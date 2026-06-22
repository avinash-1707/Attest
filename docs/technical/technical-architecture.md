# Attest - Technical Architecture

|                   |                                                                                                                  |
| ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Project**       | Attest                                                                                                           |
| **Document type** | Technical Architecture (implementation-facing)                                                                   |
| **Status**        | Draft v1.0                                                                                                       |
| **Last updated**  | June 2026                                                                                                        |
| **Scope**         | *How* the system is built: package dependency rules, adapter contracts, runtime behavior, error handling, config, testing, build/deploy, observability. |

## How this document relates to the others

This doc is the **implementation companion** to the system-design doc. Read it after the foundational docs, not instead of them. Strict separation of concerns:

| Document | Owns | Does **not** cover |
| -------- | ---- | ------------------ |
| `foundational/prd.md` | *Why* - product, users, market, roadmap, success metrics | Any implementation detail |
| `foundational/architecture.md` | *What* - monorepo layout, services, data flow, the attestation contract, multi-tenancy, infra topology, tech-stack choices | Concrete code-level rules, runtime semantics |
| **`technical/technical-architecture.md`** (this) | *How* - package import rules, adapter interface signatures, error/retry/timeout semantics, config surface, secret handling at runtime, testing strategy, deploy topology, observability, resolved open questions | Product rationale (PRD), high-level system design (arch doc) |
| `technical/code-standards.md` | Coding conventions: TS rules, framework patterns, naming, file organization | Architecture |
| `technical/ai-workflow-rules.md` | How an agent/contributor builds against these specs | Architecture |
| `technical/project-overview.md` | One-page technical orientation + doc index | Deep detail |

When this doc and `architecture.md` appear to overlap, `architecture.md` is canonical for *structure* (what exists), and this doc is canonical for *behavior and rules* (how it acts and how code may depend on it). Anchors below cite the arch doc as `[arch §N]`.

---

## Tech stack (locked)

Concretizes the interface choices in `[arch §12]`. Install everything by command (`pnpm add ...`), never pin by hand-editing package.json, so the latest compatible version is pulled.

| Concern | Choice | Notes |
| ------- | ------ | ----- |
| Language | TypeScript (strict) | all packages and apps |
| Runtime | Node.js 22 LTS (dev on v22.18.0) | pin via `.nvmrc` + `engines` |
| Package manager | pnpm 10.33.2 | pnpm workspaces |
| Monorepo task runner | Turborepo | task graph, caching, `dev`/`build`/`test`/`lint` pipelines |
| Frontend (`apps/web`, `apps/dashboard`) | Next.js | `web` = landing+auth, `dashboard` = authenticated app |
| Backend HTTP (`apps/backend`) | Fastify | API front door `[arch §3.3]` |
| DB access (`packages/db`) | Drizzle ORM + Postgres | tenant-scoped data layer `[arch §5]`; migrations via Drizzle Kit |
| Object storage | Cloudflare R2 (hosted) / local disk (self-hosted) | behind the `EvidenceStore` interface `[arch §9]`; R2 is S3-compatible |
| Queue | BullMQ (Redis) | `[arch §12]` |
| Auth | BetterAuth | sessions + OAuth `[arch §6.1]` |
| Validation | zod | `packages/contracts`, every boundary `[tech-arch §2.2]` |
| Browser engine | Chromium via Puppeteer/CDP | behind `adapters/browser` `[tech-arch §3.1]` |
| Element resolution | Stagehand (MIT) | behind `adapters/resolution` `[tech-arch §3.2]` |
| Models | OpenRouter gateway; per-agent model choice + BYOK | behind `adapters/model` `[tech-arch §3.3]`; one OpenAI-compatible API, every provider |
| Tests | Vitest | all tiers `[tech-arch §9]` |
| Lint / format | ESLint (incl. `no-restricted-imports` `[tech-arch §1.3]`) + Prettier | CI-enforced |
| Payments (`ee/`) | Dodo Payments (Merchant of Record) | `dodopayments` TS SDK; subscriptions + one-time credit packs; handles global tax `[tech-arch §13]` |
| Logging | pino | structured, tenant-tagged, no secrets `[tech-arch §11]`; pairs with Fastify |
| Secret encryption | Node `crypto` AES-256-GCM, envelope | app-side envelope `[tech-arch §6.2]` |
| KEK store (MVP) | env-sourced KEK, both hosted and self-hosted | behind a swappable `KeyProvider` interface; see §6.2 |

**Why not Cloudflare (ruled out, verified June 2026):** Cloudflare Secrets Store cannot serve this. Its REST API never returns a secret value (read responses omit `value` by design); runtime value access is Workers-binding only, so a Fastify/Node backend on a VM/container has no path to fetch the KEK. It is also still open beta, and Cloudflare has no AWS-KMS-style server-side wrap/unwrap API. Sources confirmed against current Cloudflare docs.

**Deferred (post-MVP, non-breaking behind `KeyProvider`):** a server-side wrap/unwrap KMS so the KEK never enters app memory: HashiCorp Vault Transit (cloud-agnostic, fits self-hosting) or AWS/GCP KMS. Adopt before scale; the env-key MVP keeps the interface and call sites identical.

