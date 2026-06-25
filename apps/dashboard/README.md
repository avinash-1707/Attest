# @attest/dashboard

The authenticated Attest app. A Next.js (App Router) dashboard where a human manages their orgs and apps, triggers and watches runs, reviews attestations, configures models and BYOK keys, and handles billing. It is the human entry point to the **same** backend and execution path the MCP server uses.

Runs on port **3001**.

## Surfaces

| Route | Purpose |
| ----- | ------- |
| `/` | Home: trigger a run, recent activity. |
| `/runs`, `/runs/[id]` | Run list and a single run with its attestation and evidence. |
| `/apps` | Apps and their URL allowlists. |
| `/credentials` | Per-app credentials (envelope-encrypted server-side). |
| `/org` | Org members and keys. |
| `/billing` | Plan, credits, and checkout (hosted). |
| `/profile` | Account settings. |

## Layout

```
src/
  app/                 App Router routes, layout, providers, global styles
  components/
    shell/             app frame: sidebar, nav, org switcher, user menu
    runs/              run trigger, run list, attestation view
    management/        apps, keys, credentials, model keys
    billing/           plan + credits UI
    auth/              session-aware gates
    home/              dashboard landing
    ui/                shared primitives
  lib/                 API client, auth client, query keys, hooks, env
```

## Develop

```bash
pnpm --filter @attest/dashboard dev       # next dev on :3001
pnpm --filter @attest/dashboard build
pnpm --filter @attest/dashboard typecheck
```

## Stack and conventions

- Next.js 16, React 19, Tailwind CSS v4.
- TanStack Query for server state; query keys live in `lib/query-keys.ts`.
- BetterAuth client for sessions, sharing a cookie with the backend and web app.
- `next-themes` for theming. The design system and tokens are documented in `docs/technical/ui-context.md`.

## Configuration

Reads the `NEXT_PUBLIC_*` block from the root `.env`: `NEXT_PUBLIC_BACKEND_URL`, `NEXT_PUBLIC_WEB_URL`, `NEXT_PUBLIC_DASHBOARD_URL`. These are inlined at build time and carry no secrets. For cross-subdomain SSO with the web app, `COOKIE_DOMAIN` is set on the backend. See [`.env.example`](../../.env.example).

## Boundaries

- Depends only on `@attest/contracts` for shared shapes. It talks to the backend over HTTP; it has no database or engine access.
- All run execution and attestation assembly happen server-side. The dashboard triggers, reads, and renders.
