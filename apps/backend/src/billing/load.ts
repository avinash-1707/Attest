import type { BillingGate, BillingWebhookHandler, BillingCheckout } from '@attest/contracts';
import { CheckoutUnavailableError } from '@attest/contracts';
import type { DataAccess } from '@attest/db';

// Always-allow no-op: the OSS build never gates [arch §11]. Keeps the enqueue call site unconditional.
export const allowAllGate: BillingGate = {
  async assertCanEnqueue() {},
};

// 404 no-op: the OSS build exposes no billing webhook. Keeps the route registration unconditional.
export const noopWebhookHandler: BillingWebhookHandler = {
  async handle() {
    return { statusCode: 404 };
  },
};

// Unavailable no-op: the OSS build has no Dodo account, so checkout/portal always 409 [tech-arch §13.6].
export const unavailableCheckout: BillingCheckout = {
  async createCheckoutSession() {
    throw new CheckoutUnavailableError('Billing is not enabled on this deployment');
  },
  async createPortalLink() {
    throw new CheckoutUnavailableError('Billing is not enabled on this deployment');
  },
};

// Shape of the optionally-present @attest/ee billing module. pricing flows through opaquely so the OSS
// backend never names ee's pricing type.
interface EeBilling {
  createBillingGate(opts: { dal: DataAccess; pricing: unknown }): BillingGate;
  createBillingWebhookHandler(opts: {
    dal: DataAccess;
    pricing: unknown;
    webhookKey: string;
    log?: (message: string) => void;
  }): BillingWebhookHandler;
  createBillingCheckout(opts: {
    dal: DataAccess;
    apiKey: string;
    returnUrl: string;
    environment: 'test_mode' | 'live_mode';
  }): BillingCheckout;
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
    // Billing was explicitly enabled, so ee MUST be present. Fail closed UNCONDITIONALLY rather than
    // falling back to the always-allow gate when REQUIRE_BILLING happened not to be set: enabling
    // billing without it must never silently run ungated/unmetered [audit 2026-06-27 H8].
    throw new Error('BILLING_ENABLED is set but @attest/ee is absent (refusing to run ungated)');
  }
  return ee.createBillingGate({ dal: opts.dal, pricing: ee.defaultPricing() });
}

export async function loadBillingWebhookHandler(opts: {
  enabled: boolean;
  requireBilling: boolean;
  webhookKey?: string;
  dal: DataAccess;
}): Promise<BillingWebhookHandler> {
  if (!opts.enabled) return noopWebhookHandler;
  const ee = await importEeBilling();
  if (!ee?.createBillingWebhookHandler || !opts.webhookKey) {
    // Fail closed when hosted: never accept (and silently drop) paid webhooks with no verifier.
    if (opts.requireBilling) throw new Error('billing enabled but @attest/ee or DODO_WEBHOOK_KEY is absent');
    return noopWebhookHandler;
  }
  return ee.createBillingWebhookHandler({
    dal: opts.dal,
    pricing: ee.defaultPricing(),
    webhookKey: opts.webhookKey,
    // Surface operational signals (unknown product, unkeyable grant) to stderr so a misconfigured
    // plan or a missing period field is visible in the hosted logs instead of silently swallowed.
    log: (message: string) => console.warn(`[billing] ${message}`),
  });
}

export async function loadBillingCheckout(opts: {
  enabled: boolean;
  requireBilling: boolean;
  apiKey?: string;
  returnUrl?: string;
  environment: 'test_mode' | 'live_mode';
  dal: DataAccess;
}): Promise<BillingCheckout> {
  if (!opts.enabled) return unavailableCheckout;
  const ee = await importEeBilling();
  if (!ee?.createBillingCheckout || !opts.apiKey || !opts.returnUrl) {
    // Fail closed when hosted: don't silently offer a checkout that can't reach Dodo.
    if (opts.requireBilling) {
      throw new Error('billing enabled but @attest/ee, DODO_API_KEY, or DASHBOARD_URL is absent');
    }
    return unavailableCheckout;
  }
  return ee.createBillingCheckout({
    dal: opts.dal,
    apiKey: opts.apiKey,
    returnUrl: opts.returnUrl,
    environment: opts.environment,
  });
}
