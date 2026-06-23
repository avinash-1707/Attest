import { describe, it, expect } from 'vitest';
import { loadConfig } from './config';

const full = {
  DATABASE_URL: 'postgresql://localhost/db',
  REDIS_URL: 'redis://localhost:6379',
  ATTEST_KEK: 'a'.repeat(44),
  BETTER_AUTH_SECRET: 'b'.repeat(32),
  BETTER_AUTH_URL: 'http://localhost:3000',
  EVIDENCE_ROOT: '/var/lib/attest/evidence',
};

describe('loadConfig', () => {
  it('parses a full env, defaults to the disk evidence backend, and applies model defaults', () => {
    const cfg = loadConfig(full as NodeJS.ProcessEnv);
    expect(cfg.databaseUrl).toBe(full.DATABASE_URL);
    expect(cfg.port).toBe(3000);
    expect(cfg.kekId).toBe('env');
    expect(cfg.evidence).toEqual({ backend: 'disk', root: full.EVIDENCE_ROOT });
    expect(cfg.modelDefaults.planner).toMatch(/.+/);
    expect(cfg.modelDefaults.judge).toMatch(/.+/);
    expect(cfg.modelDefaults.resolution).toMatch(/.+/);
    expect(cfg.google).toBeUndefined();
    expect(cfg.trustedOrigins).toEqual([]);
  });

  it('selects the s3 evidence backend with its bucket + endpoint', () => {
    const cfg = loadConfig({
      ...full,
      EVIDENCE_BACKEND: 's3',
      EVIDENCE_BUCKET: 'attest-evidence',
      EVIDENCE_ENDPOINT: 'https://acct.r2.cloudflarestorage.com',
    } as NodeJS.ProcessEnv);
    expect(cfg.evidence).toMatchObject({ backend: 's3', bucket: 'attest-evidence' });
  });

  it('fails closed when a required secret/url is missing', () => {
    for (const k of ['DATABASE_URL', 'REDIS_URL', 'ATTEST_KEK', 'BETTER_AUTH_SECRET', 'BETTER_AUTH_URL']) {
      const env = { ...full } as Record<string, string>;
      delete env[k];
      expect(() => loadConfig(env as NodeJS.ProcessEnv), `missing ${k}`).toThrow();
    }
  });

  it('fails closed when the disk backend has no EVIDENCE_ROOT', () => {
    const env = { ...full } as Record<string, string>;
    delete env.EVIDENCE_ROOT;
    expect(() => loadConfig(env as NodeJS.ProcessEnv)).toThrow();
  });

  it('splits TRUSTED_ORIGINS CSV and includes Google only when both halves are present', () => {
    const cfg = loadConfig({
      ...full,
      TRUSTED_ORIGINS: 'https://a.com, https://b.com',
      GOOGLE_CLIENT_ID: 'gid',
      GOOGLE_CLIENT_SECRET: 'gsecret',
      MODEL_DEFAULT_PLANNER: 'x/planner',
    } as NodeJS.ProcessEnv);
    expect(cfg.trustedOrigins).toEqual(['https://a.com', 'https://b.com']);
    expect(cfg.google).toEqual({ clientId: 'gid', clientSecret: 'gsecret' });
    expect(cfg.modelDefaults.planner).toBe('x/planner');
  });

  it('omits Google when only one half is set', () => {
    const cfg = loadConfig({ ...full, GOOGLE_CLIENT_ID: 'gid' } as NodeJS.ProcessEnv);
    expect(cfg.google).toBeUndefined();
  });
});
