import { z } from 'zod';

// Process-start configuration, validated once at the boundary [tech-arch §8]. Nothing downstream
// branches on "am I hosted?" - it branches on which evidence backend was selected here.

const base = z.object({
  databaseUrl: z.string().min(1),
  redisUrl: z.string().min(1),
  // Override for a local OpenAI-compatible endpoint (Ollama); absent = OpenRouter default [arch §7.2].
  modelBaseUrl: z.string().min(1).optional(),
  concurrency: z.number().int().positive().default(1),
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
  const backend = env.EVIDENCE_BACKEND ?? 'disk';
  const common = {
    databaseUrl: env.DATABASE_URL,
    redisUrl: env.REDIS_URL,
    modelBaseUrl: env.MODEL_BASE_URL,
    concurrency: env.WORKER_CONCURRENCY ? Number(env.WORKER_CONCURRENCY) : undefined,
  };

  if (backend === 's3') {
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
