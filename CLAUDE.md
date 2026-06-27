# CLAUDE.md - Attest

QA-primitive MCP server + dashboard. Verifies user outcomes in a real browser, returns an evidence-backed **attestation** (a verdict agents loop on). Open-core (Apache-2.0) + self-hostable, paid hosted `ee/` tier.

**Read by use case, not all at once.** Start every task at `docs/technical/progress-tracker.md`, then read only what the table says.

| Task | Read, in order |
| ---- | -------------- |
| Implement feature / engine | `project-overview` → `architecture` → `technical-architecture` → `code-standards` |
| Architecture / boundary decision | `architecture` → `technical-architecture` §1, §12 |
| Change attestation schema / any contract | `architecture` §8 → `technical-architecture` §2 (do it first and alone; ripples everywhere) |
| Adapter (browser/resolution/model/storage) | `technical-architecture` §3 → `code-standards` |
| Auth / tenancy / secrets / BYOK | `architecture` §5,§6,§10 → `technical-architecture` §6 |
| API route (`apps/backend`) | `architecture` §3,§4 → `technical-architecture` §2.2,§5 → `code-standards` |
| Worker / run execution | `architecture` §3.4,§4 → `technical-architecture` §4,§5,§7.3 |
| UI (`web`/`dashboard`) | `ui-context` (design system) → `code-standards` (styling) → `project-overview` |
| Build / deploy / config | `technical-architecture` §1.4,§8,§10 |
| Tests | `technical-architecture` §9 |
| Missing/ambiguous requirement | `ai-workflow-rules`; log it in `progress-tracker` |
| Product / market / roadmap | `prd` |

Docs live in `docs/foundational/` (`prd`, `architecture` - canonical, git-ignored, local-only) and `docs/technical/` (committed). Full doc-ownership map: `docs/technical/project-overview.md`.

## Invariants (never break - full list `technical-architecture` §12)

1. One execution path: MCP and dashboard runs are the same job/queue/worker/attestation.
2. `packages/core` stays pure: no transport/storage/engine import.
3. Tenant isolation: every row carries `org_id`; no cross-tenant query path.
4. Secrets never leak: not logged, not in evidence, not returned to clients.
5. Engine stays behind its adapter.
6. Attestation schema validated at every boundary; `schemaVersion` additive-only.
7. Allowlist enforced at enqueue and re-checked in worker; agent can't expand it.

## Coding rules (non-negotiable)

- **pnpm** workspaces. Install deps by command (`pnpm add ...`), never hand-edit versions.
- Production-friendly, modular, well-organized: small single-purpose modules, clear boundaries.
- No em dashes anywhere.
- No comments unless code is not self-explanatory.
- Spec-driven: implement against the docs, don't invent behavior. One unit at a time; split steps crossing package/app boundaries.
- Update `progress-tracker.md` after every meaningful change; update the affected doc before continuing if implementation changes architecture/scope/standards.

Full conventions: `docs/technical/code-standards.md`. Workflow: `docs/technical/ai-workflow-rules.md`.

## Rate limiting / trust-proxy

Fastify `trustProxy` (and any `req.ip`-derived security control) MUST be a numeric hop count equal to the real proxy-chain length (1 = single LB, 2 = CDN+LB, 0 = directly internet-facing), **never `true`**. `true` trusts the whole `X-Forwarded-For` chain, so an attacker spoofs the left-most entry to bypass per-IP limits (Fastify advisory GHSA-444r-cwp2-x5xf); too-low collapses every client onto the proxy IP (one global throttle locking out all users). Set via `RATE_LIMIT_TRUST_PROXY_HOPS` (default 0). _(recorded 2026-06-27)_

## Error contract: 429 vs 402

`429 rate_limited` (retryable after `Retry-After`) and `402 insufficient_credits` (out of money) are distinct signals; never conflate them. Rate-limit 429s reuse the house `ApiError -> {code, message}` shape. _(recorded 2026-06-27)_
