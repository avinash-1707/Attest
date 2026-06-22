import { pgTable, text, timestamp, index, uniqueIndex, primaryKey } from 'drizzle-orm/pg-core';
import { idColumn, orgIdColumn, timestamps } from './columns';
import { app } from './app';

// Org-scoped service key for MCP/agent auth [arch §6.2]. Resolves to exactly one org and a set of
// apps. Only the hash is stored; the plaintext key is shown once at creation [invariant 4].
export const appKey = pgTable(
  'app_key',
  {
    id: idColumn('ak'),
    orgId: orgIdColumn(),
    name: text('name').notNull(),
    // SHA-256 of the presented key; lookups hash-then-match, never store plaintext.
    keyHash: text('key_hash').notNull(),
    // Non-secret display prefix (e.g. "ak_live_a1b2"), safe to show in the dashboard.
    keyPrefix: text('key_prefix').notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [uniqueIndex('app_key_hash_idx').on(t.keyHash), index('app_key_org_idx').on(t.orgId)],
);

// The app-scope set: which apps a key may run attestations against [arch §6.2].
export const appKeyApp = pgTable(
  'app_key_app',
  {
    orgId: orgIdColumn(),
    appKeyId: text('app_key_id')
      .notNull()
      .references(() => appKey.id, { onDelete: 'cascade' }),
    appId: text('app_id')
      .notNull()
      .references(() => app.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.appKeyId, t.appId] }),
    index('app_key_app_org_idx').on(t.orgId),
    index('app_key_app_app_idx').on(t.appId),
  ],
);
