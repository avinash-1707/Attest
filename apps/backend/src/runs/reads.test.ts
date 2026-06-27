import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Attestation } from '@attest/contracts';
import { buildApp } from '../app';
import type { BackendDeps } from '../platform/deps';

const TS = new Date('2026-06-23T00:00:00.000Z');

function attestation(): Attestation {
  return {
    schemaVersion: '1.0',
    runId: 'run_1',
    orgId: 'org_1',
    appId: 'app_1',
    source: 'mcp',
    goal: 'log in',
    status: 'passed',
    url: 'https://app.com',
    startedAt: '2026-06-23T00:00:00.000Z',
    durationMs: 1200,
    steps: [],
    evidence: { consoleErrors: [], networkErrors: [], screenshotRefs: [], domSnapshotRefs: [], videoRef: null },
  };
}

const runRow = {
  id: 'run_1',
  orgId: 'org_1',
  appId: 'app_1',
  source: 'mcp' as const,
  goal: 'log in',
  url: 'https://app.com',
  lifecycle: 'completed' as const,
  attempt: 0,
  modelSnapshot: null,
  startedAt: TS,
  finishedAt: TS,
  durationMs: 1200,
  error: null,
  createdAt: TS,
  updatedAt: TS,
};

const evRow = {
  id: 'ev_1',
  orgId: 'org_1',
  appId: 'app_1',
  runId: 'run_1',
  stepIndex: null,
  kind: 'screenshot' as const,
  storageKey: 'org_1/app_1/screenshot/s.png',
  contentType: 'image/png',
  bytes: 7,
  createdAt: TS,
};

let storeGet: ReturnType<typeof vi.fn>;
let getByStorageKey: ReturnType<typeof vi.fn>;
let getRun: ReturnType<typeof vi.fn>;
let getByRun: ReturnType<typeof vi.fn>;

function makeDeps(): BackendDeps {
  storeGet = vi.fn(async () => Buffer.from('PNGDATA'));
  getByStorageKey = vi.fn(async (key: string) => (key === evRow.storageKey ? evRow : undefined));
  getRun = vi.fn(async (id: string) => (id === 'run_1' ? runRow : undefined));
  getByRun = vi.fn(async (id: string) => (id === 'run_1' ? attestation() : undefined));

  const org = {
    runs: { list: vi.fn(async () => ({ rows: [runRow], nextCursor: null })), get: getRun },
    attestations: { getByRun, statusByRun: vi.fn(async (id: string) => (id === 'run_1' ? 'passed' : undefined)) },
    evidence: { listForRun: vi.fn(async () => [evRow]), getByStorageKey },
    appKeys: { touchLastUsed: vi.fn(async () => undefined) },
  };

  return {
    config: { trustedOrigins: ['https://dash.test'] },
    dal: {
      forOrg: () => org,
      resolveServiceKey: vi.fn(async () => ({ key: { id: 'k1', orgId: 'org_1' }, appIds: ['app_1'] })),
    },
    cipher: {},
    queue: {},
    redis: {},
    auth: { handler: async () => new Response(null), api: { getSession: vi.fn() } },
    store: { get: storeGet },
    modelDefaults: { planner: 'p', judge: 'j', resolution: 'r' },
    closeDb: async () => undefined,
  } as unknown as BackendDeps;
}

const auth = { authorization: 'Bearer ak_live_secret' };

