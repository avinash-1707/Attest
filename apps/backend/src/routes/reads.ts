import type { FastifyInstance } from 'fastify';
import { runStatusView, runList, runListItem, evidenceList, evidenceRefView } from '@attest/contracts';
import type { BackendDeps } from '../deps';
import { resolveContext } from '../context';
import { ApiError } from '../errors';

// Read API [tech-arch §2.2 #5]. All reads go through dal.forOrg(ctx.orgId) so a caller only ever sees
// its own org's rows [invariant 3]; every response is re-validated against its DTO on the way out.
export function registerReadRoutes(app: FastifyInstance, deps: BackendDeps): void {
  // History listing. One query (runs.list); the verdict is deliberately omitted here (status:null) to
  // avoid an attestation fetch per row - the verdict is on the detail endpoint. lifecycle conveys
  // queued/running/completed/canceled for the list.
  app.get('/runs', async (req) => {
    const ctx = await resolveContext(req, deps);
    const runs = await deps.dal.forOrg(ctx.orgId).runs.list({ limit: 100 });
    return runList.parse({
      runs: runs.map((r) =>
        runListItem.parse({
          runId: r.id,
          appId: r.appId,
          goal: r.goal,
          lifecycle: r.lifecycle,
          status: null,
          createdAt: r.createdAt.toISOString(),
          durationMs: r.durationMs ?? null,
        }),
      ),
    });
  });

  // Run status: operational lifecycle + the verdict (from the attestation, null until written).
  app.get<{ Params: { id: string } }>('/runs/:id', async (req) => {
    const ctx = await resolveContext(req, deps);
    const org = deps.dal.forOrg(ctx.orgId);
    const run = await org.runs.get(req.params.id);
    if (!run) throw new ApiError(404, 'run_not_found', 'Run not found');
    const attestation = await org.attestations.getByRun(run.id);
    return runStatusView.parse({
      runId: run.id,
      appId: run.appId,
      source: run.source,
      goal: run.goal,
      url: run.url,
      lifecycle: run.lifecycle,
      status: attestation?.status ?? null,
      attempt: run.attempt,
      createdAt: run.createdAt.toISOString(),
      startedAt: run.startedAt?.toISOString() ?? null,
      finishedAt: run.finishedAt?.toISOString() ?? null,
      durationMs: run.durationMs ?? null,
      error: run.error ?? null,
    });
  });

  // The full attestation. The DAL zod-validates on read [tech-arch §2.2 #5], so it is returned as-is.
  app.get<{ Params: { id: string } }>('/runs/:id/attestation', async (req) => {
    const ctx = await resolveContext(req, deps);
    const attestation = await deps.dal.forOrg(ctx.orgId).attestations.getByRun(req.params.id);
    if (!attestation) throw new ApiError(404, 'attestation_not_found', 'No attestation for this run');
    return attestation;
  });

  // Evidence index for a run: metadata + a fetch url per ref. Bytes are served by GET /evidence
  // (never inlined) [arch §8 G5].
  app.get<{ Params: { id: string } }>('/runs/:id/evidence', async (req) => {
    const ctx = await resolveContext(req, deps);
    const rows = await deps.dal.forOrg(ctx.orgId).evidence.listForRun(req.params.id);
    return evidenceList.parse({
      evidence: rows.map((e) =>
        evidenceRefView.parse({
          ref: e.storageKey,
          kind: e.kind,
          stepIndex: e.stepIndex ?? null,
          contentType: e.contentType ?? null,
          bytes: e.bytes ?? null,
          url: `/evidence?ref=${encodeURIComponent(e.storageKey)}`,
        }),
      ),
    });
  });
}
