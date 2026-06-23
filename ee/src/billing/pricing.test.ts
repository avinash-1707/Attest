import { describe, it, expect } from 'vitest';
import { defaultPricing, creditsForRun, creditsFromAmount } from './pricing';
import type { RunMeterInput } from '@attest/contracts';

const pricing = defaultPricing();

function meter(over: Partial<RunMeterInput>): RunMeterInput {
  return {
    orgId: 'org_1',
    appId: 'app_1',
    runId: 'run_1',
    browserMinutes: 1.5,
    steps: 3,
    modelCostUsd: 0.08,
    byok: false,
    ...over,
  };
}

describe('credit pricing [tech-arch §13.2]', () => {
  it('charges a hosted run model + infra cost, marked up', () => {
    // (0.08 + 1.5*0.02) * 1.5 / 0.02 = (0.11)*1.5/0.02 = 0.165/0.02 = 8.25 -> ceil 9
    expect(creditsForRun(meter({}), pricing)).toBe(9);
  });

  it('charges a BYOK run strictly less (infra only, no model markup)', () => {
    const hosted = creditsForRun(meter({ byok: false }), pricing);
    const byok = creditsForRun(meter({ byok: true }), pricing);
    expect(byok).toBeLessThan(hosted);
    // BYOK: (0 + 1.5*0.02)*1.5/0.02 = 0.045/0.02 = 2.25 -> ceil 3
    expect(byok).toBe(3);
  });

  it('grants credits at face value from the amount paid', () => {
    // $10.00 pack = 1000 minor units; 10 / 0.02 = 500 credits
    expect(creditsFromAmount(1000, pricing)).toBe(500);
  });
});
