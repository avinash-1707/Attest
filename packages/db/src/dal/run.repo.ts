import { and, desc, eq, sql } from 'drizzle-orm';
import type { Source, AgentRole } from '@attest/contracts';
import type { Db } from './types';
import { one } from './util';
import { run, app } from '../schema';

export type Run = typeof run.$inferSelect;

export function runRepo(db: Db, orgId: string) {
  return {
    async create(input: {
      appId: string;
      source: Source;
      goal: string;
      url: string;
      modelSnapshot?: Partial<Record<AgentRole, string>>;
    }): Promise<Run> {
      const [owned] = await db
        .select({ id: app.id })
        .from(app)
        .where(and(eq(app.orgId, orgId), eq(app.id, input.appId)));
      if (!owned) throw new Error('app not found in org');
      return one(
        await db
          .insert(run)
          .values({
            orgId,
            appId: input.appId,
            source: input.source,
            goal: input.goal,
            url: input.url,
            modelSnapshot: input.modelSnapshot,
          })
          .returning(),
      );
    },

    async get(runId: string): Promise<Run | undefined> {
      const [row] = await db
        .select()
        .from(run)
        .where(and(eq(run.orgId, orgId), eq(run.id, runId)));
      return row;
    },

    async list(options?: { appId?: string; limit?: number }): Promise<Run[]> {
      const where = options?.appId
        ? and(eq(run.orgId, orgId), eq(run.appId, options.appId))
        : eq(run.orgId, orgId);
      return db
        .select()
        .from(run)
        .where(where)
        .orderBy(desc(run.createdAt))
        .limit(options?.limit ?? 50);
    },

    async markRunning(runId: string): Promise<void> {
      await db
        .update(run)
        .set({ lifecycle: 'running', startedAt: new Date() })
        .where(and(eq(run.orgId, orgId), eq(run.id, runId)));
    },

    async markCompleted(runId: string, input: { durationMs: number }): Promise<void> {
      await db
        .update(run)
        .set({ lifecycle: 'completed', finishedAt: new Date(), durationMs: input.durationMs })
        .where(and(eq(run.orgId, orgId), eq(run.id, runId)));
    },

    async markCanceled(runId: string): Promise<void> {
      await db
        .update(run)
        .set({ lifecycle: 'canceled', finishedAt: new Date() })
        .where(and(eq(run.orgId, orgId), eq(run.id, runId)));
    },

    // Bumps the environment-failure retry counter; returns the new attempt count [tech-arch §7.5].
    async incrementAttempt(runId: string): Promise<number | undefined> {
      const [row] = await db
        .update(run)
        .set({ attempt: sql`${run.attempt} + 1` })
        .where(and(eq(run.orgId, orgId), eq(run.id, runId)))
        .returning({ attempt: run.attempt });
      return row?.attempt;
    },

    async setError(runId: string, message: string): Promise<void> {
      await db
        .update(run)
        .set({ error: message })
        .where(and(eq(run.orgId, orgId), eq(run.id, runId)));
    },
  };
}
