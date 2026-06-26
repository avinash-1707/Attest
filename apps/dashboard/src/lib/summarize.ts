import type { RunListItem } from '@attest/contracts';

export interface RunSummary {
  total: number;
  passed: number;
  failed: number;
  inconclusive: number;
  running: number;
  queued: number;
  completed: number;
}

export function summarizeRuns(runs: RunListItem[]): RunSummary {
  let passed = 0;
  let failed = 0;
  let inconclusive = 0;
  let running = 0;
  let queued = 0;
  let completed = 0;

  for (const run of runs) {
    if (run.status === 'passed') passed++;
    else if (run.status === 'failed') failed++;
    else if (run.status === 'inconclusive') inconclusive++;

    if (run.lifecycle === 'running') running++;
    else if (run.lifecycle === 'queued') queued++;
    else if (run.lifecycle === 'completed') completed++;
  }

  return { total: runs.length, passed, failed, inconclusive, running, queued, completed };
}
