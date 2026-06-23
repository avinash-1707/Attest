import { getDb } from '@attest/db';
import { buildAuth, type Auth } from './auth';
import { createConsoleMailer } from './mailer';

// Schema-introspection instance, isolated so the running app and its tests NEVER construct it.
// `@better-auth/cli generate --config apps/backend/src/auth/auth.cli.ts` reads this `auth` export to
// (re)generate packages/db/src/schema/auth.ts. Env is read loosely on purpose: schema generation
// must not depend on a real secret/KEK, and this module is never imported on the runtime path, so
// the placeholder secret and the eager getDb() pool stay out of the app and test bundles.
export const auth: Auth = buildAuth({
  db: getDb(process.env.DATABASE_URL ?? 'postgresql://localhost:5432/attest'),
  mailer: createConsoleMailer(),
  secret: process.env.BETTER_AUTH_SECRET ?? 'better-auth-cli-schema-introspection-placeholder',
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
  trustedOrigins: [],
  google:
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET }
      : undefined,
});
