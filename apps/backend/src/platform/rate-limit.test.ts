import { describe, it, expect, vi, beforeEach } from 'vitest';
import IORedis from 'ioredis';
import { buildApp } from '../app';
import type { BackendDeps } from './deps';
import { allowAllGate, unavailableCheckout } from '../billing/load';

const MODELS = { planner: 'm/p', judge: 'm/j', resolution: 'm/r' };

type RL = {
  enabled: boolean;
  trustProxyHops: number;
  globalMax: number;
  authMax: number;
  enqueueMax: number;
};

function rl(overrides: Partial<RL> = {}): RL {
  return { enabled: true, trustProxyHops: 0, globalMax: 100, authMax: 8, enqueueMax: 30, ...overrides };
}

function makeDeps(rateLimit: RL | undefined, opts: { redis?: unknown } = {}) {
  const add = vi.fn(async () => undefined);
  // toNodeHandler(deps.auth) calls deps.auth.handler; spying on it proves whether a throttled auth
  // request reached the (expensive) handler or was rejected by the limiter's onRequest hook first.
  const authHandler = vi.fn(async () => new Response(null, { status: 200 }));
  const getSession = vi.fn(async () => null);
  const resolveServiceKey = vi.fn(async () => ({ key: { id: 'k1', orgId: 'org_1' }, appIds: ['app_1'] }));
  const webhookHandle = vi.fn(async () => ({ statusCode: 200 }));

  const org = {
    apps: { get: vi.fn(async () => ({ id: 'app_1', orgId: 'org_1', allowlist: ['https://ok.com'], archivedAt: null })) },
    modelKeys: { list: vi.fn(async () => []) },
    appCredentials: { list: vi.fn(async () => []) },
    runs: { create: vi.fn(async () => ({ id: 'run_1' })), failPermanently: vi.fn(async () => undefined) },
    appKeys: { touchLastUsed: vi.fn(async () => undefined) },
    credits: { balance: vi.fn(async () => 1234) },
    orgBilling: { get: vi.fn(async () => ({ planId: 'team', subscriptionStatus: 'active' })) },
  };
  const forOrg = vi.fn(() => org);

  const deps = {
    config: { openrouterApiKey: 'sk-hosted', trustedOrigins: [], billingEnabled: false, rateLimit },
    dal: { forOrg, resolveServiceKey },
    cipher: { for: () => ({ seal: async (s: string) => s, open: async (s: string) => s }) },
    queue: { add },
    redis: opts.redis ?? {},
    auth: { handler: authHandler, api: { getSession } },
    modelDefaults: MODELS,
    gate: allowAllGate,
    webhook: { handle: webhookHandle },
    checkout: unavailableCheckout,
    closeDb: async () => undefined,
  } as unknown as BackendDeps;

  return { deps, add, authHandler, webhookHandle };
}

const runBody = { appId: 'app_1', goal: 'log in', url: 'https://ok.com/login' };

// A POST the global net applies to with no auth in the way: the webhook route uses the global bucket
// (it is neither the auth catch-all nor /runs) and a 200-stub handler keeps it off the OSS 404 path.
function webhook(app: ReturnType<typeof buildApp>, headers: Record<string, string> = {}) {
  return app.inject({
    method: 'POST',
    url: '/webhooks/dodo',
    headers: { 'content-type': 'application/json', ...headers },
    payload: '{}',
  });
}

