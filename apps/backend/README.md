# @attest/backend

The Attest API. A Fastify service that is the single front door to the execution path: it authenticates callers, enforces tenancy and the URL allowlist, decrypts secrets, enqueues runs, serves run and attestation reads, and handles billing webhooks. The MCP server, dashboard, and web app all talk to it.

Runs on port **3000**.

## Contents

- [Responsibilities](#responsibilities)
- [HTTP API](#http-api)
- [Authentication](#authentication)
- [Run enqueue flow](#run-enqueue-flow)
- [Error model](#error-model)
- [Billing seam](#billing-seam)
- [Layout](#layout)
- [Develop](#develop)
- [Configuration](#configuration)
- [Boundaries](#boundaries)

## Responsibilities

- **Authentication and sessions.** BetterAuth with email/password (verified by email OTP), optional Google OAuth, and the organization plugin. Sessions are cookie-based and shared cross-subdomain with the dashboard and web app.
- **Tenancy.** Resolves the active org and (for service keys) the app scope on every request. Every data path is org-scoped; the `orgId` comes from the session or key, never the request body.
- **Allowlist enforcement.** The target URL is checked against the app allowlist at enqueue. The worker re-checks before navigating.
- **Secrets and BYOK.** Decrypts envelope-encrypted credentials and per-org model keys through `@attest/db` at enqueue. Secrets are never logged, returned, or placed in evidence.
- **Run enqueue.** Validates against `@attest/contracts`, builds the job payload, and pushes it to BullMQ.
- **Reads.** Serves run status, attestations, and evidence (metadata and raw bytes) back to clients.
- **Billing webhooks.** Verifies and ingests Dodo Payments webhooks when the hosted billing layer is enabled.

## HTTP API

Two authentication doors converge on one request context (see [Authentication](#authentication)): a **service key** (Bearer token, used by MCP) or a **session cookie** (used by the dashboard). Routes do not care which door was used.

### Runs

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| `POST` | `/runs` | either | Enqueue a run. Body `{ appId, goal, url }`. Returns `202 { runId, status: "queued" }`. |
| `GET` | `/runs` | either | List runs in the org (compact projection, no per-row attestation fetch). |
| `GET` | `/runs/:id` | either | One run with its denormalized verdict and lifecycle. |
| `GET` | `/runs/:id/attestation` | either | The full attestation document (re-validated on read). |
| `GET` | `/runs/:id/evidence` | either | The evidence index for the run (refs, kinds, content types, sizes). |

### Evidence

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| `GET` | `/evidence?ref=<storageKey>` | either | Streams raw evidence bytes. Double-gated: org-scoped lookup plus a store-level namespace check. A foreign or missing ref returns an opaque 404. |

### Management (session only)

| Method | Path | Description |
| ------ | ---- | ----------- |
| `POST` / `GET` / `PATCH` / `DELETE` | `/apps`, `/apps/:id` | Create, list, update (name, allowlist), archive apps. |
| `POST` / `GET` / `DELETE` | `/keys`, `/keys/:id` | Create a service key (plaintext returned once), list (prefix and scope only), revoke. |
| `POST` / `GET` / `DELETE` | `/model-keys`, `/model-keys/:id` | Store a BYOK OpenRouter key (sealed server-side), list safe fields, delete. |
| `POST` / `GET` / `DELETE` | `/credentials`, `/credentials/:id` | Store app login credentials (sealed), list safe fields, delete. |

### Billing

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| `GET` | `/billing/summary` | session | Plan, subscription status, balance. `enabled: false` on OSS. |
| `POST` | `/billing/checkout` | session | Start a Dodo checkout for a plan or credit pack. |
| `POST` | `/billing/portal` | session | Customer portal link. |
| `POST` | `/webhooks/dodo` | none (signed) | Inbound Dodo webhook. Verifies the Standard-Webhooks signature, dedupes by webhook id, applies the ledger effect. |

`GET /health` returns `{ status: "ok" }`.

## Authentication

`resolveContext(req)` is the single entry point used by every route. It branches on the presence of a Bearer token:

- **Service key path.** Extract the `Authorization: Bearer <token>`, hash it (SHA-256), resolve the hash to an org plus an app-id scope set, and reject if missing, revoked, or expired. Service keys are minted as `ak_live_<random>`; only the hash and a 12-char display prefix are stored. The plaintext is returned exactly once at creation.
- **Session path.** Resolve the BetterAuth session from the cookie. Reject if there is no session (401) or no active organization (403). The org comes from the session's `activeOrganizationId`.

Both paths produce one `RequestContext` of `{ orgId, appScope, principal }`. For service keys, `appScope` is a specific list of app ids and `POST /runs` rejects any `appId` outside it; for sessions, scope is "all apps in the org".

**CSRF.** A guard runs on state-changing methods. It is skipped when there is no cookie (no ambient credential to abuse) or when a Bearer token is present (service keys are never sent ambiently by a browser). For cookie-authed POST/PATCH/DELETE it requires the `Origin` (or `Referer` origin) to be in `TRUSTED_ORIGINS`.

## Run enqueue flow

`POST /runs` (`src/runs/runs.routes.ts`) → `enqueueRun` (`src/runs/enqueue.ts`):

1. Resolve context and parse the body (`{ appId, goal, url }`).
2. If the principal is a service key, fail closed unless `appId` is in its scope.
3. Fetch the app; 404 if missing or archived.
4. **Allowlist gate.** Reject with 400 if the URL is not allowed by the app's allowlist.
5. **Credit gate.** `gate.assertCanEnqueue(orgId)` (no-op on OSS; on hosted, throws `InsufficientCreditsError` → 402). Runs before any secret is opened.
6. Resolve the API key: the org's decrypted BYOK key, else the hosted default, else 400.
7. Decrypt app credentials for the app into a `{ name: value }` map.
8. Create the run row (`lifecycle: queued`).
9. Validate the job payload against `@attest/contracts` (a failure here is a 500, not a client error).
10. Enqueue on BullMQ with `attempts: 3`, exponential backoff, and `removeOnComplete`/`removeOnFail` so plaintext secrets do not linger in Redis.
11. On enqueue failure, mark the run permanently failed and return 503.

The `source` is tagged `mcp` for service keys and `dashboard` for sessions.

## Error model

`ApiError(statusCode, code, message)` is the only way routes surface 4xx. The global handler maps:

| Condition | Status |
| --------- | ------ |
| `ApiError` | its `statusCode` with `{ code, message }` |
| `InsufficientCreditsError` (ee) | 402 |
| `CheckoutUnavailableError` (ee) | 409 |
| `ZodError` / Fastify validation | 400, issue paths only (never values, which may carry secrets) |
| anything else | 500, opaque `{ code: "internal" }`; full error logged server-side |

The Fastify logger redacts `authorization`, `cookie`, and `webhook-signature`. Job data is never logged.

## Billing seam

`@attest/ee` is an optional dependency loaded by a guarded dynamic `import('@attest/ee')` (via a non-literal specifier so the OSS compiler never resolves it). Three loaders in `src/billing/load.ts` return either the real ee implementation or a no-op:

- **gate**: `assertCanEnqueue`; no-op allows everything on OSS.
- **webhook**: handles `/webhooks/dodo`; returns 404 on OSS.
- **checkout**: checkout and portal links; throws `CheckoutUnavailableError` on OSS.

With `REQUIRE_BILLING=true`, boot fails closed if ee or the Dodo config is missing, so a hosted box never runs silently free. Routes call `deps.gate` / `deps.webhook` / `deps.checkout` unconditionally; the wiring decides the behavior.

## Layout

```
src/
  index.ts           bind and listen
  app.ts             Fastify assembly + route registration
  auth/              BetterAuth setup, CSRF guard, active-org + request context
  runs/              enqueue (producer) + run reads
  evidence/          evidence byte streaming
  management/        apps / keys / model-keys / credentials routes
  billing/           Dodo webhook ingest, billing routes, ee loader
  platform/          config loader, dependency wiring, error handling
```

## Develop

```bash
pnpm --filter @attest/backend dev          # tsx watch, reads ../../.env
pnpm --filter @attest/backend test         # vitest
pnpm --filter @attest/backend typecheck
```

## Configuration

Reads the root `.env`. Required: `DATABASE_URL`, `REDIS_URL`, `ATTEST_KEK`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`. Optional: `PORT` (default 3000), `TRUSTED_ORIGINS`, `COOKIE_DOMAIN`, Google OAuth, `OPENROUTER_API_KEY` plus per-role model defaults, the `EVIDENCE_*` block, and the billing block when hosted. Full annotated list in [`.env.example`](../../.env.example).

## Boundaries

- Depends on `@attest/contracts`, `@attest/core` (types), and `@attest/db`. `@attest/ee` is optional and present only in the hosted build.
- The backend does not run browsers or the engine. It validates, enqueues, and reads; the [worker](../worker) executes.
- Every shape entering or leaving is validated against `@attest/contracts`.
