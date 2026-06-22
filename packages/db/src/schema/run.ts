import { pgTable, text, integer, timestamp, jsonb, index, pgEnum } from 'drizzle-orm/pg-core';
import type { AgentRole } from '@attest/contracts';
import { idColumn, orgIdColumn, timestamps } from './columns';
import { sourceEnum } from './enums';
import { app } from './app';

// Operational lifecycle of a run (queue/execution state), distinct from the goal verdict.
// The verdict (passed/failed/inconclusive) is the contract status and lives on the attestation
// [arch §8, tech-arch §4.3]. This enum is infra-only, never crosses a contract boundary.
export const runLifecycleEnum = pgEnum('run_lifecycle', [
  'queued',
  'running',
  'completed',
  'canceled',
]);

// A single attestation attempt [arch §5.1]. MCP- and dashboard-triggered runs are the same row,
// same path [invariant 1]; `source` is recorded for metrics only.
export const run = pgTable(
  'run',
  {
    id: idColumn('run'),
    orgId: orgIdColumn(),
    appId: text('app_id')
      .notNull()
      .references(() => app.id, { onDelete: 'restrict' }),
    source: sourceEnum('source').notNull(),
    goal: text('goal').notNull(),
    url: text('url').notNull(),
    lifecycle: runLifecycleEnum('lifecycle').notNull().default('queued'),
    // Environment-failure retries before resolving to inconclusive [tech-arch §7.5].
    attempt: integer('attempt').notNull().default(0),
    // Non-secret model choice per role for this run (OpenRouter model ids); the BYOK apiKey is
    // never persisted here [tech-arch §3.3, §6, invariant 4].
    modelSnapshot: jsonb('model_snapshot').$type<Partial<Record<AgentRole, string>>>(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    durationMs: integer('duration_ms'),
    // Operational error summary (never a secret, never an evidence payload) [invariant 4].
    error: text('error'),
    ...timestamps(),
  },
  (t) => [
    index('run_org_idx').on(t.orgId),
    index('run_org_app_idx').on(t.orgId, t.appId),
    index('run_org_lifecycle_idx').on(t.orgId, t.lifecycle),
    index('run_org_created_idx').on(t.orgId, t.createdAt),
  ],
);
