import { Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { RUN_QUEUE } from '@attest/contracts';
import { getDb, closeDb, createDataAccess } from '@attest/db';
import { runAttestation } from '@attest/core';
import { loadConfig } from './config';
import { createDepsFactory } from './adapters';
import { processRunJob } from './process-job';
import { loadBillingMeter } from './billing/load';

// apps/worker: the run-execution process. Consumes the run queue, wires the concrete adapters into the
// pure engine, and persists the attestation [arch §3.4, tech-arch §4, §5, §7]. The backend never
// launches a browser; a crash here is a failed job, never an API outage [tech-arch §5.2].

async function main(): Promise<void> {
  const config = loadConfig();
  const dal = createDataAccess(getDb(config.databaseUrl));
  const depsFactory = createDepsFactory(config);
  // No-op unless billing is enabled (OSS build never meters); fail-closed if hosted and ee is absent.
  const meter = await loadBillingMeter({
    enabled: config.billingEnabled,
    requireBilling: config.requireBilling,
    dal,
  });

  const connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });

  const worker = new Worker(
    RUN_QUEUE,
    (job: Job) =>
      processRunJob(job.data, {
        dal,
        meter,
        attemptsMade: job.attemptsMade,
        // Single source of truth: BullMQ drives retry from job.opts.attempts, so the worker's notion of
        // "final attempt" must read the same value. Absent (producer misconfig) => treat as no-retry
        // (1) so a transient failure resolves the run instead of hanging it [tech-arch §7.5].
        maxAttempts: job.opts.attempts ?? 1,
        run: (input, payload) => runAttestation(input, depsFactory(payload)),
      }),
    { connection, concurrency: config.concurrency },
  );

  worker.on('failed', (job, err) => {
    // Operational signal only; never the job data (it carries decrypted secrets) [invariant 4].
    console.error(`run job failed runId=${job?.id ?? 'unknown'}: ${err.name}: ${err.message}`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`worker received ${signal}, draining`);
    await worker.close();
    await connection.quit();
    await closeDb();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  console.log(`worker listening on queue "${RUN_QUEUE}" (concurrency ${config.concurrency})`);
}

main().catch((err) => {
  console.error(`worker failed to start: ${err instanceof Error ? err.message : 'unknown error'}`);
  process.exit(1);
});