describe('read API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GET /runs lists history (lifecycle, verdict omitted to avoid N+1)', async () => {
    const app = buildApp(makeDeps());
    const res = await app.inject({ method: 'GET', url: '/runs', headers: auth });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      runs: [{ runId: 'run_1', appId: 'app_1', goal: 'log in', lifecycle: 'completed', status: null, createdAt: TS.toISOString(), durationMs: 1200 }],
      nextCursor: null,
    });
    await app.close();
  });

  it('GET /runs passes the default page size (50) and no cursor when none given', async () => {
    const deps = makeDeps();
    const app = buildApp(deps);
    await app.inject({ method: 'GET', url: '/runs', headers: auth });
    expect(deps.dal.forOrg('org_1').runs.list).toHaveBeenCalledWith(expect.objectContaining({ limit: 50 }));
    await app.close();
  });

  it('GET /runs encodes a forward cursor and round-trips it back to the DAL', async () => {
    const deps = makeDeps();
    const cursorRow = { ...runRow, id: 'run_abcdefghijklmnopqrstuvwx', createdAt: new Date('2026-06-20T00:00:00.000Z') };
    (deps.dal.forOrg('org_1').runs.list as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      rows: [cursorRow],
      nextCursor: { createdAt: cursorRow.createdAt, id: cursorRow.id },
    });
    const app = buildApp(deps);
    const first = await app.inject({ method: 'GET', url: '/runs?limit=1', headers: auth });
    const { nextCursor } = first.json();
    expect(nextCursor).toBeTruthy();

    await app.inject({ method: 'GET', url: `/runs?limit=1&cursor=${encodeURIComponent(nextCursor)}`, headers: auth });
    expect(deps.dal.forOrg('org_1').runs.list).toHaveBeenLastCalledWith({
      limit: 1,
      cursor: { createdAt: cursorRow.createdAt, id: cursorRow.id },
    });
    await app.close();
  });

  it('GET /runs 400s a malformed cursor', async () => {
    const app = buildApp(makeDeps());
    const res = await app.inject({ method: 'GET', url: '/runs?cursor=not-a-real-cursor', headers: auth });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('invalid_cursor');
    await app.close();
  });

  it('GET /runs 400s a tampered cursor (valid base64url, wrong JSON shape)', async () => {
    const app = buildApp(makeDeps());
    const tampered = Buffer.from(JSON.stringify({ foo: 'bar' }), 'utf8').toString('base64url');
    const res = await app.inject({ method: 'GET', url: `/runs?cursor=${encodeURIComponent(tampered)}`, headers: auth });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('invalid_cursor');
    await app.close();
  });

  it('GET /runs 400s an out-of-range, fractional or non-numeric limit', async () => {
    const app = buildApp(makeDeps());
    for (const bad of ['0', '101', 'abc', '1.5', '-5']) {
      const res = await app.inject({ method: 'GET', url: `/runs?limit=${bad}`, headers: auth });
      expect(res.statusCode, `limit=${bad}`).toBe(400);
      expect(res.json().code).toBe('invalid_request');
    }
    await app.close();
  });

  it('GET /runs/:id returns status + verdict from the attestation', async () => {
    const app = buildApp(makeDeps());
    const res = await app.inject({ method: 'GET', url: '/runs/run_1', headers: auth });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ runId: 'run_1', lifecycle: 'completed', status: 'passed', durationMs: 1200 });
    await app.close();
  });

  it('GET /runs/:id 404s an unknown run', async () => {
    const app = buildApp(makeDeps());
    const res = await app.inject({ method: 'GET', url: '/runs/nope', headers: auth });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('run_not_found');
    await app.close();
  });

  it('GET /runs/:id/attestation returns the full attestation, 404 when none', async () => {
    const app = buildApp(makeDeps());
    const ok = await app.inject({ method: 'GET', url: '/runs/run_1/attestation', headers: auth });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().status).toBe('passed');
    const none = await app.inject({ method: 'GET', url: '/runs/other/attestation', headers: auth });
    expect(none.statusCode).toBe(404);
    await app.close();
  });

  it('GET /runs/:id/evidence indexes refs with a fetch url', async () => {
    const app = buildApp(makeDeps());
    const res = await app.inject({ method: 'GET', url: '/runs/run_1/evidence', headers: auth });
    expect(res.statusCode).toBe(200);
    expect(res.json().evidence[0]).toEqual({
      ref: 'org_1/app_1/screenshot/s.png',
      kind: 'screenshot',
      stepIndex: null,
      contentType: 'image/png',
      bytes: 7,
      url: `/evidence?ref=${encodeURIComponent('org_1/app_1/screenshot/s.png')}`,
    });
    await app.close();
  });

  it('GET /evidence streams the bytes for an owned ref', async () => {
    const app = buildApp(makeDeps());
    const res = await app.inject({ method: 'GET', url: `/evidence?ref=${encodeURIComponent(evRow.storageKey)}`, headers: auth });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
    expect(res.rawPayload.equals(Buffer.from('PNGDATA'))).toBe(true);
    expect(storeGet).toHaveBeenCalledWith({ orgId: 'org_1', appId: 'app_1' }, evRow.storageKey);
    await app.close();
  });

  it('GET /evidence 400s without a ref, 404s a foreign/unknown ref', async () => {
    const app = buildApp(makeDeps());
    const noRef = await app.inject({ method: 'GET', url: '/evidence', headers: auth });
    expect(noRef.statusCode).toBe(400);
    const foreign = await app.inject({ method: 'GET', url: '/evidence?ref=org_2%2Fapp%2Fx.png', headers: auth });
    expect(foreign.statusCode).toBe(404);
    expect(storeGet).not.toHaveBeenCalled();
    await app.close();
  });
});
