import { describe, it, expect, vi } from 'vitest';
import { Queue } from 'bullmq';
import { MAX_RUN_ATTEMPTS, RUN_BACKOFF_MS, RUN_JOB, jobPayload, type JobPayload } from '@attest/contracts';
import type { DataAccess, SecretCipher } from '@attest/db';
import { enqueueRun, type EnqueueDeps } from './enqueue';

const MODELS = { planner: 'm/p', judge: 'm/j', resolution: 'm/r' };

interface Opts {
  app?: { id: string; orgId: string; allowlist: string[]; archivedAt: Date | null } | undefined;
  modelKeys?: Array<{ ciphertext: string }>;
  creds?: Array<{ name: string; ciphertext: string }>;
  addImpl?: () => Promise<unknown>;
  hostedApiKey?: string;
}

function setup(opts: Opts) {
  const app =
    'app' in opts ? opts.app : { id: 'app_1', orgId: 'org_1', allowlist: ['https://ok.com'], archivedAt: null };
  const add = vi.fn<(name: string, data: JobPayload, opts: unknown) => Promise<unknown>>(
    opts.addImpl ?? (async () => undefined),
  );
  const failPermanently = vi.fn(async () => undefined);
  const runsCreate = vi.fn(async () => ({ id: 'run_1' }));

  const org = {
    apps: { get: vi.fn(async () => app) },
    modelKeys: { list: vi.fn(async () => opts.modelKeys ?? []) },
    appCredentials: { list: vi.fn(async () => opts.creds ?? []) },
    runs: { create: runsCreate, failPermanently },
  };

  const dal = { forOrg: () => org } as unknown as DataAccess;
  const cipher = {
    for: () => ({ seal: async (s: string) => s, open: async (s: string) => `opened:${s}` }),
  } as unknown as SecretCipher;

  const deps: EnqueueDeps = {
    dal,
    cipher,
    queue: { add } as unknown as Queue,
    modelDefaults: MODELS,
    hostedApiKey: opts.hostedApiKey,
  };

  return { deps, add, failPermanently, runsCreate };
}

const input = { appId: 'app_1', goal: 'log in', url: 'https://ok.com/login', source: 'mcp' as const };

describe('enqueueRun', () => {
  it('stamps the exact retry envelope the worker §7.5 gate depends on (MANDATORY)', async () => {
    const { deps, add } = setup({ hostedApiKey: 'sk-hosted' });

    const result = await enqueueRun({ orgId: 'org_1' }, input, deps);

    expect(result).toEqual({ runId: 'run_1', status: 'queued' });
    expect(add).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledWith(RUN_JOB, expect.objectContaining({ runId: 'run_1' }), {
      jobId: 'run_1',
      attempts: MAX_RUN_ATTEMPTS,
      backoff: { type: 'exponential', delay: RUN_BACKOFF_MS },
      removeOnComplete: true,
      removeOnFail: true,
    });
  });

  it('enqueues a valid jobPayload carrying the OPENED secrets', async () => {
    const { deps, add } = setup({
      modelKeys: [{ ciphertext: 'mk' }],
      creds: [{ name: 'username', ciphertext: 'cu' }],
    });

    await enqueueRun({ orgId: 'org_1' }, input, deps);

    const payload = add.mock.calls[0]![1];
    expect(() => jobPayload.parse(payload)).not.toThrow();
    expect(payload.modelConfig.apiKey).toBe('opened:mk');
    expect(payload.modelConfig.models).toEqual(MODELS);
    expect(payload.credentials).toEqual({ username: 'opened:cu' });
    expect(payload.runId).toBe('run_1');
  });

  it('opens every credential row into a flat name -> value map', async () => {
    const { deps, add } = setup({
      hostedApiKey: 'sk-hosted',
      creds: [
        { name: 'username', ciphertext: 'cu' },
        { name: 'password', ciphertext: 'cp' },
      ],
    });
    await enqueueRun({ orgId: 'org_1' }, input, deps);
    expect(add.mock.calls[0]![1].credentials).toEqual({ username: 'opened:cu', password: 'opened:cp' });
  });

  it('omits credentials entirely when the app has none', async () => {
    const { deps, add } = setup({ hostedApiKey: 'sk-hosted' });
    await enqueueRun({ orgId: 'org_1' }, input, deps);
    expect(add.mock.calls[0]![1].credentials).toBeUndefined();
  });

  it('prefers a BYOK model key over the hosted default', async () => {
    const { deps, add } = setup({ modelKeys: [{ ciphertext: 'byok' }], hostedApiKey: 'sk-hosted' });
    await enqueueRun({ orgId: 'org_1' }, input, deps);
    expect(add.mock.calls[0]![1].modelConfig.apiKey).toBe('opened:byok');
  });

  it('denies a URL outside the app allowlist and never enqueues (invariant 7)', async () => {
    const { deps, add } = setup({ hostedApiKey: 'sk-hosted' });
    await expect(
      enqueueRun({ orgId: 'org_1' }, { ...input, url: 'https://evil.com/x' }, deps),
    ).rejects.toMatchObject({ statusCode: 400, code: 'url_not_allowed' });
    expect(add).not.toHaveBeenCalled();
  });

  it('404s a missing app without enqueueing', async () => {
    const { deps, add } = setup({ app: undefined, hostedApiKey: 'sk-hosted' });
    await expect(enqueueRun({ orgId: 'org_1' }, input, deps)).rejects.toMatchObject({
      statusCode: 404,
      code: 'app_not_found',
    });
    expect(add).not.toHaveBeenCalled();
  });

  it('400s when no model key is available (no BYOK, no hosted default)', async () => {
    const { deps, add } = setup({});
    await expect(enqueueRun({ orgId: 'org_1' }, input, deps)).rejects.toMatchObject({
      statusCode: 400,
      code: 'model_key_required',
    });
    expect(add).not.toHaveBeenCalled();
  });

  it('compensates with failPermanently exactly once and 503s when enqueue fails', async () => {
    const { deps, add, failPermanently, runsCreate } = setup({
      hostedApiKey: 'sk-hosted',
      addImpl: async () => {
        throw new Error('redis down');
      },
    });
    await expect(enqueueRun({ orgId: 'org_1' }, input, deps)).rejects.toMatchObject({
      statusCode: 503,
      code: 'enqueue_unavailable',
    });
    expect(runsCreate).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledTimes(1);
    expect(failPermanently).toHaveBeenCalledTimes(1);
    expect(failPermanently).toHaveBeenCalledWith('run_1', 'enqueue failed');
  });

  it('still surfaces the 503 even if the compensating failPermanently throws', async () => {
    const { deps, failPermanently } = setup({
      hostedApiKey: 'sk-hosted',
      addImpl: async () => {
        throw new Error('redis down');
      },
    });
    failPermanently.mockImplementation(async () => {
      throw new Error('db down too');
    });
    await expect(enqueueRun({ orgId: 'org_1' }, input, deps)).rejects.toMatchObject({
      statusCode: 503,
      code: 'enqueue_unavailable',
    });
  });
});
