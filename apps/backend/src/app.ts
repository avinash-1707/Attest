import Fastify, { type FastifyInstance } from 'fastify';
import { toNodeHandler } from 'better-auth/node';
import type { BackendDeps } from './deps';
import { registerErrorHandler } from './errors';
import { registerRunRoutes } from './routes/runs';

// Assembles the Fastify app from already-constructed deps. Pure wiring, so it builds and can be
// exercised via app.inject() with no live socket, db, or Redis.
export function buildApp(deps: BackendDeps): FastifyInstance {
  // Redact credential-bearing headers from request logs so a service key or session cookie can never
  // land in logs [invariant 4]. pino does not log these by default, but the redact makes it enforced.
  const app = Fastify({ logger: { redact: ['req.headers.authorization', 'req.headers.cookie'] } });

  registerErrorHandler(app);

  app.get('/health', async () => ({ status: 'ok' }));

  // Mount Better Auth as the /api/auth/* catch-all. Encapsulated in its own plugin scope so the raw
  // request stream reaches Better Auth (its content-type passthrough does not leak to /runs, which
  // still gets normal JSON parsing).
  app.register(async (scope) => {
    scope.addContentTypeParser('application/json', (_req, _payload, done) => done(null, null));
    const handler = toNodeHandler(deps.auth);
    scope.all('/api/auth/*', async (req, reply) => {
      reply.hijack();
      try {
        await handler(req.raw, reply.raw);
      } catch (err) {
        // hijack() detaches Fastify's reply lifecycle, so setErrorHandler will not run here. Without
        // this, a throw before the handler writes a response leaves the socket hanging until timeout.
        req.log.error({ err }, 'auth handler failed');
        if (!reply.raw.headersSent) {
          reply.raw.statusCode = 500;
          reply.raw.end('Internal Server Error');
        }
      }
    });
  });

  registerRunRoutes(app, deps);

  return app;
}
