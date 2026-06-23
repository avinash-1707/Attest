import { and, desc, eq, gte } from 'drizzle-orm';
import type { Db } from './types';
import { usageEvent } from '../schema';

export type UsageEvent = typeof usageEvent.$inferSelect;

// Raw metering, one record per run [tech-arch §11, §13]. The UsageEvent is written atomically with the
// credit debit in creditLedger.debitForRun (the single writer for this table), so the read side here is
// list-only. Absent from the OSS build (self-hosters never meter).
export function usageRepo(db: Db, orgId: string) {
  return {
    async listSince(since: Date): Promise<UsageEvent[]> {
      return db
        .select()
        .from(usageEvent)
        .where(and(eq(usageEvent.orgId, orgId), gte(usageEvent.occurredAt, since)))
        .orderBy(desc(usageEvent.occurredAt));
    },
  };
}
