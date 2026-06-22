import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core';
import { idColumn, orgIdColumn, timestamps } from './columns';

// An App is the unit that owns an allowlist and (later) test credentials [arch §5.3].
// Org-scoped keys are meaningful only against apps ("this key may test App X").
export const app = pgTable(
  'app',
  {
    id: idColumn('app'),
    orgId: orgIdColumn(),
    name: text('name').notNull(),
    // The navigation allowlist: the security guardrail enforced at enqueue and re-checked in the
    // worker [arch §10, tech-arch §7.4]. The agent can never expand it [invariant 7].
    allowlist: text('allowlist').array().notNull().default([]),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [index('app_org_idx').on(t.orgId)],
);
