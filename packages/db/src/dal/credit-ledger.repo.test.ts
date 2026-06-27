import { describe, it, expect, beforeEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from '../schema';
import { createDataAccess, type DataAccess } from './index';

// DB-level proof that the credit ledger's idempotency actually dedups at the partial unique indexes,
// not just in app logic [tech-arch §13.4]. This is what stands between "grant once per billing period"
// and "grant on every webhook delivery", and between "charge once per run" and "double-charge a
// re-delivered job" - and no mock can verify the `onConflictDoNothing` arbiter matches the index.
async function freshDataAccess(): Promise<DataAccess> {
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: 'migrations' });
  await db
    .insert(schema.organization)
    .values([{ id: 'org_a', name: 'A', slug: 'a', createdAt: new Date() }]);
  return createDataAccess(db as unknown as Parameters<typeof createDataAccess>[0]);
}

let dao: DataAccess;
beforeEach(async () => {
  dao = await freshDataAccess();
});

describe('credit ledger idempotency [tech-arch §13.4]', () => {
  it('dedups a grant on idempotency_key: a replayed period grants exactly once', async () => {
    const credits = dao.forOrg('org_a').credits;
    const key = 'sub_grant:sub_1:2026-05-01';

    await credits.grant({ amount: 2500, idempotencyKey: key, reason: 'monthly_grant' });
    await credits.grant({ amount: 2500, idempotencyKey: key, reason: 'monthly_grant' });

    // Two deliveries of the same period -> ONE grant. This is the per-period correctness guarantee.
    expect(await credits.balance()).toBe(2500);
    const grants = (await credits.list()).filter((r) => r.kind === 'grant');
    expect(grants).toHaveLength(1);
  });

  it('grants distinct idempotency_keys independently (the next period grants again)', async () => {
    const credits = dao.forOrg('org_a').credits;
    await credits.grant({ amount: 2500, idempotencyKey: 'sub_grant:sub_1:2026-05-01', reason: 'monthly_grant' });
    await credits.grant({ amount: 2500, idempotencyKey: 'sub_grant:sub_1:2026-06-01', reason: 'monthly_grant' });
    expect(await credits.balance()).toBe(5000);
  });

  it('dedups a pack purchase on the webhook-id key', async () => {
    const credits = dao.forOrg('org_a').credits;
    await credits.grant({ amount: 1000, idempotencyKey: 'wh_1', reason: 'pack_purchase', kind: 'purchase' });
    await credits.grant({ amount: 1000, idempotencyKey: 'wh_1', reason: 'pack_purchase', kind: 'purchase' });
    expect(await credits.balance()).toBe(1000);
  });

  it('dedups a debit on (org_id, run_id): a re-delivered job charges exactly once', async () => {
    const org = dao.forOrg('org_a');
    const app = await org.apps.create({ name: 'checkout', allowlist: ['https://app.com'] });
    const run = await org.runs.create({ appId: app.id, source: 'mcp', goal: 'g', url: 'https://app.com' });

    const usage = { browserMinutes: 1.5, steps: 3, modelCostUsd: 0.08 };
    await org.credits.debitForRun({ runId: run.id, appId: app.id, credits: 9, usage });
    await org.credits.debitForRun({ runId: run.id, appId: app.id, credits: 9, usage });

    // Re-delivery converges to ONE debit, not -18.
    expect(await org.credits.balance()).toBe(-9);
    const debits = (await org.credits.list()).filter((r) => r.kind === 'debit');
    expect(debits).toHaveLength(1);
  });

  it('combines grants and debits into a correct running balance', async () => {
    const org = dao.forOrg('org_a');
    const app = await org.apps.create({ name: 'a', allowlist: ['https://app.com'] });
    const run = await org.runs.create({ appId: app.id, source: 'mcp', goal: 'g', url: 'https://app.com' });

    await org.credits.grant({ amount: 2500, idempotencyKey: 'sub_grant:sub_1:2026-05-01', reason: 'monthly_grant' });
    await org.credits.debitForRun({
      runId: run.id,
      appId: app.id,
      credits: 9,
      usage: { browserMinutes: 1, steps: 2, modelCostUsd: 0.05 },
    });
    expect(await org.credits.balance()).toBe(2491);
  });
});

describe('credit hold reservation [audit 2026-06-27 H7]', () => {
  it('reserves the estimate (reflected in balance) and releases it on a terminal run transition', async () => {
    const org = dao.forOrg('org_a');
    const app = await org.apps.create({ name: 'a', allowlist: ['https://app.com'] });
    const run = await org.runs.create({ appId: app.id, source: 'mcp', goal: 'g', url: 'https://app.com' });
    await org.credits.grant({ amount: 100, idempotencyKey: 'starter:org_a', reason: 'starter' });

    const remaining = await org.credits.reserveForRun({ runId: run.id, holdCredits: 10 });
    expect(remaining).toBe(90);
    expect(await org.credits.balance()).toBe(90); // the hold is live, so concurrent gates see it

    await org.runs.markCompleted(run.id, { durationMs: 5 });
    expect(await org.credits.balance()).toBe(100); // terminal transition released the hold
  });

  it('refuses (null) and persists no hold when the reservation would overdraw', async () => {
    const org = dao.forOrg('org_a');
    await org.credits.grant({ amount: 5, idempotencyKey: 'starter:org_a', reason: 'starter' });
    const remaining = await org.credits.reserveForRun({ runId: 'run_over', holdCredits: 10 });
    expect(remaining).toBeNull();
    expect(await org.credits.balance()).toBe(5); // rolled back, nothing reserved
  });

  it('reserves at most once per run (idempotent on runId)', async () => {
    const org = dao.forOrg('org_a');
    await org.credits.grant({ amount: 100, idempotencyKey: 'starter:org_a', reason: 'starter' });
    await org.credits.reserveForRun({ runId: 'run_dup', holdCredits: 10 });
    await org.credits.reserveForRun({ runId: 'run_dup', holdCredits: 10 });
    expect(await org.credits.balance()).toBe(90); // one hold, not two
  });
});

describe('run lifecycle claim guard [audit 2026-06-27 H4]', () => {
  it('markRunning claims a queued run once but refuses to resurrect a terminal one', async () => {
    const org = dao.forOrg('org_a');
    const app = await org.apps.create({ name: 'a', allowlist: ['https://app.com'] });
    const run = await org.runs.create({ appId: app.id, source: 'mcp', goal: 'g', url: 'https://app.com' });

    expect(await org.runs.markRunning(run.id)).toBe(true); // queued -> claimed
    await org.runs.markCompleted(run.id, { durationMs: 5 });
    expect(await org.runs.markRunning(run.id)).toBe(false); // already terminal -> not re-claimed
    expect((await org.runs.get(run.id))?.lifecycle).toBe('completed'); // never flipped back to running
  });
});
