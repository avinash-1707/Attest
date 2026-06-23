// Public runtime config. apps/web runs in the browser, so the only env it reads must be a
// NEXT_PUBLIC_* var (inlined at build). It holds no secrets [arch §3.1, invariant 4].
//
// BACKEND_URL   - apps/backend, where the BetterAuth routes (/api/auth/*) are mounted.
// DASHBOARD_URL - apps/dashboard, the authenticated app web hands off to once a session exists.
//
// Defaults target local dev: backend :3000, dashboard :3001, this app :3002.
export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3000';
export const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? 'http://localhost:3001';
