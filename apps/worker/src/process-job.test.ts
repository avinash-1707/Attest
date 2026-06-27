import { describe, it, expect, vi } from 'vitest';
import { UnrecoverableError } from 'bullmq';
import { SCHEMA_VERSION, type Attestation, type JobPayload, type RunStatus } from '@attest/contracts';
import type { DataAccess } from '@attest/db';
import { processRunJob, EnvironmentRetryError, type JobContext } from './process-job';
import { noopMeter } from './billing/load';

const JOB: JobPayload = {
  runId: 'run_1',
  orgId: 'org_1',
  appId: 'app_1',
  source: 'mcp',
  goal: 'log in',
  url: 'https://example.com/login',
  modelConfig: { models: { planner: 'm', judge: 'm', resolution: 'm' }, apiKey: 'sk-test' },
  byok: false,
};

function attestation(status: RunStatus, overrides: Partial<Attestation> = {}): Attestation {
  const base: Attestation = {
    schemaVersion: SCHEMA_VERSION,
    runId: JOB.runId,
    orgId: JOB.orgId,
    appId: JOB.appId,
    source: JOB.source,
    goal: JOB.goal,
    status,
    url: JOB.url,
    startedAt: '2026-06-22T00:00:00.000Z',
    durationMs: 1234,
    steps: [],
    evidence: {
      consoleErrors: [],
      networkErrors: [],
      screenshotRefs: ['org_1/app_1/screenshot/a'],
      domSnapshotRefs: ['org_1/app_1/dom_snapshot/b'],
      videoRef: null,
    },
    ...overrides,
  };
  if (status === 'failed' && !base.failure) {
    base.failure = {
      step: 'submit',
      reason: 'goal not met',
      rootCauseHypothesis: 'form rejected',
      evidence: { console: [], network: [] },
      suggestedNextAction: 'retry with valid creds',
    };
  }
  return base;
}

function fakeRuns() {
  return {
    // Returns true = the run was claimed (was not already terminal) [audit 2026-06-27 H4].
    markRunning: vi.fn(async () => true),
    markCompleted: vi.fn(async () => {}),
    markCanceled: vi.fn(async (_runId: string) => {}),
    failPermanently: vi.fn(async (_runId: string, _message: string) => {}),
    incrementAttempt: vi.fn(async (_runId: string) => 1),
    setError: vi.fn(async (_runId: string, _message: string) => {}),
  };
}

function makeDal(opts: { allowlist?: string[]; appExists?: boolean } = {}) {
  const runs = fakeRuns();
  const attestations = { save: vi.fn(async () => {}), statusByRun: vi.fn(async () => undefined) };
  const evidence = { createMany: vi.fn(async () => []) };
  const apps = {
    get: vi.fn(async () =>
      opts.appExists === false ? undefined : { id: 'app_1', allowlist: opts.allowlist ?? ['example.com'] },
    ),
  };
  const dal = {
    forOrg: () => ({ apps, runs, attestations, evidence }),
  } as unknown as DataAccess;
  return { dal, runs, attestations, evidence, apps };
}

const METER = { modelCostUsd: 0.08, browserMinutes: 1.5, steps: 2 };
function runResult(status: RunStatus, overrides: Partial<Attestation> = {}) {
  return { attestation: attestation(status, overrides), meter: METER };
}

function ctx(over: Partial<JobContext> & { dal: DataAccess }): JobContext {
  return {
    attemptsMade: 0,
    maxAttempts: 3,
    meter: noopMeter,
    run: vi.fn(async () => runResult('passed')),
    ...over,
  };
}

