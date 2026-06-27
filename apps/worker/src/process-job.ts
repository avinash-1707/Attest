import { UnrecoverableError } from 'bullmq';
import {
  jobPayload,
  isUrlAllowed,
  type JobPayload,
  type Attestation,
  type RunStatus,
  type BillingMeter,
} from '@attest/contracts';
import type { RunInput, RunResult } from '@attest/core';
import type { DataAccess, NewEvidence } from '@attest/db';

// Thrown to let BullMQ retry an environment failure with backoff [tech-arch §7.5]. A plain Error (not
// UnrecoverableError) so the queue's attempt budget governs the retry.
export class EnvironmentRetryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvironmentRetryError';
  }
}

export interface JobContext {
  dal: DataAccess;
  // 0-based count of prior attempts (BullMQ job.attemptsMade at processing time).
  attemptsMade: number;
  // The job's total attempt budget (BullMQ job.opts.attempts), normally MAX_RUN_ATTEMPTS.
  maxAttempts: number;
  // Adapter-wired engine entrypoint; injected so this handler stays free of puppeteer/openai/db drivers.
  run: (input: RunInput, job: JobPayload) => Promise<RunResult>;
  // Run-completion meter: writes the UsageEvent + credit debit on a resolved run. No-op in the OSS
  // build [tech-arch §13.2].
  meter: BillingMeter;
}

export type JobResult = { status: RunStatus };

// Parses the issue paths only - never the received values, which may carry secrets [invariant 4].
function describeParseFailure(err: unknown): string {
  if (err && typeof err === 'object' && 'issues' in err && Array.isArray((err as { issues: unknown[] }).issues)) {
    const paths = (err as { issues: { path: (string | number)[] }[] }).issues
      .map((i) => i.path.join('.') || '(root)')
      .join(', ');
    return `invalid job payload at: ${paths}`;
  }
  return 'invalid job payload';
}

function evidenceRows(job: JobPayload, att: Attestation): NewEvidence[] {
  return [
    ...att.evidence.screenshotRefs.map(
      (storageKey): NewEvidence => ({ appId: job.appId, runId: job.runId, kind: 'screenshot', storageKey }),
    ),
    ...att.evidence.domSnapshotRefs.map(
      (storageKey): NewEvidence => ({ appId: job.appId, runId: job.runId, kind: 'dom_snapshot', storageKey }),
    ),
  ];
}

// One run, end to end: parse -> allowlist re-check -> execute -> persist, with the §7.5 retry policy.
// Throwing routes to BullMQ: UnrecoverableError = reject (no retry), EnvironmentRetryError = retry,
// any other throw = worker fault (retried until the budget is spent). Returning = run resolved.
export async function processRunJob(raw: unknown, ctx: JobContext): Promise<JobResult> {
  let job: JobPayload;
  try {
    job = jobPayload.parse(raw);
  } catch (err) {
    throw new UnrecoverableError(describeParseFailure(err));
  }

  const org = ctx.dal.forOrg(job.orgId);
  const isFinal = ctx.attemptsMade + 1 >= ctx.maxAttempts;

  const app = await org.apps.get(job.appId);
  if (!app) {
    await org.runs.failPermanently(job.runId, 'app not found in org');
    throw new UnrecoverableError('app not found in org');
  }

  // Defense in depth: the backend already checked this at enqueue, but a confused/adversarial agent
  // must not be able to navigate off the allowlist [tech-arch §7.4, invariant 7].
  if (!isUrlAllowed(job.url, app.allowlist)) {
    await org.runs.failPermanently(job.runId, 'navigation target not in allowlist');
    throw new UnrecoverableError('navigation target not in allowlist');
  }

  // Claim the run; guarded against terminal states so a stale re-delivery of an already-resolved run is
  // not re-executed (which could flip a canceled run to completed) [audit 2026-06-27 H4].
  const claimed = await org.runs.markRunning(job.runId);
  if (!claimed) {
    const status = await org.attestations.statusByRun(job.runId);
    return { status: status ?? 'inconclusive' };
  }
  // The attempt column counts environment-failure retries, not total executions: bump only on a
  // re-execution [tech-arch §7.5].
  if (ctx.attemptsMade > 0) await org.runs.incrementAttempt(job.runId);

  const input: RunInput = {
    runId: job.runId,
    orgId: job.orgId,
    appId: job.appId,
    source: job.source,
    goal: job.goal,
    url: job.url,
    allowlist: app.allowlist,
  };

  let runOut: RunResult;
  try {
    runOut = await ctx.run(input, job);
  } catch (err) {
    // Worker fault (Chromium crash, adapter throw) [tech-arch §5.1, §5.2]. Retry until the budget is
    // spent; on the final attempt resolve the run so the caller is never left hanging.
    if (!isFinal) throw err;
    await org.runs.failPermanently(job.runId, summarize(err, job));
    throw err;
  }
  const att = runOut.attestation;

  // Environment failure: retry with backoff before surfacing inconclusive [tech-arch §7.5].
  if (att.status === 'inconclusive' && !isFinal) {
    throw new EnvironmentRetryError('environment failure, retrying');
  }

  // Validated on write [tech-arch §2.2 #4]; keyed by runId so a re-delivery overwrites, never duplicates.
  await org.attestations.save(job.runId, att);
  const rows = evidenceRows(job, att);
  if (rows.length) await org.evidence.createMany(rows);
  // Record why a run ended inconclusive after the retry budget so the operational reason isn't lost
  // (the lifecycle is still `completed` - the run did resolve) [tech-arch §7.5].
  if (att.status === 'inconclusive') {
    await org.runs.setError(job.runId, 'inconclusive after retry budget exhausted');
  }
  await org.runs.markCompleted(job.runId, { durationMs: att.durationMs });

  // Meter the resolved run: UsageEvent + credit debit, idempotent on runId so a re-delivery converges
  // [tech-arch §13.2]. No-op in the OSS build. Runs last; if it throws, the job retries and the
  // idempotent writes converge rather than double-charging. An `inconclusive` run (environment failure,
  // target unreachable) consumed resources but gave the user no verdict, so it is NOT billed - only a
  // passed/failed verdict charges. byok is snapshotted at enqueue (job.byok), not re-read here.
  if (att.status !== 'inconclusive') {
    await ctx.meter.recordAndDebit({
      orgId: job.orgId,
      appId: job.appId,
      runId: job.runId,
      browserMinutes: runOut.meter.browserMinutes,
      steps: runOut.meter.steps,
      modelCostUsd: runOut.meter.modelCostUsd,
      byok: job.byok,
    });
  }

  return { status: att.status };
}

// Operational error summary for run.error, which IS surfaced to clients - so any secret an adapter may
// have interpolated into its message is redacted first [invariant 4].
function summarize(err: unknown, job: JobPayload): string {
  const raw = err instanceof Error ? `${err.name}: ${err.message}` : 'worker fault';
  return redactSecrets(raw, job);
}

function redactSecrets(text: string, job: JobPayload): string {
  let out = text;
  const secrets = [job.modelConfig.apiKey, ...Object.values(job.credentials ?? {})];
  for (const secret of secrets) {
    if (secret) out = out.split(secret).join('[redacted]');
  }
  return out;
}
