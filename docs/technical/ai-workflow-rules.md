# Attest - AI Workflow Rules

> How an agent or contributor builds against these specs. Conventions are in `code-standards.md`; structure in `technical-architecture.md`; product in `../foundational/prd.md`.

## Approach

Build Attest incrementally with a **spec-driven workflow**. The context docs define what to build (`project-overview.md`, `../foundational/prd.md`), how it's structured (`../foundational/architecture.md`, `technical-architecture.md`), and how to write it (`code-standards.md`). Implement against these specs - do not infer or invent product behavior from scratch. When unsure which doc to read for a task, see `CLAUDE.md` (use-case routing).

## Scoping rules

- Work on one feature unit at a time.
- Prefer small, verifiable increments over large speculative changes.
- Do not combine unrelated system boundaries in a single step. The boundaries are the package/app seams in `[tech-arch §1]` - a step that touches `core` *and* `backend` *and* `db` is usually three steps.
- If a change can't be verified end to end quickly, the scope is too broad - split it.

## When to split work

Split a step if it combines:

- A `packages/core` (engine) change **and** an app (transport) change - these are separate boundaries (`[tech-arch §1.2]`).
- Multiple unrelated API routes or surfaces.
- A `contracts` schema change **and** its consumers - change the schema first (it ripples everywhere by design - `[tech-arch §2.3]`), verify it compiles, then update consumers.
- Behavior not clearly defined in the context docs (resolve the doc first - see below).

## Handling missing requirements

- Do not invent product behavior not defined in the context docs.
- If a requirement is ambiguous, resolve it in the relevant doc **before** implementing - PRD for product, architecture doc for structure, this folder for the *how*.
- If a requirement is missing, add it as an open question in `progress-tracker.md` before continuing.
- The six provisional decisions in `[tech-arch §7]` are settled defaults - follow them; reopen one only with a tracked reason.

## Protected invariants (never break)

These restate `[tech-arch §12]`. A change that violates one is wrong, not a tradeoff:

1. One execution path - MCP and dashboard runs are the same job/queue/worker/attestation.
2. `packages/core` stays pure - no transport/storage/engine import.
3. Tenant isolation - no cross-tenant query path.
4. Secrets never leak - not logged, not in evidence, not returned to clients.
5. Engine stays behind its adapter.
6. The attestation schema is validated at every boundary; `schemaVersion` is additive-only.
7. The allowlist is enforced at enqueue and re-checked in the worker.

## Protected files

Do not modify unless explicitly instructed:

- `ee/` license-boundary structure - it is a top-level dir from commit #1 by design (`[prd §3.2]`).
- Generated UI library components and third-party internals.
- `packages/contracts` schema versioning rules - schema changes are deliberate, reviewed events (`[tech-arch §2.3]`).

## Keeping docs in sync

Update the relevant doc whenever implementation changes:

- System structure / boundaries → `../foundational/architecture.md`.
- Runtime behavior, adapter contracts, deploy → `technical-architecture.md`.
- Storage/data-model decisions → `../foundational/architecture.md §5` + `technical-architecture.md`.
- Conventions → `code-standards.md`.
- Product scope → `../foundational/prd.md`.
- A resolved open question → move it out of `[tech-arch §7]`/`[arch §13]` into the body, dated.

## Before moving to the next unit

1. The current unit works end to end within its defined scope.
2. No invariant in `[tech-arch §12]` / `../foundational/architecture.md §1` was violated.
3. `progress-tracker.md` reflects the completed work.
4. The relevant test tier passes (`[tech-arch §9]`) and `npm run build` passes.
