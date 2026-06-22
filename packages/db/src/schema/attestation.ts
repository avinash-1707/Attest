import { pgTable, text, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import type { Attestation } from '@attest/contracts';
import { idColumn, orgIdColumn, timestamps } from './columns';
import { runStatusEnum } from './enums';
import { run } from './run';

// The verdict artifact, one per run [arch §5.1, §8]. The full document is validated against the
// contract schema before write [tech-arch §2.2 point 4] and is the primary run trace [tech-arch §11].
// Hot fields are denormalized as columns for listing/filtering; `document` stays authoritative.
export const attestation = pgTable(
  'attestation',
  {
    id: idColumn('att'),
    orgId: orgIdColumn(),
    runId: text('run_id')
      .notNull()
      .references(() => run.id, { onDelete: 'cascade' }),
    schemaVersion: text('schema_version').notNull(),
    status: runStatusEnum('status').notNull(),
    document: jsonb('document').$type<Attestation>().notNull(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('attestation_run_idx').on(t.runId),
    index('attestation_org_status_idx').on(t.orgId, t.status),
  ],
);
