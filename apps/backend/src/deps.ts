import IORedis from 'ioredis';
import { Queue } from 'bullmq';
import {
  getDb,
  closeDb,
  createDataAccess,
  createSecretCipher,
  createEnvKeyProvider,
  kekFromEnv,
  type DataAccess,
  type SecretCipher,
} from '@attest/db';
import { RUN_QUEUE, type AgentRole } from '@attest/contracts';
import type { BackendConfig } from './config';
import { buildAuth, type Auth } from './auth';
import { createConsoleMailer } from './mailer';

// Composition root: the one place concrete singletons (db pool, Redis, BullMQ queue, cipher, auth)
// are constructed [tech-arch §8, mirrors apps/worker/adapters.ts]. Built once at boot from validated
// config; building the cipher here is also where a bad/absent KEK fails the process before listen.

export interface BackendDeps {
  config: BackendConfig;
  dal: DataAccess;
  cipher: SecretCipher;
  queue: Queue;
  redis: IORedis;
  auth: Auth;
  modelDefaults: Record<AgentRole, string>;
  closeDb: () => Promise<void>;
}

export function createDeps(config: BackendConfig): BackendDeps {
  const db = getDb(config.databaseUrl);
  const dal = createDataAccess(db);

  // kekFromEnv throws on a non-32-byte key, failing boot [tech-arch §6.2, fail-closed].
  const keyProvider = createEnvKeyProvider(kekFromEnv(config.kek), config.kekId);
  const cipher = createSecretCipher({ db, keyProvider });

  const redis = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });
  const queue = new Queue(RUN_QUEUE, { connection: redis });

  // The console mailer logs OTP codes; it is the dev/self-hosted seam only. Fail loud rather than
  // silently shipping verification codes to logs in a hosted production deploy [invariant 4].
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'No production mailer configured: the console mailer logs OTP codes and must not run in production.',
    );
  }

  const auth = buildAuth({
    db,
    mailer: createConsoleMailer(),
    secret: config.betterAuthSecret,
    baseURL: config.betterAuthUrl,
    trustedOrigins: config.trustedOrigins,
    google: config.google,
  });

  return { config, dal, cipher, queue, redis, auth, modelDefaults: config.modelDefaults, closeDb };
}
