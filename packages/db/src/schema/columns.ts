import { customAlphabet } from 'nanoid';
import { text, timestamp } from 'drizzle-orm/pg-core';
import { organization } from './auth';

// Prefixed, URL-safe ids (e.g. run_… app_…) so an id is self-describing in logs and the
// attestation contract [arch §8]. Lowercase base36, 24 chars (~124 bits) collision-safe.
const nano = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 24);
export const genId = (prefix: string): string => `${prefix}_${nano()}`;

export const idColumn = (prefix: string) =>
  text('id')
    .primaryKey()
    .$defaultFn(() => genId(prefix));

// Tenant key on every row [arch §5.2, invariant 3]. FK to the BetterAuth-owned organization table;
// deleting an org cascades to all of its tenant data. Returns a fresh builder per table.
export const orgIdColumn = () =>
  text('org_id')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' });

export const timestamps = () => ({
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
