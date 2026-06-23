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
    expect(await a.attestations.statusByRun(run.id)).toBe('passed');
    expect(await b.attestations.statusByRun(run.id)).toBeUndefined();
    expect((await a.evidence.get(ev.id))?.id).toBe(ev.id);
    expect((await a.evidence.getByStorageKey('org_a/app/ev1.png'))?.id).toBe(ev.id);
  });

  it('refuses to create a run against an app outside the org', async () => {
    const app = await dao.forOrg('org_a').apps.create({ name: 'a' });
    await expect(
      dao.forOrg('org_b').runs.create({ appId: app.id, source: 'mcp', goal: 'g', url: 'https://x.com' }),
    ).rejects.toThrow(/not found in org/);
  });

  it('listWithScopes returns each key with its app scope in one query', async () => {
    const a = dao.forOrg('org_a');
    const app1 = await a.apps.create({ name: 'one' });
    const app2 = await a.apps.create({ name: 'two' });
    await a.appKeys.create({ name: 'multi', keyHash: 'h1', keyPrefix: 'ak_1', appIds: [app1.id, app2.id] });
    await a.appKeys.create({ name: 'single', keyHash: 'h2', keyPrefix: 'ak_2', appIds: [app1.id] });

    const keys = await a.appKeys.listWithScopes();
    expect(keys).toHaveLength(2);
    const multi = keys.find((k) => k.name === 'multi');
    expect(multi?.appIds.sort()).toEqual([app1.id, app2.id].sort());
    expect(keys.find((k) => k.name === 'single')?.appIds).toEqual([app1.id]);
    // org_b sees none.
    expect(await dao.forOrg('org_b').appKeys.listWithScopes()).toHaveLength(0);
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

describe('credit ledger [tech-arch §13.4]', () => {
  it('balance is 0 for an org with no entries, and sums signed entries', async () => {
    const a = dao.forOrg('org_a');
    expect(await a.credits.balance()).toBe(0);

    await a.credits.grant({ amount: 1000, idempotencyKey: 'starter:org_a', reason: 'starter' });
    await a.credits.grant({ amount: 500, idempotencyKey: 'wh_pack_1', reason: 'pack_purchase', kind: 'purchase' });
    expect(await a.credits.balance()).toBe(1500);
  });

  it('grant is idempotent on idempotencyKey (a replayed webhook re-grants to a no-op)', async () => {
    const a = dao.forOrg('org_a');
    await a.credits.grant({ amount: 1000, idempotencyKey: 'wh_1', reason: 'monthly_grant' });
    await a.credits.grant({ amount: 1000, idempotencyKey: 'wh_1', reason: 'monthly_grant' });
    expect(await a.credits.balance()).toBe(1000);
    expect(await a.credits.list()).toHaveLength(1);
  });

  it('debitForRun writes a usage event + a debit, idempotent on runId (re-delivery is a no-op)', async () => {
    const a = dao.forOrg('org_a');
    const app = await a.apps.create({ name: 'a' });
    const run = await a.runs.create({ appId: app.id, source: 'mcp', goal: 'g', url: 'https://x.com' });
    await a.credits.grant({ amount: 100, idempotencyKey: 'starter:org_a', reason: 'starter' });

    const charge = {
      runId: run.id,
      appId: app.id,
      credits: 7,
      usage: { browserMinutes: 1.5, steps: 3, modelCostUsd: 0.08 },
    };
    await a.credits.debitForRun(charge);
    await a.credits.debitForRun(charge); // re-delivery

    expect(await a.credits.balance()).toBe(93);
    const usage = await a.usage.listSince(new Date(0));
    expect(usage).toHaveLength(1);
    expect(usage[0]?.steps).toBe(3);
  });

  it('a zero-credit charge records usage but no debit row', async () => {
    const a = dao.forOrg('org_a');
    const app = await a.apps.create({ name: 'a' });
    const run = await a.runs.create({ appId: app.id, source: 'mcp', goal: 'g', url: 'https://x.com' });

    await a.credits.debitForRun({
      runId: run.id,
      appId: app.id,
      credits: 0,
      usage: { browserMinutes: 1, steps: 2, modelCostUsd: 0 },
    });
    expect(await a.credits.balance()).toBe(0);
    expect(await a.credits.list()).toHaveLength(0);
    expect(await a.usage.listSince(new Date(0))).toHaveLength(1);
  });

  it('a ledger is tenant-isolated: another org never sees the balance', async () => {
    const a = dao.forOrg('org_a');
    await a.credits.grant({ amount: 1000, idempotencyKey: 'starter:org_a', reason: 'starter' });
    expect(await dao.forOrg('org_b').credits.balance()).toBe(0);
  });
});

describe('billing webhook fulfillment [tech-arch §13.5]', () => {
  it('maps a Dodo customer to its org via org_billing upsert', async () => {
    await dao.forOrg('org_a').orgBilling.upsert({ dodoCustomerId: 'cus_123', subscriptionStatus: 'active' });
    expect(await dao.resolveOrgByDodoCustomer('cus_123')).toBe('org_a');
    expect(await dao.resolveOrgByDodoCustomer('cus_nope')).toBeUndefined();
    expect((await dao.forOrg('org_a').orgBilling.get())?.subscriptionStatus).toBe('active');
  });

  it('dedupes a webhook delivery on webhook-id (fresh once, then not)', async () => {
    expect((await dao.recordWebhookEvent({ webhookId: 'wh_1', eventType: 'subscription.active', status: 'processed' })).fresh).toBe(true);
    expect((await dao.recordWebhookEvent({ webhookId: 'wh_1', eventType: 'subscription.active', status: 'processed' })).fresh).toBe(false);
  });
});
