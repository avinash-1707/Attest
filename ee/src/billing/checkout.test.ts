import { describe, it, expect, vi } from 'vitest';
import type { DataAccess } from '@attest/db';
import { CheckoutUnavailableError } from '@attest/contracts';
import { createBillingCheckout } from './checkout';
import type { Plan, CreditPack } from './plans';

const PLANS: readonly Plan[] = [
  { planId: 'team', dodoProductId: 'prod_team', baseCredits: 2000, displayName: 'Team' },
];
const PACKS: readonly CreditPack[] = [
  { packId: 'pack', dodoProductId: 'prod_pack', displayName: 'Credit pack' },
];

function makeDal(dodoCustomerId: string | null = null) {
  const get = vi.fn(async () => (dodoCustomerId ? { dodoCustomerId } : undefined));
  const upsert = vi.fn(async () => {});
  const dal = {
    forOrg: () => ({ orgBilling: { get, upsert } }),
  } as unknown as DataAccess;
  return { dal, get, upsert };
}

function fakeClient() {
  return {
    checkoutSessions: {
      create: vi.fn(async () => ({ checkout_url: 'https://checkout.dodo/session/cks_1' })),
    },
    customers: {
      create: vi.fn(async () => ({ customer_id: 'cus_new' })),
      customerPortal: {
        create: vi.fn(async () => ({ link: 'https://portal.dodo/p/cus_1' })),
      },
    },
  };
}

function build(dodoCustomerId: string | null = null) {
  const d = makeDal(dodoCustomerId);
  const client = fakeClient();
  const checkout = createBillingCheckout({
    dal: d.dal,
    apiKey: 'sk_test',
    returnUrl: 'https://app.attest/billing',
    plans: PLANS,
    packs: PACKS,
    client: client as never,
  });
  return { checkout, client, ...d };
}

describe('billing checkout [tech-arch §13.6]', () => {
  it('creates + persists a Dodo customer on first checkout, then returns the checkout url', async () => {
    const { checkout, client, upsert } = build(null);
    const res = await checkout.createCheckoutSession({
      orgId: 'org_1',
      kind: 'plan',
      planId: 'team',
      customerEmail: 'a@b.com',
      customerName: 'A',
    });
    // The create is idempotency-keyed on the orgId so a retry reuses the customer [audit 2026-06-27 M7].
    expect(client.customers.create).toHaveBeenCalledWith(
      { email: 'a@b.com', name: 'A' },
      { idempotencyKey: expect.stringMatching(/^dodo_customer:/) },
    );
    expect(upsert).toHaveBeenCalledWith({ dodoCustomerId: 'cus_new' });
    expect(client.checkoutSessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        product_cart: [{ product_id: 'prod_team', quantity: 1 }],
        customer: { customer_id: 'cus_new' },
      }),
    );
    expect(res.url).toBe('https://checkout.dodo/session/cks_1');
  });

  it('reuses the existing customer (no create) when one is already mapped', async () => {
    const { checkout, client } = build('cus_existing');
    await checkout.createCheckoutSession({ orgId: 'org_1', kind: 'plan', planId: 'team' });
    expect(client.customers.create).not.toHaveBeenCalled();
    expect(client.checkoutSessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ customer: { customer_id: 'cus_existing' } }),
    );
  });

  it('checks out a credit pack by its product id', async () => {
    const { checkout, client } = build('cus_existing');
    await checkout.createCheckoutSession({ orgId: 'org_1', kind: 'pack', planId: 'pack' });
    expect(client.checkoutSessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ product_cart: [{ product_id: 'prod_pack', quantity: 1 }] }),
    );
  });

  it('throws on an unknown plan id', async () => {
    const { checkout } = build('cus_existing');
    await expect(
      checkout.createCheckoutSession({ orgId: 'org_1', kind: 'plan', planId: 'enterprise' }),
    ).rejects.toBeInstanceOf(CheckoutUnavailableError);
  });

  it('refuses first checkout with no billing email (can not create a customer)', async () => {
    const { checkout } = build(null);
    await expect(
      checkout.createCheckoutSession({ orgId: 'org_1', kind: 'plan', planId: 'team' }),
    ).rejects.toBeInstanceOf(CheckoutUnavailableError);
  });

  it('returns a portal link for an org with a customer', async () => {
    const { checkout, client } = build('cus_1');
    const res = await checkout.createPortalLink({ orgId: 'org_1' });
    expect(client.customers.customerPortal.create).toHaveBeenCalledWith('cus_1', {
      return_url: 'https://app.attest/billing',
    });
    expect(res.url).toBe('https://portal.dodo/p/cus_1');
  });

  it('throws for a portal link when the org has no customer yet', async () => {
    const { checkout } = build(null);
    await expect(checkout.createPortalLink({ orgId: 'org_1' })).rejects.toBeInstanceOf(
      CheckoutUnavailableError,
    );
  });
});
