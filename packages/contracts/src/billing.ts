// Billing composition seams shared between the OSS apps and the ee/ tier [tech-arch §13]. These are
// plain interfaces, not zod schemas: they are internal injection seams (erased at runtime), not
// external wire contracts. ee/ implements them; the OSS build wires no-op impls so it never meters or
// gates - self-hosters run unlimited [arch §11]. Pricing is intentionally NOT here: it is ee-internal
// policy, passed through the loader opaquely so the OSS apps never name it.

// Raw metering inputs for one completed run, handed to the meter hook after the run resolves.
export interface RunMeterInput {
  orgId: string;
  appId: string;
  runId: string;
  browserMinutes: number;
  steps: number;
  // Gateway-reported model cost in USD. Zeroed by the meter when byok, since that cost lands on the
  // user's own OpenRouter account [tech-arch §13.2].
  modelCostUsd: number;
  byok: boolean;
}

// Writes the UsageEvent + credit debit for a resolved run. Idempotent on runId (a BullMQ re-delivery
// converges). The OSS no-op impl does nothing.
export interface BillingMeter {
  recordAndDebit(input: RunMeterInput): Promise<void>;
}

// Decides whether an org may enqueue a run. Throws InsufficientCreditsError to block, or returns to
// allow. The pre-flight estimate is ee-internal (flat per-run, errs high) so the OSS caller passes no
// pricing. The OSS no-op impl always allows.
export interface BillingGate {
  assertCanEnqueue(orgId: string): Promise<void>;
}

// Standard-Webhooks signature headers on an inbound Dodo webhook [tech-arch §13.5].
export interface WebhookHeaders {
  'webhook-id': string;
  'webhook-signature': string;
  'webhook-timestamp': string;
}

// The HTTP status the webhook route should return. The handler never throws: 200 = processed / deduped
// / ignored, 400 = bad signature, 5xx = transient processing failure so Dodo retries.
export interface WebhookResult {
  statusCode: number;
}

// Verifies an inbound Dodo webhook and applies its effect (credit grant / subscription status) to the
// ledger, idempotently. ee/ implements it over the dodopayments SDK; the OSS build wires a 404 no-op.
export interface BillingWebhookHandler {
  handle(rawBody: string, headers: WebhookHeaders): Promise<WebhookResult>;
}

// Thrown by the ee/ gate when an org's balance can't cover the estimated run cost. Defined here (not in
// the backend) so ee/ throws it without depending on the backend; the backend error handler maps it to
// a 402 with this code [tech-arch §13.4].
export class InsufficientCreditsError extends Error {
  readonly code = 'insufficient_credits';
  constructor(
    readonly balance: number,
    readonly required: number,
  ) {
    super('Insufficient credits to start a run');
    this.name = 'InsufficientCreditsError';
  }
}
