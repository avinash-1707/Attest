import type { FastifyInstance } from 'fastify';
import type { BackendDeps } from '../deps';
import { resolveContext } from '../context';
import { ApiError } from '../errors';

// GET /evidence?ref=<storageKey> - streams the raw bytes for an opaque evidence ref. The ref carries
// slashes (org/app/kind/id.ext), so it travels as a query param. Resolution is double-gated: the DAL
// lookup is org-scoped (a foreign ref does not resolve) and the store re-checks the ref's namespace
// against {orgId, appId} [invariant 3]. Any miss/denial is an opaque 404 - never leak which.
export function registerEvidenceRoutes(app: FastifyInstance, deps: BackendDeps): void {
  app.get<{ Querystring: { ref?: string } }>('/evidence', async (req, reply) => {
    const ctx = await resolveContext(req, deps);
    const ref = req.query.ref;
    if (!ref) throw new ApiError(400, 'invalid_request', 'Missing ref');

    const row = await deps.dal.forOrg(ctx.orgId).evidence.getByStorageKey(ref);
    if (!row) throw new ApiError(404, 'evidence_not_found', 'Evidence not found');

    let blob: Buffer;
    try {
      blob = await deps.store.get({ orgId: ctx.orgId, appId: row.appId }, ref);
    } catch {
      throw new ApiError(404, 'evidence_not_found', 'Evidence not found');
    }

    reply
      .header('content-type', row.contentType ?? 'application/octet-stream')
      .header('cache-control', 'private, max-age=300');
    return reply.send(blob);
  });
}
