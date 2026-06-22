import { z } from 'zod';
import { SCHEMA_VERSION, runStatus, stepStatus, source, resolvedBy, guardId } from './enums';
import { stepEvidence, runEvidence } from './evidence';

// One executed step of the journey [arch §8].
export const attestationStep = z.object({
  index: z.number().int().nonnegative(),
  name: z.string().min(1),
  status: stepStatus,
  // Absent for steps with no element resolution (e.g. a pure navigation) [tech-arch §3.2].
  resolvedBy: resolvedBy.optional(),
  // Which of the five deterministic guards fired, for transparency [arch §8, tech-arch §4.2].
  guardsTriggered: z.array(guardId).optional(),
  evidence: stepEvidence.optional(),
});
export type AttestationStep = z.infer<typeof attestationStep>;

// Failure dossier; present only when status="failed" [arch §8, tech-arch §4.4].
export const failureEvidence = z.object({
  screenshotRef: z.string().min(1).optional(),
  console: z.array(z.string()),
  network: z.array(z.string()),
});
export type FailureEvidence = z.infer<typeof failureEvidence>;

export const failure = z.object({
  step: z.string().min(1),
  reason: z.string().min(1),
  rootCauseHypothesis: z.string().min(1),
  evidence: failureEvidence,
  // Mandatory on failure; it drives the fix loop [arch §8, tech-arch §4.3].
  suggestedNextAction: z.string().min(1),
});
export type Failure = z.infer<typeof failure>;

// The attestation: stable interface between Attest and every consumer [arch §8].
// Validated at the worker output, the backend read API, and the MCP client [tech-arch §2.2].
export const attestation = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    runId: z.string().min(1),
    orgId: z.string().min(1),
    appId: z.string().min(1),
    source,
    goal: z.string().min(1),
    status: runStatus,
    url: z.url(),
    startedAt: z.iso.datetime(),
    durationMs: z.number().int().nonnegative(),
    steps: z.array(attestationStep),
    failure: failure.optional(),
    evidence: runEvidence,
  })
  .refine((a) => a.status !== 'failed' || a.failure !== undefined, {
    message: 'failure dossier is required when status is "failed"',
    path: ['failure'],
  })
  .refine((a) => a.status === 'failed' || a.failure === undefined, {
    message: 'failure is only present when status is "failed"',
    path: ['failure'],
  });
export type Attestation = z.infer<typeof attestation>;
