import { describe, it, expect } from 'vitest';
import { attestation, type Attestation } from './attestation';
import { SCHEMA_VERSION } from './enums';

const basePassed: Attestation = {
  schemaVersion: SCHEMA_VERSION,
  runId: 'run_abc123',
  orgId: 'org_1',
  appId: 'app_1',
  source: 'mcp',
  goal: 'A user can log in and reach the dashboard',
  status: 'passed',
  url: 'https://staging.app.com',
  startedAt: '2026-06-22T10:00:00Z',
  durationMs: 18400,
  steps: [
    {
      index: 0,
      name: 'Open login page',
      status: 'passed',
      evidence: { screenshotRef: 'ev_001' },
    },
    {
      index: 1,
      name: 'Submit',
      status: 'passed',
      resolvedBy: 'text',
      guardsTriggered: ['http_status'],
      evidence: { screenshotRef: 'ev_002', domSnapshotRef: 'dom_002' },
    },
  ],
  evidence: {
    consoleErrors: [],
    networkErrors: [],
    screenshotRefs: ['ev_001', 'ev_002'],
    domSnapshotRefs: ['dom_002'],
    videoRef: null,
  },
};

const baseFailed: Attestation = {
  ...basePassed,
  runId: 'run_def456',
  status: 'failed',
  steps: [
    {
      index: 0,
      name: 'Submit',
      status: 'failed',
      resolvedBy: 'text',
      guardsTriggered: ['http_status', 'console_error'],
      evidence: { screenshotRef: 'ev_003', domSnapshotRef: 'dom_003' },
    },
  ],
  failure: {
    step: 'Submit',
    reason: 'Dashboard never rendered after submit',
    rootCauseHypothesis: 'Client exception before navigation',
    evidence: {
      screenshotRef: 'ev_003',
      console: ['TypeError: user is undefined at Login.tsx:88'],
      network: ['POST /api/login 500'],
    },
    suggestedNextAction: 'Check null-handling of the login response',
  },
};

describe('attestation contract', () => {
  it('accepts a valid passed attestation', () => {
    expect(attestation.parse(basePassed)).toEqual(basePassed);
  });

  it('accepts a valid failed attestation with a dossier', () => {
    expect(attestation.parse(baseFailed)).toEqual(baseFailed);
  });

  it('round-trips through parse(JSON(parse(x)))', () => {
    const once = attestation.parse(baseFailed);
    const twice = attestation.parse(JSON.parse(JSON.stringify(once)));
    expect(twice).toEqual(once);
  });

  it('rejects status="failed" without a failure dossier', () => {
    const { failure: _omit, ...noDossier } = baseFailed;
    expect(attestation.safeParse(noDossier).success).toBe(false);
  });

  it('rejects a failure dossier when status is not "failed"', () => {
    const passedWithFailure = { ...basePassed, failure: baseFailed.failure };
    expect(attestation.safeParse(passedWithFailure).success).toBe(false);
  });

  it('rejects an unknown status', () => {
    expect(attestation.safeParse({ ...basePassed, status: 'errored' }).success).toBe(false);
  });

  it('rejects a wrong schemaVersion', () => {
    expect(attestation.safeParse({ ...basePassed, schemaVersion: '2.0' }).success).toBe(false);
  });

  it('rejects an unknown resolvedBy value', () => {
    const bad = {
      ...basePassed,
      steps: [{ index: 0, name: 'x', status: 'passed', resolvedBy: 'url' }],
    };
    expect(attestation.safeParse(bad).success).toBe(false);
  });

  it('rejects a non-ISO startedAt', () => {
    expect(attestation.safeParse({ ...basePassed, startedAt: 'yesterday' }).success).toBe(false);
  });

  it('requires a non-empty suggestedNextAction on failure', () => {
    const bad = {
      ...baseFailed,
      failure: { ...baseFailed.failure, suggestedNextAction: '' },
    };
    expect(attestation.safeParse(bad).success).toBe(false);
  });
});
