import { and, desc, eq } from 'drizzle-orm';
import type { Db } from './types';
import { one } from './util';
import { modelKey } from '../schema';

export type ModelKey = typeof modelKey.$inferSelect;

// BYOK model keys for one org. The DAL stores only sealed ciphertext (encrypted with the org DEK by
// the secret cipher [tech-arch §6.2]); it never sees or returns plaintext. `ciphertext` must never be
// sent to a client - the read API projects label/provider/keyPrefix only [arch §10, invariant 4].
export function modelKeyRepo(db: Db, orgId: string) {
  return {
    async create(input: {
      label: string;
      provider?: string;
      keyPrefix: string;
      ciphertext: string;
    }): Promise<ModelKey> {
      return one(
        await db
          .insert(modelKey)
          .values({
            orgId,
            label: input.label,
            provider: input.provider,
            keyPrefix: input.keyPrefix,
            ciphertext: input.ciphertext,
          })
          .returning(),
      );
    },

    async list(): Promise<ModelKey[]> {
      return db
        .select()
        .from(modelKey)
        .where(eq(modelKey.orgId, orgId))
        .orderBy(desc(modelKey.createdAt));
    },

    async get(id: string): Promise<ModelKey | undefined> {
      const [row] = await db
        .select()
        .from(modelKey)
        .where(and(eq(modelKey.orgId, orgId), eq(modelKey.id, id)));
      return row;
    },

    // Returns false when no such key exists in this org, so the route can 404 [audit 2026-06-27 M11].
    async delete(id: string): Promise<boolean> {
      const rows = await db
        .delete(modelKey)
        .where(and(eq(modelKey.orgId, orgId), eq(modelKey.id, id)))
        .returning({ id: modelKey.id });
      return rows.length > 0;
    },
  };
}
