# @attest/worker

The run executor. A BullMQ consumer that pulls enqueued jobs, launches an isolated browser, runs the Attest engine (`@attest/core`), and writes the resulting attestation and evidence. This is where a run actually happens; the [backend](../backend) only enqueues it.

No HTTP port. It is a long-running queue consumer.

## What a job does

1. Pull a job from the BullMQ queue and validate its payload against `@attest/contracts`.
2. Re-check the target URL against the app allowlist (the allowlist is enforced at enqueue and again here, so it cannot be widened in transit).
3. Wire the engine adapters: a Puppeteer browser, the DOM-ladder resolution adapter, the OpenRouter model client (or the org's BYOK key), and the evidence store (disk or S3).
4. Run the engine: **plan, execute, capture evidence, run five deterministic guards, then the LLM judge**, and assemble a validated attestation.
5. Write the attestation and evidence references, and stream status back so callers see the verdict.
6. When hosted billing is enabled, emit the metering inputs (model cost, browser minutes, steps) for the credit debit.

## Layout

```
src/
  index.ts         worker entry; queue subscription and lifecycle
  process-job.ts   the job handler (validate, run engine, persist)
  adapters.ts      builds the concrete engine adapters from config
  config.ts        environment parsing
  billing/         metering load + integration with the hosted layer
```

## Develop

```bash
pnpm --filter @attest/worker dev         # tsx watch, reads ../../.env
pnpm --filter @attest/worker test        # vitest
pnpm --filter @attest/worker typecheck
```

A local run needs Postgres and Redis reachable, and a Chromium that Puppeteer can launch.

## Configuration

Reads the root `.env`. Relevant blocks: `DATABASE_URL`, `REDIS_URL`, `ATTEST_KEK` (fails closed without it), the model gateway (`OPENROUTER_API_KEY`), the evidence store (`EVIDENCE_BACKEND` and its `disk` or `s3` settings), and the billing block when metering is on. See [`.env.example`](../../.env.example).

## Boundaries

- Depends on `@attest/contracts`, `@attest/core` (the engine), and `@attest/db`. `@attest/ee` is optional and present only in the hosted build.
- The engine in `@attest/core` is pure: the worker supplies every browser, model, and storage concern as an adapter. Swapping a backend (for example disk to S3) is a config change, not an engine change.
- Secrets used to drive a run are never written into evidence and never logged.
