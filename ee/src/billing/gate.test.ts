import { describe, it, expect, vi } from 'vitest';
import { InsufficientCreditsError } from '@attest/contracts';
import type { DataAccess } from '@attest/db';
import { createBillingGate } from './gate';
import { defaultPricing } from './pricing';

// Fake credits repo: grant is a spy, balance returns a configurable value (the DB enforces real
// idempotency; here we assert the gate's logic + the starter-grant key it uses).
function makeDal(balance: number) {
  const grant = vi.fn(async () => {});
  const balanceFn = vi.fn(async () => balance);
  const dal = {
    forOrg: () => ({ credits: { grant, balance: balanceFn } }),
  } as unknown as DataAccess;
  return { dal, grant, balanceFn };
}

const pricing = defaultPricing();

describe('credit enqueue gate [tech-arch §13.4]', () => {
  it('grants the starter credits (keyed per org) then allows when the balance covers the estimate', async () => {
    const { dal, grant } = makeDal(pricing.starterCredits);
    const gate = createBillingGate({ dal, pricing });
    await expect(gate.assertCanEnqueue('org_1')).resolves.toBeUndefined();
    expect(grant).toHaveBeenCalledWith({
      amount: pricing.starterCredits,
      idempotencyKey: 'starter:org_1',
      reason: 'starter',
    });
  });

  it('denies with InsufficientCreditsError when the balance is below the estimate', async () => {
    const { dal } = makeDal(pricing.estimateCredits - 1);
    const gate = createBillingGate({ dal, pricing });
    await expect(gate.assertCanEnqueue('org_1')).rejects.toBeInstanceOf(InsufficientCreditsError);
  });

  it('uses an org-scoped starter key so the grant is idempotent per org (a replay re-grants to a no-op at the DB)', async () => {
    const { dal, grant } = makeDal(0);
    const gate = createBillingGate({ dal, pricing });
    // balance 0 < estimate -> denied, but the starter grant was still attempted with the stable key.
    await expect(gate.assertCanEnqueue('org_2')).rejects.toBeInstanceOf(InsufficientCreditsError);
    expect(grant).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: 'starter:org_2' }));
  });
});
