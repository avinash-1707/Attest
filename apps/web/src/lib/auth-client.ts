import { createAuthClient } from 'better-auth/react';
import { emailOTPClient } from 'better-auth/client/plugins';
import { BACKEND_URL } from './env';

// Better Auth client for the public auth surface. It targets the backend's mounted auth routes
// (/api/auth/*) and must send cookies cross-origin, so credentials:'include' is set globally. Only
// emailOTP is loaded here - the signup verification step is web's only plugin need. Org SELECTION is
// post-auth and lives in the dashboard, so organizationClient is deliberately NOT exported from web
// (that keeps the boundary enforced by code, not just convention). Sessions set here are read by the
// dashboard over the shared cookie.
export const authClient = createAuthClient({
  baseURL: BACKEND_URL,
  fetchOptions: { credentials: 'include' },
  plugins: [emailOTPClient()],
});

export const { signIn, signUp, signOut, useSession, emailOtp } = authClient;
