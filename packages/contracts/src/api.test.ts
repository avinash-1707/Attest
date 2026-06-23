import { describe, it, expect } from 'vitest';
import { runCreate, runCreated } from './api';

describe('API DTOs', () => {
  it('runCreate requires appId, non-empty goal, and a valid url', () => {
    expect(runCreate.parse({ appId: 'app_1', goal: 'log in', url: 'https://app.com' })).toEqual({
      appId: 'app_1',
      goal: 'log in',
      url: 'https://app.com',
    });
    expect(runCreate.safeParse({ appId: '', goal: 'log in', url: 'https://app.com' }).success).toBe(false);
    expect(runCreate.safeParse({ appId: 'app_1', goal: '', url: 'https://app.com' }).success).toBe(false);
    expect(runCreate.safeParse({ appId: 'app_1', goal: 'log in', url: 'not-a-url' }).success).toBe(false);
  });

  it('runCreate rejects unknown/secret fields being stripped (no credentials in DTO)', () => {
    const parsed = runCreate.parse({
      appId: 'app_1',
      goal: 'log in',
      url: 'https://app.com',
      modelKeyId: 'mk_1',
    } as Record<string, unknown>);
    expect(parsed).not.toHaveProperty('modelKeyId');
  });

  it('runCreated round-trips {runId, status:queued}', () => {
    expect(runCreated.parse({ runId: 'run_1', status: 'queued' })).toEqual({
      runId: 'run_1',
      status: 'queued',
    });
    expect(runCreated.safeParse({ runId: 'run_1', status: 'running' }).success).toBe(false);
  });
});
