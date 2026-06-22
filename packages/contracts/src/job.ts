import { z } from 'zod';
import { source, agentRole } from './enums';

// Per-run model config, built by the backend at enqueue from the app's model settings [tech-arch §3.3].
// Names an OpenRouter model id per role; apiKey is the user's BYOK key or the hosted default.
export const runModelConfig = z.object({
  models: z.record(agentRole, z.string().min(1)),
  apiKey: z.string().min(1),
});
export type RunModelConfig = z.infer<typeof runModelConfig>;

// The internal queue message [arch §4.1]. Secrets (modelConfig.apiKey, credentials) flow
// backend -> worker only; never returned to clients and never logged [arch §4.1, tech-arch §6, invariant 4].
export const jobPayload = z.object({
  runId: z.string().min(1),
  orgId: z.string().min(1),
  appId: z.string().min(1),
  source,
  goal: z.string().min(1),
  url: z.url(),
  modelConfig: runModelConfig,
  // App login credentials, decrypted at enqueue. Shape is app-specific; provisional (see progress-tracker).
  credentials: z.record(z.string(), z.string()).optional(),
});
export type JobPayload = z.infer<typeof jobPayload>;
