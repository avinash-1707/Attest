import type { Attestation, Source, AgentRole } from '@attest/contracts';
import type { BrowserAdapter } from './adapters/browser/index';
import type { ResolutionAdapter } from './adapters/resolution/index';
import type { ModelClient, ModelRequest, ModelResponse } from './adapters/model/index';
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
  // The app's navigation allowlist. Re-checked before EVERY navigation (not just the entry url) so a
  // planner-emitted goto cannot reach an off-allowlist/internal host [invariant 7, audit 2026-06-27 H2].
  allowlist: readonly string[];
}

export interface RunDeps {
  browser: BrowserAdapter;
  resolution: ResolutionAdapter;
  model: ModelClient;
  store: EvidenceStore;
  now?: () => number; // injectable clock for deterministic tests; defaults to wall clock
}

// Raw metering inputs for the run, consumed by ee/metering to write the UsageEvent + credit debit
// [tech-arch §13.2]. NOT part of the Attestation contract (worker-internal), so schemaVersion is
// untouched [invariant 6]. modelCostUsd is the gateway-reported cost summed across model calls (0 when
// the gateway reports nothing); the BYOK case is zeroed downstream by the meter, since that cost lands
// on the user's own OpenRouter account.
export interface RunMeter {
  modelCostUsd: number;
  browserMinutes: number;
  steps: number;
}

export interface RunResult {
  attestation: Attestation;
  meter: RunMeter;
}

// Wraps a ModelClient to sum the gateway-reported USD cost across every completion in a run.
function meteredModel(model: ModelClient): { client: ModelClient; totalCostUsd: () => number } {
  let total = 0;
  const client: ModelClient = {
    async complete(role: AgentRole, req: ModelRequest): Promise<ModelResponse> {
      const res = await model.complete(role, req);
      if (typeof res.costUsd === 'number') total += res.costUsd;
      return res;
    },
  };
  return { client, totalCostUsd: () => total };
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

export async function runAttestation(input: RunInput, deps: RunDeps): Promise<RunResult> {
  const now = deps.now ?? (() => Date.now());
  const start = now();
  const startedAt = new Date(start).toISOString();
  const ns = { orgId: input.orgId, appId: input.appId };

  const { client: model, totalCostUsd } = meteredModel(deps.model);

  const journey = await plan({ goal: input.goal, url: input.url }, model);

  const ctx = await deps.browser.newContext({});
  const evidence = new EvidenceCollector(ctx, deps.store, ns, input.runId);
  let execution: ExecutionResult;
  try {
    execution = await execute(journey, {
      ctx,
      resolution: deps.resolution,
      evidence,
      allowlist: input.allowlist,
    });
  } finally {
    await ctx.close();
  }

  const environmentFailure = detectEnvironmentFailure(execution);
  const verdict = await judge({
    journey,
    execution,
    model,
    ...(environmentFailure ? { environmentFailure } : {}),
  });

  const durationMs = now() - start;
  const attestation = assemble({
    meta: {
      runId: input.runId,
      orgId: input.orgId,
      appId: input.appId,
      source: input.source,
      goal: input.goal,
      url: input.url,
      startedAt,
      durationMs,
    },
    execution,
    verdict,
    evidence,
  });

  const meter: RunMeter = {
    modelCostUsd: totalCostUsd(),
    browserMinutes: durationMs / 60_000,
    steps: attestation.steps.length,
  };

  return { attestation, meter };
}
