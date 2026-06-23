import { describe, it, expect } from 'vitest';
import { jobPayload, runModelConfig, type JobPayload } from './job';

const validModelConfig = {
  models: { planner: 'anthropic/claude-opus-4-8', judge: 'google/gemini-flash', resolution: 'google/gemini-flash' },
  apiKey: 'or_live_xxx',
};

const validJob: JobPayload = {
  runId: 'run_abc123',
  orgId: 'org_1',
  appId: 'app_1',
  source: 'mcp',
  goal: 'A user can log in and reach the dashboard',
  url: 'https://staging.app.com',
  modelConfig: validModelConfig,
  credentials: { username: 'qa@app.com', password: 's3cret' },
  byok: false,
};

describe('queue job payload contract', () => {
  it('accepts a valid job and round-trips it', () => {
    const parsed = jobPayload.parse(validJob);
    expect(jobPayload.parse(JSON.parse(JSON.stringify(parsed)))).toEqual(validJob);
  });

  it('accepts a job without optional credentials', () => {
    const { credentials: _omit, ...noCreds } = validJob;
    expect(jobPayload.safeParse(noCreds).success).toBe(true);
  });

  it('requires all three model roles', () => {
    const bad = { ...validModelConfig, models: { planner: 'x', judge: 'y' } };
    expect(runModelConfig.safeParse(bad).success).toBe(false);
  });

  it('rejects a job with a bad url', () => {
    expect(jobPayload.safeParse({ ...validJob, url: 'localhost' }).success).toBe(false);
  });

  it('rejects an unknown source', () => {
    expect(jobPayload.safeParse({ ...validJob, source: 'cron' }).success).toBe(false);
  });
});
