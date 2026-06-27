import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { toNodeHandler } from 'better-auth/node';
import type { BackendDeps } from './platform/deps';
import { registerErrorHandler } from './platform/errors';
import { registerRateLimit, authRouteRateLimit } from './platform/rate-limit';
import { registerCsrfGuard } from './auth/csrf';
import { registerRunRoutes } from './runs/runs.routes';
import { registerReadRoutes } from './runs/reads.routes';
import { registerEvidenceRoutes } from './evidence/evidence.routes';
import { registerManagementRoutes } from './management/management.routes';
import { registerMeRoutes } from './me.routes';
import { registerWebhookRoutes } from './billing/webhook.routes';
import { registerBillingRoutes } from './billing/billing.routes';

// Assembles the Fastify app from already-constructed deps. Pure wiring, so it builds and can be
// exercised via app.inject() with no live socket, db, or Redis.
export function buildApp(deps: BackendDeps): FastifyInstance {
  // Redact credential-bearing headers from request logs so a service key or session cookie can never
  // land in logs [invariant 4]. pino does not log these by default, but the redact makes it enforced.
  // trustProxy MUST be a hop count, never `true`: behind exactly N proxies Fastify walks
  // X-Forwarded-For from the right by N trusted hops to find the real client IP, so the rate-limit
  // key can't be spoofed by a forged left-most XFF entry, nor collapsed onto the proxy's own IP.
  // Defaults to 0 (no proxy) for self-host; the hosted deploy sets RATE_LIMIT_TRUST_PROXY_HOPS [security].
  const trustProxyHops = deps.config.rateLimit?.trustProxyHops ?? 0;
  const app = Fastify({
    logger: {
      redact: ['req.headers.authorization', 'req.headers.cookie', 'req.headers["webhook-signature"]'],
    },
    trustProxy: trustProxyHops > 0 ? trustProxyHops : false,
  });

  registerErrorHandler(app);

  // CORS for the cross-origin dashboard: only trusted origins, with credentials so the session cookie
  // is sent/accepted. An empty allowlist denies all cross-origin requests (fail closed). The matching
  // CSRF guard below covers state-changing cookie requests; together they gate the session door.
  app.register(cors, {
    origin: deps.config.trustedOrigins.length > 0 ? deps.config.trustedOrigins : false,
    credentials: true,
  });

  registerCsrfGuard(app, { trustedOrigins: deps.config.trustedOrigins });

  // The global net. Registered after CORS/CSRF and before any route so its onRequest hook covers
  // every route below, including the hijacked auth catch-all (hijack runs at the handler stage,
  // after onRequest, so a throttled auth request is rejected before the password-hash path runs).
  registerRateLimit(app, deps);

  // Health checks must never 429.
  app.get('/health', { config: { rateLimit: false } }, async () => ({ status: 'ok' }));

  // Mount Better Auth as the /api/auth/* catch-all. Encapsulated in its own plugin scope so the raw
  // request stream reaches Better Auth (its content-type passthrough does not leak to /runs, which
  // still gets normal JSON parsing).
  app.register(async (scope) => {
    scope.addContentTypeParser('application/json', (_req, _payload, done) => done(null, null));
    const handler = toNodeHandler(deps.auth);
    const allowedOrigins = new Set(deps.config.trustedOrigins);
    // Tight per-route cap on the credential endpoints (sign-in/sign-up/reset/otp) only; other auth
    // paths (e.g. session polling) bypass it via the limiter's allowList and stay on the global net.
    const authRl = authRouteRateLimit(deps);
    scope.all('/api/auth/*', authRl ? { config: { rateLimit: authRl } } : {}, async (req, reply) => {
      // reply.hijack() detaches Fastify's reply, so @fastify/cors (which sets headers on the Fastify
      // reply) never reaches this raw response. Mirror its credentialed allow-origin onto reply.raw,
      // gated on the same trustedOrigins, or the browser blocks the auth response on register/sign-in.
      const origin = req.headers.origin;
      if (origin && allowedOrigins.has(origin)) {
        reply.raw.setHeader('access-control-allow-origin', origin);
        reply.raw.setHeader('access-control-allow-credentials', 'true');
        reply.raw.setHeader('vary', 'Origin');
      }
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

  // @fastify/rate-limit attaches to a route via an onRoute hook, which only sees routes registered
  // AFTER the plugin has loaded. registerRateLimit registers the plugin via app.register (deferred to
  // boot), but these routes are added synchronously - so without deferring them too they would load
  // first and escape the limiter entirely (including the enqueue cap on /runs). app.after runs this
  // past the plugin load, on the root instance (no new encapsulation). The auth + webhook scopes are
  // already deferred (app.register), so they need no wrapping.
  app.after(() => {
    registerRunRoutes(app, deps);
    registerReadRoutes(app, deps);
    registerEvidenceRoutes(app, deps);
    registerManagementRoutes(app, deps);
    registerMeRoutes(app, deps);
    registerBillingRoutes(app, deps);
  });
  registerWebhookRoutes(app, deps);

  return app;
}
