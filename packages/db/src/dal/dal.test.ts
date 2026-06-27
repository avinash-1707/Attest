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
    expect((await b.runs.list()).rows).toHaveLength(0);
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
    // Exactly one debit row, not just the right balance: pins idempotency at the row level.
    expect((await a.credits.list()).filter((r) => r.kind === 'debit')).toHaveLength(1);
  });

  it('sums a mixed sequence of grant + purchase + debit into a signed balance', async () => {
    const a = dao.forOrg('org_a');
    const app = await a.apps.create({ name: 'a' });
    const run = await a.runs.create({ appId: app.id, source: 'mcp', goal: 'g', url: 'https://x.com' });
    await a.credits.grant({ amount: 250, idempotencyKey: 'starter:org_a', reason: 'starter' });
    await a.credits.grant({ amount: 500, idempotencyKey: 'wh_pack', reason: 'pack_purchase', kind: 'purchase' });
    await a.credits.debitForRun({
      runId: run.id,
      appId: app.id,
      credits: 9,
      usage: { browserMinutes: 1, steps: 2, modelCostUsd: 0.08 },
    });
    expect(await a.credits.balance()).toBe(741);
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

describe('run list keyset pagination', () => {
  // Own db handle so runs can be seeded with controlled created_at + id (the repo's create() always
  // stamps now()), which the boundary-tie and stable-walk cases require.
  async function freshWithDb() {
    const db = drizzle(new PGlite(), { schema });
    await migrate(db, { migrationsFolder: 'migrations' });
    await db.insert(schema.organization).values([
      { id: 'org_a', name: 'A', slug: 'a', createdAt: new Date() },
      { id: 'org_b', name: 'B', slug: 'b', createdAt: new Date() },
    ]);
    const dal = createDataAccess(db as unknown as Parameters<typeof createDataAccess>[0]);
    return { db, dal };
  }

  async function seedRun(
    db: Awaited<ReturnType<typeof freshWithDb>>['db'],
    over: { id: string; appId: string; orgId?: string; createdAt: Date },
  ) {
    await db.insert(schema.run).values({
      id: over.id,
      orgId: over.orgId ?? 'org_a',
      appId: over.appId,
      source: 'mcp',
      goal: 'g',
      url: 'https://x.com',
      createdAt: over.createdAt,
    });
  }

  const T = (n: number) => new Date(`2026-01-0${n}T00:00:00.000Z`);

  it('returns an empty page with a null cursor for an org with no runs', async () => {
    const { dal } = await freshWithDb();
    const page = await dal.forOrg('org_a').runs.list({ limit: 10 });
    expect(page.rows).toHaveLength(0);
    expect(page.nextCursor).toBeNull();
  });

  it('a single page (rows <= limit) returns a null cursor', async () => {
    const { db, dal } = await freshWithDb();
    const a = dal.forOrg('org_a');
    const app = await a.apps.create({ name: 'a' });
    await seedRun(db, { id: 'run_1', appId: app.id, createdAt: T(1) });
    await seedRun(db, { id: 'run_2', appId: app.id, createdAt: T(2) });
    const page = await a.runs.list({ limit: 10 });
    expect(page.rows.map((r) => r.id)).toEqual(['run_2', 'run_1']);
    expect(page.nextCursor).toBeNull();
  });

  it('walks multiple pages with no gap and no overlap', async () => {
    const { db, dal } = await freshWithDb();
    const a = dal.forOrg('org_a');
    const app = await a.apps.create({ name: 'a' });
    for (const n of [1, 2, 3, 4, 5]) await seedRun(db, { id: `run_${n}`, appId: app.id, createdAt: T(n) });

    const seen: string[] = [];
    let cursor = undefined as undefined | { createdAt: Date; id: string };
    for (let i = 0; i < 10; i++) {
      const page = await a.runs.list({ limit: 2, cursor });
      seen.push(...page.rows.map((r) => r.id));
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }
    // newest-first, every id exactly once.
    expect(seen).toEqual(['run_5', 'run_4', 'run_3', 'run_2', 'run_1']);
  });

  it('splits a created_at tie across the page boundary on the id tie-breaker, no dup/skip', async () => {
    const { db, dal } = await freshWithDb();
    const a = dal.forOrg('org_a');
    const app = await a.apps.create({ name: 'a' });
    // Three runs share one timestamp; id DESC is the deterministic total order.
    for (const id of ['run_a', 'run_b', 'run_c']) await seedRun(db, { id, appId: app.id, createdAt: T(1) });

    const p1 = await a.runs.list({ limit: 2 });
    expect(p1.rows.map((r) => r.id)).toEqual(['run_c', 'run_b']);
    expect(p1.nextCursor).not.toBeNull();
    const p2 = await a.runs.list({ limit: 2, cursor: p1.nextCursor! });
    expect(p2.rows.map((r) => r.id)).toEqual(['run_a']);
    expect(p2.nextCursor).toBeNull();
  });

  it('sets nextCursor iff a further row exists (limit+1 has_more)', async () => {
    const { db, dal } = await freshWithDb();
    const a = dal.forOrg('org_a');
    const app = await a.apps.create({ name: 'a' });
    await seedRun(db, { id: 'run_1', appId: app.id, createdAt: T(1) });
    await seedRun(db, { id: 'run_2', appId: app.id, createdAt: T(2) });
    const exact = await a.runs.list({ limit: 2 });
    expect(exact.rows.map((r) => r.id)).toEqual(['run_2', 'run_1']);
    expect(exact.nextCursor).toBeNull(); // exactly limit rows, no +1th
    const partial = await a.runs.list({ limit: 1 });
    expect(partial.rows.map((r) => r.id)).toEqual(['run_2']);
    expect(partial.nextCursor).not.toBeNull();
  });

  it('a forward walk never revisits rows inserted after the first page (stable under inserts)', async () => {
    const { db, dal } = await freshWithDb();
    const a = dal.forOrg('org_a');
    const app = await a.apps.create({ name: 'a' });
    for (const n of [1, 2, 3]) await seedRun(db, { id: `run_${n}`, appId: app.id, createdAt: T(n) });

    const p1 = await a.runs.list({ limit: 2 });
    expect(p1.rows.map((r) => r.id)).toEqual(['run_3', 'run_2']);
    // A new run lands (newer than everything) mid-walk.
    await seedRun(db, { id: 'run_4', appId: app.id, createdAt: T(4) });
    const p2 = await a.runs.list({ limit: 2, cursor: p1.nextCursor! });
    // page 2 only yields the older pre-existing run; the new one sorts above the cursor, never seen here.
    expect(p2.rows.map((r) => r.id)).toEqual(['run_1']);
  });

  it('a cursor minted in org A returns only org B rows when replayed against org B [invariant 3]', async () => {
    const { db, dal } = await freshWithDb();
    const a = dal.forOrg('org_a');
    const b = dal.forOrg('org_b');
    const appA = await a.apps.create({ name: 'a' });
    const appB = await b.apps.create({ name: 'b' });
    // org_a's runs are strictly NEWER than org_b's, so a cursor minted at org_a's newest sits above
    // all of org_b in time - no created_at tie to clip - and a correct (org-scoped) replay must
    // return all 3 of org_b's rows. A cross-tenant leak would instead surface org_a rows.
    for (const n of [7, 8, 9]) await seedRun(db, { id: `a_${n}`, appId: appA.id, orgId: 'org_a', createdAt: T(n) });
    for (const n of [1, 2, 3]) await seedRun(db, { id: `b_${n}`, appId: appB.id, orgId: 'org_b', createdAt: T(n) });

    const aPage = await a.runs.list({ limit: 1 });
    const stolen = aPage.nextCursor!;
    const bPage = await b.runs.list({ limit: 10, cursor: stolen });
    // Non-empty assertion first: a `.every()` over an empty array is vacuously true, so an
    // over-filtering cursor that wrongly empties org_b's page must fail loudly, not pass green.
    expect(bPage.rows).toHaveLength(3);
    expect(bPage.rows.every((r) => r.orgId === 'org_b')).toBe(true);
    expect(bPage.rows.map((r) => r.id).every((id) => id.startsWith('b_'))).toBe(true);
  });

  it('excludes the exact row the cursor names, returning only strictly-older ties', async () => {
    const { db, dal } = await freshWithDb();
    const a = dal.forOrg('org_a');
    const app = await a.apps.create({ name: 'a' });
    // Two rows at the SAME timestamp: cursor names run_b; the next page must yield run_a only,
    // and run_b must never reappear (isolates exclusive-boundary from the multi-row tie-split).
    await seedRun(db, { id: 'run_a', appId: app.id, createdAt: T(1) });
    await seedRun(db, { id: 'run_b', appId: app.id, createdAt: T(1) });
    const p1 = await a.runs.list({ limit: 1 });
    expect(p1.rows.map((r) => r.id)).toEqual(['run_b']);
    const p2 = await a.runs.list({ limit: 1, cursor: p1.nextCursor! });
    expect(p2.rows.map((r) => r.id)).toEqual(['run_a']);
    expect(p2.nextCursor).toBeNull();
  });

  it('survives the codec Date round-trip (toISOString -> new Date) against the real query', async () => {
    // Mirrors the seam the route adds: the cursor's createdAt is serialized to an ISO string and
    // parsed back before it hits the keyset eq()/lt(). If that truncation ever desynced from the
    // stored timestamp, a boundary row would be skipped or duplicated. Drive a full walk through it.
    const { db, dal } = await freshWithDb();
    const a = dal.forOrg('org_a');
    const app = await a.apps.create({ name: 'a' });
    // Includes a created_at tie so the seam is exercised at the exact eq()-boundary, not just lt().
    await seedRun(db, { id: 'run_1', appId: app.id, createdAt: T(1) });
    await seedRun(db, { id: 'run_2', appId: app.id, createdAt: T(2) });
    await seedRun(db, { id: 'run_3', appId: app.id, createdAt: T(2) });

    const seen: string[] = [];
    let cursor = undefined as undefined | { createdAt: Date; id: string };
    for (let i = 0; i < 10; i++) {
      const page = await a.runs.list({ limit: 1, cursor });
      seen.push(...page.rows.map((r) => r.id));
      if (!page.nextCursor) break;
      // Reproduce the codec transform exactly: Date -> ISO string -> Date.
      cursor = { createdAt: new Date(page.nextCursor.createdAt.toISOString()), id: page.nextCursor.id };
    }
    expect(seen).toEqual(['run_3', 'run_2', 'run_1']);
  });

  it('returns an empty terminal page for a cursor positioned past the end', async () => {
    const { db, dal } = await freshWithDb();
    const a = dal.forOrg('org_a');
    const app = await a.apps.create({ name: 'a' });
    await seedRun(db, { id: 'run_2', appId: app.id, createdAt: T(2) });
    await seedRun(db, { id: 'run_3', appId: app.id, createdAt: T(3) });
    const page = await a.runs.list({ limit: 10, cursor: { createdAt: T(1), id: 'run_0' } });
    expect(page.rows).toHaveLength(0);
    expect(page.nextCursor).toBeNull();
  });

  it('composes the appId filter with the cursor', async () => {
    const { db, dal } = await freshWithDb();
    const a = dal.forOrg('org_a');
    const app1 = await a.apps.create({ name: 'one' });
    const app2 = await a.apps.create({ name: 'two' });
    for (const n of [1, 2, 3]) await seedRun(db, { id: `one_${n}`, appId: app1.id, createdAt: T(n) });
    for (const n of [1, 2, 3]) await seedRun(db, { id: `two_${n}`, appId: app2.id, createdAt: T(n) });

    const seen: string[] = [];
    let cursor = undefined as undefined | { createdAt: Date; id: string };
    for (let i = 0; i < 10; i++) {
      const page = await a.runs.list({ limit: 2, appId: app1.id, cursor });
      seen.push(...page.rows.map((r) => r.id));
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }
    expect(seen).toEqual(['one_3', 'one_2', 'one_1']);
  });
});

describe('default-workspace resolution [arch §6.1, invariant 3]', () => {
  // Own db so we can seed user + member rows (the shared freshDataAccess seeds only orgs). org_a and
  // org_b already exist via migrate + this seed; we add memberships with explicit join times.
  async function freshWithUser() {
    const db = drizzle(new PGlite(), { schema });
    await migrate(db, { migrationsFolder: 'migrations' });
    await db.insert(schema.organization).values([
      { id: 'org_a', name: 'A', slug: 'a', createdAt: new Date() },
      { id: 'org_b', name: 'B', slug: 'b', createdAt: new Date() },
    ]);
    await db.insert(schema.user).values({ id: 'user_1', name: 'U', email: 'u@test.com' });
    const dal = createDataAccess(db as unknown as Parameters<typeof createDataAccess>[0]);
    return { db, dal };
  }

  async function addMember(
    db: Awaited<ReturnType<typeof freshWithUser>>['db'],
    orgId: string,
    joinedAtIso: string,
  ) {
    await db.insert(schema.member).values({
      id: `mem_${orgId}`,
      organizationId: orgId,
      userId: 'user_1',
      createdAt: new Date(joinedAtIso),
    });
  }

  it('returns memberships oldest-joined first (drives the resolver default)', async () => {
    const { db, dal } = await freshWithUser();
    await addMember(db, 'org_b', '2025-06-01');
    await addMember(db, 'org_a', '2024-01-01');
    const memberships = await dal.getUserOrgMemberships('user_1');
    expect(memberships.map((m) => m.organizationId)).toEqual(['org_a', 'org_b']);
  });

  it('returns no memberships for a user who belongs to none', async () => {
    const { dal } = await freshWithUser();
    expect(await dal.getUserOrgMemberships('user_1')).toEqual([]);
  });

  it('round-trips and overwrites the durable last-active pointer', async () => {
    const { db, dal } = await freshWithUser();
    await addMember(db, 'org_a', '2024-01-01');
    await addMember(db, 'org_b', '2025-06-01');
    expect(await dal.getUserLastActiveOrg('user_1')).toBeNull();
    await dal.setUserLastActiveOrg('user_1', 'org_b');
    expect(await dal.getUserLastActiveOrg('user_1')).toBe('org_b');
    await dal.setUserLastActiveOrg('user_1', 'org_a');
    expect(await dal.getUserLastActiveOrg('user_1')).toBe('org_a');
  });

  it('no-ops the durable write when the value is unchanged (rolling-refresh path)', async () => {
    const { db, dal } = await freshWithUser();
    await addMember(db, 'org_a', '2024-01-01');
    await dal.setUserLastActiveOrg('user_1', 'org_a');
    // Re-persisting the same value must not throw and must leave the pointer intact.
    await dal.setUserLastActiveOrg('user_1', 'org_a');
    expect(await dal.getUserLastActiveOrg('user_1')).toBe('org_a');
  });

  it('refuses to persist a pointer to an org the user is not a member of [audit 2026-06-27 M4]', async () => {
    const { db, dal } = await freshWithUser();
    await addMember(db, 'org_a', '2024-01-01');
    await dal.setUserLastActiveOrg('user_1', 'org_a'); // member -> persisted
    await dal.setUserLastActiveOrg('user_1', 'org_b'); // NOT a member -> guarded no-op
    expect(await dal.getUserLastActiveOrg('user_1')).toBe('org_a');
  });
});
