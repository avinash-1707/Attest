import { createAuthClient } from 'better-auth/react';
import { organizationClient, emailOTPClient } from 'better-auth/client/plugins';
import { BACKEND_URL } from './env';

// Better Auth client, the session half of the dashboard. It targets the backend's mounted auth routes
// (/api/auth/*) and must send cookies cross-origin, so credentials:'include' is set globally. The
// client plugins mirror the server (auth.ts): organization (active-org selection, member/invite) and
// emailOTP (typed authClient.emailOtp.* for the signup verification step).
//
// Session reads/writes go through this client; all OTHER data (runs, apps, keys, evidence) goes
// through the typed api.ts client. Both rely on the same session cookie.
export const authClient = createAuthClient({
  baseURL: BACKEND_URL,
  fetchOptions: { credentials: 'include' },
  plugins: [organizationClient(), emailOTPClient()],
});

export const { signIn, signUp, signOut, useSession, updateUser, organization, emailOtp } = authClient;