Bundled with the above, no separate decision: **Drizzle Kit** (migrations), **ioredis** (BullMQ's Redis client), native SSE (no lib) for live run streaming `[tech-arch §7.2]`, Node `crypto` for encryption.

---

## 1. Package topology & dependency rules

The monorepo layout is defined in `[arch §2]`. This section adds the **dependency rules** - what may import what. These are enforced, not advisory (see §1.3).

### 1.1 Allowed dependency direction

```
                 ┌─────────────────────────────────────────┐
                 │              packages/contracts            │  ← depends on nothing (only zod)
                 └─────────────────────────────────────────┘
                       ▲            ▲            ▲
                       │            │            │
        ┌──────────────┘     ┌──────┘      ┌─────┘
        │                    │             │
 ┌────────────┐      ┌──────────────┐      │
 │ packages/db │◀─────│ packages/core │      │   core may read contracts; never db
 └────────────┘      └──────────────┘      │   (core is transport- and storage-free)
        ▲                    ▲             │
        │                    │             │
 ┌──────┴────────────────────┴─────────────┴──────┐
 │  apps/backend   apps/worker   apps/dashboard    │   apps may import any package
 │  apps/web       apps/mcp                          │   apps NEVER import each other
 └───────────────────────────────────────────────┘
        ▲
        │
 ┌──────┴───────┐
 │     ee/       │   ee/ may import packages + wire into interfaces; apps load ee/ behind interfaces
 └──────────────┘
```

### 1.2 The rules

1. **`packages/contracts` depends on nothing** except `zod`. It is the root of the graph. A change here recompiles every consumer - that is the point `[arch §2, §8]`.
2. **`packages/core` is transport-free and storage-free.** It may import `contracts`. It may **not** import `db`, any `apps/*`, HTTP libraries, the queue client, or the MCP SDK. Core receives plain inputs and returns plain `contracts` objects. This is what makes it unit-testable without infrastructure `[arch §2]`.
3. **`packages/db` may import `contracts`** (for DTO/row mapping). It may not import `core` or any app.
4. **`apps/*` may import any `packages/*` and (in the hosted build) `ee/*`.** Apps **must not import each other** - they communicate only over the network boundaries defined in `[arch §3]`.
5. **`ee/*` may import `packages/*`** and is wired into apps **only through interfaces** (auth, storage, queue, browser pool, billing, metering). No app contains an `import` from `ee/` outside an interface-resolution seam `[arch §2, §11]`.
6. **Adapters in `core/adapters/*` define interfaces; concrete engine imports (Puppeteer, Stagehand, model SDKs) live only inside their adapter implementation** - never in planner/executor/judge `[arch §1.3]`.

### 1.3 Enforcement

- TypeScript **project references** + per-package `tsconfig` `paths` make illegal imports fail to resolve.
- An ESLint `no-restricted-imports` ruleset encodes the matrix above (e.g. `core` forbids `^@attest/db`, `^puppeteer`, `^@modelcontextprotocol`). CI fails on violation.
- The OSS build (`[arch §2]`) compiles `packages/` + `apps/` with `ee/` **absent**; interface defaults stand in. If any app fails to compile without `ee/`, an interface leaked - that is a build break, by design.

### 1.4 Build configurations

| Build | Compiles | `ee/` | Tenancy default | Billing/metering |
| ----- | -------- | ----- | --------------- | ---------------- |
| OSS / self-hosted | `packages/` + `apps/` | absent / stubbed | single-org friendly | off |
| Hosted | `packages/` + `apps/` + `ee/` | present | multi-tenant | on |

A single env/flag selects the build; there are no parallel codebases `[arch §1.2]`.

---

## 2. Contracts package (the network contract, in code)

`packages/contracts` is the single source of truth for every shape that crosses a boundary `[arch §8]`. This section specifies *how* it is structured and validated.

### 2.1 What lives here

- **`Attestation`** schema + inferred type (full shape in `[arch §8]`).
- **Tool I/O** schemas: `attest`, `explain_failure`, `assert_outcome`, `verify_flow`, `explore` (V2) - request and response.
- **API DTOs**: run-create request, run-status, evidence-ref resolution, app/key management.
- **Internal job payload**: the queue message (`[arch §4.1]`).
- **Enums/unions**: `status`, `source`, `resolvedBy`, `guardId`.

### 2.2 Validation points (every boundary, both directions)

A schema is only a contract if it is validated where data crosses a trust or process boundary:

1. **MCP/dashboard → backend**: backend parses the request DTO before any logic. Reject with a typed 4xx on failure.
2. **backend → queue**: the job payload is parsed on enqueue (catch a bad job before a worker wastes a browser).
3. **queue → worker**: the worker parses the job on receipt (defense against a malformed/poisoned message).
4. **worker → DB**: the assembled `Attestation` is parsed before write. A worker may never persist an attestation that fails its own schema.
5. **DB → read API → client**: the read API parses on the way out (guards against drift/partial rows).

### 2.3 Versioning

- `schemaVersion` is **sacred and additive-only** within a major `[arch §8]`. New optional fields are fine; renaming/removing/retyping a field is a major bump.
- Consumers branch on `schemaVersion` only when a major changes. The worker always writes the current version; the read API may translate older stored attestations forward.
- A schema change is a deliberate, reviewed event - it is the one change that ripples everywhere.

---

## 3. Adapter contracts

Adapters are the seams that keep the engine replaceable `[arch §1.3]`. Each defines a **narrow interface**; engine specifics never leak past it. Signatures below are the intended MVP shape (TypeScript, illustrative - the source in `core/adapters` is canonical).

### 3.1 Browser adapter (`core/adapters/browser`)

Wraps Chromium-via-Puppeteer/CDP `[arch §12]`. The engine talks to *this*, never to Puppeteer.

```ts
interface BrowserAdapter {
  // A clean-room context per run - never a real user profile [arch §10].
  newContext(opts: { viewport?: Viewport; userAgent?: string }): Promise<BrowserContext>;
}

interface BrowserContext {
  goto(url: string): Promise<NavigationResult>;       // NavigationResult carries httpStatus, ok, timing
  click(target: ResolvedTarget): Promise<void>;
  type(target: ResolvedTarget, text: string): Promise<void>;
  screenshot(): Promise<Buffer>;                       // raw bytes; evidence layer owns storage
  domSnapshot(): Promise<string>;                      // compressed HTML
  a11ySnapshot(): Promise<A11yNode[]>;                 // accessibility tree
  // Continuous evidence streams the executor subscribes to:
  onConsole(cb: (e: ConsoleEvent) => void): void;      // guard #4 source [arch §6.3]
  onNetwork(cb: (e: NetworkEvent) => void): void;      // guard #1 source
  close(): Promise<void>;
}
```

### 3.2 Resolution adapter (`core/adapters/resolution`)

Wraps Stagehand (MIT) `[arch §12]`, `[prd §6.2A]`. Turns an intent into a `ResolvedTarget` the browser adapter can act on, via the fallback ladder (a11y role+name → visible text → ARIA label → role → visual position).

```ts
interface ResolutionAdapter {
  resolve(intent: string, ctx: BrowserContext): Promise<ResolvedTarget>;
}

interface ResolvedTarget {
  selector: string;
  resolvedBy: 'a11y' | 'text' | 'aria' | 'role' | 'visual';  // recorded in the attestation step
  confidence: number;
}
```

`resolvedBy` flows straight into the attestation `steps[].resolvedBy` field `[arch §8]`, so resolution method is auditable per step. A resolution miss is **re-resolved**, not failed, before the step is declared failed `[prd §6.2A]`.

### 3.3 Model adapter (`core/adapters/model`)

The model seam `[arch §7.2]`. Every model call goes through **OpenRouter** (one OpenAI-compatible API, one key, access to all providers), so `core` never imports a provider SDK. The user **picks the model per agent role** (planner, judge, resolution fallback): model choice is per-tenant/app config, not hardcoded tiers.

```ts
type AgentRole = 'planner' | 'judge' | 'resolution';

interface ModelClient {
  // One OpenRouter-backed client; the model is chosen per call from RunModelConfig.
  complete(role: AgentRole, req: ModelRequest): Promise<ModelResponse>;
}

interface RunModelConfig {
  // Built by backend at enqueue from the app's model settings; carried in the job.
  // Each role names an OpenRouter model id (e.g. "anthropic/claude-opus-4-8", "google/gemini-...").
  models: Record<AgentRole, string>;   // user's per-role choice, or hosted defaults
  apiKey: string;                       // OpenRouter key: user's (BYOK) or hosted default, decrypted at enqueue (§6)
}
```

- **Gateway: OpenRouter.** One key reaches every model. BYOK = the user's own OpenRouter key; hosted falls back to Attest's key. Self-hosters can point the same OpenAI-compatible client at a local endpoint (e.g. Ollama) when they don't want OpenRouter.
- **Per-agent model choice** `[prd §6.4]`: the dashboard lets the user select a model for each role. Defaults follow the tiered strategy (strong planner, one call per run; cheap judge, only when the five guards don't decide `[prd §6.3]`; cheap resolution fallback), but the user can override any role.
- **Cost note** `[arch §7.3]`: per-run cost now tracks the user's model choices, not a fixed config. Defaults stay pocket-friendly; a user picking an expensive planner pays for it (their BYOK key, or metered on hosted).
- The OpenRouter key is decrypted at enqueue and injected here (§6); it is never returned to clients or written to evidence.

### 3.4 Storage adapter (evidence)

One interface, two implementations: object store (hosted) / local disk (self-hosted) `[arch §9]`.

```ts
interface EvidenceStore {
  put(ns: TenantNamespace, blob: Buffer, kind: EvidenceKind): Promise<EvidenceRef>;
  get(ns: TenantNamespace, ref: EvidenceRef): Promise<Buffer>;   // tenant-checked
  // ns = { orgId, appId }; access is structurally namespaced [arch §5.2, §9].
}
```

Secrets are **never** written through this interface `[arch §9, §10]`.

---

## 4. Engine runtime semantics (`core/`)

Structure of the planner/executor/judge/evidence pipeline is in `[arch §4.1]`. This section pins the **runtime contract** - ordering, halting, and what each stage may assume.

### 4.1 The pipeline, as a sequence

```
plan(goal)                         → Journey            (1 strong-model call) [arch §7.1]
for step in journey:
   target = resolution.resolve(step.intent)             (re-resolve on miss)  [prd §6.2A]
   browser.<action>(target)
   evidence.captureBeforeAfter(step)                     → refs               [arch §9]
   guards = runDeterministicGuards(step, evidence)       (5 plain checks)     [prd §6.3]
   if guards conclusively fail and policy = halt: break
judge(journey, evidence, guards)   → verdict             (cheap model only on interpretive cases)
assemble(verdict, steps, evidence) → Attestation
```

### 4.2 The five deterministic guards (run order & precedence)

Guards run **before** any LLM judgment, over evidence the worker already holds, and are plain checks - not a rules engine `[prd §6.3]`. A guard firing is recorded in `steps[].guardsTriggered` `[arch §8]`.

| # | Guard | Signal source | Deterministic verdict |
| - | ----- | ------------- | --------------------- |
| 1 | HTTP status | network events | `4xx/5xx` on a key request → fail signal |
| 2 | URL assertion | navigation result | wrong path after nav → fail signal |
| 3 | Element presence | a11y/DOM snapshot | expected role/text absent → fail signal |
| 4 | Console errors | console stream | uncaught exception → fail signal |
| 5 | Page-load / timeout | navigation result | navigation failure → fail signal |

**Precedence:** if any guard yields a conclusive failure, the LLM judge is **not** invoked for that step's pass/fail - it is consulted only for interpretive outcomes ("is this the right dashboard / a completed order") `[prd §6.3]`. This is the core cost lever `[arch §7.3]`.

### 4.3 Verdict semantics (goal-relative)

- `status` is **goal-relative, not action-relative**: all steps passing but the goal unmet ⇒ `failed` `[arch §8]`, `[prd §6.2B]`.
- `inconclusive` is reserved for **environment** failures (app unreachable, timeout) so infra noise is never read as a code bug `[arch §8]`. See retry policy §7.5.
- On failure, `failure.suggestedNextAction` is **mandatory** - it drives the fix loop `[arch §8]`, `[prd G4]`.

### 4.4 Failure dossier (the §G4 loop)

On a judged failure, the judge forms a `rootCauseHypothesis` from console errors + network errors + DOM state + the failing step; the reporter builds the dossier; the attestation is marked `failed` `[arch §4.2]`. The agent retrieves the full dossier via `explain_failure{runId}`. Evidence is returned **by reference**, never inlined `[arch §8 G5]`, `[prd G5]`.

---

## 5. Error handling & resilience

Distinct from *verdict* failures (§4.3, which are product outputs). This section covers **operational** errors - crashes, timeouts, transient infra faults.

### 5.1 Error taxonomy

| Class | Example | Where surfaced | Outcome |
| ----- | ------- | -------------- | ------- |
| **Verdict failure** | goal not met, guard fired | attestation `status: failed` | normal product output - not an error |
| **Environment failure** | target unreachable, page-load timeout | attestation `status: inconclusive` | retried per §7.5, then surfaced |
| **Worker fault** | Chromium crash, OOM, adapter throw | job retry / dead-letter | never takes down backend `[arch §3.3]` |
| **Backend fault** | DB down, queue down | typed 5xx to client | run not enqueued; idempotent retry safe |
| **Client/contract error** | bad request DTO, allowlist denial | typed 4xx | rejected before enqueue (§2.2) |

### 5.2 Worker fault isolation

The backend **does not launch browsers** `[arch §3.3]`. A Chromium crash, hang, or OOM is contained in a worker process and surfaces as a failed/retried **job**, never an API outage. Each job runs in a fresh context (§7.3) so a crash cannot leak state into the next run.

### 5.3 Timeouts (layered)

- **Per-step action timeout** - bounded wait for resolve/act; exceeding it is a step-level signal feeding guard #5.
- **Per-run wall-clock timeout** - hard ceiling; on breach the run is marked `inconclusive` (environment), evidence captured so far is preserved, browser context torn down.
- **Heartbeat/liveness** - worker emits progress/heartbeat `[arch §3.4]`; a missing heartbeat past threshold lets the backend mark the run stalled and (per §7.5) retry or surface `inconclusive`.

### 5.4 Idempotency

- `runId` is allocated at enqueue and returned to the caller `[arch §4.1]`. Re-delivery of a job (queue at-least-once) is safe because the worker writes the attestation keyed by `runId`; a second write is a no-op/overwrite of the same run.
- Run-create requests carry no side effects beyond enqueue, so client retry on a 5xx cannot double-bill or double-run within the same `runId`.

---

## 6. Secrets & BYOK at runtime

Policy is in `[arch §6.3, §7.2, §10]`. This section is the **runtime mechanics**.

### 6.1 Lifecycle of a secret (app credential or BYOK key)

```
stored: encrypted at rest in packages/db, per-tenant, never logged [arch §10]
   │
   ▼  (at enqueue, backend only)
decrypt → inject into job payload (creds*, modelKey*) [arch §4.1]
   │
   ▼  (internal trust boundary backend → worker [arch §6.3])
worker: held in memory for the run only
   │
   ▼
torn down with the run; NEVER written to evidence, NEVER returned to MCP/dashboard clients [arch §4.1, §9, §10]
```

The `*` in the job payload (`[arch §4.1]`) marks fields that travel **backend → worker only**.

### 6.2 Encryption

- **Envelope encryption.** A per-tenant **data key (DEK)** encrypts secret values (AES-256-GCM via Node `crypto`); the DEK is wrapped by a **key-encryption key (KEK)**. Envelope crypto runs **app-side** through a `KeyProvider` interface, so the KEK backend is swappable without touching call sites.
- **MVP, both hosted and self-hosted:** the KEK is **env-sourced** (injected at container launch from the deployment's own secret mechanism). `backend` holds it in memory to wrap/unwrap DEKs. Same impl in both modes, so no managed dependency is forced on self-hosters `[prd §3.3]`.
- **Tradeoff (accepted for MVP):** the KEK lives in `backend` process memory, and rotation requires a reload/restart rather than a live re-wrap. Held only in memory, never logged, never persisted to DB or evidence.
- **Deferred (post-MVP, non-breaking):** swap the `KeyProvider` for a server-side wrap/unwrap KMS so the KEK never enters app memory: **HashiCorp Vault Transit** (cloud-agnostic, fits self-hosting) or **AWS/GCP KMS**. Adopt before scale; the interface and DEK-wrapping scheme stay identical, so it is a config change, not a re-encryption.
- **Cloudflare ruled out (verified):** Cloudflare Secrets Store cannot return secret values to non-Worker callers and is still beta; Cloudflare has no server-side wrap/unwrap KMS. See the tech-stack note.
- Plaintext secrets exist only in: the encrypt path (entry), the enqueue decrypt path, and worker run memory. They are never logged, never in evidence, never in an attestation `[arch §10]`.

---

## 7. Resolved open implementation questions

The arch doc lists six open questions `[arch §13]`. Below are **provisional MVP defaults** - chosen to favor correctness and the clean-room guarantee, each with its tradeoff. Marked provisional: revisit with real data.

### 7.1 Plan caching → **ship without cache in MVP; cache designed, disabled**

- **Default:** no plan cache in MVP. The planner runs once per run `[arch §7.1]`; correctness and freshness beat the saving until real per-run cost data exists.
- **Designed for:** a content-addressed cache keyed on `(appId, normalizedGoal, appConfigHash)` with TTL, behind a flag. `appConfigHash` covers allowlist + credentials + relevant app settings so a config change invalidates cleanly - the hard part `[arch §13.1]`.
- **Tradeoff:** leaves the single biggest cost lever after the guards on the table for MVP; deliberate, since premature caching risks serving stale plans against changed apps.

### 7.2 Live run streaming → **SSE for MVP**

- **Default:** Server-Sent Events for dashboard live-watch. One-way, proxy-friendly, simple; sufficient for status + step progress. WebSocket deferred to when bidirectional need appears `[arch §13.2]`.
- **Worker → backend** progress via queue/Redis events; backend fans out to the SSE stream. Streams are **scoped per run and tenant-checked** (room-auth pattern) `[arch §13.2]`.
- **Tradeoff:** SSE can't push client→server, but live-watch is read-only, so no loss for MVP.

### 7.3 Worker isolation → **one fresh browser context per job in MVP**

- **Default:** a clean-room context per run, torn down after `[arch §3.4, §10]`. The reproducibility/clean-room guarantee `[prd §6.2, §7.2]` outweighs cold-start latency for MVP.
- **Deferred:** a warm pool of contexts (cold-start win) belongs with `ee/autoscaling` `[arch §11]` once latency data justifies the added care around state leakage `[arch §13.3]`.
- **Tradeoff:** higher per-run cold-start cost; accepted to keep the clean-room guarantee unconditional.

### 7.4 Allowlist enforcement → **backend at enqueue AND re-checked in worker (defense in depth)**

- **Default:** the backend validates the target against the app allowlist before enqueue `[arch §3.3]`; the worker **re-checks every navigation** against the same allowlist before issuing it `[arch §13.4]`.
- **Why both:** mid-run navigations discovered during `explore` (V2) `[prd §6.1]` aren't known at enqueue; re-checking in the worker closes that gap and defends against a confused/adversarial agent `[arch §1.6, §10]`.
- **Tradeoff:** a little duplicated logic (shared from `contracts`/`core`), bought for a hard security guarantee.

### 7.5 `inconclusive` retry → **auto-retry environment failures up to 2× with backoff, then surface**

- **Default:** an environment failure (unreachable, timeout, stalled heartbeat) is retried up to **2 times** with exponential backoff before the run resolves to `inconclusive` `[arch §8, §13.5]`.
- **Never retried:** verdict `failed` (a real product result) and contract errors (deterministic). Only environment noise is retried.
- **Tradeoff:** adds up to ~2× latency on genuinely-down environments; accepted to keep `inconclusive` rare and trustworthy `[prd §10 false-positive target]`.

### 7.6 BYOK encryption key management → **envelope encryption, KMS hosted / operator-key self-hosted**

- Resolved in §6.2 above `[arch §13.6]`.

> These six are the only design decisions intentionally deferred at MVP. Each is reversible behind an interface or flag.

---

## 8. Configuration surface

Config is **interface-driven** so the same code runs hosted and self-hosted `[arch §1.2]`. Selection happens at process start; nothing branches on "am I hosted?" in business logic - it branches on which interface implementation was injected.

| Concern | Interface | Hosted | Self-hosted |
| ------- | --------- | ------ | ----------- |
| Auth | auth provider | BetterAuth + `ee/sso` | BetterAuth `[arch §6.1]` |
| Evidence storage | `EvidenceStore` | object store | local disk `[arch §9]` |
| Queue | queue client | managed Redis/BullMQ | local Redis/BullMQ `[arch §12]` |
| Browser pool | browser provider | `ee/autoscaling` | fixed local pool `[arch §11]` |
| Billing/metering | metering hooks | `ee/billing` (Dodo MoR) + `ee/metering` + local credit ledger `[tech-arch §13]` | no-op `[arch §11]` |
| Model | `ModelClient` (OpenRouter) | hosted OpenRouter key + default per-role models | BYOK OpenRouter key, or local OpenAI-compatible endpoint (Ollama) `[arch §7.2]` |
| Secret KEK | `KeyProvider` | env-sourced KEK (MVP); KMS/Vault deferred (§6.2) | env-sourced KEK (§6.2) |

**Env vars** (illustrative, namespaced `ATTEST_`): `DATABASE_URL`, `REDIS_URL`, `EVIDENCE_BACKEND` (`s3`\|`disk`), `EVIDENCE_*` (bucket/path), `KEK_PROVIDER` (`kms`\|`env`), `OPENROUTER_API_KEY` (hosted default), `MODEL_DEFAULT_PLANNER`\|`_JUDGE`\|`_RESOLUTION` (default per-role model ids), `MODEL_BASE_URL` (override for local OpenAI-compatible endpoint), `DODO_PAYMENTS_API_KEY` + `DODO_PAYMENTS_WEBHOOK_KEY` + `DODO_ENV` (`test`\|`live`) (hosted/`ee/` only), `BUILD_EDITION` (`oss`\|`hosted`). All external input is validated at the boundary `[code-standards: API Routes]`.

---

## 9. Testing strategy

The dependency rules (§1) make most of the system testable without infrastructure. Test tiers, fastest first:

1. **Contracts** - schema round-trip + version-compat tests in `packages/contracts`. A breaking schema change fails here first.
2. **Core (pure, no infra)** - `packages/core` is transport/storage-free (§1.2), so planner/executor/judge are tested against **fake adapters** (in-memory browser, scripted resolution, stub model). The five guards (§4.2) get deterministic unit tests over canned evidence - no browser, no LLM, no flake. This is where verdict accuracy `[prd §10]` is pinned.
3. **DB** - `packages/db` tenant-scoping tests: assert no query path returns cross-tenant rows `[arch §5.2]`. These guard the isolation invariant.
4. **Adapter integration** - each adapter tested against its real engine in isolation (browser adapter vs real Chromium; resolution vs real Stagehand; model vs a real provider with a cheap model).
5. **End-to-end** - backend + worker + queue + a fixture app, one run per entry point (MCP and dashboard) asserting the **same** attestation `[arch §1.1]`. This proves "one execution path, two entry points."

**Determinism discipline:** LLM-dependent assertions live only in tier 4/5 and are kept few; guard logic (tier 2) is fully deterministic, which is where the >95% accuracy / <5% false-positive targets `[prd §10]` are actually defended.

---

## 10. Build, deploy & runtime topology

Service responsibilities are in `[arch §3]`. Deployment shape:

### 10.1 Hosted

```
            ┌──────────┐      ┌──────────────┐
 clients ──▶│ apps/web  │      │ apps/dashboard│  (static/SPA, scale independently [arch §3.1,§3.2])
            └──────────┘      └──────┬───────┘
                                     │ authenticated API
 MCP client ───────────────────────▶│
                                     ▼
                              ┌──────────────┐        ┌─────────┐
                              │ apps/backend  │───────▶│  queue   │ (BullMQ/Redis)
                              │  (API front)  │        └────┬────┘
                              └──────┬───────┘             │ jobs
                                     │ read/write          ▼
                                     ▼              ┌──────────────┐   launch
                              ┌──────────┐          │ apps/worker   │──────────▶ Chromium (isolated ctx)
                              │ Postgres  │◀─────────│  (N replicas) │
                              └──────────┘  attest   └──────┬───────┘
                                                            ▼
                                                    evidence object store
       ee/autoscaling sizes worker pool against queue depth [arch §3.4, §11]
```

- `backend` and `worker` **scale independently** `[arch §3.3, §3.4]`; worker count tracks queue depth via `ee/autoscaling`.
- `web`/`dashboard` are lightweight surfaces deployed separately from `backend` `[arch §3.1]`.

### 10.2 Self-hosted

Identical service graph `[arch §4.4]`, all on the operator's infra: `backend`, `worker`, Chromium, Redis/BullMQ, Postgres, and **disk-backed** evidence. `ee/` absent → effectively single-org, no billing, fixed worker pool. The worker reaches `localhost` apps `[prd §3.1]`. Distributable as containers + compose/Helm; one `BUILD_EDITION=oss` build (§1.4).

### 10.3 Migrations

DB schema + migrations live in `packages/db` `[arch §2]`. Migrations run as a gated deploy step ahead of rolling out new `backend`/`worker`. Additive-first to stay compatible with in-flight workers during a rollout.

---

## 11. Observability

- **Structured logs**, tenant-tagged (`orgId`/`appId`/`runId`), **never containing secrets or evidence payloads** `[arch §10]`. Logs reference evidence by ID only `[arch §8 G5]`.
- **Run trace**: every run is reconstructable from its `runId` - status transitions, guards fired, resolution methods per step, durations - all already in the attestation `[arch §8]`, so the attestation *is* the primary trace artifact.
- **Metrics tied to product targets** `[prd §10]`: verdict latency (median run time < 60 s), false-positive rate, fix-loop completion, time-to-second-attempt, cost-per-run, self-hosted activation. Cost-per-run is the tracked margin tension `[arch §7.3]`, `[prd §6.3]`.
- **Metering** (`ee/metering`) emits a `UsageEvent` per run capturing runs + browser-minutes + steps `[arch §11]` - separate from operational metrics; all three captured from day one so pricing can change without re-instrumentation.

---

## 12. Cross-cutting invariants (must never break)

These restate `[arch §1]` as enforceable checks contributors verify before merge:

1. **One execution path.** MCP-triggered and dashboard-triggered runs are the same job, queue, worker, attestation `[arch §1.1]`. (E2E test §9.5.)
2. **Core stays pure.** No transport/storage/engine import in `packages/core` `[arch §1.3, §2]`. (ESLint §1.3.)
3. **Tenant isolation.** No data-access path returns cross-tenant rows `[arch §5.2]`. (DB tests §9.3.)
4. **Secrets never leak.** Not logged, not in evidence, not returned to clients `[arch §10]`. (§6, §11.)
5. **Engine behind adapter.** Engine specifics never reach the QA-primitive contract or the attestation schema `[arch §1.3]`.
6. **Schema is contract.** Validated at every boundary (§2.2); `schemaVersion` additive-only `[arch §8]`.
7. **Allowlist is the guardrail.** Enforced at enqueue and re-checked in the worker (§7.4); the agent can never expand it `[arch §10]`.

---

## 13. Billing, metering & credits (`ee/`)

Concretizes the metering/billing model in `[arch §11]`. All of this lives in `ee/` (`metering`, `billing`) and is **absent from the OSS build**: self-hosters do not meter, have no credits, and run unlimited `[arch §11]`, `[prd §3.3]`. Payments run through **Dodo Payments** as Merchant of Record.

> **Numbers below are directional estimates, not fixed prices.** Every cost is a range with stated assumptions; the cent-value of a credit, the margin multiplier, the per-role default models, and the tier prices are all **tunable knobs**, not constants. Re-baseline against real run data (the §7.3 cost-watch). The raw `UsageEvent` is the source of truth, so pricing can change without re-instrumentation.

### 13.1 Cost per run (what Attest actually pays)

Two cases, because of the OpenRouter model seam (§3.3):

**Hosted run on Attest's OpenRouter key** (default models: strong planner, cheap judge/resolution):

| Component | Estimate | Assumptions |
| --------- | -------- | ----------- |
| Planner | ~$0.03 | 1 call, ~4k in / ~1.5k out, strong-tier model |
| Judge | ~$0.02 | ~3 interpretive calls (guards decide the rest `[prd §6.3]`), cheap-tier |
| Resolution fallback | ~$0.003 | rare; Stagehand resolves most `[prd §6.2A]` |
| OpenRouter fee | ~5% | on the above |
| Browser-minutes | ~$0.02 to $0.05 | ~1.5 min/run, containerized Chromium, fully loaded |
| Queue / DB / R2 | ~$0.001 | evidence by reference; R2 egress free |
| **Fully loaded** | **~$0.08 to $0.12/run** | worst case (retries, long run, user-picked expensive model): $0.20 to $0.50+ |

**Hosted run on the user's BYOK OpenRouter key:** the model cost lands on the user's OpenRouter account, so Attest pays **infra only, ~$0.02 to $0.05/run**. This removes the §7.3 margin risk; pricing should encourage BYOK.

### 13.2 The credit model (customer-facing layer over the hybrid meter)

- **`UsageEvent` stays the raw meter** `[arch §11]`: every run emits one event capturing `runs`, `browserMinutes`, `steps`, and `modelCostUsd` (the OpenRouter cost, or `0` when BYOK). All four are captured from day one so pricing can change without re-instrumentation.
- **Credits are the spend currency.** `1 credit = a fixed cent value` (a tunable knob, e.g. ~$0.02). A run debits `credits = ceil(meteredCost * margin / centValue)`, where `meteredCost` is the fully-loaded cost from the `UsageEvent`.
- **Margin is explicit and built in.** Target a healthy gross margin (illustratively ~60 to 75%): a ~$0.10 fully-loaded run debits ~$0.25 to $0.40 of credits. The multiplier is a config value, not a constant.
- **BYOK debits fewer credits** (infra only, no model markup), so a BYOK user's run is cheaper in credits than the same run on Attest's key. This is the incentive that protects margin.
- **The dashboard shows credits-per-run** so spend is legible despite variable model choice.

### 13.3 Subscription + credits (the hybrid)

- **Subscription tier** (recurring via Dodo): a monthly fee grants a monthly **credit allotment** plus feature gates (seats/members, evidence retention, run concurrency, SSO via `ee/sso`). Tiers map to the org.
- **Overage**: when the monthly grant is exhausted, the org buys **credit packs** (one-time purchase) or enables **auto-recharge**. Credit packs are also the pay-as-you-go path for orgs without a subscription.
- This is the `[arch §11]` hybrid made concrete; the documented fallback (collapse to a single dominant unit) is preserved because `browserMinutes` is one of the meters.

### 13.4 Credit ledger & run gating

- **The credit ledger is local (`ee/billing`, Postgres) and authoritative for gating.** Append-only, org-scoped (`org_id`, §5.2). Entry kinds: `grant` (subscription renewal), `purchase` (credit pack), `debit` (run), `refund`, `expiry`. Balance = sum of entries.
- **Enqueue gate** `[arch §4.1]`: before enqueuing a run, `backend` checks `balance >= estimatedCost`. Insufficient balance returns a typed `402`-style error (or proceeds within a configured good-standing buffer for active subscribers). Actual cost is debited on run completion from the `UsageEvent`. This is a deliberate pre-flight check so an expensive browser run never starts unpaid.
- **Why a local ledger and not Dodo's native credits:** Dodo offers built-in credit pools, but deduction runs on an async ~1-minute worker, which is **unfit as a real-time enqueue gate**, and Attest's debit is multi-factor (infra + model-cost passthrough, BYOK-discounted) rather than a single metered unit. So the local ledger is the source of truth for balance and gating; Dodo is the payment rail and grant source (§13.5). Deliberate tradeoff, not an oversight.

### 13.5 Dodo Payments integration

- **Merchant of Record.** Dodo is the legal seller; it calculates, collects, files, and remits VAT/GST/sales tax across 190+ jurisdictions, and owns chargeback/PCI liability. Attest carries **no tax-remittance burden**. This is the reason to use an MoR over a raw gateway.
- **SDK:** `dodopayments` (official TS SDK), bearer-token auth, separate test/live keys. Lives behind a thin `ee/billing` interface so the rest of the system never imports it directly.
- **Products:** subscription products (the tiers) grouped in a **Product Collection** (required for in-portal plan upgrades/downgrades), plus one-time credit-pack products.
- **Purchase flow:** `backend` (via `ee/billing`) creates a Dodo **checkout session** for a tier or pack and redirects the user; Dodo handles payment + tax.
- **Fulfillment via webhooks → ledger grant:** Dodo posts Standard-Webhooks events (`webhook-id`, `webhook-signature`, `webhook-timestamp`, HMAC-SHA256) verified with the SDK's `unwrap()`. Relevant events: `payment.succeeded` (credit-pack → ledger `purchase`), `subscription.active` / `subscription.renewed` (→ monthly `grant` + entitlements), `subscription.on_hold` (recoverable: prompt payment-method update), `subscription.cancelled` / `subscription.expired` (revoke entitlements), `refund.succeeded` (→ ledger `refund`). The handler **ACKs immediately, verifies the signature, dedupes on `webhook-id`** (idempotent), then writes the ledger entry. `subscription.failed` is **terminal and never grants access** (distinct from the recoverable `subscription.on_hold`).
- **Webhook handler is Fastify with a raw-body parser** on the Dodo route (the default JSON parser breaks signature verification; verify the buffer, then parse).
- **Customer portal:** Dodo-hosted (subscription management, payment methods, invoices, credit-balance view). `backend` mints a magic-link portal session per customer.

### 13.6 Fees & margin

- Dodo fees stack: ~4% + $0.40 domestic US one-time; an **international subscription effectively runs ~6% + $0.40** (subscription +0.5%, international +1.5%). Refunds ~$1, disputes ~$30. These are a **cost of revenue folded into the margin multiplier** (§13.2), not a separate line the customer sees.
- Model the real transaction mix (global subscribers skew to the higher effective rate) when setting the multiplier so the target gross margin holds after Dodo's cut.

---

_End of Technical Architecture v1.0 - Attest. Companion to `foundational/architecture.md` (system design) and `foundational/prd.md` (product). See `technical/code-standards.md` for coding conventions._
