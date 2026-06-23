import type { BillingGate } from '@attest/contracts';
import type { DataAccess } from '@attest/db';

// Always-allow no-op: the OSS build never gates [arch §11]. Keeps the enqueue call site unconditional.
export const allowAllGate: BillingGate = {
  async assertCanEnqueue() {},
};

// Shape of the optionally-present @attest/ee billing module. pricing flows through opaquely so the OSS
// backend never names ee's pricing type.
interface EeBilling {
  createBillingGate(opts: { dal: DataAccess; pricing: unknown }): BillingGate;
  defaultPricing(): unknown;
}

// The single sanctioned ee seam in the backend [tech-arch §13]. The specifier is a `string` (not a
// literal) so the compiler never resolves @attest/ee - the OSS build has zero compile-time reference
// to it and the package may be wholly absent from node_modules. Hosted resolves it; OSS catches.
async function importEeBilling(): Promise<EeBilling | null> {
  const spec: string = '@attest/ee';
  try {
    return (await import(spec)) as EeBilling;
  } catch {
    return null;
  }
}

export async function loadBillingGate(opts: {
  enabled: boolean;
  requireBilling: boolean;
  dal: DataAccess;
}): Promise<BillingGate> {
  if (!opts.enabled) return allowAllGate;
  const ee = await importEeBilling();
  if (!ee?.createBillingGate) {
    // Fail closed in a hosted deploy: never silently run ungated when billing was required.
    if (opts.requireBilling) throw new Error('billing enabled but @attest/ee is absent');
    return allowAllGate;
  }
  return ee.createBillingGate({ dal: opts.dal, pricing: ee.defaultPricing() });
}
