import { z } from 'zod';

// API DTOs: the HTTP request/response shapes for apps/backend [tech-arch §2.1, §2.2].
// Distinct from the MCP tool I/O (tools.ts) and the internal queue message (job.ts).

// POST /runs body. The dashboard and MCP both post this; the backend resolves the app's
// secrets (model key + credentials) server-side, so the caller names no secret [arch §10].
// A superset of attestRequest: adds the appId the run targets (the run's allowlist owner).
export const runCreate = z.object({
  appId: z.string().min(1),
  goal: z.string().min(1),
  url: z.url(),
});
export type RunCreate = z.infer<typeof runCreate>;

// POST /runs response: the allocated runId. A freshly enqueued run is always 'queued';
// verdict status (passed/failed/inconclusive) lands on the attestation later, via the read API.
export const runCreated = z.object({
  runId: z.string().min(1),
  status: z.literal('queued'),
});
export type RunCreated = z.infer<typeof runCreated>;
