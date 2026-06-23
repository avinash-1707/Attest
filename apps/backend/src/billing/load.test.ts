import { describe, it, expect } from 'vitest';
import type { DataAccess } from '@attest/db';
import {
  loadBillingGate,
  loadBillingWebhookHandler,
  allowAllGate,
  noopWebhookHandler,
} from './load';

const explodingDal = {
  forOrg: () => {
    throw new Error('OSS build must never touch the ledger');
  },
} as unknown as DataAccess;

describe('OSS no-op billing [tech-arch §13, arch §11]', () => {
  it('returns the allow-all gate when billing is disabled and never gates', async () => {
    const gate = await loadBillingGate({ enabled: false, requireBilling: false, dal: explodingDal });
    expect(gate).toBe(allowAllGate);
    await expect(gate.assertCanEnqueue('org_1')).resolves.toBeUndefined();
  });

  it('returns the 404 no-op webhook handler when billing is disabled', async () => {
    const handler = await loadBillingWebhookHandler({
      enabled: false,
      requireBilling: false,
      dal: explodingDal,
    });
    expect(handler).toBe(noopWebhookHandler);
    const res = await handler.handle('{}', {
      'webhook-id': 'x',
      'webhook-signature': 'x',
      'webhook-timestamp': 'x',
    });
    expect(res.statusCode).toBe(404);
  });

  it('fails closed when hosted billing is required but the webhook key is absent', async () => {
    await expect(
      loadBillingWebhookHandler({ enabled: true, requireBilling: true, dal: explodingDal }),
    ).rejects.toThrow(/absent/);
  });
});
