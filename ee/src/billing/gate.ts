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
    async assertCanEnqueue(orgId: string, runId: string): Promise<void> {
      const credits = deps.dal.forOrg(orgId).credits;
      await credits.grant({
        amount: deps.pricing.starterCredits,
        idempotencyKey: `starter:${orgId}`,
        reason: 'starter',
      });
      // Atomically reserve the flat per-run estimate as a hold and read the post-hold balance. A null
      // result means the hold would overdraw the account, so it was rolled back: reject. Reserving (vs.
      // a bare balance read) closes the check-then-act race where N concurrent enqueues at a near-floor
      // balance all pass [audit 2026-06-27 H7]. The hold is released on any terminal run transition.
      const remaining = await credits.reserveForRun({ runId, holdCredits: deps.pricing.estimateCredits });
      if (remaining === null) {
        const balance = await credits.balance();
        throw new InsufficientCreditsError(balance, deps.pricing.estimateCredits);
      }
    },
  };
}
