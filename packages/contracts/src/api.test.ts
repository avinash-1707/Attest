import { describe, it, expect } from 'vitest';
import {
  runCreate,
  runCreated,
  runStatusView,
  runListItem,
  evidenceRefView,
  appView,
  appCreate,
  appKeyCreate,
  appKeyView,
  appKeyCreated,
  modelKeyCreate,
  modelKeyView,
  appCredentialCreate,
  appCredentialView,
} from './api';

const TS = '2026-06-23T00:00:00.000Z';

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

describe('Read API DTOs', () => {
  const baseRun = {
    runId: 'run_1',
    appId: 'app_1',
    source: 'mcp' as const,
    goal: 'log in',
    url: 'https://app.com',
    lifecycle: 'running' as const,
    attempt: 0,
    createdAt: TS,
  };

  it('runStatusView allows a null verdict while queued/running and a real verdict once done', () => {
    expect(
      runStatusView.safeParse({
        ...baseRun,
        status: null,
        startedAt: TS,
        finishedAt: null,
        durationMs: null,
        error: null,
      }).success,
    ).toBe(true);
    expect(
      runStatusView.safeParse({
        ...baseRun,
        lifecycle: 'completed',
        status: 'passed',
        startedAt: TS,
        finishedAt: TS,
        durationMs: 4200,
        error: null,
      }).success,
    ).toBe(true);
    // Rejects an unknown lifecycle and a non-verdict status.
    expect(runStatusView.safeParse({ ...baseRun, lifecycle: 'paused', status: null }).success).toBe(false);
  });

  it('runListItem round-trips a compact summary', () => {
    expect(
      runListItem.parse({
        runId: 'run_1',
        appId: 'app_1',
        goal: 'log in',
        lifecycle: 'completed',
        status: 'failed',
        createdAt: TS,
        durationMs: 1000,
      }).status,
    ).toBe('failed');
  });

  it('evidenceRefView carries metadata + a fetch url, nullable stepIndex', () => {
    expect(
      evidenceRefView.safeParse({
        ref: 'orgs/o1/apps/a1/runs/r1/screenshot.png',
        kind: 'screenshot',
        stepIndex: null,
        contentType: 'image/png',
        bytes: 1234,
        url: '/evidence/orgs%2Fo1...',
      }).success,
    ).toBe(true);
    expect(
      evidenceRefView.safeParse({ ref: 'x', kind: 'not_a_kind', stepIndex: 0, contentType: null, bytes: null, url: '/x' })
        .success,
    ).toBe(false);
  });
});

describe('Management DTOs', () => {
  it('appCreate / appView round-trip; appView strips unknown columns', () => {
    expect(appCreate.parse({ name: 'Acme', allowlist: ['https://ok.com'] }).allowlist).toEqual(['https://ok.com']);
    const view = appView.parse({
      id: 'app_1',
      name: 'Acme',
      allowlist: [],
      archivedAt: null,
      createdAt: TS,
      updatedAt: TS,
      orgId: 'org_secret_internal',
    } as Record<string, unknown>);
    expect(view).not.toHaveProperty('orgId');
  });

  it('appKeyCreate requires at least one appId', () => {
    expect(appKeyCreate.safeParse({ name: 'ci', appIds: ['app_1'] }).success).toBe(true);
    expect(appKeyCreate.safeParse({ name: 'ci', appIds: [] }).success).toBe(false);
  });

  it('appKeyView NEVER exposes keyHash (invariant 4)', () => {
    const raw = {
      id: 'ak_1',
      name: 'ci',
      keyPrefix: 'ak_live_a1b2',
      appIds: ['app_1'],
      lastUsedAt: null,
      revokedAt: null,
      expiresAt: null,
      createdAt: TS,
      keyHash: 'DEADBEEFSECRETHASH',
    };
    const view = appKeyView.parse(raw as Record<string, unknown>);
    expect(view).not.toHaveProperty('keyHash');
    expect(JSON.stringify(view)).not.toContain('DEADBEEFSECRETHASH');
  });

  it('appKeyCreated returns the plaintext key once (the one secret-bearing response)', () => {
    const created = appKeyCreated.parse({
      id: 'ak_1',
      name: 'ci',
      keyPrefix: 'ak_live_a1b2',
      appIds: ['app_1'],
      lastUsedAt: null,
      revokedAt: null,
      expiresAt: null,
      createdAt: TS,
      key: 'ak_live_a1b2_thefullsecret',
    });
    expect(created.key).toBe('ak_live_a1b2_thefullsecret');
  });

  it('modelKeyCreate carries the inbound key; modelKeyView NEVER exposes ciphertext (invariant 4)', () => {
    expect(modelKeyCreate.parse({ label: 'prod', key: 'sk-or-secret' }).key).toBe('sk-or-secret');
    const view = modelKeyView.parse({
      id: 'mk_1',
      label: 'prod',
      provider: 'openrouter',
      keyPrefix: 'sk-or-a1',
      createdAt: TS,
      ciphertext: 'v1.SEALEDSECRET',
    } as Record<string, unknown>);
    expect(view).not.toHaveProperty('ciphertext');
    expect(JSON.stringify(view)).not.toContain('SEALEDSECRET');
  });

  it('appCredentialView NEVER exposes the ciphertext/value (invariant 4)', () => {
    expect(appCredentialCreate.parse({ appId: 'app_1', name: 'login', value: 'hunter2' }).value).toBe('hunter2');
    const view = appCredentialView.parse({
      id: 'cred_1',
      appId: 'app_1',
      name: 'login',
      createdAt: TS,
      ciphertext: 'v1.SEALEDCRED',
    } as Record<string, unknown>);
    expect(view).not.toHaveProperty('ciphertext');
    expect(JSON.stringify(view)).not.toContain('SEALEDCRED');
  });
});
