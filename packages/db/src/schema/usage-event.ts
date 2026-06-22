import { pgTable, text, integer, numeric, timestamp, index } from 'drizzle-orm/pg-core';
import { idColumn, orgIdColumn, timestamps } from './columns';
import { run } from './run';
import { app } from './app';

// Raw metering record, one per run: the tunable source of truth for billing [tech-arch §11, §13].
// Captures runs + browser-minutes + steps + model cost so pricing can change without
// re-instrumentation. Emitted by ee/metering; absent from the OSS build (self-hosters never meter).
export const usageEvent = pgTable(
  'usage_event',
  {
    id: idColumn('ue'),
    orgId: orgIdColumn(),
    appId: text('app_id')
      .notNull()
      .references(() => app.id, { onDelete: 'cascade' }),
    runId: text('run_id')
      .notNull()
      .references(() => run.id, { onDelete: 'cascade' }),
    runs: integer('runs').notNull().default(1),
    browserMinutes: numeric('browser_minutes', { precision: 10, scale: 3 }).notNull().default('0'),
    steps: integer('steps').notNull().default(0),
    modelCostUsd: numeric('model_cost_usd', { precision: 12, scale: 6 }).notNull().default('0'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    ...timestamps(),
  },
  (t) => [
    index('usage_event_org_occurred_idx').on(t.orgId, t.occurredAt),
    index('usage_event_org_run_idx').on(t.orgId, t.runId),
  ],
);
