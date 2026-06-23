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

// Pre-flight cost estimate for the enqueue gate, in credits.
export interface GateEstimate {
  credits: number;
}

// Decides whether an org may enqueue a run. Throws a typed insufficient-credits error to block, or
// returns to allow. The OSS no-op impl always allows.
export interface BillingGate {
  assertCanEnqueue(orgId: string, estimate: GateEstimate): Promise<void>;
}
