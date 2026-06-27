import DodoPayments from 'dodopayments';
import type { BillingWebhookHandler, WebhookHeaders, WebhookResult } from '@attest/contracts';
import type { DataAccess, OrgScope } from '@attest/db';
import { creditsFromAmount, type BillingPricing } from './pricing';
import { defaultPlans, resolvePlanByProductId, type Plan } from './plans';

// The minimal shape we read off a verified Dodo event (verified against dodopayments@2.39, Standard
// Webhooks). The SDK returns a richer typed union; we cast to this read-model at the verify seam.
interface DodoEvent {
  type: string;
  data: {
    customer?: { customer_id?: string };
    subscription_id?: string | null;
    product_id?: string;
    recurring_pre_tax_amount?: number;
    total_amount?: number;
    // Billing-period boundary, used to key the recurring base grant once per period (field name
    // unverified against a live Dodo renewal payload - see periodKey's fallback chain [tech-arch §13.5]).
    current_period_start?: string;
    next_billing_date?: string;
  };
}

// Idempotency key for the recurring base-credit grant. Keyed on the billing PERIOD, not the webhook-id:
// the webhook-id is unique per delivery, so it would NOT collapse two different events for the same
// period (e.g. active then a spurious renewed). The ledger's UNIQUE(idempotency_key) then makes any
// second event resolving to the same period a no-op, so base credits are granted exactly once per
// period regardless of which event fires or how many times.
//
// Returns null when the event is UNKEYABLE - no subscription id, or no period boundary in the payload.
// We refuse to mint a grant we can't dedup, because the idempotency_key index is GLOBAL (not org-scoped):
// a placeholder like 'nosub' would collide ACROSS orgs (first org wins, the rest silently get nothing),
// and a wall-clock month fallback double-grants when a renewal retry crosses the UTC month boundary. A
// visible missed grant (logged, fixable with a manual ledger entry) is strictly safer than either.
// Verify the real period field against a live Dodo renewal payload before launch [tech-arch §13.5].
function periodKey(event: DodoEvent): string | null {
  const sub = event.data.subscription_id;
  const period = event.data.current_period_start ?? event.data.next_billing_date;
  if (!sub || !period) return null;
  return `sub_grant:${sub}:${period}`;
}

// Verify seam: returns the parsed event, throws on a bad signature. Injectable so the handler is
// unit-testable without a live SDK or signing key.
export type WebhookVerify = (rawBody: string, headers: WebhookHeaders) => DodoEvent;

function realVerify(webhookKey: string): WebhookVerify {
  // webhooks.unwrap is local HMAC verification (no API call), so the client needs only the webhook key.
  const client = new DodoPayments({ webhookKey });
  return (rawBody, headers) =>
    client.webhooks.unwrap(rawBody, {
      headers: headers as unknown as Record<string, string>,
    }) as unknown as DodoEvent;
}

// Inbound Dodo webhook -> ledger grant / subscription status, idempotent on the webhook-id [tech-arch
// §13.5]. Never throws: 400 on a bad signature (no DB touch), 503 on a transient DB failure (Dodo
// retries; every write is idempotent so a retry converges), 200 otherwise. Grants are deduped on the
// webhook-id at the ledger (a replay re-grants to a no-op), so processing is safe to repeat.
export function createBillingWebhookHandler(deps: {
  dal: DataAccess;
  pricing: BillingPricing;
  webhookKey?: string;
  verify?: WebhookVerify;
  // Plan catalog used to map a Dodo product to its fixed base-credit grant. Defaults to the env-driven
  // catalog; injectable so tests are deterministic without env.
  plans?: readonly Plan[];
  // Structured log sink for operational signals (e.g. a subscribed customer on an unknown product).
  log?: (message: string) => void;
}): BillingWebhookHandler {
  if (!deps.verify && !deps.webhookKey) {
    throw new Error('billing webhook handler requires a webhookKey (DODO_WEBHOOK_KEY) or a verify seam');
  }
  const verify = deps.verify ?? realVerify(deps.webhookKey as string);
  const plans = deps.plans ?? defaultPlans();
  const log = deps.log ?? (() => {});

  return {
    async handle(rawBody: string, headers: WebhookHeaders): Promise<WebhookResult> {
      let event: DodoEvent;
      try {
        event = verify(rawBody, headers);
      } catch {
        return { statusCode: 400 };
      }

      const webhookId = headers['webhook-id'];
      const customerId = event.data.customer?.customer_id;
      // No customer, or a customer we don't map to an org: ACK so Dodo stops retrying. Nothing to do.
      if (!customerId) return ack(deps, webhookId, event.type, 'ignored');
      const orgId = await deps.dal.resolveOrgByDodoCustomer(customerId);
      if (!orgId) return ack(deps, webhookId, event.type, 'ignored');

      // Process every verified event and rely on the ledger's idempotency_key (= webhookId) for
      // correctness: a replay re-grants to a no-op. We deliberately do NOT gate on the webhook_event
      // dedupe row, because recording it before applying would open a crash-between-record-and-grant
      // window that silently drops a paid grant. Consequence: subscription STATUS upserts are
      // last-writer-wins (Dodo gives no ordering guarantee). Acceptable in v1 because the gate reads the
      // ledger BALANCE (order-independent), not subscriptionStatus; revisit when a good-standing buffer
      // makes status gate-relevant [tech-arch §13.4].
      try {
        await applyEvent(deps.dal.forOrg(orgId), event, webhookId, deps.pricing, plans, log);
      } catch {
        return { statusCode: 503 };
      }
      return ack(deps, webhookId, event.type, 'processed');
    },
  };
}

