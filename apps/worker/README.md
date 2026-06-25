# @attest/worker

The run executor. A BullMQ consumer that pulls enqueued jobs, launches an isolated browser, runs the Attest engine (`@attest/core`), persists the attestation and evidence, and meters usage. This is where a run actually happens; the [backend](../backend) only enqueues it.

No HTTP port. It is a long-running queue consumer.

## Contents

- [Lifecycle](#lifecycle)
- [Job processing](#job-processing)
- [Retry policy](#retry-policy)
- [Metering](#metering)
- [Adapters](#adapters)
- [Secret handling](#secret-handling)
- [Layout](#layout)
- [Develop](#develop)
- [Configuration](#configuration)
- [Boundaries](#boundaries)

## Lifecycle

`src/index.ts`:

1. Load config (database, Redis, evidence backend, concurrency, optional model gateway override).
2. Connect to Postgres and build the org-scoped data-access layer.
3. Build the adapter factory (`src/adapters.ts`), which produces the concrete engine adapters per job.
4. Load the billing meter (no-op on OSS; fails closed on hosted if billing is required but `@attest/ee` is absent).
5. Create a BullMQ `Worker` on the `attest-runs` queue with the configured concurrency. The job handler is `processRunJob`.
6. Install SIGTERM/SIGINT handlers that drain the worker and close Redis and Postgres.

The error listener logs the failure signal only; it never logs `job.data` (which carries plaintext secrets).

## Job processing

`src/process-job.ts`, per job:

1. **Parse** the payload against `@attest/contracts`. A malformed payload is an `UnrecoverableError` (no retry); the parse-error detail names field paths only, never values.
2. **Fetch the app.** If it no longer exists, fail the run permanently.
3. **Re-check the allowlist.** Defense in depth: the backend already checked at enqueue, but the worker re-checks before navigating so an allowlist can never be widened in transit. A miss fails the run permanently.
4. **Mark running**, and bump the attempt counter if this is a retry.
5. **Run the engine** with the wired adapters. The engine returns `{ attestation, meter }`.
6. **Resolve:** persist the attestation, write evidence rows (idempotent on storage key), mark the run completed with its duration.
7. **Meter** the run (unless inconclusive).

## Retry policy

The worker distinguishes three outcomes and routes them to BullMQ accordingly:

| Outcome | Behavior |
| ------- | -------- |
| Malformed payload, app not found, URL off-allowlist | `UnrecoverableError` → reject immediately, run failed permanently. |
| Engine returned `inconclusive` (environment failure: unreachable, timeout) | If retry budget remains, `EnvironmentRetryError` → retry with backoff. On the final attempt, resolve the run as inconclusive with a reason (never leave the caller hanging). |
| Worker fault (Chromium crash, adapter throw) | Retry until the budget is spent. On the final attempt, record the (redacted) error on the run and rethrow so BullMQ marks the job failed. |

Budget comes from the job's `attempts` (3, set at enqueue). `isFinal = attemptsMade + 1 >= maxAttempts` decides retry-versus-resolve.

## Metering

After a conclusive verdict (`passed` or `failed`, never `inconclusive`), the worker calls `meter.recordAndDebit` with the run's `browserMinutes`, `steps`, and gateway-reported `modelCostUsd`, plus the `byok` flag. The meter is idempotent on `runId`, so a BullMQ re-delivery converges instead of double-charging. On OSS the meter is a no-op. For BYOK runs the model cost is zeroed downstream (it landed on the user's own OpenRouter account). Inconclusive runs are not charged: the user got no verdict.

## Adapters

`src/adapters.ts` is the only place concrete engine SDKs are imported. It builds:

- **browser**: Puppeteer, a fresh isolated context per run.
- **resolution**: the DOM-ladder resolver (a11y role → text → aria-label → role attribute).
- **model**: the OpenRouter client, built per job because it carries that run's API key (BYOK or hosted default).
- **storage**: selected once from config: local disk or any S3-protocol bucket (R2-compatible).

The browser and resolution adapters are shared across jobs; the model client is per-job to keep keys from leaking between runs.

## Secret handling

The job payload carries the plaintext model key and app credentials (decrypted by the backend at enqueue). The worker:

- never logs `job.data`;
- redacts known secrets from any error string before writing it to the run's `error` field or surfacing it;
- never writes secrets into evidence.

## Layout

```
src/
  index.ts         queue subscription, concurrency, lifecycle
  process-job.ts   the job handler (validate, recheck allowlist, run, persist, meter)
  adapters.ts      builds concrete engine adapters from config
  config.ts        environment parsing
  billing/         metering load + hosted integration
```

## Develop

```bash
pnpm --filter @attest/worker dev           # tsx watch, reads ../../.env
pnpm --filter @attest/worker test          # vitest
pnpm --filter @attest/worker typecheck
```

A local run needs Postgres and Redis reachable and a Chromium Puppeteer can launch.

## Configuration

Reads the root `.env`: `DATABASE_URL`, `REDIS_URL`, `ATTEST_KEK` (fails closed without it), `OPENROUTER_API_KEY` and optional per-role model defaults, the `EVIDENCE_*` block (`disk` or `s3`), worker concurrency, and the billing block when metering is on. See [`.env.example`](../../.env.example).

## Boundaries

- Depends on `@attest/contracts`, `@attest/core`, and `@attest/db`. `@attest/ee` is optional, hosted-only.
- The engine in `@attest/core` is pure; the worker supplies every browser, model, and storage concern as an adapter.
- All database access is org-scoped via `dal.forOrg(orgId)`.
