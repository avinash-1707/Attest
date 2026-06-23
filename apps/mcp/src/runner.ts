import type { Attestation } from '@attest/contracts';
import type { BackendClient } from './client';

// Turns the async run lifecycle into the synchronous request/response an MCP tool call needs: enqueue
// a run, poll its status until it resolves, then return the attestation [arch §4.1]. The agent calls
// one tool and blocks here until there's a verdict (or a timeout / operational cancel).

// run.lifecycle terminal states [tech-arch §4.3]: `completed` carries an attestation (any verdict,
// incl. inconclusive); `canceled` is an operational fault (allowlist denial / missing app / worker
// fault) with no attestation - run.error explains it.
export type RunOutcome =
  | { kind: 'attestation'; runId: string; attestation: Attestation }
  | { kind: 'canceled'; runId: string; error: string }
  | { kind: 'timeout'; runId: string };

export interface RunnerDeps {
  client: BackendClient;
  pollIntervalMs: number;
  pollTimeoutMs: number;
  // Injectable so the poll loop unit-tests without real time.
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function runAndAwait(
  input: { appId: string; goal: string; url: string },
  deps: RunnerDeps,
): Promise<RunOutcome> {
  const sleep = deps.sleep ?? defaultSleep;
  const { runId } = await deps.client.createRun(input);

  const maxPolls = Math.max(1, Math.ceil(deps.pollTimeoutMs / deps.pollIntervalMs));
  for (let i = 0; i < maxPolls; i++) {
    const status = await deps.client.getRunStatus(runId);
    if (status.lifecycle === 'completed') {
      const att = await deps.client.getAttestation(runId);
      return { kind: 'attestation', runId, attestation: att };
    }
    if (status.lifecycle === 'canceled') {
      return { kind: 'canceled', runId, error: status.error ?? 'Run canceled' };
    }
    // No sleep after the final poll - it would push the real wait one interval past the budget.
    if (i < maxPolls - 1) await sleep(deps.pollIntervalMs);
  }

  return { kind: 'timeout', runId };
}
