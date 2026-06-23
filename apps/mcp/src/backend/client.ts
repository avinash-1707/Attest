import {
  runCreate,
  runCreated,
  runStatusView,
  attestation,
  type RunCreated,
  type RunStatusView,
  type Attestation,
} from '@attest/contracts';

// Thin typed client of apps/backend's run-create + read API. The MCP server is a service-key
// principal [arch §6.2]: every request carries the key as a Bearer token; the backend resolves it to
// the org + app scope. Responses are re-validated against their contract on the way in so a backend
// drift surfaces here, not deep in a tool handler [invariant 6].

export interface BackendClient {
  createRun(input: { appId: string; goal: string; url: string }): Promise<RunCreated>;
  getRunStatus(runId: string): Promise<RunStatusView>;
  getAttestation(runId: string): Promise<Attestation>;
}

export class BackendError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'BackendError';
  }
}

// Injectable fetch seam so the client unit-tests without a live backend or network.
export type FetchLike = typeof fetch;

export function createBackendClient(deps: {
  backendUrl: string;
  serviceKey: string;
  fetch?: FetchLike;
}): BackendClient {
  const doFetch = deps.fetch ?? fetch;
  const base = deps.backendUrl.replace(/\/+$/, '');
  const authHeader = `Bearer ${deps.serviceKey}`;

  async function request(method: string, path: string, body?: unknown): Promise<unknown> {
    const res = await doFetch(`${base}${path}`, {
      method,
      headers: {
        authorization: authHeader,
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      // The backend's error envelope is { error: { code, message } } [backend errors.ts]; fall back to
      // the HTTP status when the body is not that shape. Never surface response bodies verbatim beyond
      // code/message - they carry no secrets, but staying narrow keeps the contract tight.
      const code = await readErrorCode(res);
      throw new BackendError(res.status, code, `${method} ${path} -> ${res.status}`);
    }

    if (res.status === 204) return undefined;
    return res.json();
  }

  return {
    async createRun(input) {
      const payload = runCreate.parse(input);
      const json = await request('POST', '/runs', payload);
      return runCreated.parse(json);
    },
    async getRunStatus(runId) {
      const json = await request('GET', `/runs/${encodeURIComponent(runId)}`);
      return runStatusView.parse(json);
    },
    async getAttestation(runId) {
      const json = await request('GET', `/runs/${encodeURIComponent(runId)}/attestation`);
      return attestation.parse(json);
    },
  };
}

async function readErrorCode(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { code?: unknown } };
    const code = body?.error?.code;
    return typeof code === 'string' ? code : 'backend_error';
  } catch {
    return 'backend_error';
  }
}
