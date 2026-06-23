// Public runtime config. The dashboard runs in the browser, so the only env it reads must be a
// NEXT_PUBLIC_* var (inlined at build). Everything else (secrets, model keys) lives server-side in
// apps/backend and is never exposed here [arch §3.2, invariant 4].
//
// BACKEND_URL - apps/backend, the authenticated API + the BetterAuth routes.
// WEB_URL     - apps/web, the public auth surface the dashboard bounces to when there is no session
//               or on sign-out [arch §3.1].
//
// Defaults target local dev: backend :3000, this app :3001, web :3002.
export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3000';
export const WEB_URL = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3002';
