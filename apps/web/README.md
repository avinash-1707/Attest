# @attest/web

The public face of Attest. A Next.js (App Router) site that serves the marketing landing page and the authentication flow (sign-in, sign-up, email verification). After authenticating, users hand off to the [dashboard](../dashboard); the two share one session.

Runs on port **3002**.

## Contents

- [Routes](#routes)
- [Auth flow](#auth-flow)
- [Cross-app handoff](#cross-app-handoff)
- [Layout](#layout)
- [Develop](#develop)
- [Stack and conventions](#stack-and-conventions)
- [Configuration](#configuration)
- [Boundaries](#boundaries)

## Routes

| Route | Purpose |
| ----- | ------- |
| `/` | Marketing landing: hero, integrations, proof comparison, how-it-works, metrics, surfaces, guarantees, open-core, pricing, FAQ, final CTA. |
| `/sign-in` | Email/password and optional Google sign-in. |
| `/sign-up` | Account creation. |
| `/verify-email` | Email OTP verification; hands off to the dashboard on success. |

The auth pages live in an `(auth)` route group sharing a centered card layout. A signed-in user who lands on an auth page is redirected to the dashboard (`lib/use-redirect-if-authed.ts`).

## Auth flow

Backed by the BetterAuth client (`lib/auth-client.ts`), which loads only the email-OTP plugin. Organization selection is deliberately **not** here; it is a post-auth concern owned by the dashboard, so the `organizationClient` is not exported from web.

- **Email/password.** Sign up or sign in, then verify a 6-digit OTP on `/verify-email`. The backend auto-signs in after verification and mints the session cookie.
- **Google.** `signIn.social({ provider: "google", callbackURL: DASHBOARD_URL })`. The backend completes OAuth, mints the session, and redirects to the dashboard.

## Cross-app handoff

On a successful sign-in or verification, the page does a full `window.location.assign(DASHBOARD_URL)` rather than a client-side navigation, so the browser carries the freshly set session cookie across origins. The session is shared because the cookie is host-only across ports locally, and scoped to a shared parent domain in production via `COOKIE_DOMAIN` (set on the backend).

## Layout

```
src/
  app/
    page.tsx           marketing landing
    (auth)/            sign-in, sign-up, verify-email, shared auth layout
    layout.tsx         root layout, providers, global styles
  components/
    marketing/         landing sections (Hero, Pricing, Faq, ...) and art/ (seal, guilloche, icons)
    auth/              sign-in / sign-up / OTP forms
    ui/                shared primitives
    SmoothScroll.tsx   Lenis smooth scrolling
  lib/                 auth client, use-redirect-if-authed, env
```

## Develop

```bash
pnpm --filter @attest/web dev              # next dev on :3002
pnpm --filter @attest/web build
pnpm --filter @attest/web typecheck
```

## Stack and conventions

- Next.js 16, React 19, Tailwind CSS v4.
- BetterAuth client (email-OTP plugin only) for the auth flow.
- Lenis for smooth scrolling, `next-themes` for theming. Design tokens are documented in `docs/technical/ui-context.md`.

## Configuration

Reads the `NEXT_PUBLIC_*` block from the root `.env`: `NEXT_PUBLIC_BACKEND_URL` (auth routes), `NEXT_PUBLIC_DASHBOARD_URL` (post-auth handoff), `NEXT_PUBLIC_WEB_URL`. Inlined at build, no secrets. See [`.env.example`](../../.env.example).

## Boundaries

- Depends only on `@attest/contracts`. It authenticates against the backend and otherwise serves static marketing content.
- No database, engine, or run access; it is the unauthenticated and sign-in surface only. Org selection happens in the dashboard.
