import { describe, it, expect, beforeEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import type { Attestation } from '@attest/contracts';
import * as schema from '../schema';
import { createDataAccess, type DataAccess } from './index';

async function freshDataAccess(): Promise<DataAccess> {
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: 'migrations' });
  await db.insert(schema.organization).values([
    { id: 'org_a', name: 'A', slug: 'a', createdAt: new Date() },
    { id: 'org_b', name: 'B', slug: 'b', createdAt: new Date() },
  ]);
  // The DAL is driver-agnostic; pglite stands in for Postgres in tests.
  return createDataAccess(db as unknown as Parameters<typeof createDataAccess>[0]);
}

function passingAttestation(over: Partial<Attestation>): Attestation {
  return {
    schemaVersion: '1.0',
    runId: 'run_x',
    orgId: 'org_a',
    appId: 'app_x',
    source: 'mcp',
    goal: 'A user can log in',
    status: 'passed',
    url: 'https://staging.app.com',
    startedAt: '2026-06-22T10:00:00Z',
    durationMs: 1200,
    steps: [],
    evidence: {
      consoleErrors: [],
      networkErrors: [],
      screenshotRefs: [],
      domSnapshotRefs: [],
      videoRef: null,
    },
    ...over,
  };
}

let dao: DataAccess;
beforeEach(async () => {
  dao = await freshDataAccess();
});

describe('tenant isolation [arch §5.2, invariant 3]', () => {
  it('never returns another org rows through any repo', async () => {
    const a = dao.forOrg('org_a');
    const b = dao.forOrg('org_b');

    const app = await a.apps.create({ name: 'checkout', allowlist: ['https://app.com'] });
    const run = await a.runs.create({ appId: app.id, source: 'mcp', goal: 'g', url: 'https://app.com' });
    await a.attestations.save(run.id, passingAttestation({ runId: run.id, appId: app.id }));
    const ev = await a.evidence.create({
      appId: app.id,
      runId: run.id,
      kind: 'screenshot',
      storageKey: 'org_a/app/ev1.png',
    });

    expect(await b.apps.list()).toHaveLength(0);
    expect(await b.apps.get(app.id)).toBeUndefined();
    expect(await b.runs.get(run.id)).toBeUndefined();
    expect(await b.runs.list()).toHaveLength(0);
    expect(await b.attestations.getByRun(run.id)).toBeUndefined();
    expect(await b.evidence.get(ev.id)).toBeUndefined();
    expect(await b.evidence.getByStorageKey('org_a/app/ev1.png')).toBeUndefined();

    expect(await a.apps.list()).toHaveLength(1);
    expect((await a.attestations.getByRun(run.id))?.status).toBe('passed');
    expect((await a.evidence.get(ev.id))?.id).toBe(ev.id);
    expect((await a.evidence.getByStorageKey('org_a/app/ev1.png'))?.id).toBe(ev.id);
  });

  it('refuses to create a run against an app outside the org', async () => {
    const app = await dao.forOrg('org_a').apps.create({ name: 'a' });
    await expect(
      dao.forOrg('org_b').runs.create({ appId: app.id, source: 'mcp', goal: 'g', url: 'https://x.com' }),
    ).rejects.toThrow(/not found in org/);
  });

  it('refuses a service key scoped to an app outside the org', async () => {
    const app = await dao.forOrg('org_a').apps.create({ name: 'a' });
    await expect(
      dao.forOrg('org_b').appKeys.create({
        name: 'k',
        keyHash: 'h',
        keyPrefix: 'ak_x',
        appIds: [app.id],
      }),
    ).rejects.toThrow(/outside this org/);
  });

  it('refuses an attestation whose orgId/runId does not match the run', async () => {
    const a = dao.forOrg('org_a');
    const app = await a.apps.create({ name: 'a' });
    const run = await a.runs.create({ appId: app.id, source: 'mcp', goal: 'g', url: 'https://x.com' });
    await expect(
      a.attestations.save(run.id, passingAttestation({ runId: run.id, orgId: 'org_b' })),
    ).rejects.toThrow(/does not match/);
  });
});

describe('service key resolution [arch §6.2]', () => {
  it('resolves a live key to its org and app scope, but not a revoked one', async () => {
    const a = dao.forOrg('org_a');
    const app = await a.apps.create({ name: 'a' });
    const key = await a.appKeys.create({
      name: 'ci',
      keyHash: 'hash_live',
      keyPrefix: 'ak_live_1',
      appIds: [app.id],
    });

    const resolved = await dao.resolveServiceKey('hash_live');
    expect(resolved?.key.orgId).toBe('org_a');
    expect(resolved?.appIds).toEqual([app.id]);

    await a.appKeys.revoke(key.id);
    expect(await dao.resolveServiceKey('hash_live')).toBeUndefined();
    expect(await dao.resolveServiceKey('nope')).toBeUndefined();
  });
});

describe('run lifecycle', () => {
  it('advances queued -> running -> completed', async () => {
    const a = dao.forOrg('org_a');
    const app = await a.apps.create({ name: 'a' });
    const run = await a.runs.create({ appId: app.id, source: 'dashboard', goal: 'g', url: 'https://x.com' });
    expect(run.lifecycle).toBe('queued');

    await a.runs.markRunning(run.id);
    expect((await a.runs.get(run.id))?.lifecycle).toBe('running');

    await a.runs.markCompleted(run.id, { durationMs: 4200 });
    const done = await a.runs.get(run.id);
    expect(done?.lifecycle).toBe('completed');
    expect(done?.durationMs).toBe(4200);

    expect(await a.runs.incrementAttempt(run.id)).toBe(1);
  });

  it('failPermanently cancels and records the error in one write', async () => {
    const a = dao.forOrg('org_a');
    const app = await a.apps.create({ name: 'a' });
    const run = await a.runs.create({ appId: app.id, source: 'mcp', goal: 'g', url: 'https://x.com' });

    await a.runs.failPermanently(run.id, 'navigation target not in allowlist');
    const row = await a.runs.get(run.id);
    expect(row?.lifecycle).toBe('canceled');
    expect(row?.error).toBe('navigation target not in allowlist');
  });
});

describe('evidence idempotency [tech-arch §5.4]', () => {
  it('absorbs a re-delivered storageKey instead of throwing on the unique index', async () => {
    const a = dao.forOrg('org_a');
    const app = await a.apps.create({ name: 'a' });
    const run = await a.runs.create({ appId: app.id, source: 'mcp', goal: 'g', url: 'https://x.com' });
    const rows = [
      { appId: app.id, runId: run.id, kind: 'screenshot' as const, storageKey: 'org_a/app/s.png' },
      { appId: app.id, runId: run.id, kind: 'dom_snapshot' as const, storageKey: 'org_a/app/d.html' },
    ];

    await a.evidence.createMany(rows);
    // Second delivery of the same job must not throw and must not duplicate rows.
    await expect(a.evidence.createMany(rows)).resolves.toBeDefined();
    expect(await a.evidence.listForRun(run.id)).toHaveLength(2);
  });
});
