import { z } from 'zod';
import { attestation, failure } from './attestation';
import { runStatus } from './enums';

// attest{goal, url} -> Attestation. The primary tool call [arch §4.1, prd §6.1].
export const attestRequest = z.object({
  goal: z.string().min(1),
  url: z.url(),
});
export type AttestRequest = z.infer<typeof attestRequest>;

export const attestResponse = attestation;
export type AttestResponse = z.infer<typeof attestResponse>;

// assert_outcome{url, outcome}: assert a single outcome (the outcome is the goal) [prd §6.1].
// Field shape provisional: the docs describe intent, not a signature (see progress-tracker).
export const assertOutcomeRequest = z.object({
  url: z.url(),
  outcome: z.string().min(1),
});
export type AssertOutcomeRequest = z.infer<typeof assertOutcomeRequest>;

export const assertOutcomeResponse = attestation;
export type AssertOutcomeResponse = z.infer<typeof assertOutcomeResponse>;

// verify_flow{url, goal, steps}: verify an explicit ordered flow [prd §6.1].
// Field shape provisional (see progress-tracker).
export const verifyFlowRequest = z.object({
  url: z.url(),
  goal: z.string().min(1),
  steps: z.array(z.string().min(1)).min(1),
});
export type VerifyFlowRequest = z.infer<typeof verifyFlowRequest>;

export const verifyFlowResponse = attestation;
export type VerifyFlowResponse = z.infer<typeof verifyFlowResponse>;

// explain_failure{runId}: retrieve the full failure dossier for a run [arch §4.2, §G4 loop].
export const explainFailureRequest = z.object({
  runId: z.string().min(1),
});
export type ExplainFailureRequest = z.infer<typeof explainFailureRequest>;

export const explainFailureResponse = z.object({
  runId: z.string().min(1),
  status: runStatus,
  failure,
});
export type ExplainFailureResponse = z.infer<typeof explainFailureResponse>;
