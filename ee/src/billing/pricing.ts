import type { RunMeterInput } from '@attest/contracts';

// Pricing knobs [tech-arch §13.2]. Every value is a TUNABLE default, not a constant: re-baseline
// against real run data (the §7.3 cost-watch). The raw UsageEvent stays the source of truth, so these
// can change without re-instrumentation.
export interface BillingPricing {
  // USD value of one credit (the spend currency).
  centValueUsd: number;
  // Gross-margin markup applied to the fully-loaded cost (illustratively ~60-75% margin -> ~1.5x).
  marginMultiplier: number;
  // Infra cost per browser-minute (containerized Chromium, fully loaded) [tech-arch §13.1].
  browserMinuteCostUsd: number;
  // Conservative pre-flight per-run estimate for the enqueue gate; errs slightly high so a run never
  // starts unpaid [tech-arch §13.4].
  estimateCredits: number;
  // One-time free-tier grant for a new org (~25 runs). Granted lazily + idempotently on first gate.
  starterCredits: number;
}

export function defaultPricing(): BillingPricing {
  return {
    centValueUsd: 0.02,
    marginMultiplier: 1.5,
    browserMinuteCostUsd: 0.02,
    estimateCredits: 10,
    starterCredits: 250,
  };
}

// credits = ceil(meteredCost * margin / centValue), where meteredCost is the fully-loaded USD cost:
// model cost (0 when BYOK) + browser-minute infra [tech-arch §13.2].
export function creditsForRun(input: RunMeterInput, pricing: BillingPricing): number {
  const modelCostUsd = input.byok ? 0 : input.modelCostUsd;
  const meteredCostUsd = modelCostUsd + input.browserMinutes * pricing.browserMinuteCostUsd;
  return Math.ceil((meteredCostUsd * pricing.marginMultiplier) / pricing.centValueUsd);
}

// Credits granted for a payment/subscription, derived from the amount paid (in the smallest currency
// unit, e.g. cents) at the credit's face value: amountPaidUsd / centValue. This auto-scales with
// whatever tier or pack the customer bought, so there is no per-product map to maintain; the margin is
// captured at debit time, not here [tech-arch §13.2, §13.3].
export function creditsFromAmount(amountMinorUnits: number, pricing: BillingPricing): number {
  const usd = amountMinorUnits / 100;
  // floor, never round up: never grant more face value than was paid (margin-safe on odd FX-converted
  // minor-unit amounts from the Merchant of Record).
  return Math.floor(usd / pricing.centValueUsd);
}
