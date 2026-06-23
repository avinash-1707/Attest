import { describe, it, expect } from 'vitest';
import { handleAttest, handleAssertOutcome, handleVerifyFlow, handleExplainFailure, type ToolDeps } from './tools';
import { BackendError, type BackendClient } from '../backend/client';
import { fakeClient, passedAttestation, failedAttestation } from '../test-fixtures';

const runner = { pollIntervalMs: 10, pollTimeoutMs: 100, sleep: async () => {} };

function deps(client: BackendClient): ToolDeps {
  return { appId: 'app_1', client, runner };
}

describe('run tools', () => {
  it('attest passes the goal through verbatim and returns the attestation as a non-error result', async () => {
    const client = fakeClient({ statuses: [{ lifecycle: 'completed', status: 'passed' }], attestation: passedAttestation });
    const res = await handleAttest({ goal: 'log in works', url: 'https://x.com' }, deps(client));

    expect(res.isError).toBe(false);
    expect(client.calls.create).toEqual([{ appId: 'app_1', goal: 'log in works', url: 'https://x.com' }]);
    expect(JSON.parse(res.text)).toEqual(passedAttestation);
  });

  it('a failed verdict is still a successful tool call (the agent loops on it)', async () => {
    const client = fakeClient({ statuses: [{ lifecycle: 'completed', status: 'failed' }], attestation: failedAttestation });
    const res = await handleAttest({ goal: 'g', url: 'https://x.com' }, deps(client));
    expect(res.isError).toBe(false);
    expect(JSON.parse(res.text).status).toBe('failed');
  });

  it('assert_outcome uses the outcome as the goal', async () => {
    const client = fakeClient({ statuses: [{ lifecycle: 'completed', status: 'passed' }], attestation: passedAttestation });
    await handleAssertOutcome({ url: 'https://x.com', outcome: 'cart shows 2 items' }, deps(client));
    expect(client.calls.create).toEqual([{ appId: 'app_1', goal: 'cart shows 2 items', url: 'https://x.com' }]);
  });

  it('verify_flow composes the goal with numbered ordered steps', async () => {
    const client = fakeClient({ statuses: [{ lifecycle: 'completed', status: 'passed' }], attestation: passedAttestation });
    await handleVerifyFlow(
      { url: 'https://x.com', goal: 'checkout works', steps: ['add item', 'open cart', 'pay'] },
      deps(client),
    );
    const created = client.calls.create[0] as { goal: string };
    expect(created.goal).toBe('checkout works\n\nSteps to verify, in order:\n1. add item\n2. open cart\n3. pay');
  });

  it('an operational cancel surfaces as an error result, not an attestation', async () => {
    const client = fakeClient({ statuses: [{ lifecycle: 'canceled', error: 'url_not_allowlisted' }] });
    const res = await handleAttest({ goal: 'g', url: 'https://x.com' }, deps(client));
    expect(res.isError).toBe(true);
    expect(JSON.parse(res.text).error.code).toBe('run_canceled');
  });

  it('a poll timeout is an error result carrying the runId', async () => {
    const client = fakeClient({ statuses: [{ lifecycle: 'running' }] });
    const res = await handleAttest({ goal: 'g', url: 'https://x.com' }, deps(client));
    expect(res.isError).toBe(true);
    expect(JSON.parse(res.text).error.code).toBe('run_timeout');
    expect(JSON.parse(res.text).error.runId).toBe('run_abc123');
  });

  it('rejects a malformed goal (zod) before any backend call', async () => {
    const client = fakeClient({ statuses: [{ lifecycle: 'completed' }] });
    await expect(handleAttest({ goal: '', url: 'not-a-url' }, deps(client))).rejects.toThrow();
    expect(client.calls.create).toEqual([]);
  });
});

describe('explain_failure', () => {
  it('returns the failure dossier for a failed run', async () => {
    const client = fakeClient({ statuses: [], attestation: failedAttestation });
    const res = await handleExplainFailure({ runId: 'run_def456' }, deps(client));
    const body = JSON.parse(res.text);
    expect(res.isError).toBe(false);
    expect(body.status).toBe('failed');
    expect(body.failure.suggestedNextAction).toBe('Check null-handling');
  });

  it('returns a no-dossier message for a run that did not fail', async () => {
    const client = fakeClient({ statuses: [], attestation: passedAttestation });
    const res = await handleExplainFailure({ runId: 'run_abc123' }, deps(client));
    const body = JSON.parse(res.text);
    expect(res.isError).toBe(false);
    expect(body.failure).toBeNull();
  });

  it('maps a 404 to a run_not_found error result', async () => {
    const client: BackendClient = {
      createRun: async () => ({ runId: 'x', status: 'queued' }),
      getRunStatus: async () => {
        throw new Error('unused');
      },
      getAttestation: async () => {
        throw new BackendError(404, 'attestation_not_found', 'nope');
      },
    };
    const res = await handleExplainFailure({ runId: 'run_x' }, deps(client));
    expect(res.isError).toBe(true);
    expect(JSON.parse(res.text).error.code).toBe('attestation_unavailable');
  });
});

describe('run tools - backend faults', () => {
  it('a BackendError at enqueue becomes an isError result, not a thrown protocol error', async () => {
    const client: BackendClient = {
      createRun: async () => {
        throw new BackendError(403, 'app_forbidden', 'POST /runs -> 403');
      },
      getRunStatus: async () => {
        throw new Error('unused');
      },
      getAttestation: async () => {
        throw new Error('unused');
      },
    };
    const res = await handleAttest({ goal: 'g', url: 'https://x.com' }, deps(client));
    expect(res.isError).toBe(true);
    const body = JSON.parse(res.text);
    expect(body.error.code).toBe('backend_error');
    expect(body.error.status).toBe(403);
    expect(body.error.backendCode).toBe('app_forbidden');
  });
});
