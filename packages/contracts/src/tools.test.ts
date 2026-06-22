import { describe, it, expect } from 'vitest';
import {
  attestRequest,
  assertOutcomeRequest,
  verifyFlowRequest,
  explainFailureRequest,
  explainFailureResponse,
} from './tools';

describe('tool I/O contracts', () => {
  it('attestRequest accepts {goal, url} and rejects a bad url', () => {
    expect(attestRequest.parse({ goal: 'log in', url: 'https://app.com' })).toEqual({
      goal: 'log in',
      url: 'https://app.com',
    });
    expect(attestRequest.safeParse({ goal: 'log in', url: 'not-a-url' }).success).toBe(false);
    expect(attestRequest.safeParse({ goal: '', url: 'https://app.com' }).success).toBe(false);
  });

  it('assertOutcomeRequest requires url + non-empty outcome', () => {
    expect(assertOutcomeRequest.safeParse({ url: 'https://app.com', outcome: 'order placed' }).success).toBe(true);
    expect(assertOutcomeRequest.safeParse({ url: 'https://app.com', outcome: '' }).success).toBe(false);
  });

  it('verifyFlowRequest requires at least one step', () => {
    expect(
      verifyFlowRequest.safeParse({ url: 'https://app.com', goal: 'checkout', steps: ['add to cart', 'pay'] }).success,
    ).toBe(true);
    expect(verifyFlowRequest.safeParse({ url: 'https://app.com', goal: 'checkout', steps: [] }).success).toBe(false);
  });

  it('explainFailureRequest requires a runId', () => {
    expect(explainFailureRequest.safeParse({ runId: 'run_1' }).success).toBe(true);
    expect(explainFailureRequest.safeParse({ runId: '' }).success).toBe(false);
  });

  it('explainFailureResponse round-trips a dossier', () => {
    const dossier = {
      runId: 'run_def456',
      status: 'failed' as const,
      failure: {
        step: 'Submit',
        reason: 'Dashboard never rendered',
        rootCauseHypothesis: 'Client exception before navigation',
        evidence: { screenshotRef: 'ev_003', console: ['TypeError'], network: ['POST /api/login 500'] },
        suggestedNextAction: 'Check null-handling of the login response',
      },
    };
    const parsed = explainFailureResponse.parse(dossier);
    expect(explainFailureResponse.parse(JSON.parse(JSON.stringify(parsed)))).toEqual(parsed);
  });
});
