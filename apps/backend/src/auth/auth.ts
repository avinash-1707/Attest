import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { organization } from 'better-auth/plugins/organization';
import { emailOTP } from 'better-auth/plugins/email-otp';
import { schema, type Database } from '@attest/db';
import type { Mailer } from './mailer';

// Dashboard auth: session login (email/password + Google) over orgs/members [arch §6.1].
// - email/password is the credential; email is verified at signup via an OTP code (emailOTP),
//   and an unverified account cannot sign in (requireEmailVerification) [decision: OTP verifies email].
// - Google is a separate social path; a same-email Google sign-in auto-links to the password
//   account because Google verifies the address (trustedProviders) [decision: auto-link].
// The org plugin owns organization/member/invitation; its Drizzle tables are generated into
// packages/db via `@better-auth/cli generate` and are the FK target for every org-scoped row.

export interface AuthDeps {
  db: Database;
  mailer: Mailer;
  secret: string;
  baseURL: string;
  trustedOrigins: string[];
  google?: { clientId: string; clientSecret: string };
}

export function buildAuth(deps: AuthDeps) {
  return betterAuth({
    database: drizzleAdapter(deps.db, { provider: 'pg', schema }),
    secret: deps.secret,
    baseURL: deps.baseURL,
    trustedOrigins: deps.trustedOrigins,
    emailAndPassword: { enabled: true, requireEmailVerification: true },
    // OTP verification is how a new email/password account proves its address, and signUp returns no
    // session while unverified. The verify-email step must therefore ESTABLISH the session, or the
    // post-verify handoff (apps/web -> apps/dashboard) lands on a client with no cookie and bounces
    // straight back to sign-in. autoSignInAfterVerification makes verifyEmail create + set the session.
    emailVerification: { autoSignInAfterVerification: true },
    socialProviders: deps.google ? { google: deps.google } : {},
    // Auto-link a Google sign-in to an existing same-email account, but only when that local account
    // is already email-verified (requireLocalEmailVerified). This blocks the takeover where an
    // attacker seeds an unverified local row for a victim's email and waits for the Google link.
    account: {
      accountLinking: { enabled: true, trustedProviders: ['google'], requireLocalEmailVerified: true },
    },
    plugins: [
      organization(),
      emailOTP({
        sendVerificationOnSignUp: true,
        overrideDefaultEmailVerification: true,
        async sendVerificationOTP({ email, otp, type }) {
          await deps.mailer.sendVerificationOtp({ to: email, otp, type });
        },
      }),
    ],
  });
}

export type Auth = ReturnType<typeof buildAuth>;
