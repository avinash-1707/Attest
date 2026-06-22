import { and, eq } from 'drizzle-orm';
import type { EvidenceKind } from '@attest/contracts';
import type { Db } from './types';
import { one } from './util';
import { evidenceRef } from '../schema';

export type EvidenceRefRow = typeof evidenceRef.$inferSelect;

export type NewEvidence = {
  appId: string;
  runId: string;
  kind: EvidenceKind;
  storageKey: string;
  stepIndex?: number;
  contentType?: string;
  bytes?: number;
};

export function evidenceRepo(db: Db, orgId: string) {
  return {
    async create(input: NewEvidence): Promise<EvidenceRefRow> {
      return one(await db.insert(evidenceRef).values({ orgId, ...input }).returning());
    },

    async createMany(inputs: NewEvidence[]): Promise<EvidenceRefRow[]> {
      if (!inputs.length) return [];
      return db
        .insert(evidenceRef)
        .values(inputs.map((i) => ({ orgId, ...i })))
        .returning();
    },

    // Resolves an opaque ref for the read API; org-scoped so a foreign ref returns undefined
    // [arch §8 G5, §5.2].
    async get(refId: string): Promise<EvidenceRefRow | undefined> {
      const [row] = await db
        .select()
        .from(evidenceRef)
        .where(and(eq(evidenceRef.orgId, orgId), eq(evidenceRef.id, refId)));
      return row;
    },

    async listForRun(runId: string): Promise<EvidenceRefRow[]> {
      return db
        .select()
        .from(evidenceRef)
        .where(and(eq(evidenceRef.orgId, orgId), eq(evidenceRef.runId, runId)));
    },
  };
}
