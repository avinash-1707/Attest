# ADR-0001: OSS-vs-EE wiring via optional-hook injection (guarded dynamic import)

- **Status:** Accepted
- **Date:** 2026-06-23

## Context

Attest is open-core: an Apache-2.0 OSS build (self-hostable, unlimited, no metering) plus a paid hosted tier whose features live in the `ee/` package (billing, metering, and later SSO/autoscaling). The first `ee/` feature to wire in is billing + metering, which needs two seams in OSS code paths: a credit gate in the backend's `enqueueRun` and a meter in the worker's run-completion path, plus an inbound Dodo webhook route.

Forces:

- **Invariant 2:** `packages/core` stays pure — no transport/storage/engine/billing import.
- **Apps must never statically import `ee/`.** A static `import … from '@attest/ee'` anywhere in `apps/**` or `packages/core/**` would couple the OSS build to the paid package and risk an EE type or runtime leaking into an OSS artifact.
- **`ee/` may be wholly absent.** An OSS deploy ships without the `ee/` package in `node_modules` at all; the code must treat "EE absent" as a normal runtime state, not a crash.
- **Hosted must be able to fail loud.** A hosted box that somehow boots without billing must not silently run free (ungated, unmetered) — that is direct revenue loss.
- One codebase, one build graph — we do not want to maintain two divergent builds.

## Decision

Wire EE as an **optional hook bundle injected at each composition root**, loaded through a **guarded, variable-specifier dynamic import**. EE is a swappable adapter selected by config, mirroring how the repo already selects disk/S3 storage at the composition root.

Concretely:

- **Seam interfaces live in OSS**, in `@attest/contracts/billing.ts`: `BillingMeter`, `BillingGate`, `BillingWebhookHandler`, `RunMeterInput` (plain TS interfaces, erased at runtime — not zod, since they are internal injection seams, not wire contracts). Pricing stays EE-internal and is passed through the loader opaquely so the OSS apps never name it.
- **The loader is the only place that touches EE** (`apps/{backend,worker}/src/billing/load.ts`):
  ```ts
  const spec: string = '@attest/ee';      // string, NOT a literal -> tsc never resolves it
  const ee = await import(spec).catch(() => null);
  ```
  Because the specifier is a widened `string`, the compiler never compile-resolves `@attest/ee`, so the OSS build has **zero compile-time reference** to the package; `.catch(() => null)` makes runtime absence a non-event.
- **`@attest/ee` is an `optionalDependency`** of `apps/backend` + `apps/worker` — present in the monorepo (so CI/typecheck/tests resolve it) and in a hosted install, omittable from an OSS production install (`--no-optional`).
- **`BILLING_ENABLED` defaults off:** the loaders return no-op impls (`allowAllGate`, `noopMeter`, 404 `noopWebhookHandler`). The OSS build never meters, never gates, runs unlimited.
- **`REQUIRE_BILLING` fails closed:** when set (hosted), the loader throws at boot if EE or the webhook key is absent, so a hosted box can never silently run free.
- **An ESLint `no-restricted-imports` rule** bans static `@attest/ee` imports in `apps/**` and `packages/core/**`. The dynamic seam in `*/billing/load.ts` is the only path, and a non-literal `import()` is not flaggable — so lint *proves* no app or core statically depends on EE.

**Rejected — build flag / two build graphs** (`#if EE`, conditional bundling): two build outputs, real risk of an EE type leaking into the OSS artifact, and far more CI surface. The leak risk is exactly the invariant-class breakage we are trying to prevent.

**Considered and not taken — a single `@attest/core/worker` entrypoint** that re-exports EE: it would drag every engine SDK (and EE) onto any importer of that entrypoint, the opposite of the per-adapter-subpath discipline the repo already uses.

## Consequences

Easier:

- One codebase, one build. EE-absent is a first-class, tested runtime state (the OSS-no-op load tests assert the no-op path never touches the DB).
- The purity/boundary invariants are *enforced by tooling* (lint + the dynamic-import discipline), not by convention.
- Adding the next EE feature (SSO, autoscaling) follows the same seam-in-contracts + loader pattern.

Harder / tradeoffs accepted:

- The hosted runtime needs `@attest/ee` actually resolvable from `node_modules`, hence the `optionalDependency` declaration — a deploy that wants billing must include optional deps.
- The variable-specifier trick deliberately defeats type resolution at the import site, so the loaded module is cast to a hand-written `EeBilling` interface in the loader; a drift between that interface and EE's real exports would only surface at runtime, not compile time. Mitigated by keeping the interface tiny and the seam types shared via `@attest/contracts`.
- The fail-closed-on-EE-absent path (`REQUIRE_BILLING=true` + EE genuinely missing) cannot be unit-tested in the monorepo (EE is always present there); it is covered by code review and would need a hosted smoke test (deploy without EE).