describe('processRunJob', () => {
  it('persists a passed run: attestation, evidence rows, completed', async () => {
    const { dal, runs, attestations, evidence } = makeDal();
    const res = await processRunJob(JOB, ctx({ dal }));
    expect(res.status).toBe('passed');
    expect(runs.markRunning).toHaveBeenCalledWith('run_1');
    expect(attestations.save).toHaveBeenCalledWith('run_1', expect.objectContaining({ status: 'passed' }));
    expect(evidence.createMany).toHaveBeenCalledWith([
      { appId: 'app_1', runId: 'run_1', kind: 'screenshot', storageKey: 'org_1/app_1/screenshot/a' },
      { appId: 'app_1', runId: 'run_1', kind: 'dom_snapshot', storageKey: 'org_1/app_1/dom_snapshot/b' },
    ]);
    expect(runs.markCompleted).toHaveBeenCalledWith('run_1', { durationMs: 1234 });
  });

  it('rejects (no retry) when the url is off the allowlist, and cancels the run in one write', async () => {
    const { dal, runs, attestations } = makeDal({ allowlist: ['other.com'] });
    await expect(processRunJob(JOB, ctx({ dal }))).rejects.toBeInstanceOf(UnrecoverableError);
    expect(runs.failPermanently).toHaveBeenCalledWith('run_1', 'navigation target not in allowlist');
    expect(runs.markRunning).not.toHaveBeenCalled();
    expect(attestations.save).not.toHaveBeenCalled();
  });

  it('rejects when the app is missing', async () => {
    const { dal, runs } = makeDal({ appExists: false });
    await expect(processRunJob(JOB, ctx({ dal }))).rejects.toBeInstanceOf(UnrecoverableError);
    expect(runs.failPermanently).toHaveBeenCalledWith('run_1', 'app not found in org');
  });

  it('rejects an invalid payload without retry', async () => {
    const { dal } = makeDal();
    await expect(processRunJob({ runId: 'x' }, ctx({ dal }))).rejects.toBeInstanceOf(UnrecoverableError);
  });

  it('retries (no persist) on an environment failure before the budget is spent', async () => {
    const { dal, attestations, runs } = makeDal();
    const run = vi.fn(async () => runResult('inconclusive'));
    await expect(processRunJob(JOB, ctx({ dal, run, attemptsMade: 0, maxAttempts: 3 }))).rejects.toBeInstanceOf(
      EnvironmentRetryError,
    );
    expect(attestations.save).not.toHaveBeenCalled();
    expect(runs.markCompleted).not.toHaveBeenCalled();
  });

  it('surfaces inconclusive on the final attempt, recording the operational reason', async () => {
    const { dal, attestations, runs } = makeDal();
    const run = vi.fn(async () => runResult('inconclusive'));
    const res = await processRunJob(JOB, ctx({ dal, run, attemptsMade: 2, maxAttempts: 3 }));
    expect(res.status).toBe('inconclusive');
    expect(attestations.save).toHaveBeenCalledWith('run_1', expect.objectContaining({ status: 'inconclusive' }));
    expect(runs.setError).toHaveBeenCalledWith('run_1', 'inconclusive after retry budget exhausted');
    expect(runs.markCompleted).toHaveBeenCalled();
  });

  it('bumps the attempt counter only on a re-execution, not the first attempt', async () => {
    const { dal, runs } = makeDal();
    await processRunJob(JOB, ctx({ dal, attemptsMade: 0 }));
    expect(runs.incrementAttempt).not.toHaveBeenCalled();

    const retry = makeDal();
    await processRunJob(JOB, ctx({ dal: retry.dal, attemptsMade: 1 }));
    expect(retry.runs.incrementAttempt).toHaveBeenCalledWith('run_1');
  });

  it('persists a verdict failure (never retried)', async () => {
    const { dal, attestations } = makeDal();
    const run = vi.fn(async () => runResult('failed'));
    const res = await processRunJob(JOB, ctx({ dal, run, attemptsMade: 0 }));
    expect(res.status).toBe('failed');
    expect(attestations.save).toHaveBeenCalledWith('run_1', expect.objectContaining({ status: 'failed' }));
  });

  it('rethrows a worker fault for retry before the budget is spent, without resolving the run', async () => {
    const { dal, runs } = makeDal();
    const boom = new Error('chromium crashed');
    const run = vi.fn(async () => {
      throw boom;
    });
    await expect(processRunJob(JOB, ctx({ dal, run, attemptsMade: 0, maxAttempts: 3 }))).rejects.toBe(boom);
    expect(runs.failPermanently).not.toHaveBeenCalled();
  });

  it('resolves the run on a final worker fault, then rethrows for dead-letter', async () => {
    const { dal, runs } = makeDal();
    const boom = new Error('chromium crashed');
    const run = vi.fn(async () => {
      throw boom;
    });
    await expect(processRunJob(JOB, ctx({ dal, run, attemptsMade: 2, maxAttempts: 3 }))).rejects.toBe(boom);
    expect(runs.failPermanently).toHaveBeenCalledWith('run_1', 'Error: chromium crashed');
  });

  it('redacts the BYOK key from a worker-fault error before persisting it [invariant 4]', async () => {
    const { dal, runs } = makeDal();
    const run = vi.fn(async () => {
      throw new Error(`gateway 401 for key ${JOB.modelConfig.apiKey}`);
    });
    await expect(processRunJob(JOB, ctx({ dal, run, attemptsMade: 2, maxAttempts: 3 }))).rejects.toThrow();
    const [, message] = runs.failPermanently.mock.calls[0]!;
    expect(message).not.toContain(JOB.modelConfig.apiKey);
    expect(message).toContain('[redacted]');
  });

  it('meters a resolved run after completion with the run meter + byok flag [tech-arch §13.2]', async () => {
    const { dal } = makeDal();
    const meter = { recordAndDebit: vi.fn(async () => {}) };
    const res = await processRunJob(JOB, ctx({ dal, meter }));
    expect(res.status).toBe('passed');
    expect(meter.recordAndDebit).toHaveBeenCalledWith({
      orgId: 'org_1',
      appId: 'app_1',
      runId: 'run_1',
      browserMinutes: METER.browserMinutes,
      steps: METER.steps,
      modelCostUsd: METER.modelCostUsd,
      byok: false,
    });
  });

  it('does not meter a run rejected before execution (allowlist denial)', async () => {
    const { dal } = makeDal({ allowlist: ['other.com'] });
    const meter = { recordAndDebit: vi.fn(async () => {}) };
    await expect(processRunJob(JOB, ctx({ dal, meter }))).rejects.toBeInstanceOf(UnrecoverableError);
    expect(meter.recordAndDebit).not.toHaveBeenCalled();
  });

  it('meters a failed verdict (it consumed browser + model budget)', async () => {
    const { dal } = makeDal();
    const meter = { recordAndDebit: vi.fn(async () => {}) };
    const run = vi.fn(async () => runResult('failed'));
    await processRunJob(JOB, ctx({ dal, meter, run, attemptsMade: 0 }));
    expect(meter.recordAndDebit).toHaveBeenCalledWith(expect.objectContaining({ runId: 'run_1', byok: false }));
  });

  it('does NOT meter an inconclusive run (no verdict, no charge) even on the final attempt', async () => {
    const { dal, runs } = makeDal();
    const meter = { recordAndDebit: vi.fn(async () => {}) };
    const run = vi.fn(async () => runResult('inconclusive'));
    const res = await processRunJob(JOB, ctx({ dal, meter, run, attemptsMade: 2, maxAttempts: 3 }));
    expect(res.status).toBe('inconclusive');
    expect(runs.markCompleted).toHaveBeenCalled(); // run resolved...
    expect(meter.recordAndDebit).not.toHaveBeenCalled(); // ...but was not billed
  });

  it('does not meter an inconclusive run that is retried (thrown before completion)', async () => {
    const { dal } = makeDal();
    const meter = { recordAndDebit: vi.fn(async () => {}) };
    const run = vi.fn(async () => runResult('inconclusive'));
    await expect(
      processRunJob(JOB, ctx({ dal, meter, run, attemptsMade: 0, maxAttempts: 3 })),
    ).rejects.toBeInstanceOf(EnvironmentRetryError);
    expect(meter.recordAndDebit).not.toHaveBeenCalled();
  });
});
