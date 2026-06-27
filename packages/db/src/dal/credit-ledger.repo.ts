import { and, desc, eq, sql } from 'drizzle-orm';
import type { Db } from './types';
import { creditLedger, usageEvent } from '../schema';

export type CreditLedger = typeof creditLedger.$inferSelect;

// Idempotency key for a per-run credit reservation (hold). The gate writes a hold debit at enqueue so
// concurrent enqueues see each other's reservations (closing the check-then-act overspend race), and
// every terminal run transition releases it [audit 2026-06-27 H7]. Distinct from the final run debit's
// (org_id, run_id) key so the two never collide on the partial-unique index.
export function holdKey(runId: string): string {
  return `hold:${runId}`;
}

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

    // Reserve `holdCredits` for a run about to be enqueued, atomically: insert the hold (idempotent on
    // its key, so a re-delivery/retry of the same run reserves once) then read the balance INCLUDING the
    // hold inside the same transaction. Returns the post-hold balance when affordable; returns null and
    // rolls the hold back when it would drive the balance negative, so a rejected run reserves nothing.
    // Concurrent enqueues serialize on the row insert, so they can no longer all pass on one stale read.
    async reserveForRun(input: { runId: string; holdCredits: number }): Promise<number | null> {
      const rollback = Symbol('insufficient');
      try {
        return await db.transaction(async (tx) => {
          await tx
            .insert(creditLedger)
            .values({
              orgId,
              kind: 'debit',
              amount: -Math.abs(input.holdCredits),
              idempotencyKey: holdKey(input.runId),
              reason: 'run_hold',
            })
            .onConflictDoNothing({
              target: creditLedger.idempotencyKey,
              where: sql`${creditLedger.idempotencyKey} is not null`,
            });
          const [row] = await tx
            .select({ total: sql<number>`coalesce(sum(${creditLedger.amount}), 0)::int` })
            .from(creditLedger)
            .where(eq(creditLedger.orgId, orgId));
          const total = row?.total ?? 0;
          if (total < 0) throw rollback;
          return total;
        });
      } catch (e) {
        if (e === rollback) return null;
        throw e;
      }
    },

    // Release a run's reservation. Called on every terminal run transition so the hold never outlives
    // the run; the final debit (for a billed run) is written separately by debitForRun. Idempotent and
    // a harmless no-op when no hold exists (OSS build, or a run that was never reserved).
    async releaseHold(runId: string): Promise<void> {
      await db
        .delete(creditLedger)
        .where(and(eq(creditLedger.orgId, orgId), eq(creditLedger.idempotencyKey, holdKey(runId))));
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
