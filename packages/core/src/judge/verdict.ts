import { z } from 'zod';
import type { EvidenceRef, RunStatus } from '@attest/contracts';
import type { ModelClient } from '../adapters/model/index';
import type { Journey } from '../journey';
import type { ExecutedStep, ExecutionResult } from '../executor/index';

// judge: turns guard outcomes + LLM judgment into a goal-relative verdict [arch §4.3, tech-arch §4.3].
// Precedence: the guards already decided each step's pass/fail. The LLM is invoked only for
// interpretive work the guards don't do: the goal-relative verdict, and authoring the dossier
// rootCauseHypothesis on failure [arch §6.3, §4.4]. It never overrides a guard failure.

export class JudgeError extends Error {
  override name = 'JudgeError';
}

export interface StepVerdict {
  index: number;
  status: 'passed' | 'failed';
}

export interface VerdictFailure {
  stepName: string;
  reason: string;
  rootCauseHypothesis: string;
  suggestedNextAction: string;
  console: string[];
  network: string[];
  screenshotRef?: EvidenceRef;
}

export interface Verdict {
  status: RunStatus;
  steps: StepVerdict[];
  failure?: VerdictFailure;
}

export interface JudgeInput {
  journey: Journey;
  execution: ExecutionResult;
  model: ModelClient;
  // Set by the orchestrator/worker when the failure is environmental, not a code bug [arch §5.1].
  environmentFailure?: { reason: string };
}

const judgeSchema = z.object({
  met: z.boolean(),
  reason: z.string(),
  rootCauseHypothesis: z.string().optional(),
  suggestedNextAction: z.string().optional(),
});

type JudgeJson = z.infer<typeof judgeSchema>;

const JUDGE_SYSTEM = [
  'You are a QA judge. Decide whether the stated goal was actually achieved, based on the',
  'evidence summary. Respond with ONLY JSON:',
  '{"met":boolean,"reason":string,"rootCauseHypothesis"?:string,"suggestedNextAction"?:string}.',
  'When met=false, rootCauseHypothesis and suggestedNextAction are required.',
].join(' ');

function consoleErrors(execution: ExecutionResult): string[] {
  return execution.steps.flatMap((s) =>
    s.guardEvidence.console.filter((c) => c.level === 'error').map((c) => c.text),
  );
}

function networkErrors(execution: ExecutionResult): string[] {
  return execution.steps.flatMap((s) =>
    s.guardEvidence.network
      .filter((n) => !n.ok || n.status >= 400)
      .map((n) => `${n.method} ${n.url} -> ${n.status}`),
  );
}

function summarize(journey: Journey, execution: ExecutionResult): string {
  const lines = execution.steps.map((s) => {
    const fired = s.firedGuardIds.length ? ` guards:[${s.firedGuardIds.join(',')}]` : '';
    const err = s.error ? ` error:${s.error}` : '';
    return `#${s.step.index} ${s.step.name} -> ${s.conclusiveFailure ? 'FAIL' : 'ok'}${fired}${err}`;
  });
  return [
    `Goal: ${journey.goal}`,
    `Steps:\n${lines.join('\n')}`,
    `Console errors: ${consoleErrors(execution).join(' | ') || 'none'}`,
    `Network errors: ${networkErrors(execution).join(' | ') || 'none'}`,
  ].join('\n');
}

async function askJudge(model: ModelClient, summary: string): Promise<JudgeJson> {
  const res = await model.complete('judge', { system: JUDGE_SYSTEM, prompt: summary });
  let raw: unknown;
  try {
    raw = JSON.parse(res.text);
  } catch {
    throw new JudgeError('judge returned non-JSON output');
  }
  const parsed = judgeSchema.safeParse(raw);
  if (!parsed.success) {
    throw new JudgeError(`judge output failed validation: ${parsed.error.message}`);
  }
  return parsed.data;
}

function stepVerdicts(execution: ExecutionResult): StepVerdict[] {
  return execution.steps.map((s) => ({
    index: s.step.index,
    status: s.conclusiveFailure ? 'failed' : 'passed',
  }));
}

function buildFailure(
  step: ExecutedStep,
  execution: ExecutionResult,
  reason: string,
  judged: JudgeJson | undefined,
): VerdictFailure {
  const failure: VerdictFailure = {
    stepName: step.step.name,
    reason,
    rootCauseHypothesis: judged?.rootCauseHypothesis ?? 'Undetermined from available evidence.',
    suggestedNextAction:
      judged?.suggestedNextAction ?? 'Inspect the captured evidence for the failing step.',
    console: consoleErrors(execution),
    network: networkErrors(execution),
  };
  if (step.screenshotRef !== undefined) failure.screenshotRef = step.screenshotRef;
  return failure;
}

export async function judge(input: JudgeInput): Promise<Verdict> {
  const { journey, execution, model, environmentFailure } = input;
  const steps = stepVerdicts(execution);

  // Environment failure -> inconclusive, never a code-bug failure dossier [arch §4.3, §5.1].
  if (environmentFailure) {
    return { status: 'inconclusive', steps };
  }

  // A guard (or action error) conclusively failed a step: the verdict is failed; the LLM only
  // authors the dossier, it does not re-decide [arch §6.3, §4.4].
  const failingStep = execution.steps.find((s) => s.conclusiveFailure);
  if (failingStep) {
    const reason = failingStep.error
      ? failingStep.error
      : `guards fired: ${failingStep.firedGuardIds.join(', ')}`;
    const judged = await askJudge(model, summarize(journey, execution));
    return {
      status: 'failed',
      steps,
      failure: buildFailure(failingStep, execution, reason, judged),
    };
  }

  // No deterministic failure: ask the LLM whether the goal was actually met (goal-relative) [arch §4.3].
  const judged = await askJudge(model, summarize(journey, execution));
  if (judged.met) {
    return { status: 'passed', steps };
  }

  const lastStep = execution.steps.at(-1);
  return {
    status: 'failed',
    steps,
    failure: lastStep
      ? buildFailure(lastStep, execution, judged.reason, judged)
      : {
          stepName: journey.goal,
          reason: judged.reason,
          rootCauseHypothesis: judged.rootCauseHypothesis ?? 'Goal not met.',
          suggestedNextAction: judged.suggestedNextAction ?? 'Review the goal against the evidence.',
          console: consoleErrors(execution),
          network: networkErrors(execution),
        },
  };
}
