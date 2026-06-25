# Attest

Attest is a QA primitive for agents. It verifies a user outcome in a real browser and returns an evidence-backed **attestation**: a structured, goal-relative verdict (`passed` / `failed` / `inconclusive`) that an agent can loop on, not a raw action log it has to interpret.

Two entry points (an MCP server a coding agent calls, and a dashboard a human uses) drive **one** hosted, server-side execution path, so both produce the same attestation from the same code. Attest is open-core and self-hostable under Apache-2.0, with a paid hosted tier living in `ee/`.

## Contents

- [Why](#why)
- [How it works](#how-it-works)
- [The engine](#the-engine)
- [Repository layout](#repository-layout)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Security model](#security-model)
- [Builds and licensing](#builds-and-licensing)
- [Common commands](#common-commands)
- [Documentation](#documentation)

## Why

Agents can write code but cannot reliably tell whether the result actually works for a user. Attest closes that loop:

- **Outcome-level verdicts.** A verdict is relative to a goal, never a transcript the caller must parse. `failed` and `inconclusive` are distinct: `failed` means the app is wrong, `inconclusive` means the environment prevented a verdict (target unreachable, timeout).
- **Machine-readable failures.** Every failed attestation carries a dossier: the failing step, the reason, a root-cause hypothesis, evidence references, and a suggested next action.
- **Context economy.** Evidence (screenshots, DOM snapshots, console, network) is stored and returned by reference, so agents receive compact verdicts instead of megabytes of artifacts.
- **Deploy anywhere.** Hosted and self-hosted run the same codebase with no functional gap in the verdict loop.
- **Trust by construction.** No source ingestion, strict per-org tenant isolation, and envelope-encrypted secrets that are never logged, never written into evidence, and never returned to clients.

## How it works

```
 agent (MCP)  ─┐                         ┌──────────────┐
               ├──▶  backend  ──enqueue──▶│ Redis/BullMQ │
 human (dash) ─┘   (auth, tenancy,        └──────┬───────┘
                    allowlist, secrets,          │
                    credit gate)                 ▼
                                              worker  ──▶  packages/core engine
       ▲                                         │        (plan→execute→judge→assemble)
       │                                         ▼
       └──────── verdict + evidence refs ◀── attestation + evidence written
                  (status streams back)         (Postgres + object store)
```

1. An agent (`attest goal:"…"`) or a human (dashboard "Run") triggers a run against the **backend**.
2. The backend authenticates the caller, resolves the org and app, checks the target URL against the app allowlist, runs the credit gate (hosted only), decrypts the model key and any app credentials, validates the job payload, and enqueues it on BullMQ. Plaintext secrets ride the job in Redis only and the job is dropped the moment it completes.
3. The **worker** pulls the job, re-checks the allowlist, launches an isolated browser, and runs the engine in `packages/core`.
4. The attestation and evidence references are written to Postgres and the object store. The run lifecycle (`queued` → `running` → `completed`/`canceled`) streams back. The agent reads the verdict and loops (fix, re-attest); the human reviews it in the dashboard.

## The engine

The engine in `packages/core` is a pure, four-stage pipeline. It takes plain input plus adapters and returns a validated attestation. It has no transport, storage, or queue concerns; those are supplied by the worker as adapters.

1. **Plan.** One strong-model call turns the goal and starting URL into an ordered journey of browser actions (`goto`, `click` by intent, `type` by intent), each with optional expectations (expected URL, expected element text or role).
2. **Execute.** Each step drives the browser: it resolves intents to elements through a fallback ladder (a11y role, then text, then aria-label, then role attribute), performs the action, and captures evidence (screenshot, console delta, network delta, accessibility snapshot). A failing step can halt the run.
3. **Judge.** Five deterministic **guards** run on every step before any LLM is consulted. A guard failure is conclusive and short-circuits the LLM judge for that step. If no guard fails, the LLM decides the goal-relative verdict and, on failure, authors the root-cause hypothesis and next action. The LLM never overrides a guard.

   | Guard | Fires when |
   | ----- | ---------- |
   | `http_status` | A request returned 4xx/5xx or failed. |
   | `url_assertion` | Navigation did not reach the expected path. |
   | `element_presence` | An expected element (by role and/or text) is absent from the a11y tree. |
   | `console_error` | The browser console logged an error-level message. |
   | `page_load` | Navigation failed or the step timed out. |

   An unreachable target (DNS failure, connection refused) yields `inconclusive`, not `failed`.
4. **Assemble.** Steps, verdict, and evidence references are combined into an `Attestation` and validated against the schema in `packages/contracts` before it leaves the engine.

Everything external sits behind an adapter interface: **browser** (Puppeteer), **resolution** (DOM ladder), **model** (OpenRouter gateway, or the org's BYOK key), and **storage** (local disk or any S3-protocol bucket, R2 included). Swapping a backend is a config change, not a code change.

## Repository layout

This is a pnpm + Turborepo monorepo (Node 22, TypeScript, ESM throughout).

### Apps

| App | Port | Purpose |
| --- | ---- | ------- |
| [`apps/backend`](apps/backend) | 3000 | Fastify API: the single front door. Auth, tenancy, allowlist, secrets, run enqueue, run and evidence reads, billing webhooks. |
| [`apps/worker`](apps/worker) | n/a | BullMQ consumer that runs the browser engine, persists attestations and evidence, and meters usage. |
| [`apps/mcp`](apps/mcp) | n/a | Thin stdio MCP server an agent runs locally; exposes `attest` tools and forwards them to the backend over a service key. |
| [`apps/dashboard`](apps/dashboard) | 3001 | Authenticated Next.js app: runs, apps, keys, model keys, credentials, billing. The human entry point. |
| [`apps/web`](apps/web) | 3002 | Public Next.js site: marketing landing and the auth flow (sign-in, sign-up, email verification). |

### Packages

| Package | Purpose |
| ------- | ------- |
| `packages/contracts` | The single source of truth for every shape crossing a boundary: the `Attestation` schema (with an additive-only `schemaVersion`), tool I/O, the queue job payload, API DTOs, the allowlist matcher, and billing seam interfaces. Pure Zod, no runtime deps beyond `zod`. |
| `packages/core` | The engine: planner, executor, judge, the five guards, evidence collector, and the adapter interfaces plus their concrete implementations (Puppeteer, DOM ladder, OpenRouter, disk, S3). |
| `packages/db` | Postgres schema (Drizzle), the org-scoped data-access layer where every query is bound to one `orgId`, and envelope-encrypted secret storage (KEK wraps a per-org DEK; AES-256-GCM). |
| `ee/` | Commercial hosted tier: billing (pricing, plans, credit ledger, Dodo checkout/webhooks), metering, gating, plus SSO/org-management/autoscaling stubs. Source-available, absent from the OSS build, wired only through interface seams. |

## Quick start

Prerequisites: Node 22 (see `.nvmrc`), pnpm 10, a Postgres database, and a Redis instance.

```bash
pnpm install
cp .env.example .env                       # fill in the required values (below)
pnpm --filter @attest/db db:migrate        # apply schema
pnpm dev                                    # backend :3000, dashboard :3001, web :3002, worker
```

The worker also needs a Chromium that Puppeteer can launch. The MCP server is built and run separately (`pnpm --filter @attest/mcp build`) and wired into an agent over stdio.

## Configuration

Every variable is documented inline in [`.env.example`](.env.example). The essentials:

| Variable | Used by | Notes |
| -------- | ------- | ----- |
| `DATABASE_URL` | backend, worker, db | Postgres connection string. |
| `REDIS_URL` | backend, worker | BullMQ queue. |
| `ATTEST_KEK` | backend, worker | Base64-encoded 32-byte key-encryption key. Both services fail closed at boot if it is absent or the wrong length. |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | backend | Session signing and base URL. |
| `TRUSTED_ORIGINS` | backend | Comma-separated browser origins for CORS and the CSRF origin guard. Must include the web and dashboard origins. |
| `COOKIE_DOMAIN` | backend | Parent domain for cross-subdomain SSO (e.g. `.attest.io`) in prod. Leave unset locally. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | backend | Optional. Google sign-in is enabled only when both are set. |
| `OPENROUTER_API_KEY` | worker | Hosted default model gateway key. Optional if every org brings its own (BYOK). |
| `EVIDENCE_BACKEND` | backend, worker | `disk` (default) or `s3`, with the matching `EVIDENCE_*` settings. |
| `NEXT_PUBLIC_BACKEND_URL` / `_WEB_URL` / `_DASHBOARD_URL` | web, dashboard | Inlined at build, no secrets. |
| `BILLING_ENABLED` / `REQUIRE_BILLING` | backend, worker, ee | Off by default; the OSS build never meters or gates. `REQUIRE_BILLING=true` fails boot if `@attest/ee` or the Dodo config is missing. |
| `DODO_*` | ee | Merchant-of-record billing (webhook key, API key, product ids). Never logged. |

## Security model

The invariants the codebase enforces (full list in `docs/technical/technical-architecture.md` §12):

- **One execution path.** MCP and dashboard runs share the same job, queue, worker, and attestation. The only difference is the recorded `source` (`mcp` or `dashboard`).
- **Tenant isolation.** Every row carries `org_id`. All data access goes through `forOrg(orgId)`; there is no cross-tenant query path. The `orgId` is resolved server-side from the session or service key, never taken from the request body.
- **Secrets never leak.** Model keys and app credentials are sealed with a per-org data key (itself wrapped by the KEK), decrypted only at enqueue, carried in the job through Redis only, and scrubbed from any error message before it reaches a client. They are never logged or placed in evidence.
- **Allowlist cannot be widened.** The target URL is checked at enqueue in the backend and re-checked in the worker before navigation. An agent cannot expand it.
- **Schema validated at every boundary.** The attestation is validated on write (worker), on read (backend), and on receipt (MCP and dashboard clients). `schemaVersion` is additive-only.
- **Service keys are shown once.** A new key's plaintext is returned exactly once on creation; only its hash and a display prefix are stored.

## Builds and licensing

- **OSS build** (`ATTEST_BUILD=oss`, the default): `packages/*` plus `apps/*`, Apache-2.0, fully functional and unmetered. `@attest/ee` is absent; billing seams resolve to no-ops.
- **Hosted build** (`ATTEST_BUILD=hosted`): adds `ee/`, source-available under a commercial license, providing the credit gate, metering, and Dodo-backed checkout and webhooks.

The verdict loop is identical in both. `packages/core` stays pure (no transport, storage, or engine import), and the engine is always reached through its adapter. `@attest/ee` is loaded by a guarded dynamic import, so the OSS build never references it.

## Common commands

Run from the repo root; Turborepo fans them out across the workspace.

```bash
pnpm dev          # start all apps in watch mode
pnpm build        # build every package and app
pnpm test         # vitest across the workspace
pnpm lint         # eslint
pnpm typecheck    # tsc -b
pnpm format       # prettier --write
```

Scope to a single workspace with a filter, e.g. `pnpm --filter @attest/backend dev`. Database migrations live in `packages/db`: `pnpm --filter @attest/db db:generate` to author a migration from the schema, `db:migrate` to apply.

## Documentation

Project documentation lives in `docs/`. Start at `docs/technical/progress-tracker.md`, which routes each kind of task to the right document (architecture, technical architecture, code standards, UI context, and the product overview).
