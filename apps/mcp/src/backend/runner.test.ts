import { describe, it, expect } from 'vitest';
import { runAndAwait } from './runner';
import { fakeClient, passedAttestation } from '../test-fixtures';

const noSleep = async () => {};
const poll = { pollIntervalMs: 10, pollTimeoutMs: 100, sleep: noSleep };

describe('runAndAwait', () => {
  it('enqueues with the injected appId and returns the attestation on completion', async () => {
    const client = fakeClient({ statuses: [{ lifecycle: 'completed', status: 'passed' }], attestation: passedAttestation });
    const out = await runAndAwait({ appId: 'app_1', goal: 'g', url: 'https://x.com' }, { client, ...poll });

    expect(client.calls.create).toEqual([{ appId: 'app_1', goal: 'g', url: 'https://x.com' }]);
    expect(out).toEqual({ kind: 'attestation', runId: 'run_abc123', attestation: passedAttestation });
  });

  it('polls through running before completing', async () => {
    const client = fakeClient({
      statuses: [{ lifecycle: 'queued' }, { lifecycle: 'running' }, { lifecycle: 'completed', status: 'failed' }],
      attestation: passedAttestation,
    });
    const out = await runAndAwait({ appId: 'app_1', goal: 'g', url: 'https://x.com' }, { client, ...poll });
    expect(client.calls.statusPolls).toBe(3);
    expect(out.kind).toBe('attestation');
  });

  it('maps a canceled lifecycle to an operational error with run.error', async () => {
    const client = fakeClient({ statuses: [{ lifecycle: 'canceled', error: 'url_not_allowlisted' }] });
    const out = await runAndAwait({ appId: 'app_1', goal: 'g', url: 'https://x.com' }, { client, ...poll });
    expect(out).toEqual({ kind: 'canceled', runId: 'run_abc123', error: 'url_not_allowlisted' });
  });

  it('returns timeout after exhausting the poll budget', async () => {
    const client = fakeClient({ statuses: [{ lifecycle: 'running' }] });
    const out = await runAndAwait({ appId: 'app_1', goal: 'g', url: 'https://x.com' }, { client, ...poll });
    expect(out.kind).toBe('timeout');
    // ceil(100/10) = 10 polls before giving up.
    expect(client.calls.statusPolls).toBe(10);
  });

  it('never fetches the attestation when the run does not complete', async () => {
    const client = fakeClient({ statuses: [{ lifecycle: 'canceled', error: 'x' }] });
    await runAndAwait({ appId: 'app_1', goal: 'g', url: 'https://x.com' }, { client, ...poll });
    expect(client.calls.attestationFetches).toBe(0);
  });
});
