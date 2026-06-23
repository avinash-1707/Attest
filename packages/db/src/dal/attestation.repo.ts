import { and, eq } from 'drizzle-orm';
import { attestation as attestationContract, type Attestation, type RunStatus } from '@attest/contracts';
import type { Db } from './types';
import { attestation as attestationTable } from '../schema';

// The attestation crosses two validation boundaries [tech-arch §2.2]: it is parsed before write
// (a worker may never persist a doc that fails its own schema, #4) and parsed on read (#5).
export function attestationRepo(db: Db, orgId: string) {
  return {
    async save(runId: string, doc: Attestation): Promise<void> {
      const parsed = attestationContract.parse(doc);
      if (parsed.orgId !== orgId || parsed.runId !== runId) {
        throw new Error('attestation orgId/runId does not match the target run');
      }
      const values = {
        orgId,
        runId,
        schemaVersion: parsed.schemaVersion,
        status: parsed.status,
        document: parsed,
      };
      await db
        .insert(attestationTable)
        .values(values)
        .onConflictDoUpdate({
          target: attestationTable.runId,
          set: { status: parsed.status, schemaVersion: parsed.schemaVersion, document: parsed },
        });
    },

    async getByRun(runId: string): Promise<Attestation | undefined> {
      const [row] = await db
        .select({ document: attestationTable.document })
        .from(attestationTable)
        .where(and(eq(attestationTable.orgId, orgId), eq(attestationTable.runId, runId)));
      return row ? attestationContract.parse(row.document) : undefined;
    },

    // Reads only the denormalized verdict column - for status polling (the hottest read), so a poll
    // does not materialize + re-validate the full attestation document. undefined = no verdict yet.
    async statusByRun(runId: string): Promise<RunStatus | undefined> {
      const [row] = await db
        .select({ status: attestationTable.status })
        .from(attestationTable)
        .where(and(eq(attestationTable.orgId, orgId), eq(attestationTable.runId, runId)));
      return row?.status as RunStatus | undefined;
    },
  };
}
