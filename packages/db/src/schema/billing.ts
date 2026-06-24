import { pgTable, text, integer, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { idColumn, orgIdColumn } from './columns';
import { organization } from './auth';
import { run } from './run';

// Billing lives entirely in the hosted (ee/) tier; these tables are unused by the OSS build
// (self-hosters never meter, never gate, run unlimited) [arch §11, tech-arch §13].

// Append-only credit ledger, the authoritative balance + run gate [tech-arch §13.4]. Rows are never
// updated or deleted; balance = SUM(amount). amount is signed credits (debit negative, grant positive).
// Two idempotency keys guard the money-correctness surface:
//   - (org_id, run_id) WHERE kind='debit' : a BullMQ re-delivery re-debits to a no-op.
//   - idempotency_key (unique)             : a replayed Dodo webhook (webhook-id) or a repeated starter
//                                            grant (starter:<orgId>) re-grants to a no-op.
export const creditLedger = pgTable(
  'credit_ledger',
  {
    id: idColumn('cl'),
    orgId: orgIdColumn(),
    // 'grant' | 'purchase' | 'debit' | 'refund' | 'expiry'
    kind: text('kind').notNull(),
    amount: integer('amount').notNull(),
    // Set on debit/refund; SET NULL on run delete so the money entry survives (runs are never the
    // authoritative record of a charge).
    runId: text('run_id').references(() => run.id, { onDelete: 'set null' }),
    // Dodo webhook-id for grants/purchases, or 'starter:<orgId>' for the one-time free-tier grant.
    idempotencyKey: text('idempotency_key'),
    // Human-readable origin: 'monthly_grant' | 'pack_purchase' | 'run_debit' | 'starter' | 'refund'.
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('credit_ledger_org_created_idx').on(t.orgId, t.createdAt),
    uniqueIndex('credit_ledger_debit_uq')
      .on(t.orgId, t.runId)
      .where(sql`${t.kind} = 'debit'`),
    uniqueIndex('credit_ledger_idem_uq')
      .on(t.idempotencyKey)
      .where(sql`${t.idempotencyKey} is not null`),
  ],
);

// Webhook dedupe + audit log [tech-arch §13.5]. NOT org-scoped: the org is derived from the verified
// payload (the legitimate non-tenant lookup, like resolveServiceKey). An insert that conflicts on the
// primary key means a duplicate delivery -> skip processing.
export const webhookEvent = pgTable('webhook_event', {
  // Standard-Webhooks 'webhook-id'.
  webhookId: text('webhook_id').primaryKey(),
  eventType: text('event_type').notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  // 'processed' | 'ignored'
  status: text('status').notNull(),
});

// Org <-> Dodo mapping + subscription state [tech-arch §13.3, §13.5]. One row per org. Holds no secret;
// the Dodo customer/subscription ids are opaque references, not credentials.
export const orgBilling = pgTable('org_billing', {
  orgId: text('org_id')
    .primaryKey()
    .references(() => organization.id, { onDelete: 'cascade' }),
  dodoCustomerId: text('dodo_customer_id'),
  dodoSubscriptionId: text('dodo_subscription_id'),
  // 'active' | 'on_hold' | 'failed' | 'cancelled' | 'expired'
  subscriptionStatus: text('subscription_status'),
  // Our-vocabulary plan id (e.g. 'team' | 'business'), resolved from the Dodo product_id at webhook
  // time [tech-arch §13.3]. Distinct from current_tier, which keeps the raw Dodo product_id for audit.
  planId: text('plan_id'),
  currentTier: text('current_tier'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
