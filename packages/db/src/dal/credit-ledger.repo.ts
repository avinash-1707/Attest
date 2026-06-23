import { desc, eq, sql } from 'drizzle-orm';
import type { Db } from './types';
import { creditLedger, usageEvent } from '../schema';

export type CreditLedger = typeof creditLedger.$inferSelect;

// The append-only credit ledger for one org, authoritative for balance + run gating [tech-arch §13.4].
// Used only by the ee/ tier; the OSS build never calls it. Every write is idempotent so a BullMQ
// re-delivery (debit) or a replayed Dodo webhook (grant) converges instead of double-counting.
export function creditLedgerRepo(db: Db, orgId: string) {
  return {
    // Live SUM, always correct by construction (no cached column to invalidate). The (org_id,created_at)
    // index covers it; revisit a cached snapshot only when an org's ledger is large enough to matter.
    async balance(): Promise<number> {
      const [row] = await db
        .select({ total: sql<number>`coalesce(sum(${creditLedger.amount}), 0)::int` })
        .from(creditLedger)
        .where(eq(creditLedger.orgId, orgId));
      return row?.total ?? 0;
    },

    // A positive entry (subscription grant, pack purchase, refund, or the one-time starter grant),
    // deduped on idempotencyKey: the Dodo webhook-id, or 'starter:<orgId>'. A replay is a no-op.
    async grant(input: {
      amount: number;
      idempotencyKey: string;
      reason: string;
      kind?: 'grant' | 'purchase' | 'refund';
    }): Promise<void> {
      await db
        .insert(creditLedger)
        .values({
          orgId,
          kind: input.kind ?? 'grant',
          amount: input.amount,
          idempotencyKey: input.idempotencyKey,
          reason: input.reason,
        })
        .onConflictDoNothing({
          target: creditLedger.idempotencyKey,
          where: sql`${creditLedger.idempotencyKey} is not null`,
        });
    },

    // One run's metering + charge, written atomically and idempotently on runId. The UsageEvent is the
    // raw meter; the debit is the credits spent. A re-delivered job re-runs this to a no-op on both
    // rows [tech-arch §13.2]. credits is the already-computed debit (0 charges nothing, e.g. a free run).
    async debitForRun(input: {
      runId: string;
      appId: string;
      credits: number;
      usage: { browserMinutes: number; steps: number; modelCostUsd: number };
    }): Promise<void> {
      await db.transaction(async (tx) => {
        await tx
          .insert(usageEvent)
          .values({
            orgId,
            appId: input.appId,
            runId: input.runId,
            browserMinutes: String(input.usage.browserMinutes),
            steps: input.usage.steps,
            modelCostUsd: String(input.usage.modelCostUsd),
          })
          .onConflictDoNothing({ target: [usageEvent.orgId, usageEvent.runId] });

        if (input.credits > 0) {
          await tx
            .insert(creditLedger)
            .values({
              orgId,
              kind: 'debit',
              amount: -Math.abs(input.credits),
              runId: input.runId,
              reason: 'run_debit',
            })
            .onConflictDoNothing({
              target: [creditLedger.orgId, creditLedger.runId],
              where: sql`${creditLedger.kind} = 'debit'`,
            });
        }
      });
    },

    async list(limit = 50): Promise<CreditLedger[]> {
      return db
        .select()
        .from(creditLedger)
        .where(eq(creditLedger.orgId, orgId))
        .orderBy(desc(creditLedger.createdAt))
        .limit(limit);
    },
  };
}
