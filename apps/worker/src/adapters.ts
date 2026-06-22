import type { JobPayload } from '@attest/contracts';
import type { RunDeps } from '@attest/core';
import { createPuppeteerBrowserAdapter } from '@attest/core/adapters/browser/puppeteer';
import { createDomLadderResolutionAdapter } from '@attest/core/adapters/resolution/dom-ladder';
import { createOpenRouterModelClient } from '@attest/core/adapters/model/openrouter';
import { createDiskEvidenceStore } from '@attest/core/adapters/storage/disk';
import { createS3EvidenceStore } from '@attest/core/adapters/storage/s3';
import type { EvidenceStore } from '@attest/core';
import type { WorkerConfig } from './config';

// The composition root: the only place concrete engine SDKs are wired in [tech-arch §1.2 rule 6].
// The browser + resolution adapters are stateless and shared; the model client is per-job because it
// carries the run's BYOK key, and the store is selected once from config.

function createStore(config: WorkerConfig): EvidenceStore {
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

export function createDepsFactory(config: WorkerConfig): (job: JobPayload) => RunDeps {
  const browser = createPuppeteerBrowserAdapter();
  const resolution = createDomLadderResolutionAdapter();
  const store = createStore(config);

  return (job) => ({
    browser,
    resolution,
    store,
    model: createOpenRouterModelClient(
      job.modelConfig,
      config.modelBaseUrl ? { baseURL: config.modelBaseUrl } : undefined,
    ),
  });
}
