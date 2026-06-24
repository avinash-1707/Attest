// EE-internal plan catalog [tech-arch §13.3]. The OSS build never imports this; plan identity, prices,
// and base-credit allotments stay entirely behind the billing seam. Two subscription plans for v1
// (Team, Business) plus one-time credit packs for PAYG overage.
//
// SINGLE SOURCE OF TRUTH for the plan economics. To launch: set each plan's real Dodo product id (via
// env, so test/prod differ) and confirm `baseCredits` against the per-run cost (see sanityCheck below).
// `baseCredits` defaults are placeholders pending the founder's final numbers.

export interface Plan {
  // Our stable vocabulary, stored in org_billing.plan_id. NOT the Dodo product id.
  planId: string;
  // The Dodo product this subscription maps to; sourced from env so it isn't baked into the build.
  dodoProductId: string;
  // Recurring monthly base-credit grant, fixed per plan (independent of the dollar amount Dodo reports).
  baseCredits: number;
  displayName: string;
}

export interface CreditPack {
  packId: string;
  dodoProductId: string;
  displayName: string;
}

// Plans. baseCredits chosen against ~estimateCredits (10) per run: Team 2000 ≈ 200 runs/mo,
// Business 8000 ≈ 800 runs/mo. Adjust with real data; keep the ratio sane (see sanityCheck).
export function defaultPlans(env: NodeJS.ProcessEnv = process.env): readonly Plan[] {
  return [
    {
      planId: 'team',
      dodoProductId: env.DODO_PRODUCT_TEAM ?? '',
      baseCredits: 2000,
      displayName: 'Team',
    },
    {
      planId: 'business',
      dodoProductId: env.DODO_PRODUCT_BUSINESS ?? '',
      baseCredits: 8000,
      displayName: 'Business',
    },
  ];
}

// PAYG credit packs (one-time). Credits follow face value (amountPaid / centValue) at the webhook, so
// no per-pack credit number is stored here — only which Dodo products are packs, for checkout.
export function defaultPacks(env: NodeJS.ProcessEnv = process.env): readonly CreditPack[] {
  return [{ packId: 'pack', dodoProductId: env.DODO_PRODUCT_PACK ?? '', displayName: 'Credit pack' }];
}

// Resolve the plan a Dodo subscription event belongs to, by its product id. Returns undefined for an
// unknown product (the webhook then records status but grants nothing — margin-safe).
export function resolvePlanByProductId(
  productId: string | undefined,
  plans: readonly Plan[],
): Plan | undefined {
  if (!productId) return undefined;
  return plans.find((p) => p.dodoProductId !== '' && p.dodoProductId === productId);
}

export function resolvePlanById(
  planId: string,
  plans: readonly Plan[],
): Plan | undefined {
  return plans.find((p) => p.planId === planId);
}
