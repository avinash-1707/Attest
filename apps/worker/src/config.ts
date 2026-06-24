import { z } from 'zod';

// Process-start configuration, validated once at the boundary [tech-arch §8]. Nothing downstream
// branches on "am I hosted?" - it branches on which evidence backend was selected here.

const base = z.object({
  databaseUrl: z.string().min(1),
  redisUrl: z.string().min(1),
  // Override for a local OpenAI-compatible endpoint (Ollama); absent = OpenRouter default [arch §7.2].
  modelBaseUrl: z.string().min(1).optional(),
  concurrency: z.number().int().positive().default(1),
  // Hosted-tier metering: when enabled, the run-completion meter writes a UsageEvent + credit debit via
  // ee/billing. OFF for the OSS build (self-hosters never meter) [tech-arch §13]. requireBilling makes a
  // hosted boot fail closed if @attest/ee is somehow absent, rather than silently run unmetered.
  billingEnabled: z.boolean().default(false),
  requireBilling: z.boolean().default(false),
});

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

export type WorkerConfig = z.infer<typeof diskConfig> | z.infer<typeof s3Config>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  // An env var set to "" (common in a copied .env / .env.example) means unset, not present-empty:
  // collapse it to undefined so optional fields stay optional and defaulted fields take their default.
  const v = (key: string): string | undefined => {
    const raw = env[key];
    return raw && raw.length > 0 ? raw : undefined;
  };

  const backend = v('EVIDENCE_BACKEND') ?? 'disk';
  const common = {
    databaseUrl: v('DATABASE_URL'),
    redisUrl: v('REDIS_URL'),
    modelBaseUrl: v('MODEL_BASE_URL'),
    concurrency: v('WORKER_CONCURRENCY') ? Number(v('WORKER_CONCURRENCY')) : undefined,
    billingEnabled: env.BILLING_ENABLED === 'true',
    requireBilling: env.REQUIRE_BILLING === 'true',
  };

  if (backend === 's3') {
    return s3Config.parse({
      ...common,
      evidence: {
        backend: 's3',
        bucket: v('EVIDENCE_BUCKET'),
        endpoint: v('EVIDENCE_ENDPOINT'),
        region: v('EVIDENCE_REGION'),
        accessKeyId: v('EVIDENCE_ACCESS_KEY_ID'),
        secretAccessKey: v('EVIDENCE_SECRET_ACCESS_KEY'),
      },
    });
  }

  return diskConfig.parse({
    ...common,
    evidence: { backend: 'disk', root: v('EVIDENCE_ROOT') },
  });
}
