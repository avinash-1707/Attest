import {
  attestRequest,
  assertOutcomeRequest,
  verifyFlowRequest,
  explainFailureRequest,
  explainFailureResponse,
  type ExplainFailureResponse,
} from '@attest/contracts';
import { BackendError, type BackendClient } from './client';
import { runAndAwait, type RunnerDeps } from './runner';

// The QA-primitive tool surface [prd §6.1]. attest/assert_outcome/verify_flow all resolve to the one
// backend run path {appId,goal,url} [invariant 1]: they are agent-ergonomic framings that compose a
// goal string, never separate execution. explore is deferred to V2. explain_failure is a read.
//
// Tool results carry a JSON string in `content` and an `isError` flag. A `failed`/`inconclusive`
// verdict is a SUCCESSFUL tool call (the agent loops on the verdict) - isError is reserved for
// operational faults (run canceled, poll timeout, backend error) where there is no attestation.

export interface ToolResult {
  text: string;
  isError: boolean;
}

export interface ToolDeps {
  appId: string;
  client: BackendClient;
  runner: Omit<RunnerDeps, 'client'>;
}

function ok(value: unknown): ToolResult {
  return { text: JSON.stringify(value, null, 2), isError: false };
}

function err(code: string, message: string, extra?: Record<string, unknown>): ToolResult {
  return { text: JSON.stringify({ error: { code, message, ...extra } }, null, 2), isError: true };
}

// assert_outcome: the asserted outcome IS the goal. verify_flow: prepend the goal, then the ordered
// steps the agent wants exercised - the planner reads them as part of the goal text.
function composeFlowGoal(goal: string, steps: string[]): string {
  const numbered = steps.map((s, i) => `${i + 1}. ${s}`).join('\n');
  return `${goal}\n\nSteps to verify, in order:\n${numbered}`;
}

async function runGoal(goal: string, url: string, deps: ToolDeps): Promise<ToolResult> {
  let outcome;
  try {
    outcome = await runAndAwait({ appId: deps.appId, goal, url }, { client: deps.client, ...deps.runner });
  } catch (e) {
    // A backend fault during enqueue or polling (403/404/5xx) is an operational error, not a transport
    // fault: surface it as an isError tool result the agent can read, mirroring explain_failure. A
    // non-BackendError (e.g. a contract-drift zod error) propagates - the SDK turns it into a protocol
    // error, which is the right signal for "the backend changed shape".
    if (e instanceof BackendError) return err('backend_error', e.message, { status: e.status, backendCode: e.code });
    throw e;
  }
  switch (outcome.kind) {
    case 'attestation':
      return ok(outcome.attestation);
    case 'canceled':
      return err('run_canceled', outcome.error, { runId: outcome.runId });
    case 'timeout':
      return err('run_timeout', `Run did not complete within the poll budget`, {
        runId: outcome.runId,
      });
  }
}

export async function handleAttest(rawArgs: unknown, deps: ToolDeps): Promise<ToolResult> {
  const { goal, url } = attestRequest.parse(rawArgs);
  return runGoal(goal, url, deps);
}

export async function handleAssertOutcome(rawArgs: unknown, deps: ToolDeps): Promise<ToolResult> {
  const { url, outcome } = assertOutcomeRequest.parse(rawArgs);
  return runGoal(outcome, url, deps);
}

export async function handleVerifyFlow(rawArgs: unknown, deps: ToolDeps): Promise<ToolResult> {
  const { url, goal, steps } = verifyFlowRequest.parse(rawArgs);
  return runGoal(composeFlowGoal(goal, steps), url, deps);
}

// explain_failure: fetch the run's attestation and return its failure dossier [arch §4.2, §G4 loop].
// A run that did not fail has no dossier - that is a valid answer, not an error.
export async function handleExplainFailure(rawArgs: unknown, deps: ToolDeps): Promise<ToolResult> {
  const { runId } = explainFailureRequest.parse(rawArgs);
  try {
    const att = await deps.client.getAttestation(runId);
    if (att.status !== 'failed' || !att.failure) {
      return ok({ runId, status: att.status, failure: null, message: 'Run did not fail; no failure dossier.' });
    }
    const response: ExplainFailureResponse = explainFailureResponse.parse({
      runId,
      status: att.status,
      failure: att.failure,
    });
    return ok(response);
  } catch (e) {
    if (e instanceof BackendError && e.status === 404) {
      return err('attestation_unavailable', 'No attestation for this run (it may not exist or may still be running)', { runId });
    }
    throw e;
  }
}
