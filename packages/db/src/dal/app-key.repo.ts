import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Db } from './types';
import { one } from './util';
import { appKey, appKeyApp, app } from '../schema';
import { AppScopeError } from './errors';

export type AppKey = typeof appKey.$inferSelect;

// Service keys for one org. Plaintext is hashed by the caller (auth layer); the DAL stores the
// hash + display prefix only [arch §6.2, invariant 4].
export function appKeyRepo(db: Db, orgId: string) {
  return {
    async create(input: {
      name: string;
      keyHash: string;
      keyPrefix: string;
      appIds: string[];
      expiresAt?: Date;
    }): Promise<AppKey> {
      return db.transaction(async (tx) => {
        // Every scoped app must belong to this org, or the key would grant cross-tenant access.
        const owned = await tx
          .select({ id: app.id })
          .from(app)
          .where(and(eq(app.orgId, orgId), inArray(app.id, input.appIds)));
        if (owned.length !== new Set(input.appIds).size) {
          throw new AppScopeError('app scope contains an app outside this org');
        }
        const key = one(
          await tx
            .insert(appKey)
            .values({
              orgId,
              name: input.name,
              keyHash: input.keyHash,
              keyPrefix: input.keyPrefix,
              expiresAt: input.expiresAt,
            })
            .returning(),
        );
        if (input.appIds.length) {
          await tx
            .insert(appKeyApp)
            .values(input.appIds.map((appId) => ({ orgId, appKeyId: key.id, appId })));
        }
        return key;
      });
    },

    async list(): Promise<AppKey[]> {
      return db
        .select()
        .from(appKey)
        .where(eq(appKey.orgId, orgId))
        .orderBy(desc(appKey.createdAt));
    },

    // Keys + their app scope in a SINGLE join query (avoids an N+1 scopedAppIds call per key when
    // listing for the dashboard). A key with no scope rows comes back with appIds: [].
    async listWithScopes(): Promise<Array<AppKey & { appIds: string[] }>> {
      const rows = await db
        .select({ key: appKey, appId: appKeyApp.appId })
        .from(appKey)
        .leftJoin(appKeyApp, and(eq(appKeyApp.appKeyId, appKey.id), eq(appKeyApp.orgId, orgId)))
        .where(eq(appKey.orgId, orgId))
        .orderBy(desc(appKey.createdAt));
      const byId = new Map<string, AppKey & { appIds: string[] }>();
      for (const row of rows) {
        const existing = byId.get(row.key.id) ?? { ...row.key, appIds: [] };
        if (row.appId) existing.appIds.push(row.appId);
        byId.set(row.key.id, existing);
      }
      return [...byId.values()];
    },

    async scopedAppIds(appKeyId: string): Promise<string[]> {
      const rows = await db
        .select({ appId: appKeyApp.appId })
        .from(appKeyApp)
        .where(and(eq(appKeyApp.orgId, orgId), eq(appKeyApp.appKeyId, appKeyId)));
      return rows.map((r) => r.appId);
    },

    // Returns false when no such key exists in this org, so the route can 404 rather than a silent 204
    // [audit 2026-06-27 M11].
    async revoke(appKeyId: string): Promise<boolean> {
      const rows = await db
        .update(appKey)
        .set({ revokedAt: new Date() })
        .where(and(eq(appKey.orgId, orgId), eq(appKey.id, appKeyId)))
        .returning({ id: appKey.id });
      return rows.length > 0;
    },

    async touchLastUsed(appKeyId: string): Promise<void> {
      await db
        .update(appKey)
        .set({ lastUsedAt: new Date() })
        .where(and(eq(appKey.orgId, orgId), eq(appKey.id, appKeyId)));
    },
  };
}
