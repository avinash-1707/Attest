import type { BillingGate } from '@attest/contracts';
import { InsufficientCreditsError } from '@attest/contracts';
import type { DataAccess } from '@attest/db';
import type { BillingPricing } from './pricing';

// The hosted enqueue gate [tech-arch §13.4]. Hard-gates on balance: a run never starts unless the org
// can cover the conservative flat estimate. A new org is granted its one-time starter credits lazily +
// idempotently on first check (keyed 'starter:<orgId>', so existing and new orgs both get it once and a
// replay is a no-op), which is also the free-tier path. The OSS build never constructs this.
export function createBillingGate(deps: { dal: DataAccess; pricing: BillingPricing }): BillingGate {
  return {
    async assertCanEnqueue(orgId: string): Promise<void> {
      const credits = deps.dal.forOrg(orgId).credits;
      await credits.grant({
        amount: deps.pricing.starterCredits,
        idempotencyKey: `starter:${orgId}`,
        reason: 'starter',
      });
      const balance = await credits.balance();
      if (balance < deps.pricing.estimateCredits) {
        throw new InsufficientCreditsError(balance, deps.pricing.estimateCredits);
      }
    },
  };
}
