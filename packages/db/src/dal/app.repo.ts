import { and, desc, eq, isNull } from 'drizzle-orm';
import type { Db } from './types';
import { one } from './util';
import { app } from '../schema';

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

    async archive(appId: string): Promise<void> {
      await db
        .update(app)
        .set({ archivedAt: new Date() })
        .where(and(eq(app.orgId, orgId), eq(app.id, appId)));
    },
  };
}
