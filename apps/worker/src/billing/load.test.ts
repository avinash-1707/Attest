import { describe, it, expect } from 'vitest';
import type { DataAccess } from '@attest/db';
import { loadBillingMeter, noopMeter } from './load';

// A dal that throws if any repo is touched: proves the OSS no-op meter never reaches the DB.
const explodingDal = {
  forOrg: () => {
    throw new Error('OSS build must never touch the ledger');
  },
} as unknown as DataAccess;

describe('OSS no-op metering [tech-arch §13, arch §11]', () => {
  it('returns the no-op meter when billing is disabled and never meters', async () => {
    const meter = await loadBillingMeter({ enabled: false, requireBilling: false, dal: explodingDal });
    expect(meter).toBe(noopMeter);
    await expect(
      meter.recordAndDebit({
        orgId: 'org_1',
        appId: 'app_1',
        runId: 'run_1',
        browserMinutes: 1,
        steps: 1,
        modelCostUsd: 0.1,
        byok: false,
      }),
    ).resolves.toBeUndefined();
  });
});
