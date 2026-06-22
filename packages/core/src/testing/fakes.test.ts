import { describe, it, expect } from 'vitest';
import {
  FakeBrowserAdapter,
  FakeResolutionAdapter,
  FakeModelClient,
  FakeEvidenceStore,
} from './fakes';

describe('fake adapters', () => {
  it('browser adapter returns a controllable context', async () => {
    const browser = new FakeBrowserAdapter();
    const ctx = await browser.newContext();
    ctx.navResults['https://app.com'] = { ok: false, httpStatus: 500, url: 'https://app.com' };
    expect(await ctx.goto('https://app.com')).toEqual({ ok: false, httpStatus: 500, url: 'https://app.com' });
    expect(await ctx.goto('https://other.com')).toMatchObject({ ok: true, httpStatus: 200 });
  });

  it('browser context fans console/network events to subscribers', async () => {
    const ctx = new FakeBrowserAdapter().context;
    const seen: string[] = [];
    ctx.onConsole((e) => seen.push(e.text));
    ctx.emitConsole({ level: 'error', text: 'boom' });
    expect(seen).toEqual(['boom']);
    expect(ctx.consoleEvents).toHaveLength(1);
  });

  it('resolution adapter resolves intents and can simulate a miss', async () => {
    const res = new FakeResolutionAdapter();
    const ctx = new FakeBrowserAdapter().context;
    const target = await res.resolve('Login button', ctx);
    expect(target.resolvedBy).toBe('text');
    res.misses.add('Hidden');
    await expect(res.resolve('Hidden', ctx)).rejects.toThrow('resolution miss');
  });

  it('model client returns scripted responses per role and records calls', async () => {
    const model = new FakeModelClient();
    model.responses.planner = '{"steps":[]}';
    const out = await model.complete('planner', { prompt: 'go' });
    expect(out.text).toBe('{"steps":[]}');
    expect(model.calls[0]?.role).toBe('planner');
  });

  it('evidence store round-trips a blob by ref', async () => {
    const store = new FakeEvidenceStore();
    const ns = { orgId: 'org_1', appId: 'app_1' };
    const ref = await store.put(ns, Buffer.from('shot'), 'screenshot');
    expect(ref).toContain('screenshot');
    expect((await store.get(ns, ref)).toString()).toBe('shot');
    await expect(store.get(ns, 'ev_missing')).rejects.toThrow('unknown ref');
  });
});
