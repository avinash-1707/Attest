import type { FastifyInstance } from 'fastify';
import type { WebhookHeaders } from '@attest/contracts';
import type { BackendDeps } from '../platform/deps';

// The inbound Dodo Payments webhook [tech-arch §13.5]. Registered in its own plugin scope with a
// RAW-body parser: the default JSON parser would mutate the bytes and break HMAC verification. The
// handler verifies the Standard-Webhooks signature, dedupes, and applies the ledger effect; it returns
// the HTTP status (400 bad signature, 503 transient, 200 otherwise) and never throws. Unauthenticated
// at the session layer (Dodo holds no session) - authenticated solely by the signature. Carries no
// Cookie, so the app-wide CSRF guard does not apply [csrf.ts].
export function registerWebhookRoutes(app: FastifyInstance, deps: BackendDeps): void {
  app.register(async (scope) => {
    scope.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) =>
      done(null, body),
    );
    scope.post('/webhooks/dodo', async (req, reply) => {
      const headers: WebhookHeaders = {
        'webhook-id': String(req.headers['webhook-id'] ?? ''),
        'webhook-signature': String(req.headers['webhook-signature'] ?? ''),
        'webhook-timestamp': String(req.headers['webhook-timestamp'] ?? ''),
      };
      const raw = typeof req.body === 'string' ? req.body : '';
      const result = await deps.webhook.handle(raw, headers);
      reply.status(result.statusCode).send();
    });
  });
}
