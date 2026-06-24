import DodoPayments from 'dodopayments';
import { CheckoutUnavailableError, type BillingCheckout } from '@attest/contracts';
import type { DataAccess } from '@attest/db';
import {
  defaultPacks,
  defaultPlans,
  resolvePlanById,
  type CreditPack,
  type Plan,
} from './plans';

// We type only the SDK methods we call. Verified against the dodopayments SDK source surface [atlas,
// June 2026]: client is constructed with { bearerToken, environment }; checkoutSessions.create returns
// { checkout_url }; customers.create returns { customer_id }; customers.customerPortal.create returns
// { link }. NOTE: the pinned dodopayments@^2.39.1 is AHEAD of the latest published version (2.26.0) at
// build time - confirm these method paths/field names against the installed package before charging
// real money [tech-arch §13.6, launch-blocker].
interface DodoApi {
  checkoutSessions: {
    create(body: {
      product_cart: Array<{ product_id: string; quantity: number }>;
      customer?: { customer_id: string } | { email: string; name: string };
      return_url?: string;
    }): Promise<{ checkout_url: string | null }>;
  };
  customers: {
    create(body: { email: string; name: string }): Promise<{ customer_id: string }>;
    customerPortal: {
      create(customerId: string, params?: { return_url?: string }): Promise<{ link: string }>;
    };
  };
}

export interface CheckoutDeps {
  dal: DataAccess;
  apiKey: string;
  // Where Dodo sends the user back to (the dashboard billing page).
  returnUrl: string;
  environment?: 'test_mode' | 'live_mode';
  plans?: readonly Plan[];
  packs?: readonly CreditPack[];
  // Injectable client seam so the flow is unit-testable without a live SDK or API key.
  client?: DodoApi;
}

// Self-serve checkout + portal over the Dodo API [tech-arch §13.6]. ee/ only; the OSS build wires a
// no-op that throws CheckoutUnavailableError. Creates (and persists) the org's Dodo customer on first
// checkout so the inbound webhook can later resolve the org by customer_id [tech-arch §13.5].
export function createBillingCheckout(deps: CheckoutDeps): BillingCheckout {
  const plans = deps.plans ?? defaultPlans();
  const packs = deps.packs ?? defaultPacks();
  const client =
    deps.client ??
    (new DodoPayments({
      bearerToken: deps.apiKey,
      // Fail safe to test_mode if a caller omits the environment, matching the config/webhook default;
      // never silently charge in live mode by default.
      environment: deps.environment ?? 'test_mode',
    }) as unknown as DodoApi);

  async function ensureCustomer(
    orgId: string,
    seed?: { email?: string; name?: string },
  ): Promise<string> {
    const billing = deps.dal.forOrg(orgId).orgBilling;
    const existing = await billing.get();
    if (existing?.dodoCustomerId) return existing.dodoCustomerId;
    if (!seed?.email) {
      throw new CheckoutUnavailableError('No billing email available to create a customer');
    }
    const customer = await client.customers.create({
      email: seed.email,
      name: seed.name && seed.name.length > 0 ? seed.name : seed.email,
    });
    await billing.upsert({ dodoCustomerId: customer.customer_id });
    return customer.customer_id;
  }

  function productFor(kind: 'plan' | 'pack', id: string): string {
    if (kind === 'plan') {
      const plan = resolvePlanById(id, plans);
      if (!plan || plan.dodoProductId === '') {
        throw new CheckoutUnavailableError(`Unknown or unconfigured plan: ${id}`);
      }
      return plan.dodoProductId;
    }
    const pack = packs.find((p) => p.packId === id);
    if (!pack || pack.dodoProductId === '') {
      throw new CheckoutUnavailableError(`Unknown or unconfigured pack: ${id}`);
    }
    return pack.dodoProductId;
  }

  return {
    async createCheckoutSession(input) {
      const productId = productFor(input.kind, input.planId);
      const customerId = await ensureCustomer(input.orgId, {
        email: input.customerEmail,
        name: input.customerName,
      });
      const session = await client.checkoutSessions.create({
        product_cart: [{ product_id: productId, quantity: 1 }],
        customer: { customer_id: customerId },
        return_url: deps.returnUrl,
      });
      if (!session.checkout_url) {
        throw new CheckoutUnavailableError('Dodo returned no checkout URL');
      }
      return { url: session.checkout_url };
    },

    async createPortalLink(input) {
      const existing = await deps.dal.forOrg(input.orgId).orgBilling.get();
      if (!existing?.dodoCustomerId) {
        throw new CheckoutUnavailableError('No Dodo customer for this org yet');
      }
      const session = await client.customers.customerPortal.create(existing.dodoCustomerId, {
        return_url: deps.returnUrl,
      });
      return { url: session.link };
    },
  };
}
