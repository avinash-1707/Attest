import { describe, it, expect, vi } from 'vitest';
import type { DataAccess } from '@attest/db';
import type { WebhookHeaders } from '@attest/contracts';
import { createBillingWebhookHandler, type WebhookVerify } from './webhook';
import { defaultPricing } from './pricing';

const HEADERS: WebhookHeaders = {
  'webhook-id': 'wh_1',
  'webhook-signature': 'sig',
  'webhook-timestamp': 'ts',
};

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

function handlerWith(verify: WebhookVerify, orgId: string | null = 'org_1') {
  const d = makeDal(orgId);
  const handler = createBillingWebhookHandler({ dal: d.dal, pricing: defaultPricing(), verify });
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

  it('grants face-value credits + marks active on subscription.renewed', async () => {
    const verify: WebhookVerify = () => ({
      type: 'subscription.renewed',
      data: { customer: { customer_id: 'cus_1' }, subscription_id: 'sub_1', recurring_pre_tax_amount: 2000 },
    });
    const { handler, grant, upsert } = handlerWith(verify);
    const res = await handler.handle('{}', HEADERS);
    expect(res.statusCode).toBe(200);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ subscriptionStatus: 'active' }));
    // $20 / $0.02 = 1000 credits, deduped on webhook-id
    expect(grant).toHaveBeenCalledWith({ amount: 1000, idempotencyKey: 'wh_1', reason: 'monthly_grant' });
  });

  it('grants a one-time pack on payment.succeeded with no subscription', async () => {
    const verify: WebhookVerify = () => ({
      type: 'payment.succeeded',
      data: { customer: { customer_id: 'cus_1' }, subscription_id: null, total_amount: 1000 },
    });
    const { handler, grant } = handlerWith(verify);
    await handler.handle('{}', HEADERS);
    expect(grant).toHaveBeenCalledWith({ amount: 500, idempotencyKey: 'wh_1', reason: 'pack_purchase', kind: 'purchase' });
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
      data: { customer: { customer_id: 'cus_unknown' }, recurring_pre_tax_amount: 2000 },
    });
    const { handler, grant } = handlerWith(verify, null);
    const res = await handler.handle('{}', HEADERS);
    expect(res.statusCode).toBe(200);
    expect(grant).not.toHaveBeenCalled();
  });

  it('returns 503 (not 200) when a DB write throws, so Dodo retries and the ACK is not recorded', async () => {
    const verify: WebhookVerify = () => ({
      type: 'subscription.renewed',
      data: { customer: { customer_id: 'cus_1' }, subscription_id: 'sub_1', recurring_pre_tax_amount: 2000 },
    });
    const d = makeDal('org_1');
    d.grant.mockRejectedValueOnce(new Error('db down'));
    const handler = createBillingWebhookHandler({ dal: d.dal, pricing: defaultPricing(), verify });
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
