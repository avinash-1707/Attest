import { describe, it, expect } from 'vitest';
import { attestation } from '@attest/contracts';
import { runAttestation, type RunInput, type RunDeps } from './run';
import {
  FakeBrowserAdapter,
  FakeResolutionAdapter,
  FakeModelClient,
  FakeEvidenceStore,
} from './testing/fakes';

const input: RunInput = {
  runId: 'run_1',
  orgId: 'org_1',
  appId: 'app_1',
  source: 'mcp',
  goal: 'A user can log in and reach the dashboard',
  url: 'https://app.com',
};

const planJson = JSON.stringify({
  steps: [
    {
      name: 'Open login',
      action: { kind: 'goto', url: 'https://app.com/login' },
      expectation: { url: 'https://app.com/login' },
    },
    {
      name: 'Submit',
      action: { kind: 'click', intent: 'login button' },
      expectation: { elementRole: 'heading', elementText: 'Dashboard' },
    },
  ],
});

function makeDeps(opts: {
  judge: string;
  nav?: Record<string, { ok: boolean; httpStatus: number; url: string }>;
  a11y?: { role: string; name?: string }[];
}): RunDeps & { browser: FakeBrowserAdapter; model: FakeModelClient } {
  const browser = new FakeBrowserAdapter();
  if (opts.nav) browser.context.navResults = opts.nav;
  if (opts.a11y) browser.context.a11y = opts.a11y;
  const model = new FakeModelClient();
  model.responses.planner = planJson;
  model.responses.judge = opts.judge;
  return {
    browser,
    resolution: new FakeResolutionAdapter(),
    model,
    store: new FakeEvidenceStore(),
    now: () => 1_000,
  };
}

describe('runAttestation (full engine pipeline)', () => {
  it('produces a schema-valid passed attestation', async () => {
    const deps = makeDeps({
      judge: JSON.stringify({ met: true, reason: 'reached dashboard' }),
      nav: { 'https://app.com/login': { ok: true, httpStatus: 200, url: 'https://app.com/login' } },
      a11y: [{ role: 'heading', name: 'Dashboard' }],
    });
    const { attestation: result } = await runAttestation(input, deps);

    expect(() => attestation.parse(result)).not.toThrow();
    expect(result.status).toBe('passed');
    expect(result.failure).toBeUndefined();
    expect(result.steps).toHaveLength(2);
    expect(result.evidence.screenshotRefs.length).toBeGreaterThan(0);
    expect(result.startedAt).toBe(new Date(1000).toISOString());
  });

  it('returns a run meter alongside the attestation', async () => {
    const deps = makeDeps({
      judge: JSON.stringify({ met: true, reason: 'reached dashboard' }),
      nav: { 'https://app.com/login': { ok: true, httpStatus: 200, url: 'https://app.com/login' } },
      a11y: [{ role: 'heading', name: 'Dashboard' }],
    });
    const { meter } = await runAttestation(input, deps);

    // Fake model reports no cost; clock is pinned so duration is 0.
    expect(meter.modelCostUsd).toBe(0);
    expect(meter.browserMinutes).toBe(0);
    expect(meter.steps).toBe(2);
  });

  it('produces a failed attestation with a dossier on a guard failure', async () => {
    const deps = makeDeps({
      judge: JSON.stringify({
        met: false,
        reason: 'wrong path',
        rootCauseHypothesis: 'redirect missing',
        suggestedNextAction: 'check the post-login redirect',
      }),
      // goto reaches the wrong path -> url_assertion fails -> halts on step 0
      nav: { 'https://app.com/login': { ok: true, httpStatus: 200, url: 'https://app.com/oops' } },
    });
    const { attestation: result } = await runAttestation(input, deps);

    expect(() => attestation.parse(result)).not.toThrow();
    expect(result.status).toBe('failed');
    expect(result.failure?.suggestedNextAction).toBe('check the post-login redirect');
    expect(result.steps[0]?.guardsTriggered).toContain('url_assertion');
  });

  it('marks an unreachable target inconclusive with no dossier', async () => {
    const deps = makeDeps({
      judge: JSON.stringify({ met: true, reason: 'n/a' }),
      nav: { 'https://app.com/login': { ok: false, httpStatus: 0, url: 'https://app.com/login' } },
    });
    const { attestation: result } = await runAttestation(input, deps);

    expect(() => attestation.parse(result)).not.toThrow();
    expect(result.status).toBe('inconclusive');
    expect(result.failure).toBeUndefined();
  });

  it('marks the goal failed when all steps pass but the judge says the goal was not met', async () => {
    const deps = makeDeps({
      judge: JSON.stringify({
        met: false,
        reason: 'no order was created',
        rootCauseHypothesis: 'submit handler no-op',
        suggestedNextAction: 'verify the order API call fires',
      }),
      nav: { 'https://app.com/login': { ok: true, httpStatus: 200, url: 'https://app.com/login' } },
      a11y: [{ role: 'heading', name: 'Dashboard' }],
    });
    const { attestation: result } = await runAttestation(input, deps);

    expect(result.status).toBe('failed');
    expect(result.steps.every((s) => s.status === 'passed')).toBe(true); // steps ok, goal unmet
    expect(result.failure?.reason).toBe('no order was created');
  });
});
