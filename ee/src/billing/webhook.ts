import DodoPayments from 'dodopayments';
import type { BillingWebhookHandler, WebhookHeaders, WebhookResult } from '@attest/contracts';
import type { DataAccess, OrgScope } from '@attest/db';
import { creditsFromAmount, type BillingPricing } from './pricing';

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
  };
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
}): BillingWebhookHandler {
  if (!deps.verify && !deps.webhookKey) {
    throw new Error('billing webhook handler requires a webhookKey (DODO_WEBHOOK_KEY) or a verify seam');
  }
  const verify = deps.verify ?? realVerify(deps.webhookKey as string);

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
        await applyEvent(deps.dal.forOrg(orgId), event, webhookId, deps.pricing);
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
): Promise<void> {
  switch (event.type) {
    case 'subscription.active':
    case 'subscription.renewed': {
      await org.orgBilling.upsert({
        subscriptionStatus: 'active',
        ...(event.data.subscription_id ? { dodoSubscriptionId: event.data.subscription_id } : {}),
        ...(event.data.product_id ? { currentTier: event.data.product_id } : {}),
      });
      const amount = event.data.recurring_pre_tax_amount ?? 0;
      if (amount > 0) {
        await org.credits.grant({
          amount: creditsFromAmount(amount, pricing),
          idempotencyKey: webhookId,
          reason: 'monthly_grant',
        });
      }
      break;
    }
    case 'payment.succeeded': {
      // One-time credit pack only; a subscription's own payment is granted via the subscription events.
      if (!event.data.subscription_id) {
        const amount = event.data.total_amount ?? 0;
        if (amount > 0) {
          await org.credits.grant({
            amount: creditsFromAmount(amount, pricing),
            idempotencyKey: webhookId,
            reason: 'pack_purchase',
            kind: 'purchase',
          });
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
