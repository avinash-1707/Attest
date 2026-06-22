# Attest - Project Overview (technical orientation)

> One-page technical entry point. Product rationale lives in `../foundational/prd.md`; system design in `../foundational/architecture.md`; the *how* in `technical-architecture.md`. This page orients and indexes - it does not duplicate.

## Overview

Attest is a **QA-primitive MCP server and dashboard** that verifies user outcomes in a real browser and returns a structured, evidence-backed **attestation** - a verdict an agent can loop on, not a transcript it must interpret. Two entry points (an MCP server a coding agent calls, and a dashboard a human uses) drive **one** hosted, server-side execution path. Open-core and self-hostable (Apache-2.0), with a paid hosted tier (the `ee/` layer). Full product context: `../foundational/prd.md`.

## Goals (technical)

1. **Autonomous, outcome-level verdicts** - return a goal-relative `passed`/`failed`/`inconclusive`, never a raw action log (`[prd G1, G2]`).
2. **Machine-readable failures** - every failure carries failing step, root-cause hypothesis, evidence refs, and a mandatory next action (`[prd G3, G4]`).
3. **Context economy** - evidence stored, returned by reference; agents get compact verdicts (`[prd G5]`).
4. **Deploy anywhere, one codebase** - hosted and self-hosted with no functional gap in the verdict loop (`[prd G6]`).
5. **Trust by construction** - no source ingestion, tenant isolation, encrypted secrets never logged (`[prd G7]`).

## Core flow

1. Agent (`attest goal:"…"`) or human (dashboard "Run") triggers a run → `apps/backend`.
2. Backend authenticates, resolves org+app, checks the allowlist, decrypts secrets/BYOK, enqueues a job.
3. `apps/worker` launches an isolated browser, runs `packages/core` (plan → execute → capture evidence → 5 guards → judge), assembles an attestation.
4. Attestation + evidence refs written; status streams back. Agent reads the verdict and loops (fix → re-attest); human reviews in the dashboard.

Full sequence + diagram: `../foundational/architecture.md §4`.

## Surfaces

- `apps/web` - public landing + auth pages.
- `apps/dashboard` - authenticated app: orgs/apps/keys, trigger+watch runs, review attestations, per-agent model selection + BYOK (OpenRouter), billing.
- `apps/mcp` - thin MCP client the agent runs locally; forwards `attest` to the backend over an org-scoped key.

All three are entry points to the **same backend and execution path** (`[arch §1.1, §8 of prd]`).

## Scope

### In scope (MVP)

Hosted backend + worker (server-side Chromium) with a self-hostable build; `attest` + `verify_flow` + `assert_outcome`; Stagehand-based resolution behind an adapter; LLM judgment + five deterministic guards; tiered models + BYOK (encrypted); multi-tenant Org/App/Key model; `web` + `dashboard` + `mcp`; Apache-core / commercial-`ee/` split. (`[prd §9 MVP]`)

### Out of scope (MVP)

Cross-browser (Chromium only); mobile/device farms; visual-AI pixel benchmarking; load/perf/security testing; a full deterministic assertion engine; in-house element resolution. (`[prd §2.2]`) Permanently out: general web-browsing agent, scraping API, replacing human QA. (`[prd §2.3]`)

## Success criteria

| Criterion | Target | Source |
| --------- | ------ | ------ |
| Verdict accuracy vs human | > 95% | `[prd §10]` |
| False-positive rate | < 5% | `[prd §10]` |
| Median run time | < 60 s | `[prd §10]` |
| Fix-loop completion | > 70% | `[prd §10]` |
| Same attestation from both entry points | always | `[arch §1.1]` |

## Document map

| Need | Read |
| ---- | ---- |
| Why / product / market | `../foundational/prd.md` |
| System structure, data flow, schema, multi-tenancy | `../foundational/architecture.md` |
| Implementation rules, adapters, runtime, deploy | `technical-architecture.md` |
| Coding conventions | `code-standards.md` |
| UI design system, tokens, components | `ui-context.md` |
| How to build against these specs | `ai-workflow-rules.md` |
| Current state, next steps | `progress-tracker.md` |
