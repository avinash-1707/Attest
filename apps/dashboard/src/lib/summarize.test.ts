import { describe, it, expect } from 'vitest';
import { summarizeRuns } from './summarize';
import type { RunListItem } from '@attest/contracts';

function makeRun(overrides: Partial<RunListItem> = {}): RunListItem {
  return {
    runId: 'run_test',
    appId: 'app_test',
    goal: 'Test goal',
    lifecycle: 'completed',
    status: null,
    createdAt: new Date().toISOString(),
    durationMs: null,
    ...overrides,
  };
}

describe('summarizeRuns', () => {
  it('returns all-zero for an empty array', () => {
    const result = summarizeRuns([]);
    expect(result).toEqual({
      total: 0,
      passed: 0,
      failed: 0,
      inconclusive: 0,
      running: 0,
      queued: 0,
      completed: 0,
    });
  });

  it('null status (verdict pending) does NOT count as failed', () => {
    const runs = [
      makeRun({ lifecycle: 'completed', status: null }),
      makeRun({ lifecycle: 'running', status: null }),
    ];
    const result = summarizeRuns(runs);
    expect(result.failed).toBe(0);
    expect(result.passed).toBe(0);
    expect(result.inconclusive).toBe(0);
    expect(result.total).toBe(2);
  });

  it('correctly buckets verdict status independently from lifecycle', () => {
    const runs = [
      makeRun({ lifecycle: 'completed', status: 'passed' }),
      makeRun({ lifecycle: 'completed', status: 'failed' }),
      makeRun({ lifecycle: 'completed', status: 'inconclusive' }),
      makeRun({ lifecycle: 'running', status: null }),
      makeRun({ lifecycle: 'queued', status: null }),
    ];
    const result = summarizeRuns(runs);
    expect(result.total).toBe(5);
    expect(result.passed).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.inconclusive).toBe(1);
    expect(result.running).toBe(1);
    expect(result.queued).toBe(1);
    expect(result.completed).toBe(3);
  });

  it('counts multiple passes and failures correctly', () => {
    const runs = [
      makeRun({ status: 'passed' }),
      makeRun({ status: 'passed' }),
      makeRun({ status: 'failed' }),
    ];
    const result = summarizeRuns(runs);
    expect(result.passed).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.total).toBe(3);
  });

  it('lifecycle buckets are independent of verdict buckets', () => {
    const runs = [
      makeRun({ lifecycle: 'running', status: 'passed' }),
    ];
    const result = summarizeRuns(runs);
    expect(result.running).toBe(1);
    expect(result.passed).toBe(1);
    expect(result.completed).toBe(0);
  });
});
