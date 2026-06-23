import { z } from 'zod';

// Process-start configuration, validated once at the boundary [tech-arch §8]. Fail-closed: a
// backend that can't open secrets or sign sessions must never bind the port, so DATABASE_URL,
// REDIS_URL, ATTEST_KEK and BETTER_AUTH_SECRET are all required and loadConfig throws if absent.

const base = z.object({
  port: z.number().int().positive().default(3000),
  databaseUrl: z.string().min(1),
  redisUrl: z.string().min(1),
  // Base64-encoded KEK; the 32-byte length is checked by kekFromEnv when the cipher is built at
  // boot (deps.ts), which also fails the process before listen [tech-arch §6.2].
  kek: z.string().min(1),
  kekId: z.string().min(1).default('env'),
  betterAuthSecret: z.string().min(1),
  betterAuthUrl: z.string().min(1),
  // CSRF whitelist for the cookie-based session path (the dashboard origin) [security].
  trustedOrigins: z.array(z.string().min(1)).default([]),
  google: z.object({ clientId: z.string().min(1), clientSecret: z.string().min(1) }).optional(),
  // Hosted default OpenRouter key, used when an org has no BYOK model key [arch §7.2]. Optional so a
  // self-hoster relying solely on BYOK (or a local endpoint) need not set it.
  openrouterApiKey: z.string().min(1).optional(),
  modelBaseUrl: z.string().min(1).optional(),
  // Per-role model ids [tech-arch §3.3, §8]. Defaulted so dev boot needs no model env; override via
  // MODEL_DEFAULT_*. The app table carries no per-app model choice in MVP, so these apply to every run.
  modelDefaults: z.object({
    planner: z.string().min(1).default('anthropic/claude-sonnet-4-6'),
    judge: z.string().min(1).default('anthropic/claude-haiku-4-5'),
    resolution: z.string().min(1).default('anthropic/claude-haiku-4-5'),
  }),
});

// Evidence backend, selected once at start [tech-arch §8], same shape the worker uses so the read
// API serves bytes from the store the worker wrote to. Disk (self-hosted) / S3-compatible (hosted).
const diskConfig = base.extend({
  evidence: z.object({ backend: z.literal('disk'), root: z.string().min(1) }),
});

const s3Config = base.extend({
  evidence: z.object({
    backend: z.literal('s3'),
    bucket: z.string().min(1),
    endpoint: z.string().min(1).optional(),
    region: z.string().min(1).optional(),
    accessKeyId: z.string().min(1).optional(),
    secretAccessKey: z.string().min(1).optional(),
  }),
});

export type BackendConfig = z.infer<typeof diskConfig> | z.infer<typeof s3Config>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): BackendConfig {
  const common = {
    port: env.PORT ? Number(env.PORT) : undefined,
    databaseUrl: env.DATABASE_URL,
    redisUrl: env.REDIS_URL,
    kek: env.ATTEST_KEK,
    kekId: env.ATTEST_KEK_ID,
    betterAuthSecret: env.BETTER_AUTH_SECRET,
    betterAuthUrl: env.BETTER_AUTH_URL,
    trustedOrigins: env.TRUSTED_ORIGINS
      ? env.TRUSTED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
      : undefined,
    google:
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }
        : undefined,
    openrouterApiKey: env.OPENROUTER_API_KEY,
    modelBaseUrl: env.MODEL_BASE_URL,
    modelDefaults: {
      planner: env.MODEL_DEFAULT_PLANNER,
      judge: env.MODEL_DEFAULT_JUDGE,
      resolution: env.MODEL_DEFAULT_RESOLUTION,
    },
  };

  if ((env.EVIDENCE_BACKEND ?? 'disk') === 's3') {
    return s3Config.parse({
      ...common,
      evidence: {
        backend: 's3',
        bucket: env.EVIDENCE_BUCKET,
        endpoint: env.EVIDENCE_ENDPOINT,
        region: env.EVIDENCE_REGION,
        accessKeyId: env.EVIDENCE_ACCESS_KEY_ID,
        secretAccessKey: env.EVIDENCE_SECRET_ACCESS_KEY,
      },
    });
  }

  return diskConfig.parse({
    ...common,
    evidence: { backend: 'disk', root: env.EVIDENCE_ROOT },
  });
}
