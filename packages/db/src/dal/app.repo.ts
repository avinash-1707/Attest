import { and, desc, eq, isNull } from 'drizzle-orm';
import type { Db } from './types';
import { one } from './util';
import { app, appKeyApp } from '../schema';

export type App = typeof app.$inferSelect;

// All methods are bound to one org; orgId is never a parameter, so no caller can reach another
// tenant's rows [arch §5.2, invariant 3].
export function appRepo(db: Db, orgId: string) {
  return {
    async create(input: { name: string; allowlist?: string[] }): Promise<App> {
      return one(
        await db
          .insert(app)
          .values({ orgId, name: input.name, allowlist: input.allowlist ?? [] })
          .returning(),
      );
    },

    async get(appId: string): Promise<App | undefined> {
      const [row] = await db
        .select()
        .from(app)
        .where(and(eq(app.orgId, orgId), eq(app.id, appId)));
      return row;
    },

    async list(options?: { includeArchived?: boolean }): Promise<App[]> {
      const where = options?.includeArchived
        ? eq(app.orgId, orgId)
        : and(eq(app.orgId, orgId), isNull(app.archivedAt));
      return db.select().from(app).where(where).orderBy(desc(app.createdAt));
    },

    async update(
      appId: string,
      patch: { name?: string; allowlist?: string[] },
    ): Promise<App | undefined> {
      const [row] = await db
        .update(app)
        .set(patch)
        .where(and(eq(app.orgId, orgId), eq(app.id, appId)))
        .returning();
      return row;
    },

    // Archive an app and drop it from every service key's scope, in one transaction. A key scoped only
    // to this app is left with no apps, so it can no longer authorize or open secrets for the archived
    // app [audit 2026-06-27 M5]; credentials stay (inert - enqueue 404s an archived app). Returns false
    // when no such app exists in this org, so the route can 404 instead of a silent 204 [M11].
    async archive(appId: string): Promise<boolean> {
      return db.transaction(async (tx) => {
        const [row] = await tx
          .update(app)
          .set({ archivedAt: new Date() })
          .where(and(eq(app.orgId, orgId), eq(app.id, appId)))
          .returning({ id: app.id });
        if (!row) return false;
        await tx.delete(appKeyApp).where(and(eq(appKeyApp.orgId, orgId), eq(appKeyApp.appId, appId)));
        return true;
      });
    },
  };
}
