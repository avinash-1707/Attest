# Attest

Attest is a QA primitive for agents. It verifies a user outcome in a real browser and returns an evidence-backed **attestation**: a structured, goal-relative verdict (`passed` / `failed` / `inconclusive`) that an agent can loop on, not a raw action log it has to interpret.

Two entry points (an MCP server a coding agent calls, and a dashboard a human uses) drive **one** hosted, server-side execution path, so both produce the same attestation. Attest is open-core and self-hostable under Apache-2.0, with a paid hosted tier living in `ee/`.

## Why

Agents can write code but cannot reliably tell whether the result actually works for a user. Attest closes that loop:

- **Outcome-level verdicts.** A verdict is relative to a goal, never a transcript the caller must parse.
- **Machine-readable failures.** Every failure carries the failing step, a root-cause hypothesis, evidence references, and a mandatory next action.
- **Context economy.** Evidence (screenshots, DOM, console, network) is stored and returned by reference, so agents get compact verdicts.
- **Deploy anywhere.** Hosted and self-hosted run the same codebase with no functional gap in the verdict loop.
- **Trust by construction.** No source ingestion, strict tenant isolation, and encrypted secrets that are never logged or returned.

## How it works

```
agent (MCP) ─┐
             ├─▶ backend ─▶ queue ─▶ worker ─▶ attestation + evidence
human (dash) ─┘   (auth, allowlist,   (BullMQ)   (browser engine)        │
                   secrets, enqueue)                                     │
             ◀───────────────── verdict streams back ────────────────────┘
```

1. An agent (`attest goal:"…"`) or a human (dashboard "Run") triggers a run against the **backend**.
2. The backend authenticates, resolves org and app, checks the URL allowlist, decrypts secrets and BYOK keys, and enqueues a job.
3. The **worker** launches an isolated browser and runs the engine in `packages/core`: plan, execute, capture evidence, run five deterministic guards, then an LLM judge.
4. The attestation and evidence references are written, and status streams back. The agent reads the verdict and loops (fix, re-attest); the human reviews it in the dashboard.

## Repository layout

This is a pnpm + Turborepo monorepo (Node 22, TypeScript).

### Apps

| App | Port | Purpose |
| --- | ---- | ------- |
| [`apps/backend`](apps/backend) | 3000 | Fastify API: auth, tenancy, allowlist, secrets, run enqueue, evidence reads, billing webhooks. |
| [`apps/worker`](apps/worker) | n/a | BullMQ consumer that runs the browser engine and assembles attestations. |
| [`apps/mcp`](apps/mcp) | n/a | Thin MCP server an agent runs locally; forwards `attest` tools to the backend. |
| [`apps/dashboard`](apps/dashboard) | 3001 | Authenticated Next.js app: orgs, apps, keys, runs, attestations, models, BYOK, billing. |
| [`apps/web`](apps/web) | 3002 | Public Next.js landing and auth pages. |

### Packages

| Package | Purpose |
| ------- | ------- |
| `packages/contracts` | The single source of truth for every shape crossing a boundary (attestation schema, tool I/O, job payload, API types). Pure Zod. |
| `packages/core` | The engine: planner, executor, judge, guards, evidence. Transport-free and storage-free; everything external sits behind an adapter. |
| `packages/db` | Postgres schema (Drizzle), the org-scoped data-access layer, and envelope-encrypted secret storage. |
| `ee/` | Commercial hosted tier: billing, metering, gating, SSO, autoscaling. Optional; absent from the OSS build. |

## Quick start

Prerequisites: Node 22 (see `.nvmrc`), pnpm 10, a Postgres database, and a Redis instance.

```bash
pnpm install
cp .env.example .env        # fill in the required values (see below)
pnpm --filter @attest/db db:migrate
pnpm dev                    # runs all apps via turbo
```

Required environment, at minimum:

- `DATABASE_URL`, `REDIS_URL`
- `ATTEST_KEK` (base64-encoded 32-byte key encryption key; backend and worker fail closed without it)
- `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `TRUSTED_ORIGINS`
- `OPENROUTER_API_KEY` (default model gateway)

Every variable is documented inline in [`.env.example`](.env.example).

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

Scope to a single workspace with a filter, for example `pnpm --filter @attest/backend dev`.

## Builds and licensing

- **OSS build** (`ATTEST_BUILD=oss`, the default): `packages/*` plus `apps/*`, Apache-2.0, fully functional and unmetered.
- **Hosted build** (`ATTEST_BUILD=hosted`): adds `ee/`, which is source-available under a commercial license and provides billing, metering, and other hosted-only concerns.

The verdict loop is identical in both. The core is and stays pure: no transport, storage, or engine imports leak into `packages/core`, and the engine is always reached through its adapter.

## Documentation

Project documentation lives in `docs/`. Start at `docs/technical/progress-tracker.md`, which routes each kind of task to the right document.
