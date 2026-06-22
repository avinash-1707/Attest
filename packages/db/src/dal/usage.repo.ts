import { and, desc, eq, gte } from 'drizzle-orm';
import type { Db } from './types';
import { one } from './util';
import { usageEvent } from '../schema';

export type UsageEvent = typeof usageEvent.$inferSelect;

// Raw metering, one record per run [tech-arch §11, §13]. ee/metering writes here; absent from the
// OSS build (self-hosters never meter).
export function usageRepo(db: Db, orgId: string) {
  return {
    async record(input: {
      appId: string;
      runId: string;
      browserMinutes: number;
      steps: number;
      modelCostUsd: number;
      runs?: number;
    }): Promise<UsageEvent> {
      return one(
        await db
          .insert(usageEvent)
          .values({
            orgId,
            appId: input.appId,
            runId: input.runId,
            runs: input.runs ?? 1,
            browserMinutes: input.browserMinutes.toString(),
            steps: input.steps,
            modelCostUsd: input.modelCostUsd.toString(),
          })
          .returning(),
      );
    },

    async listSince(since: Date): Promise<UsageEvent[]> {
      return db
        .select()
        .from(usageEvent)
        .where(and(eq(usageEvent.orgId, orgId), gte(usageEvent.occurredAt, since)))
        .orderBy(desc(usageEvent.occurredAt));
    },
  };
}
