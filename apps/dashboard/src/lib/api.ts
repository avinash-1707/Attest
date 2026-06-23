import { z } from 'zod';
import {
  runCreate,
  runCreated,
  runList,
  runStatusView,
  attestation,
  evidenceList,
  appCreate,
  appUpdate,
  appView,
  appKeyCreate,
  appKeyView,
  appKeyCreated,
  modelKeyCreate,
  modelKeyView,
  appCredentialCreate,
  appCredentialView,
  type RunCreate,
  type RunCreated,
  type RunList,
  type RunStatusView,
  type Attestation,
  type EvidenceList,
  type AppCreate,
  type AppUpdate,
  type AppView,
  type AppKeyCreate,
  type AppKeyCreated,
  type ModelKeyCreate,
  type ModelKeyView,
  type AppCredentialCreate,
  type AppCredentialView,
} from '@attest/contracts';
import { BACKEND_URL } from './env';

// The typed data client for everything that is NOT session/auth (those go through auth-client.ts).
// It talks to apps/backend over the cookie-authenticated API: credentials:'include' sends the session
// cookie cross-origin, and the browser attaches the Origin header the backend's CSRF guard requires.
// Every response is re-validated against its @attest/contracts schema, so backend drift surfaces here
// rather than as a silent shape mismatch in a component [invariant 6]. No secret is ever requested or
// returned beyond appKeyCreated.key, which the backend shows exactly once [arch §6.2, invariant 4].

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const base = BACKEND_URL.replace(/\/+$/, '');

async function request<T>(
  method: string,
  path: string,
  opts: { body?: unknown; schema?: z.ZodType<T> } = {},
): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    method,
    credentials: 'include',
    headers: opts.body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (!res.ok) throw new ApiError(res.status, await readErrorCode(res), `${method} ${path} -> ${res.status}`);
  if (res.status === 204) return undefined as T;

  const json: unknown = await res.json();
  return opts.schema ? opts.schema.parse(json) : (json as T);
}

async function readErrorCode(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { code?: unknown; error?: { code?: unknown } };
    const code = body?.code ?? body?.error?.code;
    return typeof code === 'string' ? code : 'api_error';
  } catch {
    return 'api_error';
  }
}

const appsResponse = z.object({ apps: z.array(appView) });
const keysResponse = z.object({ keys: z.array(appKeyView) });
const modelKeysResponse = z.object({ modelKeys: z.array(modelKeyView) });
const credentialsResponse = z.object({ credentials: z.array(appCredentialView) });

export const api = {
  // --- Runs (read + create) ---
  listRuns: () => request<RunList>('GET', '/runs', { schema: runList }),
  getRun: (id: string) => request<RunStatusView>('GET', `/runs/${encodeURIComponent(id)}`, { schema: runStatusView }),
  getAttestation: (id: string) =>
    request<Attestation>('GET', `/runs/${encodeURIComponent(id)}/attestation`, { schema: attestation }),
  listEvidence: (id: string) =>
    request<EvidenceList>('GET', `/runs/${encodeURIComponent(id)}/evidence`, { schema: evidenceList }),
  createRun: (input: RunCreate) =>
    request<RunCreated>('POST', '/runs', { body: runCreate.parse(input), schema: runCreated }),

  // --- Apps ---
  listApps: () => request('GET', '/apps', { schema: appsResponse }).then((r) => r.apps),
  createApp: (input: AppCreate) =>
    request<AppView>('POST', '/apps', { body: appCreate.parse(input), schema: appView }),
  updateApp: (id: string, input: AppUpdate) =>
    request<AppView>('PATCH', `/apps/${encodeURIComponent(id)}`, { body: appUpdate.parse(input), schema: appView }),
  deleteApp: (id: string) => request<void>('DELETE', `/apps/${encodeURIComponent(id)}`),

  // --- Service keys ---
  listKeys: () => request('GET', '/keys', { schema: keysResponse }).then((r) => r.keys),
  createKey: (input: AppKeyCreate) =>
    request<AppKeyCreated>('POST', '/keys', { body: appKeyCreate.parse(input), schema: appKeyCreated }),
  revokeKey: (id: string) => request<void>('DELETE', `/keys/${encodeURIComponent(id)}`),

  // --- BYOK model keys ---
  listModelKeys: () => request('GET', '/model-keys', { schema: modelKeysResponse }).then((r) => r.modelKeys),
  createModelKey: (input: ModelKeyCreate) =>
    request<ModelKeyView>('POST', '/model-keys', { body: modelKeyCreate.parse(input), schema: modelKeyView }),
  deleteModelKey: (id: string) => request<void>('DELETE', `/model-keys/${encodeURIComponent(id)}`),

  // --- App login credentials ---
  listCredentials: (appId?: string) =>
    request('GET', appId ? `/credentials?appId=${encodeURIComponent(appId)}` : '/credentials', {
      schema: credentialsResponse,
    }).then((r) => r.credentials),
  createCredential: (input: AppCredentialCreate) =>
    request<AppCredentialView>('POST', '/credentials', {
      body: appCredentialCreate.parse(input),
      schema: appCredentialView,
    }),
  deleteCredential: (id: string) => request<void>('DELETE', `/credentials/${encodeURIComponent(id)}`),
};
