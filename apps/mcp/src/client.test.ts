import { describe, it, expect } from 'vitest';
import { createBackendClient, BackendError, type FetchLike } from './client';
import { passedAttestation } from './test-fixtures';

type Call = { url: string; init: RequestInit };

function mockFetch(handler: (call: Call) => { status: number; body: unknown }): { fetch: FetchLike; calls: Call[] } {
  const calls: Call[] = [];
  const fetchImpl: FetchLike = async (input, init) => {
    const call = { url: String(input), init: init ?? {} };
    calls.push(call);
    const { status, body } = handler(call);
    return new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  };
  return { fetch: fetchImpl, calls };
}

describe('BackendClient', () => {
  it('sends the service key as a Bearer token and strips a trailing slash from the base url', async () => {
    const { fetch, calls } = mockFetch(() => ({ status: 202, body: { runId: 'run_1', status: 'queued' } }));
    const client = createBackendClient({ backendUrl: 'https://api.attest.dev/', serviceKey: 'ak_live_secret', fetch });

    const res = await client.createRun({ appId: 'app_1', goal: 'g', url: 'https://x.com' });

    expect(res).toEqual({ runId: 'run_1', status: 'queued' });
    const call = calls[0]!;
    expect(call.url).toBe('https://api.attest.dev/runs');
    expect((call.init.headers as Record<string, string>).authorization).toBe('Bearer ak_live_secret');
    expect(JSON.parse(call.init.body as string)).toEqual({ appId: 'app_1', goal: 'g', url: 'https://x.com' });
  });

  it('validates the run-create body before sending', async () => {
    const { fetch, calls } = mockFetch(() => ({ status: 202, body: {} }));
    const client = createBackendClient({ backendUrl: 'https://api.attest.dev', serviceKey: 'k', fetch });
    await expect(client.createRun({ appId: '', goal: 'g', url: 'bad' })).rejects.toThrow();
    expect(calls).toEqual([]);
  });

  it('parses the backend error envelope into a BackendError code', async () => {
    const { fetch } = mockFetch(() => ({ status: 403, body: { error: { code: 'app_forbidden', message: 'no' } } }));
    const client = createBackendClient({ backendUrl: 'https://api.attest.dev', serviceKey: 'k', fetch });
    await expect(client.getRunStatus('run_1')).rejects.toMatchObject({ status: 403, code: 'app_forbidden' });
  });

  it('falls back to backend_error when the body is not the error envelope', async () => {
    const { fetch } = mockFetch(() => ({ status: 500, body: 'boom' }));
    const client = createBackendClient({ backendUrl: 'https://api.attest.dev', serviceKey: 'k', fetch });
    await expect(client.getRunStatus('run_1')).rejects.toMatchObject({ status: 500, code: 'backend_error' });
  });

  it('re-validates the attestation response against the contract', async () => {
    const { fetch } = mockFetch(() => ({ status: 200, body: passedAttestation }));
    const client = createBackendClient({ backendUrl: 'https://api.attest.dev', serviceKey: 'k', fetch });
    expect(await client.getAttestation('run_abc123')).toEqual(passedAttestation);
  });

  it('throws a BackendError, not a parse error, on a 404 attestation', async () => {
    const { fetch } = mockFetch(() => ({ status: 404, body: { error: { code: 'attestation_not_found' } } }));
    const client = createBackendClient({ backendUrl: 'https://api.attest.dev', serviceKey: 'k', fetch });
    await expect(client.getAttestation('run_1')).rejects.toBeInstanceOf(BackendError);
  });
});
