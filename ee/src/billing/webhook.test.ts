import { describe, it, expect, vi } from 'vitest';
import type { DataAccess } from '@attest/db';
import type { WebhookHeaders } from '@attest/contracts';
import { createBillingWebhookHandler, type WebhookVerify } from './webhook';
import { defaultPricing } from './pricing';
import type { Plan } from './plans';

const HEADERS: WebhookHeaders = {
  'webhook-id': 'wh_1',
  'webhook-signature': 'sig',
  'webhook-timestamp': 'ts',
};

const PLANS: readonly Plan[] = [
  { planId: 'team', dodoProductId: 'prod_team', baseCredits: 2000, displayName: 'Team' },
  { planId: 'business', dodoProductId: 'prod_business', baseCredits: 8000, displayName: 'Business' },
];

function makeDal(orgId: string | null = 'org_1') {
  const grant = vi.fn(async () => {});
  const upsert = vi.fn(async () => {});
  const recordWebhookEvent = vi.fn(async () => ({ fresh: true }));
  const resolveOrgByDodoCustomer = vi.fn(async () => orgId ?? undefined);
  const dal = {
    resolveOrgByDodoCustomer,
    recordWebhookEvent,
    forOrg: () => ({ credits: { grant }, orgBilling: { upsert } }),
  } as unknown as DataAccess;
  return { dal, grant, upsert, recordWebhookEvent, resolveOrgByDodoCustomer };
}

function handlerWith(
  verify: WebhookVerify,
  opts: { orgId?: string | null; log?: (m: string) => void } = {},
) {
  const d = makeDal(opts.orgId === undefined ? 'org_1' : opts.orgId);
  const handler = createBillingWebhookHandler({
    dal: d.dal,
    pricing: defaultPricing(),
    verify,
    plans: PLANS,
    log: opts.log,
  });
  return { handler, ...d };
}

