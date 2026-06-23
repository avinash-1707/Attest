import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildApp } from './app';
import type { BackendDeps } from './deps';
import { hashServiceKey } from './context';

const TS = new Date('2026-06-23T00:00:00.000Z');

let seal: ReturnType<typeof vi.fn>;
let appKeyCreate: ReturnType<typeof vi.fn>;
let modelKeyCreate: ReturnType<typeof vi.fn>;
let credentialCreate: ReturnType<typeof vi.fn>;
let getSession: ReturnType<typeof vi.fn>;

function makeDeps(): BackendDeps {
  seal = vi.fn(async (pt: string) => `sealed:${pt}`);
  appKeyCreate = vi.fn(async (input: { name: string; keyPrefix: string; expiresAt?: Date }) => ({
    id: 'ak_1',
    name: input.name,
    keyPrefix: input.keyPrefix,
    lastUsedAt: null,
    revokedAt: null,
    expiresAt: input.expiresAt ?? null,
    createdAt: TS,
  }));
  modelKeyCreate = vi.fn(async (input: { label: string; provider?: string; keyPrefix: string }) => ({
    id: 'mk_1',
    label: input.label,
    provider: input.provider ?? 'openrouter',
    keyPrefix: input.keyPrefix,
    createdAt: TS,
  }));
  credentialCreate = vi.fn(async (input: { appId: string; name: string }) => ({
    id: 'cred_1',
    appId: input.appId,
    name: input.name,
    createdAt: TS,
  }));
  getSession = vi.fn(async () => ({ session: { activeOrganizationId: 'org_1' }, user: { id: 'u1' } }));

  const org = {
    apps: {
      create: vi.fn(async (i: { name: string; allowlist?: string[] }) => ({
        id: 'app_1',
        name: i.name,
        allowlist: i.allowlist ?? [],
        archivedAt: null,
        createdAt: TS,
        updatedAt: TS,
      })),
      list: vi.fn(async () => []),
      update: vi.fn(async () => undefined),
      archive: vi.fn(async () => undefined),
    },
    appKeys: {
      create: appKeyCreate,
      listWithScopes: vi.fn(async () => [
        { id: 'ak_1', name: 'ci', keyPrefix: 'ak_live_aaaa', appIds: ['app_1'], lastUsedAt: null, revokedAt: null, expiresAt: null, createdAt: TS, orgId: 'org_1', keyHash: 'SHOULDNOTLEAK' },
      ]),
      revoke: vi.fn(async () => undefined),
      touchLastUsed: vi.fn(async () => undefined),
    },
    modelKeys: { create: modelKeyCreate, list: vi.fn(async () => []), delete: vi.fn(async () => undefined) },
    appCredentials: { create: credentialCreate, list: vi.fn(async () => []), delete: vi.fn(async () => undefined) },
  };

  return {
    config: { trustedOrigins: ['https://dash.test'] },
    dal: {
      forOrg: () => org,
      resolveServiceKey: vi.fn(async () => ({ key: { id: 'k1', orgId: 'org_1' }, appIds: ['app_1'] })),
    },
    cipher: { for: () => ({ seal, open: async (s: string) => s }) },
    queue: {},
    redis: {},
    auth: { handler: async () => new Response(null), api: { getSession } },
    store: { get: vi.fn() },
    modelDefaults: { planner: 'p', judge: 'j', resolution: 'r' },
    closeDb: async () => undefined,
  } as unknown as BackendDeps;
}

describe('management API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('refuses a service-key (bearer) principal: management is session-only', async () => {
    const app = buildApp(makeDeps());
    const res = await app.inject({
      method: 'POST',
      url: '/apps',
      headers: { authorization: 'Bearer ak_live_secret' },
      payload: { name: 'Acme' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('session_required');
    await app.close();
  });

  it('creates an app via a session and returns an appView', async () => {
    const app = buildApp(makeDeps());
    const res = await app.inject({ method: 'POST', url: '/apps', payload: { name: 'Acme', allowlist: ['https://ok.com'] } });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ id: 'app_1', name: 'Acme', allowlist: ['https://ok.com'] });
    await app.close();
  });

  it('mints a service key: returns the plaintext ONCE and stores only its hash', async () => {
    const app = buildApp(makeDeps());
    const res = await app.inject({ method: 'POST', url: '/keys', payload: { name: 'ci', appIds: ['app_1'] } });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.key).toMatch(/^ak_live_/);
    expect(body).not.toHaveProperty('keyHash');
    // The DAL was given the hash of the returned key, never the plaintext.
    const stored = appKeyCreate.mock.calls[0]![0];
    expect(stored.keyHash).toBe(hashServiceKey(body.key));
    expect(stored.keyHash).not.toBe(body.key);
    await app.close();
  });

  it('seals a BYOK model key before store and never returns the ciphertext', async () => {
    const app = buildApp(makeDeps());
    const res = await app.inject({ method: 'POST', url: '/model-keys', payload: { label: 'prod', key: 'sk-or-supersecret' } });
    expect(res.statusCode).toBe(201);
    expect(seal).toHaveBeenCalledWith('sk-or-supersecret');
    expect(modelKeyCreate.mock.calls[0]![0].ciphertext).toBe('sealed:sk-or-supersecret');
    const body = res.json();
    expect(body).not.toHaveProperty('ciphertext');
    expect(JSON.stringify(body)).not.toContain('supersecret');
    await app.close();
  });

  it('seals an app credential before store and never returns the value', async () => {
    const app = buildApp(makeDeps());
    const res = await app.inject({ method: 'POST', url: '/credentials', payload: { appId: 'app_1', name: 'login', value: 'hunter2' } });
    expect(res.statusCode).toBe(201);
    expect(seal).toHaveBeenCalledWith('hunter2');
    expect(credentialCreate.mock.calls[0]![0].ciphertext).toBe('sealed:hunter2');
    expect(JSON.stringify(res.json())).not.toContain('hunter2');
    await app.close();
  });

  it('lists keys with their app scope and never leaks keyHash', async () => {
    const app = buildApp(makeDeps());
    const res = await app.inject({ method: 'GET', url: '/keys' });
    expect(res.statusCode).toBe(200);
    expect(res.json().keys[0]).toMatchObject({ id: 'ak_1', appIds: ['app_1'] });
    expect(res.payload).not.toContain('SHOULDNOTLEAK');
    await app.close();
  });

  it('archives an app (204)', async () => {
    const app = buildApp(makeDeps());
    const res = await app.inject({ method: 'DELETE', url: '/apps/app_1' });
    expect(res.statusCode).toBe(204);
    await app.close();
  });
});
