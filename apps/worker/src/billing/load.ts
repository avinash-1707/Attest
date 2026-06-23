import type { BillingMeter } from '@attest/contracts';
import type { DataAccess } from '@attest/db';

// Always-allow no-op: the OSS build never meters [arch §11]. Keeps the worker call site unconditional.
export const noopMeter: BillingMeter = {
  async recordAndDebit() {},
};

// Shape of the optionally-present @attest/ee billing module. pricing flows through opaquely so the OSS
// worker never names ee's pricing type.
interface EeBilling {
  createBillingMeter(opts: { dal: DataAccess; pricing: unknown }): BillingMeter;
  defaultPricing(): unknown;
}

// The single sanctioned ee seam in the worker [tech-arch §13]. The specifier is a `string` (not a
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

export async function loadBillingMeter(opts: {
  enabled: boolean;
  requireBilling: boolean;
  dal: DataAccess;
}): Promise<BillingMeter> {
  if (!opts.enabled) return noopMeter;
  const ee = await importEeBilling();
  if (!ee?.createBillingMeter) {
    // Fail closed in a hosted deploy: never silently run unmetered when billing was required.
    if (opts.requireBilling) throw new Error('billing enabled but @attest/ee is absent');
    return noopMeter;
  }
  return ee.createBillingMeter({ dal: opts.dal, pricing: ee.defaultPricing() });
}
