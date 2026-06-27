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
import {
  RUN_QUEUE,
  type AgentRole,
  type BillingGate,
  type BillingWebhookHandler,
  type BillingCheckout,
} from '@attest/contracts';
import type { EvidenceStore, UserAssetStore } from '@attest/core';
import { loadBillingGate, loadBillingWebhookHandler, loadBillingCheckout } from '../billing/load';
import { createDiskEvidenceStore } from '@attest/core/adapters/storage/disk';
import { createS3EvidenceStore } from '@attest/core/adapters/storage/s3';
import { createDiskUserAssetStore } from '@attest/core/adapters/storage/user-assets-disk';
import { createS3UserAssetStore } from '@attest/core/adapters/storage/user-assets-s3';
import type { BackendConfig } from './config';
import { buildAuth, type Auth } from '../auth/auth';
import { withMembershipCache } from './membership-cache';
import { createConsoleMailer } from '../auth/mailer';

// Read-only here: the backend serves evidence bytes from the same store the worker wrote to
// [tech-arch §3.4, §8]. Selected once from config; subpath imports pull only the storage SDK.
function createStore(config: BackendConfig): EvidenceStore {
  if (config.evidence.backend === 's3') {
    const e = config.evidence;
    return createS3EvidenceStore({
      bucket: e.bucket,
      ...(e.endpoint ? { endpoint: e.endpoint } : {}),
      ...(e.region ? { region: e.region } : {}),
      ...(e.accessKeyId && e.secretAccessKey
        ? { credentials: { accessKeyId: e.accessKeyId, secretAccessKey: e.secretAccessKey } }
        : {}),
    });
  }
  return createDiskEvidenceStore({ root: config.evidence.root });
}

// Avatars share the evidence storage backend (no new config) under a disjoint `users/` prefix
// [profile spec]. Same disk/s3 branch on config.evidence as createStore.
function createUserAssetStore(config: BackendConfig): UserAssetStore {
  if (config.evidence.backend === 's3') {
    const e = config.evidence;
    return createS3UserAssetStore({
      bucket: e.bucket,
      ...(e.endpoint ? { endpoint: e.endpoint } : {}),
      ...(e.region ? { region: e.region } : {}),
      ...(e.accessKeyId && e.secretAccessKey
        ? { credentials: { accessKeyId: e.accessKeyId, secretAccessKey: e.secretAccessKey } }
        : {}),
    });
  }
  return createDiskUserAssetStore({ root: config.evidence.root });
}

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
  store: EvidenceStore;
  userAssets: UserAssetStore;
  modelDefaults: Record<AgentRole, string>;
  // Credit gate at enqueue; no-op in the OSS build [tech-arch §13.4].
  gate: BillingGate;
  // Inbound Dodo webhook handler; 404 no-op in the OSS build [tech-arch §13.5].
  webhook: BillingWebhookHandler;
  // Self-serve checkout + portal; 409 no-op in the OSS build [tech-arch §13.6].
  checkout: BillingCheckout;
  closeDb: () => Promise<void>;
}

export async function createDeps(config: BackendConfig): Promise<BackendDeps> {
  const db = getDb(config.databaseUrl);
  // Cache getUserOrgMemberships (the per-request M1 membership re-check + the login active-org resolver)
  // behind a short TTL so the hot session path isn't a DB round-trip every request [audit M1 follow-up].
  const dal = withMembershipCache(createDataAccess(db));

  // kekFromEnv throws on a non-32-byte key, failing boot [tech-arch §6.2, fail-closed].
  const keyProvider = createEnvKeyProvider(kekFromEnv(config.kek), config.kekId);
  const cipher = createSecretCipher({ db, keyProvider });

  const redis = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });
  const queue = new Queue(RUN_QUEUE, { connection: redis });

  // The console mailer logs OTP codes (incl. password-reset); it is the dev/self-hosted seam only.
  // Fail loud on any non-dev/test environment rather than only on the literal NODE_ENV='production':
  // a staging/preview deploy (NODE_ENV unset or 'staging') must not silently log verification codes
  // either [invariant 4, audit 2026-06-27 L6]. Opt in explicitly with NODE_ENV=development|test.
  const env = process.env.NODE_ENV;
  if (env !== 'development' && env !== 'test') {
    throw new Error(
      `No real mailer configured: the console mailer logs OTP codes and must not run outside development/test (NODE_ENV=${env ?? 'unset'}).`,
    );
  }

  const auth = buildAuth({
    db,
    dal,
    mailer: createConsoleMailer(),
    secret: config.betterAuthSecret,
    baseURL: config.betterAuthUrl,
    trustedOrigins: config.trustedOrigins,
    cookieDomain: config.cookieDomain,
    google: config.google,
  });

  const store = createStore(config);
  const userAssets = createUserAssetStore(config);

  // No-op unless billing is enabled (OSS build never gates); fail-closed if hosted and ee is absent.
  const gate = await loadBillingGate({
    enabled: config.billingEnabled,
    requireBilling: config.requireBilling,
    dal,
  });
  const webhook = await loadBillingWebhookHandler({
    enabled: config.billingEnabled,
    requireBilling: config.requireBilling,
    webhookKey: config.dodoWebhookKey,
    dal,
  });
  const checkout = await loadBillingCheckout({
    enabled: config.billingEnabled,
    requireBilling: config.requireBilling,
    apiKey: config.dodoApiKey,
    returnUrl: config.dashboardUrl ? `${config.dashboardUrl.replace(/\/+$/, '')}/billing` : undefined,
    environment: config.dodoEnvironment,
    dal,
  });

  return {
    config,
    dal,
    cipher,
    queue,
    redis,
    auth,
    store,
    userAssets,
    modelDefaults: config.modelDefaults,
    gate,
    webhook,
    checkout,
    closeDb,
  };
}
