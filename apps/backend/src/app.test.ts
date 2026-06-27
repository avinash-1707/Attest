import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildApp } from './app';
import type { BackendDeps } from './platform/deps';
import { allowAllGate, noopWebhookHandler, unavailableCheckout } from './billing/load';
import { CheckoutUnavailableError } from '@attest/contracts';

const MODELS = { planner: 'm/p', judge: 'm/j', resolution: 'm/r' };

let getSession: ReturnType<typeof vi.fn>;
let add: ReturnType<typeof vi.fn>;
let resolveServiceKey: ReturnType<typeof vi.fn>;
let forOrg: ReturnType<typeof vi.fn>;
let balance: ReturnType<typeof vi.fn>;
let orgBillingGet: ReturnType<typeof vi.fn>;

function makeDeps(
  opts: {
    appIds?: string[];
    webhook?: BackendDeps['webhook'];
    checkout?: BackendDeps['checkout'];
    billingEnabled?: boolean;
  } = {},
): BackendDeps {
  add = vi.fn(async () => undefined);
  getSession = vi.fn(async () => null);
  resolveServiceKey = vi.fn(async () => ({
    key: { id: 'k1', orgId: 'org_1' },
    appIds: opts.appIds ?? ['app_1'],
  }));
  balance = vi.fn(async () => 1234);
  orgBillingGet = vi.fn(async () => ({ planId: 'team', subscriptionStatus: 'active' }));

  const org = {
    apps: { get: vi.fn(async () => ({ id: 'app_1', orgId: 'org_1', allowlist: ['https://ok.com'], archivedAt: null })) },
    modelKeys: { list: vi.fn(async () => []) },
    appCredentials: { list: vi.fn(async () => []) },
    runs: { create: vi.fn(async () => ({ id: 'run_1' })), failPermanently: vi.fn(async () => undefined) },
    appKeys: { touchLastUsed: vi.fn(async () => undefined) },
    credits: { balance },
    orgBilling: { get: orgBillingGet },
  };
  forOrg = vi.fn(() => org);

  return {
    config: {
      openrouterApiKey: 'sk-hosted',
      trustedOrigins: ['https://dash.test'],
      billingEnabled: opts.billingEnabled ?? false,
    },
    dal: {
      forOrg,
      resolveServiceKey,
      // Session routes now re-validate live membership [audit 2026-06-27 M1].
      getUserOrgMemberships: vi.fn(async () => [{ organizationId: 'org_1', createdAt: new Date() }]),
    },
    cipher: { for: () => ({ seal: async (s: string) => s, open: async (s: string) => s }) },
    queue: { add },
    redis: {},
    auth: { handler: async () => new Response(null), api: { getSession } },
    modelDefaults: MODELS,
    gate: allowAllGate,
    webhook: opts.webhook ?? noopWebhookHandler,
    checkout: opts.checkout ?? unavailableCheckout,
    closeDb: async () => undefined,
  } as unknown as BackendDeps;
}

const body = { appId: 'app_1', goal: 'log in', url: 'https://ok.com/login' };

