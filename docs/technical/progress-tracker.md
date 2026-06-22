# Attest - Progress Tracker

> Update after every meaningful implementation change. State the *what* and *why*; link decisions to the docs they affect.

## Current phase

- **MVP - Foundation** (`[prd §9]`). Pre-implementation: docs complete, no code yet.

## Current goal

- Establish the documentation baseline and stand up the monorepo skeleton (`packages/`, `apps/`, `ee/`) per `[arch §2]` with the dependency rules in `[tech-arch §1]`.

## Completed

- Foundational docs: `foundational/prd.md` (v2), `foundational/architecture.md` (v1).
- Technical docs: `technical/technical-architecture.md` (v1), `project-overview.md`, `code-standards.md`, `ai-workflow-rules.md`, this tracker.
- Six open implementation questions from `[arch §13]` resolved as provisional MVP defaults in `[tech-arch §7]`.
- Monorepo scaffold (`[arch §2]`, `[tech-arch §1]`): pnpm workspaces for `packages/{contracts,core,db}`, `apps/{web,dashboard,backend,worker,mcp}`, single `ee` package. Turborepo pipeline (`build`/`dev`/`test`/`lint`/`typecheck`), TS strict + project references, Vitest workspace, Prettier. ESLint `no-restricted-imports` encodes the dependency matrix (`[tech-arch §1.3]`) - verified: `core`→`db` and engine-SDK-in-judge imports both fail lint. `pnpm build` + `pnpm lint` green across all 9 projects. Deps installed by command only; internal links are `workspace:*`. `core` src laid out as `planner/executor/judge/evidence/adapters/{browser,resolution,model}`; apps/ee are placeholders pending framework wiring.
- `packages/contracts` Attestation contract (`[arch §8]`, `[tech-arch §2]`): `Attestation` zod schema + `z.infer` types, with enums (`runStatus`/`stepStatus`/`source`/`resolvedBy`/`guardId`/`evidenceKind`), evidence ref schemas (`stepEvidence`, `runEvidence`), step + failure dossier. Cross-field rule enforced: `failure` is present iff `status === "failed"`. `schemaVersion` pinned to `"1.0"` literal. 10 round-trip/validation tests green (`[tech-arch §9.1]`). Tool I/O + job payload schemas still pending (next unit).

## In progress

- None.

## Next up

1. `packages/contracts`: tool I/O schemas (`attest`/`explain_failure`/`assert_outcome`/`verify_flow`) + the queue job payload, with round-trip tests (`[tech-arch §2.1, §9.1]`).
2. `packages/core` adapter interfaces (browser/resolution/model/storage) per `[tech-arch §3]`, with fake adapters for testing (dir skeleton already scaffolded).
3. The five deterministic guards (`[tech-arch §4.2]`) with deterministic unit tests over canned evidence.

## Open questions

- KEK store decided: env-sourced KEK for MVP (both modes), app-side AES-256-GCM envelope behind a swappable `KeyProvider`. Cloudflare Secrets Store ruled out (verified June 2026: REST never returns secret values, Workers-binding-only runtime access, beta). Deferred post-MVP: Vault Transit or AWS/GCP KMS for server-side wrap/unwrap, non-breaking swap (`[tech-arch §6.2, Tech stack]`).
- (resolved) `ui-context.md` written: clay-shell + flat-data design system, dark-first dual mode, oxblood accent, DM Sans + Berkeley/JetBrains Mono, flat verdict triad.
- Plan-cache flag (`[tech-arch §7.1]`): keep disabled until real per-run cost data exists - revisit, don't implement early.
- `resolvedBy` enum mismatch (resolved in code, doc note pending): `[arch §8]` step example shows `"resolvedBy": "url"`, but `[tech-arch §3.2]` defines the authoritative union `a11y|text|aria|role|visual` (no `url`). The contract schema follows §3.2 and makes `resolvedBy` optional (absent for non-element steps like pure navigation). The `[arch §8]` example value is treated as illustrative/stale. Confirm and fix the §8 example on the next contract doc pass.
- (Add new ambiguities here before implementing - `ai-workflow-rules.md`.)

## Architecture decisions

- Resolved `[arch §13]` open questions with provisional defaults - see `[tech-arch §7]`: no plan cache (MVP), SSE streaming, one fresh browser context per job, allowlist enforced at enqueue + re-checked in worker, ≤2× retry then `inconclusive`, envelope encryption (KMS hosted / operator-key self-hosted).
- Why: favor correctness and the clean-room/isolation guarantees over premature optimization; each default is reversible behind an interface or flag.
- Billing (`ee/`): hybrid subscription + credits via Dodo Payments (Merchant of Record, handles global tax). Local credit ledger is authoritative for real-time enqueue gating; Dodo is payment rail + grants via webhooks (Dodo's native credits rejected: async ~1-min deduction unfit as a gate). Costs documented as directional ranges with explicit ~60-75% margin multiplier; raw `UsageEvent` (runs+minutes+steps+model-cost) is the tunable source of truth. BYOK runs cost infra-only, kill the §7.3 margin risk (`[tech-arch §13]`).
- Models: OpenRouter is the gateway (one OpenAI-compatible API, one key, all providers) behind `adapters/model`; user picks the model per agent role (planner/judge/resolution) in the dashboard, defaults follow the tiered strategy. BYOK = user's OpenRouter key; self-hosters can point at a local OpenAI-compatible endpoint. Per-run cost now tracks user model choices (`[tech-arch §3.3]`).

## Session notes

- All `docs/technical/*` placeholders were replaced with Attest-specific content; `docs/foundational/*` are the canonical source for product + system design.
- `docs/foundational/` is git-ignored (see `.gitignore`) - treat it as local canonical reference, not a committed artifact.
- Doc routing for any task: see `CLAUDE.md`.
