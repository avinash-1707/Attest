import type { NextConfig } from 'next';

// The dashboard is a pure client of apps/backend [arch §3.2]: no server-side data fetching, no
// business logic. It talks to the backend over the authenticated API from the browser, so the only
// build-time config it needs is the public backend URL (read in src/lib/env.ts).
const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
