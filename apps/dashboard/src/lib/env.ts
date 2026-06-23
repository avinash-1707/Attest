// Public runtime config. The dashboard runs in the browser, so the only env it reads must be a
// NEXT_PUBLIC_* var (inlined at build). Everything else (secrets, model keys) lives server-side in
// apps/backend and is never exposed here [arch §3.2, invariant 4].
//
// Defaults target local dev: backend on :3000, this app on :3001.
export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3000';