describe('POST /runs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enqueues via the service-key (MCP) door', async () => {
    const app = buildApp(makeDeps());
    const res = await app.inject({
      method: 'POST',
      url: '/runs',
      headers: { authorization: 'Bearer ak_live_secret' },
      payload: body,
    });
    expect(res.statusCode).toBe(202);
    // runId is minted by the producer (so the credit gate can reserve against it) [audit 2026-06-27 H7].
    expect(res.json()).toMatchObject({ runId: expect.stringMatching(/^run_/), status: 'queued' });
    expect(add).toHaveBeenCalledTimes(1);
    // Provenance framing: the service-key door stamps source 'mcp'.
    expect(add.mock.calls[0]![1].source).toBe('mcp');
    await app.close();
  });

  it('enqueues via the session (dashboard) door, stamping source dashboard', async () => {
    const app = buildApp(makeDeps());
    getSession.mockResolvedValueOnce({ session: { activeOrganizationId: 'org_1' }, user: { id: 'u1' } });
    const res = await app.inject({ method: 'POST', url: '/runs', payload: body });
    expect(res.statusCode).toBe(202);
    expect(res.json()).toMatchObject({ runId: expect.stringMatching(/^run_/), status: 'queued' });
    expect(add.mock.calls[0]![1].source).toBe('dashboard');
    await app.close();
  });

  it('lets a session (appScope:all) target any app in its org, not just a scoped list', async () => {
    const app = buildApp(makeDeps({ appIds: ['app_other'] }));
    getSession.mockResolvedValueOnce({ session: { activeOrganizationId: 'org_1' }, user: { id: 'u1' } });
    const res = await app.inject({ method: 'POST', url: '/runs', payload: { ...body, appId: 'app_unlisted' } });
    expect(res.statusCode).toBe(202);
    expect(add).toHaveBeenCalledTimes(1);
    await app.close();
  });

  it('401s a session door with no session, without enqueueing', async () => {
    const app = buildApp(makeDeps());
    const res = await app.inject({ method: 'POST', url: '/runs', payload: body });
    expect(res.statusCode).toBe(401);
    expect(add).not.toHaveBeenCalled();
    await app.close();
  });

  it('403s a session whose active org is not selected', async () => {
    const app = buildApp(makeDeps());
    getSession.mockResolvedValueOnce({ session: { activeOrganizationId: null }, user: { id: 'u1' } });
    const res = await app.inject({ method: 'POST', url: '/runs', payload: body });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('no_active_org');
    expect(add).not.toHaveBeenCalled();
    await app.close();
  });

  it('400s an invalid body (missing appId)', async () => {
    const app = buildApp(makeDeps());
    const res = await app.inject({
      method: 'POST',
      url: '/runs',
      headers: { authorization: 'Bearer ak_live_secret' },
      payload: { goal: 'log in', url: 'https://ok.com/login' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('invalid_request');
    expect(add).not.toHaveBeenCalled();
    await app.close();
  });

  it('403s a service key not scoped to the target app', async () => {
    const app = buildApp(makeDeps({ appIds: ['app_other'] }));
    const res = await app.inject({
      method: 'POST',
      url: '/runs',
      headers: { authorization: 'Bearer ak_live_secret' },
      payload: body,
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('app_forbidden');
    expect(add).not.toHaveBeenCalled();
    await app.close();
  });

  it('serves /health', async () => {
    const app = buildApp(makeDeps());
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
    await app.close();
  });
});

describe('CSRF guard (cookie/session door)', () => {
  beforeEach(() => vi.clearAllMocks());

  const cookie = 'better-auth.session_token=abc';

  it('allows a cookie-authed state-changing request from a trusted Origin', async () => {
    const app = buildApp(makeDeps());
    getSession.mockResolvedValueOnce({ session: { activeOrganizationId: 'org_1' }, user: { id: 'u1' } });
    const res = await app.inject({
      method: 'POST',
      url: '/runs',
      headers: { cookie, origin: 'https://dash.test' },
      payload: body,
    });
    expect(res.statusCode).toBe(202);
    expect(add).toHaveBeenCalledTimes(1);
    await app.close();
  });

  it('rejects a cookie-authed state-changing request with no Origin, before auth or enqueue', async () => {
    const app = buildApp(makeDeps());
    const res = await app.inject({ method: 'POST', url: '/runs', headers: { cookie }, payload: body });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('csrf_origin_rejected');
    expect(getSession).not.toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
    await app.close();
  });

  it('rejects a cookie-authed request from an untrusted Origin', async () => {
    const app = buildApp(makeDeps());
    const res = await app.inject({
      method: 'POST',
      url: '/runs',
      headers: { cookie, origin: 'https://evil.test' },
      payload: body,
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('csrf_origin_rejected');
    expect(add).not.toHaveBeenCalled();
    await app.close();
  });

  it('does not guard the Bearer (MCP) door even with a cookie and bad Origin', async () => {
    const app = buildApp(makeDeps());
    const res = await app.inject({
      method: 'POST',
      url: '/runs',
      headers: { cookie, origin: 'https://evil.test', authorization: 'Bearer ak_live_secret' },
      payload: body,
    });
    expect(res.statusCode).toBe(202);
    await app.close();
  });

  it('does not guard a safe (GET) method', async () => {
    const app = buildApp(makeDeps());
    const res = await app.inject({ method: 'GET', url: '/health', headers: { cookie, origin: 'https://evil.test' } });
    expect(res.statusCode).toBe(200);
    await app.close();
  });
});

describe('Dodo webhook route [tech-arch §13.5]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('passes the raw body + signature headers to the handler and returns its status', async () => {
    const handle = vi.fn(async () => ({ statusCode: 200 }));
    const app = buildApp(makeDeps({ webhook: { handle } }));
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/dodo',
      headers: {
        'content-type': 'application/json',
        'webhook-id': 'wh_1',
        'webhook-signature': 'v1,sig',
        'webhook-timestamp': '123',
      },
      payload: '{"type":"subscription.renewed"}',
    });
    expect(res.statusCode).toBe(200);
    expect(handle).toHaveBeenCalledWith('{"type":"subscription.renewed"}', {
      'webhook-id': 'wh_1',
      'webhook-signature': 'v1,sig',
      'webhook-timestamp': '123',
    });
    await app.close();
  });

  it('surfaces a 400 from the handler on a bad signature, no Origin/CSRF needed', async () => {
    const handle = vi.fn(async () => ({ statusCode: 400 }));
    const app = buildApp(makeDeps({ webhook: { handle } }));
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/dodo',
      headers: { 'content-type': 'application/json', 'webhook-id': 'wh_1' },
      payload: '{}',
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('404s in the OSS build (no-op handler)', async () => {
    const app = buildApp(makeDeps());
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/dodo',
      headers: { 'content-type': 'application/json' },
      payload: '{}',
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});

describe('Billing routes [tech-arch §13.6]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GET /billing/summary returns balance + plan from the SESSION org scope only [invariant 3]', async () => {
    const app = buildApp(makeDeps({ billingEnabled: true }));
    getSession.mockResolvedValueOnce({ session: { activeOrganizationId: 'org_1' }, user: { id: 'u1' } });
    const res = await app.inject({ method: 'GET', url: '/billing/summary' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ enabled: true, planId: 'team', subscriptionStatus: 'active', balance: 1234 });
    // The org is derived from the session, never from client input: the DAL was scoped to it.
    expect(forOrg).toHaveBeenCalledWith('org_1');
    await app.close();
  });

  it('GET /billing/summary reports enabled:false on the OSS/self-hosted build', async () => {
    const app = buildApp(makeDeps({ billingEnabled: false }));
    getSession.mockResolvedValueOnce({ session: { activeOrganizationId: 'org_1' }, user: { id: 'u1' } });
    const res = await app.inject({ method: 'GET', url: '/billing/summary' });
    expect(res.json().enabled).toBe(false);
    await app.close();
  });

  it('refuses a service-key (bearer) caller on /billing/summary - billing is session-only', async () => {
    const app = buildApp(makeDeps());
    const res = await app.inject({
      method: 'GET',
      url: '/billing/summary',
      headers: { authorization: 'Bearer ak_live_secret' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('session_required');
    await app.close();
  });

  it('401s /billing/summary with no session', async () => {
    const app = buildApp(makeDeps());
    const res = await app.inject({ method: 'GET', url: '/billing/summary' });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('maps CheckoutUnavailableError to 409 on POST /billing/checkout', async () => {
    const checkout = {
      createCheckoutSession: vi.fn(async () => {
        throw new CheckoutUnavailableError('Billing is not enabled on this deployment');
      }),
      createPortalLink: vi.fn(),
    };
    const app = buildApp(makeDeps({ billingEnabled: true, checkout: checkout as never }));
    getSession.mockResolvedValueOnce({
      session: { activeOrganizationId: 'org_1' },
      user: { id: 'u1', email: 'a@b.com', name: 'A' },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/billing/checkout',
      headers: { cookie: 'better-auth.session_token=abc', origin: 'https://dash.test' },
      payload: { kind: 'plan', planId: 'team' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('checkout_unavailable');
    await app.close();
  });
});
