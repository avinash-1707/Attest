import type { FastifyInstance, FastifyRequest } from 'fastify';
import { fromNodeHeaders } from 'better-auth/node';
import { billingSummary, checkoutCreate, checkoutSession } from '@attest/contracts';
import type { BackendDeps } from '../platform/deps';
import { resolveContext } from '../auth/context';
import { ApiError } from '../platform/errors';

// Billing API: a read summary for the dashboard plus self-serve checkout/portal redirects [tech-arch
// §13.6]. Session-only (a service key runs attestations, never administers billing). Checkout/portal
// delegate to the injected BillingCheckout seam, which 409s (CheckoutUnavailableError) on the OSS build
// or when billing is disabled - the route never names a plan price or Dodo product.

async function sessionOrgId(req: FastifyRequest, deps: BackendDeps): Promise<string> {
  const ctx = await resolveContext(req, deps);
  if (ctx.principal.kind !== 'session') {
    throw new ApiError(403, 'session_required', 'This endpoint requires a dashboard session');
  }
  return ctx.orgId;
}

export function registerBillingRoutes(app: FastifyInstance, deps: BackendDeps): void {
  // Plan + live balance for the current org. Available in every build: on the OSS/self-hosted build
  // `enabled` is false so the UI shows "unlimited" instead of a meaningless zero.
  app.get('/billing/summary', async (req) => {
    const orgId = await sessionOrgId(req, deps);
    const scope = deps.dal.forOrg(orgId);
    const [balance, billing] = await Promise.all([scope.credits.balance(), scope.orgBilling.get()]);
    return billingSummary.parse({
      enabled: deps.config.billingEnabled,
      planId: billing?.planId ?? null,
      subscriptionStatus: billing?.subscriptionStatus ?? null,
      balance,
    });
  });

  // Open a hosted checkout to subscribe to a plan or buy a credit pack. Seeds the org's Dodo customer
  // from the session user's email the first time, so the inbound webhook can resolve the org later.
  app.post('/billing/checkout', async (req) => {
    const session = await deps.auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session?.session) throw new ApiError(401, 'unauthorized', 'No active session');
    const orgId = session.session.activeOrganizationId;
    if (!orgId) throw new ApiError(403, 'no_active_org', 'No active organization selected');

    const body = checkoutCreate.parse(req.body);
    const result = await deps.checkout.createCheckoutSession({
      orgId,
      kind: body.kind,
      planId: body.planId,
      customerEmail: session.user.email,
      customerName: session.user.name,
    });
    return checkoutSession.parse(result);
  });

  // Hosted customer-portal link for an org that already has a Dodo customer. POST (not GET): it makes an
  // outbound Dodo call, so it is state-changing and must pass the CSRF Origin guard rather than skip it.
  app.post('/billing/portal', async (req) => {
    const orgId = await sessionOrgId(req, deps);
    const result = await deps.checkout.createPortalLink({ orgId });
    return checkoutSession.parse(result);
  });
}
