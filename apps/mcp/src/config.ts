import { z } from 'zod';

// Process-start configuration for the MCP server, validated once at the boundary [tech-arch §8].
// The server is a thin client of apps/backend: it holds a service key + the single app it acts on.
// One MCP server instance == one app (the host's per-project config supplies these), so the agent
// never names an appId - the tools stay {goal,url} and the server injects appId at enqueue.
const schema = z.object({
  backendUrl: z.url(),
  serviceKey: z.string().min(1),
  appId: z.string().min(1),
  // Run-completion poll budget. attest/assert_outcome/verify_flow block until the run resolves;
  // these bound that wait so a stuck run surfaces a timeout rather than hanging the agent.
  // z.coerce so a non-numeric env value (e.g. ATTEST_POLL_INTERVAL_MS=abc) fails with a clear "expected
  // number" at boot rather than coercing to NaN via Number() and producing a confusing error [L13].
  pollIntervalMs: z.coerce.number().int().positive().default(2000),
  pollTimeoutMs: z.coerce.number().int().positive().default(180000),
});

export type McpConfig = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): McpConfig {
  return schema.parse({
    backendUrl: env.ATTEST_BACKEND_URL,
    serviceKey: env.ATTEST_SERVICE_KEY,
    appId: env.ATTEST_APP_ID,
    pollIntervalMs: env.ATTEST_POLL_INTERVAL_MS || undefined,
    pollTimeoutMs: env.ATTEST_POLL_TIMEOUT_MS || undefined,
  });
}
