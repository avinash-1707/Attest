import type { BillingMeter, RunMeterInput } from '@attest/contracts';
import type { DataAccess } from '@attest/db';
import { creditsForRun, type BillingPricing } from './pricing';

// The hosted meter: on a resolved run, write the UsageEvent + credit debit atomically and idempotently
// [tech-arch §13.2]. The credit charge is derived from the metered cost; BYOK runs charge infra only,
// the incentive that protects margin. The OSS build never constructs this (uses the no-op meter).
export function createBillingMeter(deps: { dal: DataAccess; pricing: BillingPricing }): BillingMeter {
  return {
    async recordAndDebit(input: RunMeterInput): Promise<void> {
      const credits = creditsForRun(input, deps.pricing);
      await deps.dal.forOrg(input.orgId).credits.debitForRun({
        runId: input.runId,
        appId: input.appId,
        credits,
        usage: {
          browserMinutes: input.browserMinutes,
          steps: input.steps,
          modelCostUsd: input.byok ? 0 : input.modelCostUsd,
        },
      });
    },
  };
}
