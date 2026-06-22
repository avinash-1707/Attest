import { describe, it, expect } from 'vitest';
import {
  runGuards,
  firedGuards,
  hasConclusiveFailure,
  type GuardEvidence,
} from './guards';

const clean: GuardEvidence = {
  navigation: { ok: true, httpStatus: 200, url: 'https://app.com/dashboard' },
  console: [],
  network: [{ url: '/api/me', method: 'GET', status: 200, ok: true }],
  a11y: [{ role: 'heading', name: 'Dashboard' }],
};

function byId(ev: GuardEvidence, id: string) {
  return runGuards(ev).find((r) => r.guardId === id)!;
}

describe('deterministic guards', () => {
  it('runs all five in fixed order', () => {
    expect(runGuards(clean).map((r) => r.guardId)).toEqual([
      'http_status',
      'url_assertion',
      'element_presence',
      'console_error',
      'page_load',
    ]);
  });

  it('passes a clean step with no conclusive failure', () => {
    const results = runGuards(clean);
    expect(hasConclusiveFailure(results)).toBe(false);
    expect(firedGuards(results)).toEqual([]);
  });

  it('guard #1 fails on a 5xx request', () => {
    const ev = { ...clean, network: [{ url: '/api/login', method: 'POST', status: 500, ok: false }] };
    expect(byId(ev, 'http_status').status).toBe('fail');
  });

  it('guard #1 is na with no network signal', () => {
    expect(byId({ ...clean, network: [] }, 'http_status').status).toBe('na');
  });

  it('guard #2 fails on the wrong path and is na without an expectation', () => {
    expect(byId(clean, 'url_assertion').status).toBe('na');
    const ev = {
      ...clean,
      expectation: { url: 'https://app.com/dashboard' },
      navigation: { ok: true, httpStatus: 200, url: 'https://app.com/login' },
    };
    expect(byId(ev, 'url_assertion').status).toBe('fail');
  });

  it('guard #3 finds an element by role+text and fails when absent', () => {
    const present = { ...clean, expectation: { elementRole: 'heading', elementText: 'Dashboard' } };
    expect(byId(present, 'element_presence').status).toBe('pass');
    const absent = { ...clean, expectation: { elementText: 'Welcome back' } };
    expect(byId(absent, 'element_presence').status).toBe('fail');
  });

  it('guard #3 searches nested a11y children', () => {
    const ev: GuardEvidence = {
      ...clean,
      a11y: [{ role: 'main', children: [{ role: 'button', name: 'Log out' }] }],
      expectation: { elementRole: 'button', elementText: 'Log out' },
    };
    expect(byId(ev, 'element_presence').status).toBe('pass');
  });

  it('guard #4 fails on an uncaught console error', () => {
    const ev = { ...clean, console: [{ level: 'error' as const, text: 'TypeError: x' }] };
    expect(byId(ev, 'console_error').status).toBe('fail');
  });

  it('guard #5 fails on navigation failure or timeout', () => {
    expect(byId({ ...clean, navigation: { ok: false, httpStatus: 0, url: '' } }, 'page_load').status).toBe('fail');
    expect(byId({ ...clean, timedOut: true }, 'page_load').status).toBe('fail');
  });

  it('reports the set of fired guards', () => {
    const ev: GuardEvidence = {
      ...clean,
      network: [{ url: '/api/login', method: 'POST', status: 500, ok: false }],
      console: [{ level: 'error', text: 'boom' }],
    };
    const results = runGuards(ev);
    expect(hasConclusiveFailure(results)).toBe(true);
    expect(firedGuards(results).sort()).toEqual(['console_error', 'http_status']);
  });
});
