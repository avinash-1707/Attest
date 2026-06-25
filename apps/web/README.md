# @attest/web

The public face of Attest. A Next.js (App Router) site that serves the marketing landing page and the authentication flow (sign-in, sign-up, email verification). After authenticating, users move to the [dashboard](../dashboard); the two share one session.

Runs on port **3002**.

## Surfaces

| Route | Purpose |
| ----- | ------- |
| `/` | Marketing landing. |
| `/sign-in` | Email/password and optional Google sign-in. |
| `/sign-up` | Account creation. |
| `/verify-email` | Email verification. |

## Layout

```
src/
  app/
    page.tsx           landing
    (auth)/            sign-in, sign-up, verify-email
    layout.tsx         root layout, providers, global styles
  components/
    marketing/         landing sections and art
    auth/              auth forms
    ui/                shared primitives
    SmoothScroll.tsx   Lenis-based smooth scrolling
  lib/                 auth client, redirect-if-authed, env
```

## Develop

```bash
pnpm --filter @attest/web dev             # next dev on :3002
pnpm --filter @attest/web build
pnpm --filter @attest/web typecheck
```

## Stack and conventions

- Next.js 16, React 19, Tailwind CSS v4.
- BetterAuth client for the auth flow; the session cookie is shared with the dashboard across subdomains via `COOKIE_DOMAIN`.
- Lenis for smooth scrolling, `next-themes` for theming. Design tokens are in `docs/technical/ui-context.md`.

## Configuration

Reads the `NEXT_PUBLIC_*` block from the root `.env`: `NEXT_PUBLIC_BACKEND_URL`, `NEXT_PUBLIC_WEB_URL`, `NEXT_PUBLIC_DASHBOARD_URL`. Inlined at build, no secrets. A signed-in user landing here is redirected to the dashboard. See [`.env.example`](../../.env.example).

## Boundaries

- Depends only on `@attest/contracts`. It performs auth against the backend and otherwise serves static marketing content.
- No database, engine, or run access; it is the unauthenticated and sign-in surface only.
