# @attest/backend

The Attest API. A Fastify service that is the single front door to the execution path: it authenticates callers, enforces tenancy and the URL allowlist, decrypts secrets, enqueues runs, serves run and attestation reads, and handles billing webhooks. The MCP server, dashboard, and web app all talk to it.

Runs on port **3000**.

## Responsibilities

- **Authentication and sessions.** BetterAuth (email/password plus optional Google OAuth), with cross-subdomain cookie sessions shared with the dashboard and web app.
- **Tenancy.** Resolves the active org and app on every request; every data path is org-scoped so there is no cross-tenant query.
- **Allowlist enforcement.** The target URL is checked against the app allowlist at enqueue time and re-checked in the worker. An agent cannot widen it.
- **Secrets and BYOK.** Reads envelope-encrypted credentials and per-agent model keys through `@attest/db`. Secrets are never logged, never returned to clients, and never placed in evidence.
- **Run enqueue.** Validates the request against `@attest/contracts`, builds the job payload, and pushes it to the BullMQ queue.
- **Reads.** Serves run status, attestations, and evidence references back to clients.
- **Billing webhooks.** Verifies and ingests Dodo Payments webhooks (credit grants) when the hosted billing layer is enabled.

## Layout

```
src/
  index.ts           service entry (binds and listens)
  app.ts             Fastify app assembly and route registration
  auth/              BetterAuth setup, CSRF, active-org + request context
  management/        org / app / key management routes
  runs/              run enqueue + run reads
  evidence/          evidence reference reads
  billing/           Dodo webhook ingest + billing routes (hosted)
  platform/          config, dependency wiring, error handling
```

## Develop

```bash
pnpm --filter @attest/backend dev        # tsx watch, reads ../../.env
pnpm --filter @attest/backend test       # vitest
pnpm --filter @attest/backend typecheck
```

## Configuration

Reads the root `.env`. The variables this service needs: `DATABASE_URL`, `REDIS_URL`, `ATTEST_KEK`, the BetterAuth block (`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `TRUSTED_ORIGINS`, optional Google OAuth and `COOKIE_DOMAIN`), the evidence-store block, and, when hosted billing is on, the Dodo block. See [`.env.example`](../../.env.example) for the full annotated list.

## Boundaries

- Depends on `@attest/contracts` (boundary shapes), `@attest/core` (types), and `@attest/db` (data access and secrets). `@attest/ee` is an optional dependency, present only in the hosted build.
- The backend does not run browsers or the engine. It validates, enqueues, and reads; the [worker](../worker) executes.
- Every shape entering or leaving the service is validated against `@attest/contracts`.
