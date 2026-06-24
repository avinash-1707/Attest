import { describe, it, expect } from 'vitest';
import { defaultPlans, defaultPacks, resolvePlanById, resolvePlanByProductId } from './plans';
import { defaultPricing } from './pricing';

describe('billing plans [tech-arch §13.3]', () => {
  it('resolves a plan by its configured Dodo product id', () => {
    const plans = defaultPlans({ DODO_PRODUCT_TEAM: 'prod_team', DODO_PRODUCT_BUSINESS: 'prod_biz' });
    expect(resolvePlanByProductId('prod_team', plans)?.planId).toBe('team');
    expect(resolvePlanByProductId('prod_biz', plans)?.planId).toBe('business');
  });

  it('returns undefined for an unknown or unconfigured product id', () => {
    const plans = defaultPlans({ DODO_PRODUCT_TEAM: 'prod_team' });
    expect(resolvePlanByProductId('prod_unknown', plans)).toBeUndefined();
    // business has empty product id (env unset) -> never matches, even on an empty product id
    expect(resolvePlanByProductId('', plans)).toBeUndefined();
    expect(resolvePlanByProductId(undefined, plans)).toBeUndefined();
  });

  it('resolves a plan by our internal plan id', () => {
    const plans = defaultPlans();
    expect(resolvePlanById('team', plans)?.displayName).toBe('Team');
    expect(resolvePlanById('nope', plans)).toBeUndefined();
  });

  it('exposes exactly two subscription plans and at least one pack', () => {
    expect(defaultPlans().map((p) => p.planId)).toEqual(['team', 'business']);
    expect(defaultPacks().length).toBeGreaterThanOrEqual(1);
  });

  // Costing-consistency guard: each plan's base credits must map to a sane monthly run count against
  // the per-run estimate, so a fat-fingered baseCredits (e.g. an extra zero) fails CI rather than
  // shipping a margin-wrecking allotment [tech-arch §13.2].
  it('base credits imply a sane runs-per-month band', () => {
    const { estimateCredits } = defaultPricing();
    for (const plan of defaultPlans()) {
      const runsPerMonth = plan.baseCredits / estimateCredits;
      expect(runsPerMonth).toBeGreaterThanOrEqual(10);
      expect(runsPerMonth).toBeLessThanOrEqual(100_000);
    }
  });
});
