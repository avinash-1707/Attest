import { pgTable, text, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { idColumn, orgIdColumn, timestamps } from './columns';
import { organization } from './auth';
import { app } from './app';

// Per-org data key (DEK), wrapped by the deployment KEK [tech-arch §6.2]. One row per org. Holds only
// the wrapped (encrypted) DEK and which KEK wrapped it (for rotation); the plaintext DEK is never stored.
export const orgDek = pgTable('org_dek', {
  orgId: text('org_id')
    .primaryKey()
    .references(() => organization.id, { onDelete: 'cascade' }),
  wrappedDek: text('wrapped_dek').notNull(),
  kekId: text('kek_id').notNull(),
  ...timestamps(),
});

// BYOK model key (the user's OpenRouter key), encrypted at rest with the org DEK [arch §7.2, §10].
// Stores only the sealed ciphertext + a non-secret display prefix; decrypted at enqueue only,
// never returned to clients, never logged [invariant 4].
export const modelKey = pgTable(
  'model_key',
  {
    id: idColumn('mk'),
    orgId: orgIdColumn(),
    label: text('label').notNull(),
    provider: text('provider').notNull().default('openrouter'),
    keyPrefix: text('key_prefix').notNull(),
    ciphertext: text('ciphertext').notNull(),
    ...timestamps(),
  },
  (t) => [index('model_key_org_idx').on(t.orgId)],
);

// App login credentials, encrypted at rest with the org DEK [arch §10]. ciphertext is the sealed
// credential map; resolved server-side at enqueue, never returned to clients, never in evidence.
export const appCredential = pgTable(
  'app_credential',
  {
    id: idColumn('cred'),
    orgId: orgIdColumn(),
    appId: text('app_id')
      .notNull()
      .references(() => app.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    ciphertext: text('ciphertext').notNull(),
    ...timestamps(),
  },
  (t) => [
    index('app_credential_org_idx').on(t.orgId),
    index('app_credential_app_idx').on(t.appId),
    // One credential per (org, app, name): a duplicate name would otherwise create a second sealed row
    // and make resolution at enqueue ambiguous [audit 2026-06-27 M12].
    uniqueIndex('app_credential_org_app_name_uq').on(t.orgId, t.appId, t.name),
  ],
);
