import type { Queue } from 'bullmq';
import {
  RUN_JOB,
  MAX_RUN_ATTEMPTS,
  RUN_BACKOFF_MS,
  isUrlAllowed,
  jobPayload,
  type AgentRole,
  type Source,
  type BillingGate,
} from '@attest/contracts';
import type { DataAccess, OrgScope, SecretCipher, OrgCipher } from '@attest/db';
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

  // Credit gate: a hosted org must be able to cover the run before any secret is opened or row written
  // [tech-arch §13.4]. No-op in the OSS build. Throws InsufficientCreditsError -> mapped to 402.
  await deps.gate.assertCanEnqueue(ctx.orgId);

  // Open secrets server-side; plaintext lives only in these locals + the payload [arch §10, §6.1].
  const cipher = deps.cipher.for(ctx.orgId);
  const { apiKey, byok } = await resolveApiKey(org, cipher, deps.hostedApiKey);
  const credentials = await resolveCredentials(org, cipher, input.appId);

  const models = deps.modelDefaults;
  const run = await org.runs.create({
    appId: input.appId,
    source: input.source,
    goal: input.goal,
    url: input.url,
    modelSnapshot: models,
  });

  // Validate at the boundary before enqueue [invariant 6]. A failure here is our assembly bug (500),
  // never the client's.
  const payload = jobPayload.parse({
    runId: run.id,
    orgId: ctx.orgId,
    appId: input.appId,
    source: input.source,
    goal: input.goal,
    url: input.url,
    modelConfig: { models, apiKey },
    credentials: Object.keys(credentials).length > 0 ? credentials : undefined,
    byok,
  });

  try {
    // The options object is load-bearing: the worker reads job.opts.attempts to run its §7.5 retry
    // gate. Omitting attempts/backoff silently collapses environment-failure retries to none.
    await deps.queue.add(RUN_JOB, payload, {
      jobId: run.id,
      attempts: MAX_RUN_ATTEMPTS,
      backoff: { type: 'exponential', delay: RUN_BACKOFF_MS },
      // The payload carries decrypted secrets [job.ts]. Drop the job once terminal so plaintext does
      // not linger in Redis [invariant 4]; the run outcome lives on the attestation + run.error.
      removeOnComplete: true,
      removeOnFail: true,
    });
  } catch {
    // Compensate so a Redis blip never strands a 'queued' row with no job behind it.
    await org.runs.failPermanently(run.id, 'enqueue failed').catch(() => undefined);
    throw new ApiError(503, 'enqueue_unavailable', 'Failed to enqueue run; retry shortly');
  }

  return { runId: run.id, status: 'queued' };
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
