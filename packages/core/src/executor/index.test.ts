import { describe, it, expect, vi } from 'vitest';
import { execute } from './index';
import { EvidenceCollector } from '../evidence/index';
import { FakeBrowserContext, FakeResolutionAdapter, FakeEvidenceStore } from '../testing/fakes';
import type { Journey } from '../journey';

const ns = { orgId: 'org_1', appId: 'app_1' };

function deps(
  ctx: FakeBrowserContext,
  resolution = new FakeResolutionAdapter(),
  allowlist?: readonly string[],
) {
  const store = new FakeEvidenceStore();
  return { ctx, resolution, evidence: new EvidenceCollector(ctx, store, ns, 'run_test'), allowlist };
}

const loginJourney: Journey = {
  goal: 'log in',
  steps: [
    {
      index: 0,
      name: 'Open login',
      action: { kind: 'goto', url: 'https://app.com/login' },
      expectation: { url: 'https://app.com/login' },
    },
    { index: 1, name: 'Type email', action: { kind: 'type', intent: 'email field', text: 'qa@app.com' } },
    {
      index: 2,
      name: 'Submit',
      action: { kind: 'click', intent: 'login button' },
      expectation: { elementRole: 'button', elementText: 'Login' },
    },
  ],
};

describe('executor', () => {
  it('runs a clean journey to completion with evidence refs', async () => {
    const ctx = new FakeBrowserContext();
    ctx.navResults['https://app.com/login'] = { ok: true, httpStatus: 200, url: 'https://app.com/login' };
    ctx.a11y = [{ role: 'button', name: 'Login' }];
    const d = deps(ctx);

    const result = await execute(loginJourney, d);

    expect(result.halted).toBe(false);
    expect(result.steps).toHaveLength(3);
    expect(result.steps.every((s) => !s.conclusiveFailure)).toBe(true);
    expect(result.steps.every((s) => s.screenshotRef)).toBe(true);
    expect(result.steps.every((s) => s.domSnapshotRef === undefined)).toBe(true);
    expect(d.evidence.screenshotRefs).toHaveLength(3);
  });

  it('halts on a conclusive guard failure and snapshots the DOM', async () => {
    const ctx = new FakeBrowserContext();
    // goto returns the wrong path -> url_assertion fails on the first step.
    ctx.navResults['https://app.com/login'] = { ok: true, httpStatus: 200, url: 'https://app.com/oops' };
    const result = await execute(loginJourney, deps(ctx));

    expect(result.halted).toBe(true);
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]?.conclusiveFailure).toBe(true);
    expect(result.steps[0]?.firedGuardIds).toContain('url_assertion');
    expect(result.steps[0]?.domSnapshotRef).toBeDefined();
  });

  it('re-resolves a transient miss instead of failing the step', async () => {
    const ctx = new FakeBrowserContext();
    ctx.a11y = [{ role: 'button', name: 'Login' }];
    const resolution = new FakeResolutionAdapter();
    resolution.failuresBeforeSuccess.set('login button', 1); // miss once, then resolve
    const result = await execute(loginJourney, deps(ctx, resolution));

    expect(result.halted).toBe(false);
    expect(result.steps[2]?.error).toBeUndefined();
  });

  it('records an error and halts when resolution permanently misses', async () => {
    const ctx = new FakeBrowserContext();
    const resolution = new FakeResolutionAdapter();
    resolution.misses.add('login button');
    const result = await execute(loginJourney, deps(ctx, resolution));

    expect(result.halted).toBe(true);
    const last = result.steps.at(-1)!;
    expect(last.error).toContain('resolution miss');
    expect(last.conclusiveFailure).toBe(true);
  });

  // [audit 2026-06-27 H2] The planner can emit a goto to any host; the executor must re-check every
  // navigation against the allowlist, not just the entry url, or it is an SSRF sink.
  it('blocks a goto whose host is off the allowlist and never navigates there', async () => {
    const ctx = new FakeBrowserContext();
    const gotoSpy = vi.spyOn(ctx, 'goto');
    const journey: Journey = {
      goal: 'exfiltrate',
      steps: [{ index: 0, name: 'Hit metadata', action: { kind: 'goto', url: 'http://169.254.169.254/' } }],
    };
    const result = await execute(journey, deps(ctx, new FakeResolutionAdapter(), ['app.com']));

    expect(gotoSpy).not.toHaveBeenCalled();
    expect(result.steps[0]?.conclusiveFailure).toBe(true);
    expect(result.steps[0]?.error).toContain('not in allowlist');
  });

  it('allows a goto whose host is on the allowlist', async () => {
    const ctx = new FakeBrowserContext();
    ctx.navResults['https://app.com/login'] = { ok: true, httpStatus: 200, url: 'https://app.com/login' };
    ctx.a11y = [{ role: 'button', name: 'Login' }];
    const result = await execute(loginJourney, deps(ctx, new FakeResolutionAdapter(), ['app.com']));

    expect(result.steps[0]?.error).toBeUndefined();
  });
});