describe('rate limiting', () => {
  beforeEach(() => vi.clearAllMocks());

  it('429s past the global net with a house-shaped body + Retry-After', async () => {
    const { deps } = makeDeps(rl({ globalMax: 3 }));
    const app = buildApp(deps);
    for (let i = 0; i < 3; i++) expect((await webhook(app)).statusCode).toBe(200);

    const res = await webhook(app);
    expect(res.statusCode).toBe(429);
    expect(res.json()).toEqual({ code: 'rate_limited', message: expect.any(String) });
    expect(Object.keys(res.json())).toHaveLength(2);
    expect(res.headers['retry-after']).toBeDefined();
    await app.close();
  });

  it('caps run-enqueue on its own bucket, tighter than the global net', async () => {
    const { deps, add } = makeDeps(rl({ globalMax: 100, enqueueMax: 2 }));
    const app = buildApp(deps);
    const enqueue = () =>
      app.inject({ method: 'POST', url: '/runs', headers: { authorization: 'Bearer ak_live_secret' }, payload: runBody });

    expect((await enqueue()).statusCode).toBe(202);
    expect((await enqueue()).statusCode).toBe(202);
    const third = await enqueue();
    expect(third.statusCode).toBe(429);
    expect(add).toHaveBeenCalledTimes(2);
    await app.close();
  });

  it('keys the enqueue bucket per service key, so one key does not throttle another', async () => {
    const { deps } = makeDeps(rl({ globalMax: 100, enqueueMax: 2 }));
    const app = buildApp(deps);
    const enqueue = (key: string) =>
      app.inject({ method: 'POST', url: '/runs', headers: { authorization: `Bearer ${key}` }, payload: runBody });

    // Two keys, each at its own per-key limit. The per-route cap inherits the bearer-hash keyGenerator,
    // so key AAA exhausting its bucket must not spill onto key BBB.
    expect((await enqueue('ak_live_AAA')).statusCode).toBe(202);
    expect((await enqueue('ak_live_AAA')).statusCode).toBe(202);
    expect((await enqueue('ak_live_AAA')).statusCode).toBe(429);
    expect((await enqueue('ak_live_BBB')).statusCode).toBe(202);
    await app.close();
  });

  it('exempts /health from the global net (health checks must never 429)', async () => {
    const { deps } = makeDeps(rl({ globalMax: 1 }));
    const app = buildApp(deps);
    for (let i = 0; i < 5; i++) {
      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.statusCode).toBe(200);
    }
    await app.close();
  });

  it('rejects past the tight auth cap BEFORE the auth handler runs (catch-all is hook-reachable)', async () => {
    const { deps, authHandler } = makeDeps(rl({ authMax: 2 }));
    const app = buildApp(deps);
    const signIn = () => app.inject({ method: 'POST', url: '/api/auth/sign-in/email', payload: {} });

    expect((await signIn()).statusCode).toBe(200);
    expect((await signIn()).statusCode).toBe(200);
    const third = await signIn();
    expect(third.statusCode).toBe(429);
    expect(third.json().code).toBe('rate_limited');
    // The third request never reached the (deliberately slow) credential handler.
    expect(authHandler).toHaveBeenCalledTimes(2);
    await app.close();
  });

  it('leaves non-sensitive auth paths (session polling) off the tight cap', async () => {
    const { deps, authHandler } = makeDeps(rl({ authMax: 2 }));
    const app = buildApp(deps);
    for (let i = 0; i < 5; i++) {
      const res = await app.inject({ method: 'GET', url: '/api/auth/get-session' });
      expect(res.statusCode).toBe(200);
    }
    expect(authHandler).toHaveBeenCalledTimes(5);
    await app.close();
  });

  it('does not subject the webhook to the tight auth cap (signature is its control)', async () => {
    const { deps, webhookHandle } = makeDeps(rl({ globalMax: 100, authMax: 2 }));
    const app = buildApp(deps);
    for (let i = 0; i < 3; i++) expect((await webhook(app)).statusCode).toBe(200);
    expect(webhookHandle).toHaveBeenCalledTimes(3);
    await app.close();
  });

  it('trustProxyHops:0 ignores X-Forwarded-For, so a spoofed XFF cannot mint fresh buckets', async () => {
    const { deps } = makeDeps(rl({ globalMax: 2, trustProxyHops: 0 }));
    const app = buildApp(deps);
    // Every request carries a different forged client IP; with no trusted proxy they all key on the
    // real socket peer, so the third still trips the limit.
    expect((await webhook(app, { 'x-forwarded-for': '1.1.1.1' })).statusCode).toBe(200);
    expect((await webhook(app, { 'x-forwarded-for': '2.2.2.2' })).statusCode).toBe(200);
    expect((await webhook(app, { 'x-forwarded-for': '3.3.3.3' })).statusCode).toBe(429);
    await app.close();
  });

  it('trustProxyHops:1 keys on the real client and ignores the spoofable left-most XFF entry', async () => {
    // Spoof-immunity: the trusted proxy appends the true client as the right-most XFF entry. With one
    // trusted hop the limiter keys on it; varying only the left-most (attacker-controlled) entry must
    // not escape the bucket.
    const spoof = makeDeps(rl({ globalMax: 2, trustProxyHops: 1 }));
    const appA = buildApp(spoof.deps);
    expect((await webhook(appA, { 'x-forwarded-for': 'a, 10.0.0.9' })).statusCode).toBe(200);
    expect((await webhook(appA, { 'x-forwarded-for': 'b, 10.0.0.9' })).statusCode).toBe(200);
    expect((await webhook(appA, { 'x-forwarded-for': 'c, 10.0.0.9' })).statusCode).toBe(429);
    await appA.close();

    // Distinct real clients behind the proxy land in distinct buckets (not collapsed onto one).
    const distinct = makeDeps(rl({ globalMax: 2, trustProxyHops: 1 }));
    const appB = buildApp(distinct.deps);
    expect((await webhook(appB, { 'x-forwarded-for': '1.1.1.1' })).statusCode).toBe(200);
    expect((await webhook(appB, { 'x-forwarded-for': '2.2.2.2' })).statusCode).toBe(200);
    expect((await webhook(appB, { 'x-forwarded-for': '3.3.3.3' })).statusCode).toBe(200);
    await appB.close();
  });

  it('fails OPEN when the Redis store is unreachable (a blip must not lock the front door)', async () => {
    const deadRedis = new IORedis('redis://127.0.0.1:1', {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
    deadRedis.on('error', () => {});
    // Guard against silently degrading to the in-memory store (which would pass without exercising
    // fail-open at all): the store path is taken only for a real IORedis instance.
    expect(deadRedis).toBeInstanceOf(IORedis);
    const { deps } = makeDeps(rl({ globalMax: 1 }), { redis: deadRedis });
    const app = buildApp(deps);
    // Well past globalMax:1; every request must still pass because the store errors and skipOnError
    // short-circuits to allow.
    for (let i = 0; i < 4; i++) {
      const res = await webhook(app);
      expect(res.statusCode).toBe(200);
    }
    await app.close();
    await deadRedis.quit().catch(() => {});
  });

  it('is a no-op when disabled (OSS/self-host default)', async () => {
    const { deps } = makeDeps(rl({ enabled: false, globalMax: 1 }));
    const app = buildApp(deps);
    for (let i = 0; i < 5; i++) expect((await webhook(app)).statusCode).toBe(200);
    await app.close();
  });

  it('is a no-op when config.rateLimit is absent entirely', async () => {
    const { deps } = makeDeps(undefined);
    const app = buildApp(deps);
    for (let i = 0; i < 5; i++) expect((await webhook(app)).statusCode).toBe(200);
    await app.close();
  });
});
