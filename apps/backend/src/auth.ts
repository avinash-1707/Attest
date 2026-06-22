import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { organization } from 'better-auth/plugins';
import { getDb, schema } from '@attest/db';

// Dashboard auth: session login (email/password + OAuth) over orgs/members [arch §6.1].
// The org plugin owns organization/member/invitation; its Drizzle tables are generated into
// packages/db via `@better-auth/cli generate` and are the FK target for every org-scoped row.
export const auth = betterAuth({
  database: drizzleAdapter(getDb(process.env.DATABASE_URL ?? 'postgresql://localhost:5432/attest'), {
    provider: 'pg',
    schema,
  }),
  emailAndPassword: { enabled: true },
  plugins: [organization()],
});

export type Auth = typeof auth;
