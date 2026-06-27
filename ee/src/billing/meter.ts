import type { BillingMeter, RunMeterInput } from '@attest/contracts';
import type { DataAccess } from '@attest/db';
import { creditsForRun, type BillingPricing } from './pricing';

// The hosted meter: on a resolved run, write the UsageEvent + credit debit atomically and idempotently
// [tech-arch §13.2]. The credit charge is derived from the metered cost; BYOK runs charge infra only,
// the incentive that protects margin. The OSS build never constructs this (uses the no-op meter).
export function createBillingMeter(deps: {
  dal: DataAccess;
  pricing: BillingPricing;
  // Operational log sink; defaults to stderr. Surfaces the silent-undercharge signal below.
  log?: (message: string) => void;
}): BillingMeter {
  const log = deps.log ?? ((m: string) => console.warn(m));
  return {
    async recordAndDebit(input: RunMeterInput): Promise<void> {
      // A non-BYOK run that reports zero model cost is suspicious: the gateway either genuinely charged
      // nothing or, more likely, usage.cost was absent/in-the-wrong-unit and silently fell through to 0,
      // so the run is billed on browser minutes only [audit 2026-06-27 H5]. Surface it; the unit MUST be
      // confirmed against a live OpenRouter response before charging real money (see openrouter.ts).
      if (!input.byok && input.modelCostUsd === 0 && input.steps > 0) {
        log(
          `meter_zero_model_cost run=${input.runId} org=${input.orgId} steps=${input.steps} (non-BYOK run billed with zero model cost; verify OpenRouter usage.cost)`,
        );
      }
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
