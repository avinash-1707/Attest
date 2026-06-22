import { and, desc, eq } from 'drizzle-orm';
import type { Db } from './types';
import { one } from './util';
import { appCredential, app } from '../schema';

export type AppCredential = typeof appCredential.$inferSelect;

// App login credentials for one org. Like the model-key repo, it holds only sealed ciphertext
// (encrypted with the org DEK [tech-arch §6.2]); plaintext never reaches the DAL. A credential set
// can only attach to an app this org owns, or it would leak across the tenant boundary [invariant 3].
export function appCredentialRepo(db: Db, orgId: string) {
  return {
    async create(input: {
      appId: string;
      name: string;
      ciphertext: string;
    }): Promise<AppCredential> {
      return db.transaction(async (tx) => {
        const [owned] = await tx
          .select({ id: app.id })
          .from(app)
          .where(and(eq(app.orgId, orgId), eq(app.id, input.appId)));
        if (!owned) throw new Error('app not found in org');
        return one(
          await tx
            .insert(appCredential)
            .values({ orgId, appId: input.appId, name: input.name, ciphertext: input.ciphertext })
            .returning(),
        );
      });
    },

    async list(options?: { appId?: string }): Promise<AppCredential[]> {
      const where = options?.appId
        ? and(eq(appCredential.orgId, orgId), eq(appCredential.appId, options.appId))
        : eq(appCredential.orgId, orgId);
      return db.select().from(appCredential).where(where).orderBy(desc(appCredential.createdAt));
    },

    async get(id: string): Promise<AppCredential | undefined> {
      const [row] = await db
        .select()
        .from(appCredential)
        .where(and(eq(appCredential.orgId, orgId), eq(appCredential.id, id)));
      return row;
    },

    async delete(id: string): Promise<void> {
      await db.delete(appCredential).where(and(eq(appCredential.orgId, orgId), eq(appCredential.id, id)));
    },
  };
}