async function applyEvent(
  org: OrgScope,
  event: DodoEvent,
  webhookId: string,
  pricing: BillingPricing,
  plans: readonly Plan[],
  log: (message: string) => void,
): Promise<void> {
  switch (event.type) {
    case 'subscription.active':
    case 'subscription.renewed': {
      // Resolve the plan from the Dodo product, then grant that plan's FIXED base credits (not the
      // dollar face value) once per billing period. Plan base credits are decoupled from FX-wobbled
      // minor-unit amounts, so the advertised "N credits/mo" is exactly what lands [tech-arch §13.3].
      const plan = resolvePlanByProductId(event.data.product_id, plans);
      await org.orgBilling.upsert({
        subscriptionStatus: 'active',
        ...(event.data.subscription_id ? { dodoSubscriptionId: event.data.subscription_id } : {}),
        ...(event.data.product_id ? { currentTier: event.data.product_id } : {}),
        ...(plan ? { planId: plan.planId } : {}),
      });
      if (plan && plan.baseCredits > 0) {
        const key = periodKey(event);
        if (key) {
          await org.credits.grant({ amount: plan.baseCredits, idempotencyKey: key, reason: 'monthly_grant' });
        } else {
          // Unkeyable subscription event (no subscription id or no billing period): skip the grant
          // rather than mint one we can't dedup (would double-grant on retry / collide across orgs).
          log(
            `unkeyable_subscription_grant sub=${event.data.subscription_id ?? ''} product_id=${event.data.product_id ?? ''} (no billing period; grant skipped)`,
          );
        }
      } else if (!plan) {
        // Subscribed on a product not in the catalog: status is recorded, but NO credits are granted
        // (margin-safe). Surface it so ops can add the missing plan before the customer complains.
        log(`unknown_dodo_product product_id=${event.data.product_id ?? ''}`);
      }
      break;
    }
    case 'payment.succeeded': {
      // One-time credit pack only; a subscription's own payment is granted via the subscription events.
      if (!event.data.subscription_id) {
        const amount = event.data.total_amount;
        if (typeof amount === 'number' && Number.isFinite(amount) && amount > 0) {
          await org.credits.grant({
            amount: creditsFromAmount(amount, pricing),
            idempotencyKey: webhookId,
            reason: 'pack_purchase',
            kind: 'purchase',
          });
        } else {
          // A paid pack with a missing/zero/non-finite amount grants nothing. Fail closed (never
          // over-grant), but surface it: this is the signal that `total_amount`'s name/shape is wrong
          // (or a genuinely zero payment) [audit 2026-06-27 H6]. Confirm the field against a live Dodo
          // payload before charging real money.
          log(`payment_succeeded_no_grant webhook_id=${webhookId} amount=${String(amount)} (no credits granted)`);
        }
      }
      break;
    }
    case 'subscription.on_hold':
      // Recoverable: keep existing credits, drop the good-standing privilege; no grant.
      await org.orgBilling.upsert({ subscriptionStatus: 'on_hold' });
      break;
    case 'subscription.cancelled':
      await org.orgBilling.upsert({ subscriptionStatus: 'cancelled' });
      break;
    case 'subscription.expired':
      await org.orgBilling.upsert({ subscriptionStatus: 'expired' });
      break;
    case 'subscription.failed':
      // Terminal: never grants access; existing balance is not clawed back (out of scope).
      await org.orgBilling.upsert({ subscriptionStatus: 'failed' });
      break;
    default:
      break; // unhandled event type: ACK, no-op
  }
}

// Record the delivery for audit/dedupe (best-effort; the ledger's own idempotency is the real guard),
// then ACK 200.
async function ack(
  deps: { dal: DataAccess },
  webhookId: string,
  eventType: string,
  status: string,
): Promise<WebhookResult> {
  try {
    await deps.dal.recordWebhookEvent({ webhookId, eventType, status });
  } catch {
    // audit-only; a failure here must not turn a processed grant into a retry
  }
  return { statusCode: 200 };
}
