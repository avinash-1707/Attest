import type { Attestation, RunCreated, RunStatusView, RunLifecycle, RunStatus } from '@attest/contracts';
import { SCHEMA_VERSION } from '@attest/contracts';
import type { BackendClient } from './backend/client';

export const passedAttestation: Attestation = {
  schemaVersion: SCHEMA_VERSION,
  runId: 'run_abc123',
  orgId: 'org_1',
  appId: 'app_1',
  source: 'mcp',
  goal: 'A user can log in',
  status: 'passed',
  url: 'https://staging.app.com',
  startedAt: '2026-06-22T10:00:00Z',
  durationMs: 18400,
  steps: [{ index: 0, name: 'Open login page', status: 'passed', evidence: { screenshotRef: 'ev_001' } }],
  evidence: {
    consoleErrors: [],
    networkErrors: [],
    screenshotRefs: ['ev_001'],
    domSnapshotRefs: [],
    videoRef: null,
  },
};

export const failedAttestation: Attestation = {
  ...passedAttestation,
  runId: 'run_def456',
  status: 'failed',
  steps: [{ index: 0, name: 'Submit', status: 'failed', evidence: { screenshotRef: 'ev_003' } }],
  failure: {
    step: 'Submit',
    reason: 'Dashboard never rendered',
    rootCauseHypothesis: 'Client exception before navigation',
    evidence: { screenshotRef: 'ev_003', console: ['TypeError'], network: ['POST /api/login 500'] },
    suggestedNextAction: 'Check null-handling',
  },
};

function statusView(over: Partial<RunStatusView> & { lifecycle: RunLifecycle; status: RunStatus | null }): RunStatusView {
  return {
    runId: 'run_abc123',
    appId: 'app_1',
    source: 'mcp',
    goal: 'A user can log in',
    url: 'https://staging.app.com',
    attempt: 1,
    createdAt: '2026-06-22T10:00:00Z',
    startedAt: null,
    finishedAt: null,
    durationMs: null,
    error: null,
    ...over,
  };
}

// A scripted fake: returns each queued status in turn, then sticks on the last one. Records calls so a
// test can assert the create payload and how many polls ran.
export function fakeClient(opts: {
  statuses: Array<{ lifecycle: RunLifecycle; status?: RunStatus | null; error?: string | null }>;
  attestation?: Attestation;
  onCreate?: RunCreated;
}): BackendClient & { calls: { create: unknown[]; statusPolls: number; attestationFetches: number } } {
  const calls = { create: [] as unknown[], statusPolls: 0, attestationFetches: 0 };
  return {
    calls,
    async createRun(input) {
      calls.create.push(input);
      return opts.onCreate ?? { runId: 'run_abc123', status: 'queued' };
    },
    async getRunStatus() {
      const idx = Math.min(calls.statusPolls, opts.statuses.length - 1);
      const s = opts.statuses[idx];
      calls.statusPolls += 1;
      if (!s) throw new Error('fakeClient: no status configured');
      return statusView({ lifecycle: s.lifecycle, status: s.status ?? null, error: s.error ?? null });
    },
    async getAttestation() {
      calls.attestationFetches += 1;
      if (!opts.attestation) throw new Error('no attestation configured');
      return opts.attestation;
    },
  };
}
