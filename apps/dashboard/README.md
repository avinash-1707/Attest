# @attest/dashboard

The authenticated Attest app. A Next.js (App Router) dashboard where a human manages their orgs and apps, triggers and watches runs, reviews attestations, configures models and BYOK keys, and handles billing. It is the human entry point to the **same** backend and execution path the MCP server uses.

Runs on port **3001**.

## Contents

- [Routes](#routes)
- [Settings modal](#settings-modal)
- [Data layer](#data-layer)
- [Shell](#shell)
- [Layout](#layout)
- [Develop](#develop)
- [Stack and conventions](#stack-and-conventions)
- [Configuration](#configuration)
- [Boundaries](#boundaries)

## Routes

| Route | Purpose |
| ----- | ------- |
| `/` | Overview: recent runs and a "New run" entry point. Redirects to the web app's sign-in if there is no session, or to `/org` if there is no active org. |
| `/runs` | Runs table with verdict filters (all / passed / failed / inconclusive); each row links to the detail. |
| `/runs/[id]` | One run: lifecycle and verdict, the step list (status, how each element resolved, which guards fired), the failure dossier when failed, and evidence (screenshots, DOM snapshots). Live-polls every 2s while queued or running. |
| `/apps` | Apps with their URL allowlists; create, edit, archive. Deep-links to `/credentials?appId=`. |
| `/credentials` | App login credentials, sealed server-side and never echoed back. Accepts an `appId` query param for deep-linking from an app. |
| `/org` | Org selection and creation; where the post-login flow lands when no org is active. |
| `/billing` | Plan, balance, and usage. Checkout and portal links surface here when hosted billing is enabled. |
| `/profile` | Account settings. |

The sidebar exposes Overview, Runs, Apps, and Billing. Org switching is in the sidebar's org switcher; account and key management live in the settings modal.

## Settings modal

Opened from the user menu (`components/shell/SettingsModal.tsx`), with three tabs:

- **Account**: profile and account settings.
- **API Keys**: service keys for MCP/agents. Create scopes a key to selected apps and reveals the plaintext exactly once in a copy-gated modal; the list shows only the prefix, scope, and last-used time.
- **Model Keys**: BYOK OpenRouter keys. The key is entered as a password field, sealed server-side, and never returned.

## Data layer

- `lib/api.ts`: a typed client targeting the backend with `credentials: "include"`. Every response is re-validated against `@attest/contracts`, so backend drift surfaces as a parse error instead of corrupting state. Exposes an `ApiError` class and per-endpoint functions.
- `lib/query-keys.ts`: the central TanStack Query key hierarchy (`runs`, `run(id)`, `attestation(id)`, `evidence(id)`, `apps`, `keys`, `modelKeys`, `credentials(appId?)`, `billing`).
- `lib/hooks.ts`: typed query and mutation hooks. `useRun(id, { live })` polls every 2s until the lifecycle is terminal. Mutations invalidate their list keys on success.
- `lib/auth-client.ts`: the BetterAuth client with the organization and email-OTP plugins, `credentials: "include"` for the cross-origin cookie.

## Shell

`components/shell/` holds the app frame: a collapsed 64px sidebar rail that expands to 240px on hover (a fixed overlay, no reflow), the nav with active-route detection, the org switcher (lists orgs, calls `setActive`, refetches the session with the cookie cache disabled, then invalidates all queries to re-scope data), the user menu (session email, sign-out, settings), and the theme toggle.

## Layout

```
src/
  app/                 routes, root layout, providers (QueryClient), global styles
  components/
    shell/             sidebar, nav, org switcher, user menu, settings modal, theme toggle
    runs/              runs table, run detail (status / attestation / dossier / steps / evidence), create-run form
    management/        apps, keys, model-keys, credentials (each: table + create/edit modals)
    billing/           plan + credits UI
    auth/              org-select form
    home/              overview content
    ui/                shared primitives (Button, Card, Input, Modal, ConfirmDialog, Badge, StatusPill, Spinner, ...)
  lib/                 api client, auth client, query keys, hooks, env
```

## Develop

```bash
pnpm --filter @attest/dashboard dev        # next dev on :3001
pnpm --filter @attest/dashboard build
pnpm --filter @attest/dashboard typecheck
```

## Stack and conventions

- Next.js 16, React 19, Tailwind CSS v4.
- TanStack Query v5 for server state.
- BetterAuth client for sessions, sharing a cookie with the backend and web app.
- `next-themes` for theming. The design system, tokens, and motion are documented in `docs/technical/ui-context.md`; tokens live in `src/app/globals.css`.

## Configuration

Reads the `NEXT_PUBLIC_*` block from the root `.env`: `NEXT_PUBLIC_BACKEND_URL` (API and auth), `NEXT_PUBLIC_WEB_URL` (sign-in redirect), `NEXT_PUBLIC_DASHBOARD_URL`. Inlined at build, no secrets. Cross-subdomain SSO with the web app uses `COOKIE_DOMAIN` on the backend. See [`.env.example`](../../.env.example).

## Boundaries

- Depends only on `@attest/contracts` for shared shapes. It talks to the backend over HTTP; no database or engine access.
- The `orgId` is resolved server-side from the session, never sent by the client, so a user cannot reach another org's data.
- All run execution and attestation assembly happen server-side. The dashboard triggers, reads, and renders.
