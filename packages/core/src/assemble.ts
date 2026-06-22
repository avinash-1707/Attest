import {
  attestation,
  SCHEMA_VERSION,
  type Attestation,
  type AttestationStep,
  type Failure,
  type Source,
} from '@attest/contracts';
import type { ExecutionResult } from './executor/index';
import type { Verdict } from './judge/verdict';
import type { EvidenceCollector } from './evidence/index';

// assemble: verdict + steps + evidence -> Attestation [arch §4.1]. The output is validated against
// the contract schema before it leaves the engine, so core never emits an invalid attestation.

export interface AttestationMeta {
  runId: string;
  orgId: string;
  appId: string;
  source: Source;
  goal: string;
  url: string;
  startedAt: string;
  durationMs: number;
}

export interface AssembleInput {
  meta: AttestationMeta;
  execution: ExecutionResult;
  verdict: Verdict;
  evidence: EvidenceCollector;
}

function toStep(es: ExecutionResult['steps'][number]): AttestationStep {
  const step: AttestationStep = {
    index: es.step.index,
    name: es.step.name,
    status: es.conclusiveFailure ? 'failed' : 'passed',
  };
  if (es.resolvedBy !== undefined) step.resolvedBy = es.resolvedBy;
  if (es.firedGuardIds.length > 0) step.guardsTriggered = es.firedGuardIds;

  const evidence: NonNullable<AttestationStep['evidence']> = {};
  if (es.screenshotRef !== undefined) evidence.screenshotRef = es.screenshotRef;
  if (es.domSnapshotRef !== undefined) evidence.domSnapshotRef = es.domSnapshotRef;
  if (Object.keys(evidence).length > 0) step.evidence = evidence;

  return step;
}

export function assemble(input: AssembleInput): Attestation {
  const { meta, execution, verdict, evidence } = input;

  const steps = execution.steps.map(toStep);

  let failure: Failure | undefined;
  if (verdict.status === 'failed' && verdict.failure) {
    const vf = verdict.failure;
    const failureEvidence: Failure['evidence'] = { console: vf.console, network: vf.network };
    if (vf.screenshotRef !== undefined) failureEvidence.screenshotRef = vf.screenshotRef;
    failure = {
      step: vf.stepName,
      reason: vf.reason,
      rootCauseHypothesis: vf.rootCauseHypothesis,
      evidence: failureEvidence,
      suggestedNextAction: vf.suggestedNextAction,
    };
  }

  const candidate = {
    schemaVersion: SCHEMA_VERSION,
    runId: meta.runId,
    orgId: meta.orgId,
    appId: meta.appId,
    source: meta.source,
    goal: meta.goal,
    status: verdict.status,
    url: meta.url,
    startedAt: meta.startedAt,
    durationMs: meta.durationMs,
    steps,
    ...(failure ? { failure } : {}),
    evidence: {
      consoleErrors: evidence
        .consoleEvents()
        .filter((c) => c.level === 'error')
        .map((c) => c.text),
      networkErrors: evidence
        .networkEvents()
        .filter((n) => !n.ok || n.status >= 400)
        .map((n) => `${n.method} ${n.url} -> ${n.status}`),
      screenshotRefs: [...evidence.screenshotRefs],
      domSnapshotRefs: [...evidence.domSnapshotRefs],
      videoRef: null,
    },
  };

  return attestation.parse(candidate);
}
