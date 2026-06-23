import { loadConfig } from './platform/config';
import { createDeps } from './platform/deps';
import { buildApp } from './app';

// Entry: validate config (throws -> never binds), build deps + app, listen, drain on signal.
// Mirrors apps/worker/index.ts: server -> queue -> redis -> db on shutdown.
async function main(): Promise<void> {
  const config = loadConfig();
  const deps = await createDeps(config);
  const app = buildApp(deps);

  let closing = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (closing) return;
    closing = true;
    app.log.info({ signal }, 'backend shutting down');
    await app.close();
    await deps.queue.close();
    await deps.redis.quit();
    await deps.closeDb();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  await app.listen({ port: config.port, host: '0.0.0.0' });
  app.log.info({ port: config.port }, 'backend listening');
}

main().catch((err) => {
  console.error('backend failed to start', err);
  process.exit(1);
});
