import { z } from 'zod';

// Opaque id that resolves through the read API; payloads are never inlined by default [arch §8 G5, §9].
export const evidenceRef = z.string().min(1);
export type EvidenceRef = z.infer<typeof evidenceRef>;

// Per-step evidence: references only.
export const stepEvidence = z.object({
  screenshotRef: evidenceRef.optional(),
  domSnapshotRef: evidenceRef.optional(),
});
export type StepEvidence = z.infer<typeof stepEvidence>;

// Run-level rollup, all by reference [arch §8].
export const runEvidence = z.object({
  consoleErrors: z.array(z.string()),
  networkErrors: z.array(z.string()),
  screenshotRefs: z.array(evidenceRef),
  domSnapshotRefs: z.array(evidenceRef),
  videoRef: evidenceRef.nullable(),
});
export type RunEvidence = z.infer<typeof runEvidence>;
