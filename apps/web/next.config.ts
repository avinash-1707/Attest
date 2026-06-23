import type { NextConfig } from 'next';

// apps/web is the public, unauthenticated surface [arch §3.1]: landing/marketing + the auth pages
// (sign-up, sign-in, OAuth callbacks). It talks to apps/backend's auth routes from the browser and
// hands off to apps/dashboard post-auth, so the only build-time config it needs is public URLs
// (read in src/lib/env.ts).
const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
