import type { Attestation, Source } from '@attest/contracts';
import type { BrowserAdapter } from './adapters/browser/index';
import type { ResolutionAdapter } from './adapters/resolution/index';
import type { ModelClient } from './adapters/model/index';
import type { EvidenceStore } from './adapters/storage/index';
import { plan } from './planner/index';
import { execute, type ExecutionResult } from './executor/index';
import { judge } from './judge/verdict';
import { EvidenceCollector } from './evidence/index';
import { assemble } from './assemble';

// The engine entrypoint: plan -> execute -> judge -> assemble [arch §4.1]. Pure: it takes plain
// input + adapters and returns a validated Attestation. Transport, queue, and storage backends
// live outside core.

export interface RunInput {
  runId: string;
  orgId: string;
  appId: string;
  source: Source;
  goal: string;
  url: string;
}

export interface RunDeps {
  browser: BrowserAdapter;
  resolution: ResolutionAdapter;
  model: ModelClient;
  store: EvidenceStore;
  now?: () => number; // injectable clock for deterministic tests; defaults to wall clock
}

// Environment failures (unreachable target, page-load timeout) become inconclusive, not a code-bug
// failure [arch §4.3, §5.1]. httpStatus 0 = unreachable; a 4xx/5xx is a real verdict failure.
function detectEnvironmentFailure(execution: ExecutionResult): { reason: string } | undefined {
  for (const s of execution.steps) {
    const nav = s.guardEvidence.navigation;
    if (s.step.action.kind === 'goto' && nav && nav.httpStatus === 0) {
      return { reason: 'target unreachable' };
    }
    if (s.error && /timeout|unreachable|ECONN|ENOTFOUND/i.test(s.error)) {
      return { reason: s.error };
    }
  }
  return undefined;
}

export async function runAttestation(input: RunInput, deps: RunDeps): Promise<Attestation> {
  const now = deps.now ?? (() => Date.now());
  const start = now();
  const startedAt = new Date(start).toISOString();
  const ns = { orgId: input.orgId, appId: input.appId };

  const journey = await plan({ goal: input.goal, url: input.url }, deps.model);

  const ctx = await deps.browser.newContext({});
  const evidence = new EvidenceCollector(ctx, deps.store, ns);
  let execution: ExecutionResult;
  try {
    execution = await execute(journey, { ctx, resolution: deps.resolution, evidence });
  } finally {
    await ctx.close();
  }

  const environmentFailure = detectEnvironmentFailure(execution);
  const verdict = await judge({
    journey,
    execution,
    model: deps.model,
    ...(environmentFailure ? { environmentFailure } : {}),
  });

  return assemble({
    meta: {
      runId: input.runId,
      orgId: input.orgId,
      appId: input.appId,
      source: input.source,
      goal: input.goal,
      url: input.url,
      startedAt,
      durationMs: now() - start,
    },
    execution,
    verdict,
    evidence,
  });
}
