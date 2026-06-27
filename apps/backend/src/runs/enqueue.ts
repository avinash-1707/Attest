import type { Queue } from 'bullmq';
import {
  RUN_JOB,
  MAX_RUN_ATTEMPTS,
  RUN_BACKOFF_MS,
  isUrlAllowed,
  jobPayload,
  InsufficientCreditsError,
  type AgentRole,
  type Source,
  type BillingGate,
} from '@attest/contracts';
import { genId, type DataAccess, type OrgScope, type SecretCipher, type OrgCipher } from '@attest/db';
import { ApiError } from '../platform/errors';

// The run-enqueue producer: the one path that turns an authenticated request into a queued job
// [arch §4.1, tech-arch §5]. It is also the only place backend-side where a decrypted secret exists
// (between open() and the payload), and the primary allowlist gate [invariant 4, 7].

export interface EnqueueInput {
  appId: string;
  goal: string;
  url: string;
  source: Source;
}

export interface EnqueueDeps {
  dal: DataAccess;
  cipher: SecretCipher;
  queue: Queue;
  // Per-role OpenRouter model ids applied to every run (MVP: no per-app model choice) [tech-arch §3.3].
  modelDefaults: Record<AgentRole, string>;
  // Hosted-default OpenRouter key, used when an org has no BYOK model key [arch §7.2].
  hostedApiKey?: string;
  // Credit gate; no-op in the OSS build, throws InsufficientCreditsError when hosted + over budget.
  gate: BillingGate;
}

export async function enqueueRun(
  ctx: { orgId: string },
  input: EnqueueInput,
  deps: EnqueueDeps,
): Promise<{ runId: string; status: 'queued' }> {
  const org = deps.dal.forOrg(ctx.orgId);

  const app = await org.apps.get(input.appId);
  if (!app || app.archivedAt) throw new ApiError(404, 'app_not_found', 'App not found');

  // Primary allowlist gate; the worker re-checks at navigation for defense in depth [tech-arch §7.4].
  if (!isUrlAllowed(input.url, app.allowlist)) {
    throw new ApiError(400, 'url_not_allowed', 'Target URL is not in the app allowlist');
  }

  const models = deps.modelDefaults;
  // Mint the runId up front so the credit gate can reserve a hold against it BEFORE any row is written
  // [audit 2026-06-27 H7]. A denied gate rolls its hold back and we never create a row; once reserved,
  // any later failure compensates by releasing the hold (and canceling the row if it was created).
  const runId = genId('run');
  let reserved = false;
  try {
    // Credit gate before any secret is opened [tech-arch §13.4]. No-op in the OSS build. In the hosted
    // build it reserves the run's estimated cost so concurrent enqueues can't all pass on one stale
    // balance; throws InsufficientCreditsError -> 402.
    await deps.gate.assertCanEnqueue(ctx.orgId, runId);
    reserved = true;

    // Open secrets server-side; plaintext lives only in these locals + the payload [arch §10, §6.1].
    const cipher = deps.cipher.for(ctx.orgId);
    const { apiKey, byok } = await resolveApiKey(org, cipher, deps.hostedApiKey);
    const credentials = await resolveCredentials(org, cipher, input.appId);

    await org.runs.create({
      id: runId,
      appId: input.appId,
      source: input.source,
      goal: input.goal,
      url: input.url,
      modelSnapshot: models,
    });

    // Validate at the boundary before enqueue [invariant 6].
    const payload = jobPayload.parse({
      runId,
      orgId: ctx.orgId,
      appId: input.appId,
      source: input.source,
      goal: input.goal,
      url: input.url,
      modelConfig: { models, apiKey },
      credentials: Object.keys(credentials).length > 0 ? credentials : undefined,
      byok,
    });

    // The options object is load-bearing: the worker reads job.opts.attempts to run its §7.5 retry
    // gate. Omitting attempts/backoff silently collapses environment-failure retries to none.
    await deps.queue.add(RUN_JOB, payload, {
      jobId: runId,
      attempts: MAX_RUN_ATTEMPTS,
      backoff: { type: 'exponential', delay: RUN_BACKOFF_MS },
      // The payload carries decrypted secrets [job.ts]. Drop the job once terminal so plaintext does
      // not linger in Redis [invariant 4]; the run outcome lives on the attestation + run.error.
      removeOnComplete: true,
      removeOnFail: true,
    });
  } catch (err) {
    // The gate threw before reserving anything (e.g. insufficient credits): no hold, no row, nothing to
    // compensate. Surface the typed error (-> 402) directly.
    if (!reserved) throw err;
    // Past the gate: a hold exists (hosted) and the row may exist. failPermanently releases the hold and
    // cancels the row if present, so a failed enqueue never strands a queued row or a dangling hold.
    await org.runs.failPermanently(runId, 'enqueue failed').catch(() => undefined);
    if (err instanceof ApiError || err instanceof InsufficientCreditsError) throw err;
    throw new ApiError(503, 'enqueue_unavailable', 'Failed to enqueue run; retry shortly');
  }

  return { runId, status: 'queued' };
}

// BYOK key if the org has one, else the hosted default. The model id (which model) is separate from
// the key (whose budget) and comes from modelDefaults.
async function resolveApiKey(
  org: OrgScope,
  cipher: OrgCipher,
  hostedApiKey?: string,
): Promise<{ apiKey: string; byok: boolean }> {
  const [key] = await org.modelKeys.list();
  if (key) return { apiKey: await cipher.open(key.ciphertext), byok: true };
  if (hostedApiKey) return { apiKey: hostedApiKey, byok: false };
  throw new ApiError(400, 'model_key_required', 'No model key configured; add a BYOK key or set OPENROUTER_API_KEY');
}

// App credentials opened into a flat name -> value map [contract: jobPayload.credentials]. Absent =
// no credentials sent.
async function resolveCredentials(org: OrgScope, cipher: OrgCipher, appId: string): Promise<Record<string, string>> {
  const rows = await org.appCredentials.list({ appId });
  const out: Record<string, string> = {};
  for (const row of rows) out[row.name] = await cipher.open(row.ciphertext);
  return out;
}
