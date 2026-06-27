import { and, desc, eq, lt, notInArray, or, sql } from 'drizzle-orm';
import type { Source, AgentRole } from '@attest/contracts';
import type { Db } from './types';
import { one } from './util';
import { run, app, creditLedger } from '../schema';
import { holdKey } from './credit-ledger.repo';
import { AppScopeError } from './errors';

export type Run = typeof run.$inferSelect;

// Keyset cursor: the position of the last row of the previous page, under the (createdAt DESC, id
// DESC) sort. Position only, never tenancy - org scope is re-derived from the session every request.
export interface RunCursor {
  createdAt: Date;
  id: string;
}

export interface RunListPage {
  rows: Run[];
  nextCursor: RunCursor | null;
}

const TERMINAL = ['completed', 'canceled'] as const;

export function runRepo(db: Db, orgId: string) {
  // Release any credit hold a run reserved at enqueue [audit 2026-06-27 H7]. Idempotent no-op when no
  // hold exists (OSS build, or a never-reserved run). Folded into every terminal transition below so a
  // hold can never outlive the run that reserved it.
  async function releaseHold(runId: string): Promise<void> {
    await db
      .delete(creditLedger)
      .where(and(eq(creditLedger.orgId, orgId), eq(creditLedger.idempotencyKey, holdKey(runId))));
  }

  return {
    async create(input: {
      // Optional caller-minted id so the enqueue producer can reserve a credit hold against the runId
      // before the row exists [audit 2026-06-27 H7]. Omitted = DB-default generated.
      id?: string;
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
      if (!owned) throw new AppScopeError('app not found in org');
      return one(
        await db
          .insert(run)
          .values({
            ...(input.id ? { id: input.id } : {}),
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

    // Keyset (cursor) pagination over (createdAt DESC, id DESC). The sort key pairs created_at with
    // the unique id tie-breaker so a same-millisecond batch can never skip/duplicate a row across a
    // page boundary. The cursor comparison is EXCLUSIVE and MUST mirror the ORDER BY columns and
    // direction exactly. Fetches limit+1 to detect a further page without a second count query.
    async list(options?: { appId?: string; limit?: number; cursor?: RunCursor }): Promise<RunListPage> {
      const tenancy = options?.appId
        ? and(eq(run.orgId, orgId), eq(run.appId, options.appId))
        : eq(run.orgId, orgId);
      const keyset = options?.cursor
        ? or(
            lt(run.createdAt, options.cursor.createdAt),
            and(eq(run.createdAt, options.cursor.createdAt), lt(run.id, options.cursor.id)),
          )
        : undefined;
      const limit = options?.limit ?? 50;
      const rows = await db
        .select()
        .from(run)
        .where(keyset ? and(tenancy, keyset) : tenancy)
        .orderBy(desc(run.createdAt), desc(run.id))
        .limit(limit + 1);
      const hasMore = rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;
      const last = page[page.length - 1];
      return {
        rows: page,
        nextCursor: hasMore && last ? { createdAt: last.createdAt, id: last.id } : null,
      };
    },

    // Claim a run for execution. Guarded against terminal states so a stale/at-least-once re-delivery of
    // an already-finished run can never resurrect it to `running` and re-execute it [audit 2026-06-27 H4].
    // A retry (run still `queued`/`running`) re-claims fine; returns false when the run already resolved.
    async markRunning(runId: string): Promise<boolean> {
      const claimed = await db
        .update(run)
        .set({ lifecycle: 'running', startedAt: new Date() })
        .where(and(eq(run.orgId, orgId), eq(run.id, runId), notInArray(run.lifecycle, [...TERMINAL])))
        .returning({ id: run.id });
      return claimed.length > 0;
    },

    async markCompleted(runId: string, input: { durationMs: number }): Promise<void> {
      await db
        .update(run)
        .set({ lifecycle: 'completed', finishedAt: new Date(), durationMs: input.durationMs })
        .where(and(eq(run.orgId, orgId), eq(run.id, runId)));
      await releaseHold(runId);
    },

    async markCanceled(runId: string): Promise<void> {
      await db
        .update(run)
        .set({ lifecycle: 'canceled', finishedAt: new Date() })
        .where(and(eq(run.orgId, orgId), eq(run.id, runId)));
      await releaseHold(runId);
    },

    // Terminal operational rejection (allowlist denial, missing app, final-attempt worker fault) in a
    // single write, so there is no partial-write window between the error and the lifecycle.
    async failPermanently(runId: string, message: string): Promise<void> {
      await db
        .update(run)
        .set({ lifecycle: 'canceled', finishedAt: new Date(), error: message })
        .where(and(eq(run.orgId, orgId), eq(run.id, runId)));
      await releaseHold(runId);
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
