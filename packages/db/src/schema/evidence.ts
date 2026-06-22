import { pgTable, text, integer, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { idColumn, orgIdColumn, timestamps } from './columns';
import { evidenceKindEnum } from './enums';
import { run } from './run';
import { app } from './app';

// A pointer into object storage. The row id is the opaque ref carried by the attestation
// (e.g. "ev_…"); payloads are never inlined and resolve through the read API [arch §8 G5, §9].
// Storage is namespaced by org/app and tenant-checked on access [arch §5.2, §9].
export const evidenceRef = pgTable(
  'evidence_ref',
  {
    id: idColumn('ev'),
    orgId: orgIdColumn(),
    appId: text('app_id')
      .notNull()
      .references(() => app.id, { onDelete: 'cascade' }),
    runId: text('run_id')
      .notNull()
      .references(() => run.id, { onDelete: 'cascade' }),
    // Null for run-level rollup evidence; set for per-step evidence [arch §8].
    stepIndex: integer('step_index'),
    kind: evidenceKindEnum('kind').notNull(),
    // Object-storage key within the org/app namespace (R2 hosted / disk self-hosted) [arch §9].
    storageKey: text('storage_key').notNull(),
    contentType: text('content_type'),
    bytes: integer('bytes'),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('evidence_storage_key_idx').on(t.storageKey),
    index('evidence_org_run_idx').on(t.orgId, t.runId),
  ],
);
