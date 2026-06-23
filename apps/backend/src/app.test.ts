import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildApp } from './app';
import type { BackendDeps } from './platform/deps';

const MODELS = { planner: 'm/p', judge: 'm/j', resolution: 'm/r' };

let getSession: ReturnType<typeof vi.fn>;
let add: ReturnType<typeof vi.fn>;
let resolveServiceKey: ReturnType<typeof vi.fn>;

function makeDeps(opts: { appIds?: string[] } = {}): BackendDeps {
  add = vi.fn(async () => undefined);
  getSession = vi.fn(async () => null);
  resolveServiceKey = vi.fn(async () => ({
    key: { id: 'k1', orgId: 'org_1' },
    appIds: opts.appIds ?? ['app_1'],
  }));

  const org = {
    apps: { get: vi.fn(async () => ({ id: 'app_1', orgId: 'org_1', allowlist: ['https://ok.com'], archivedAt: null })) },
    modelKeys: { list: vi.fn(async () => []) },
    appCredentials: { list: vi.fn(async () => []) },
    runs: { create: vi.fn(async () => ({ id: 'run_1' })), failPermanently: vi.fn(async () => undefined) },
    appKeys: { touchLastUsed: vi.fn(async () => undefined) },
  };

  return {
    config: { openrouterApiKey: 'sk-hosted', trustedOrigins: ['https://dash.test'] },
    dal: { forOrg: () => org, resolveServiceKey },
    cipher: { for: () => ({ seal: async (s: string) => s, open: async (s: string) => s }) },
    queue: { add },
    redis: {},
    auth: { handler: async () => new Response(null), api: { getSession } },
    modelDefaults: MODELS,
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
    expect(res.json()).toEqual({ runId: 'run_1', status: 'queued' });
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
    expect(res.json()).toEqual({ runId: 'run_1', status: 'queued' });
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
