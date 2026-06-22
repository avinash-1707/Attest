import type { EvidenceRef, GuardId, ResolvedBy } from '@attest/contracts';
import type { BrowserContext } from '../adapters/browser/index';
import type { ResolutionAdapter } from '../adapters/resolution/index';
import type { NavigationResult, ResolvedTarget } from '../adapters/types';
import type { Journey, JourneyStep } from '../journey';
import type { EvidenceCollector } from '../evidence/index';
import { runGuards, firedGuards, hasConclusiveFailure } from '../judge/guards';
import type { GuardEvidence, GuardResult } from '../judge/guards';

// executor: runs steps, drives resolution, triggers evidence capture, runs the guards [arch §4.1].
// A resolution miss is re-resolved before the step is declared failed [prd §6.2A].

export interface ExecutedStep {
  step: JourneyStep;
  guards: GuardResult[];
  guardEvidence: GuardEvidence;
  firedGuardIds: GuardId[];
  conclusiveFailure: boolean;
  resolvedBy?: ResolvedBy;
  screenshotRef?: EvidenceRef;
  domSnapshotRef?: EvidenceRef;
  error?: string;
}

export interface ExecutionResult {
  steps: ExecutedStep[];
  halted: boolean;
}

export interface ExecuteDeps {
  ctx: BrowserContext;
  resolution: ResolutionAdapter;
  evidence: EvidenceCollector;
  resolveRetries?: number; // re-resolve attempts on a miss; default 1 [prd §6.2A]
  haltOnFailure?: boolean; // §4.1 policy; default true
}

async function resolveWithRetry(
  intent: string,
  deps: ExecuteDeps,
  retries: number,
): Promise<ResolvedTarget> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await deps.resolution.resolve(intent, deps.ctx);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('resolution failed');
}

export async function execute(journey: Journey, deps: ExecuteDeps): Promise<ExecutionResult> {
  const retries = deps.resolveRetries ?? 1;
  const halt = deps.haltOnFailure ?? true;
  const steps: ExecutedStep[] = [];
  let halted = false;

  for (const step of journey.steps) {
    const consoleBefore = deps.evidence.consoleEvents().length;
    const networkBefore = deps.evidence.networkEvents().length;
    let navigation: NavigationResult | undefined;
    let resolvedBy: ResolvedBy | undefined;
    let error: string | undefined;

    try {
      switch (step.action.kind) {
        case 'goto':
          navigation = await deps.ctx.goto(step.action.url);
          break;
        case 'click': {
          const target = await resolveWithRetry(step.action.intent, deps, retries);
          resolvedBy = target.resolvedBy;
          await deps.ctx.click(target);
          break;
        }
        case 'type': {
          const target = await resolveWithRetry(step.action.intent, deps, retries);
          resolvedBy = target.resolvedBy;
          await deps.ctx.type(target, step.action.text);
          break;
        }
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }

    const screenshotRef = await deps.evidence.captureScreenshot();
    const guardEvidence: GuardEvidence = {
      navigation,
      console: deps.evidence.consoleEvents().slice(consoleBefore),
      network: deps.evidence.networkEvents().slice(networkBefore),
      a11y: await deps.ctx.a11ySnapshot(),
      expectation: step.expectation,
    };
    const guards = runGuards(guardEvidence);
    const conclusiveFailure = hasConclusiveFailure(guards) || error !== undefined;

    const executed: ExecutedStep = {
      step,
      guards,
      guardEvidence,
      firedGuardIds: firedGuards(guards),
      conclusiveFailure,
      screenshotRef,
    };
    if (resolvedBy !== undefined) executed.resolvedBy = resolvedBy;
    if (conclusiveFailure) executed.domSnapshotRef = await deps.evidence.captureDomSnapshot();
    if (error !== undefined) executed.error = error;
    steps.push(executed);

    if (conclusiveFailure && halt) {
      halted = true;
      break;
    }
  }

  return { steps, halted };
}
