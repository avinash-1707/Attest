import { eq } from 'drizzle-orm';
import type { Db } from './types';
import { orgBilling } from '../schema';

export type OrgBilling = typeof orgBilling.$inferSelect;

type OrgBillingPatch = {
  dodoCustomerId?: string;
  dodoSubscriptionId?: string;
  subscriptionStatus?: string;
  currentTier?: string;
};

// Org <-> Dodo mapping + subscription state for one org [tech-arch §13.5]. ee/ only. Holds no secret;
// the Dodo ids are opaque references.
export function orgBillingRepo(db: Db, orgId: string) {
  return {
    async get(): Promise<OrgBilling | undefined> {
      const [row] = await db.select().from(orgBilling).where(eq(orgBilling.orgId, orgId));
      return row;
    },

    // Upsert the one row for this org, merging the provided fields.
    async upsert(patch: OrgBillingPatch): Promise<void> {
      await db
        .insert(orgBilling)
        .values({ orgId, ...patch })
        .onConflictDoUpdate({ target: orgBilling.orgId, set: { ...patch, updatedAt: new Date() } });
    },
  };
}
