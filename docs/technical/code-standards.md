# Attest - Code Standards

> Conventions for writing code. Architecture (what exists, how it depends) is in `technical-architecture.md`; this file is *how to write the code that fills it*. When a rule here implies a structural decision, the architecture doc wins.

## Project-wide rules (non-negotiable)

- **Package manager: pnpm.** Use pnpm workspaces. No npm/yarn lockfiles.
- **Install dependencies by command**, never by hand-editing a version in package.json. Run `pnpm add <pkg>` (or `pnpm add -D`, `pnpm add --filter <workspace>`) so the latest compatible version is pulled and the lockfile updated.
- **Production-friendly, modular, properly organized code.** Small single-purpose modules, clear boundaries, no dead code.
- **No em dashes** anywhere: code, comments, docs, commit messages. Use a colon, comma, or parentheses instead.
- **No comments unless the code is not self-explanatory.** Write self-documenting code; reserve comments for genuinely non-obvious logic (a tricky invariant, a workaround with a reason). Do not narrate what the code already says.

## General

- Keep modules small and single-purpose. One reason to change per module.
- Fix root causes; do not layer workarounds. A failing guard, a leaked import, a cross-tenant query are bugs to fix at the source, not to patch around.
- Do not mix unrelated concerns in one module or route. Transport, business logic, and storage stay separated (`packages/core` is transport- and storage-free - `[tech-arch §1.2]`).
- Respect the dependency direction in `[tech-arch §1]`. If you need an import the matrix forbids, the design is wrong - raise it, don't bypass the ESLint rule.

## TypeScript

- **Strict mode required** across all packages and apps.
- Avoid `any`. Use explicit interfaces or narrowly-scoped types. Adapter and contract types are the public surface - type them precisely.
- **Validate unknown external input at boundaries before trusting it.** Every value crossing a process/trust boundary is parsed against a `packages/contracts` zod schema first (`[tech-arch §2.2]`). No "we'll validate later."
- Derive types from zod schemas (`z.infer`) - never hand-maintain a type alongside its schema.
- No engine-specific types (Puppeteer, Stagehand, model SDK) outside their adapter implementation (`[tech-arch §1.2, §3]`).
- **Extensionless imports.** `moduleResolution: "bundler"` (root `tsconfig.base.json`); relative imports carry no `.js`/`.ts` extension. Runnable apps execute via a bundler/tsx, not raw `node dist`, so resolution stays bundler-style end to end.

## Packages & boundaries

- `packages/contracts` imports nothing but `zod`. It is the root of the graph.
- `packages/core` never imports `db`, an app, HTTP, the queue client, or the MCP SDK. It takes plain inputs, returns `contracts` objects (`[tech-arch §1.2]`).
- `apps/*` never import each other - they talk over the network boundaries in `[arch §3]`.
- `ee/*` is wired in only behind an interface seam; no app imports `ee/` directly (`[tech-arch §1.2]`).

## Frameworks (stack locked in `[tech-arch: Tech stack]`)

- **Next.js** (`web`, `dashboard`): default to server components; add `use client` only when browser interactivity needs it. Keep route handlers single-purpose. No business/execution logic in the UI layer (`[arch §3.2]`).
- **Fastify** (`backend`): one plugin/route module per concern; schema-validate every request via `contracts` (`[tech-arch §2.2]`); typed error responses (`[tech-arch §5.1]`).
- **Drizzle** (`db`): all access through the tenant-scoped layer; schema + migrations (Drizzle Kit) live in `packages/db`; migrations additive-first (`[tech-arch §10.3]`).
- **Vitest**: tests colocated per package; pure `core` tests use fake adapters (`[tech-arch §9]`).
- **pino**: structured, tenant-tagged logs; never log secrets or evidence payloads (`[tech-arch §11]`).

## API routes (apps/backend)

- Parse and validate request input against a contract schema **before any logic runs** (`[tech-arch §2.2]`).
- Enforce auth + org/app resolution and ownership **before** any mutation or enqueue (`[arch §3.3, §6]`).
- Check the app allowlist before enqueue; the worker re-checks every navigation (`[tech-arch §7.4]`).
- Return consistent, typed response shapes from `contracts`. Errors are typed (4xx client/contract, 5xx infra - `[tech-arch §5.1]`).
- Never return secrets/BYOK keys or inline evidence payloads. Evidence is referenced by ID (`[arch §8 G5, §10]`).

## Data & storage

- Every table carries `org_id`; **all** queries go through the tenant-scoped data-access layer in `packages/db`. No ad-hoc query bypasses it (`[arch §5.2]`).
- There is no unscoped "all runs" query. Cross-tenant access must be structurally impossible (`[arch §5.2]`).
- Metadata and the attestation belong in Postgres; large evidence blobs belong in the `EvidenceStore` (object store / disk), referenced by ID (`[arch §9]`).
- Secrets are stored encrypted at rest, never logged, decrypted only at enqueue (`[tech-arch §6]`).

## Engine, adapters & determinism

- Element resolution, browser actions, and model calls go through their adapter interface (`[tech-arch §3]`). Engine swaps must not touch planner/executor/judge or the attestation schema.
- The five deterministic guards are plain, deterministic checks over captured evidence - no LLM, no I/O. Keep them that way; they are where accuracy is defended (`[tech-arch §4.2, §9]`).
- Invoke the LLM judge only for interpretive outcomes the guards don't decide (`[arch §7.1]`, `[prd §6.3]`).

## Logging & secrets

- Structured logs, tagged with `orgId`/`appId`/`runId`. Never log secrets, BYOK keys, or evidence payloads - reference by ID only (`[tech-arch §11]`, `[arch §10]`).

## File organization

- `packages/contracts/` - zod schemas + inferred types (the network contract).
- `packages/core/` - engine: `planner/`, `executor/`, `judge/`, `evidence/`, `adapters/{browser,resolution,model}/`.
- `packages/db/` - schema, migrations, tenant-scoped data access.
- `apps/{web,dashboard,backend,worker,mcp}/` - deployable surfaces; never import one another.
- `ee/` - commercial layer (`billing/`, `metering/`, `sso/`, `org-management/`, `autoscaling/`); absent in the OSS build.

## Styling (apps/web, apps/dashboard)

- Use design-token CSS custom properties - no hardcoded hex values.
- Follow the token system, two-surface rule (clay shell vs flat data), and component conventions in `ui-context.md`. Never mix surface types: clay chrome never carries data, data readouts never wear clay shadow.