describe('billing webhook handler [tech-arch §13.5]', () => {
  it('rejects a bad signature with 400 and never touches the DB', async () => {
    const verify: WebhookVerify = () => {
      throw new Error('No matching signature found');
    };
    const { handler, recordWebhookEvent, grant } = handlerWith(verify);
    const res = await handler.handle('{}', HEADERS);
    expect(res.statusCode).toBe(400);
    expect(recordWebhookEvent).not.toHaveBeenCalled();
    expect(grant).not.toHaveBeenCalled();
  });

  it('grants the plan base credits (not face value) + marks active on subscription.renewed', async () => {
    const verify: WebhookVerify = () => ({
      type: 'subscription.renewed',
      data: {
        customer: { customer_id: 'cus_1' },
        subscription_id: 'sub_1',
        product_id: 'prod_team',
        // A wildly different dollar amount must be IGNORED: the grant follows the plan, not the amount.
        recurring_pre_tax_amount: 999999,
        current_period_start: '2026-05-01',
      },
    });
    const { handler, grant, upsert } = handlerWith(verify);
    const res = await handler.handle('{}', HEADERS);
    expect(res.statusCode).toBe(200);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ subscriptionStatus: 'active', planId: 'team' }),
    );
    expect(grant).toHaveBeenCalledWith({
      amount: 2000,
      idempotencyKey: 'sub_grant:sub_1:2026-05-01',
      reason: 'monthly_grant',
    });
  });

  it('keys the grant on the billing PERIOD, so active+renewed in one period collapse to one grant', async () => {
    const data = {
      customer: { customer_id: 'cus_1' },
      subscription_id: 'sub_1',
      product_id: 'prod_business',
      current_period_start: '2026-06-01',
    };
    const active: WebhookVerify = () => ({ type: 'subscription.active', data });
    const renewed: WebhookVerify = () => ({ type: 'subscription.renewed', data });
    const a = handlerWith(active);
    await a.handler.handle('{}', HEADERS);
    const r = handlerWith(renewed);
    await r.handler.handle('{}', { ...HEADERS, 'webhook-id': 'wh_2' });
    // Same period -> identical idempotency key, so the ledger's UNIQUE(idempotency_key) dedups to one.
    const expected = { amount: 8000, idempotencyKey: 'sub_grant:sub_1:2026-06-01', reason: 'monthly_grant' };
    expect(a.grant).toHaveBeenCalledWith(expected);
    expect(r.grant).toHaveBeenCalledWith(expected);
  });

  it('keys distinct periods distinctly, so the next period grants again', async () => {
    const mk = (period: string): WebhookVerify => () => ({
      type: 'subscription.renewed',
      data: {
        customer: { customer_id: 'cus_1' },
        subscription_id: 'sub_1',
        product_id: 'prod_team',
        current_period_start: period,
      },
    });
    const p1 = handlerWith(mk('2026-05-01'));
    await p1.handler.handle('{}', HEADERS);
    const p2 = handlerWith(mk('2026-06-01'));
    await p2.handler.handle('{}', HEADERS);
    expect(p1.grant).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: 'sub_grant:sub_1:2026-05-01' }),
    );
    expect(p2.grant).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: 'sub_grant:sub_1:2026-06-01' }),
    );
  });

  it('SKIPS the grant (and logs) when the payload carries no billing period - never mints an unkeyable grant', async () => {
    const verify: WebhookVerify = () => ({
      type: 'subscription.renewed',
      data: { customer: { customer_id: 'cus_1' }, subscription_id: 'sub_1', product_id: 'prod_team' },
    });
    const log = vi.fn();
    const { handler, grant, upsert } = handlerWith(verify, { log });
    const res = await handler.handle('{}', HEADERS);
    expect(res.statusCode).toBe(200);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ subscriptionStatus: 'active' }));
    expect(grant).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('unkeyable_subscription_grant'));
  });

  it('SKIPS the grant when subscription_id is absent (would collide across orgs on the global index)', async () => {
    const verify: WebhookVerify = () => ({
      type: 'subscription.renewed',
      data: { customer: { customer_id: 'cus_1' }, product_id: 'prod_team', current_period_start: '2026-05-01' },
    });
    const { handler, grant } = handlerWith(verify);
    await handler.handle('{}', HEADERS);
    expect(grant).not.toHaveBeenCalled();
  });

  it('records status but grants NOTHING for an unknown product, and logs it', async () => {
    const verify: WebhookVerify = () => ({
      type: 'subscription.active',
      data: { customer: { customer_id: 'cus_1' }, subscription_id: 'sub_1', product_id: 'prod_mystery' },
    });
    const log = vi.fn();
    const { handler, grant, upsert } = handlerWith(verify, { log });
    const res = await handler.handle('{}', HEADERS);
    expect(res.statusCode).toBe(200);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ subscriptionStatus: 'active' }));
    expect(grant).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('prod_mystery'));
  });

  it('grants a one-time pack at FACE VALUE on payment.succeeded with no subscription', async () => {
    const verify: WebhookVerify = () => ({
      type: 'payment.succeeded',
      data: { customer: { customer_id: 'cus_1' }, subscription_id: null, total_amount: 2000 },
    });
    const { handler, grant } = handlerWith(verify);
    await handler.handle('{}', HEADERS);
    // $20 / $0.02 = 1000 credits, deduped on the webhook-id (a pack has exactly one occurrence).
    expect(grant).toHaveBeenCalledWith({
      amount: 1000,
      idempotencyKey: 'wh_1',
      reason: 'pack_purchase',
      kind: 'purchase',
    });
  });

  it('does not grant on a payment that belongs to a subscription', async () => {
    const verify: WebhookVerify = () => ({
      type: 'payment.succeeded',
      data: { customer: { customer_id: 'cus_1' }, subscription_id: 'sub_1', total_amount: 1000 },
    });
    const { handler, grant } = handlerWith(verify);
    await handler.handle('{}', HEADERS);
    expect(grant).not.toHaveBeenCalled();
  });

  it('marks subscription.failed terminal and never grants', async () => {
    const verify: WebhookVerify = () => ({
      type: 'subscription.failed',
      data: { customer: { customer_id: 'cus_1' }, subscription_id: 'sub_1' },
    });
    const { handler, grant, upsert } = handlerWith(verify);
    await handler.handle('{}', HEADERS);
    expect(upsert).toHaveBeenCalledWith({ subscriptionStatus: 'failed' });
    expect(grant).not.toHaveBeenCalled();
  });

  it('ACKs (200) an unknown customer without granting', async () => {
    const verify: WebhookVerify = () => ({
      type: 'subscription.renewed',
      data: { customer: { customer_id: 'cus_unknown' }, product_id: 'prod_team' },
    });
    const { handler, grant } = handlerWith(verify, { orgId: null });
    const res = await handler.handle('{}', HEADERS);
    expect(res.statusCode).toBe(200);
    expect(grant).not.toHaveBeenCalled();
  });

  it('returns 503 (not 200) when a DB write throws, so Dodo retries and the ACK is not recorded', async () => {
    const verify: WebhookVerify = () => ({
      type: 'subscription.renewed',
      data: {
        customer: { customer_id: 'cus_1' },
        subscription_id: 'sub_1',
        product_id: 'prod_team',
        current_period_start: '2026-05-01',
      },
    });
    const d = makeDal('org_1');
    d.grant.mockRejectedValueOnce(new Error('db down'));
    const handler = createBillingWebhookHandler({
      dal: d.dal,
      pricing: defaultPricing(),
      verify,
      plans: PLANS,
    });
    const res = await handler.handle('{}', HEADERS);
    expect(res.statusCode).toBe(503);
    expect(d.recordWebhookEvent).not.toHaveBeenCalled(); // not ACKed -> Dodo retries
  });

  it.each(['on_hold', 'cancelled', 'expired'])(
    'records subscription.%s status without granting',
    async (status) => {
      const verify: WebhookVerify = () => ({
        type: `subscription.${status}`,
        data: { customer: { customer_id: 'cus_1' }, subscription_id: 'sub_1' },
      });
      const { handler, grant, upsert } = handlerWith(verify);
      const res = await handler.handle('{}', HEADERS);
      expect(res.statusCode).toBe(200);
      expect(upsert).toHaveBeenCalledWith({ subscriptionStatus: status });
      expect(grant).not.toHaveBeenCalled();
    },
  );
});
