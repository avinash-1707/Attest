import type { FastifyInstance } from 'fastify';
import { runCreate, type Source } from '@attest/contracts';
import type { BackendDeps } from '../platform/deps';
import { resolveContext } from '../auth/context';
import { enqueueRun } from './enqueue';
import { ApiError } from '../platform/errors';

// POST /runs: the single run-create path, exercised by both auth doors [arch §4.1, invariant 1].
// Authenticate -> resolve org + app scope -> validate body -> scope-check -> enqueue.
export function registerRunRoutes(app: FastifyInstance, deps: BackendDeps): void {
  app.post('/runs', async (req, reply) => {
    const ctx = await resolveContext(req, { dal: deps.dal, auth: deps.auth });
    const body = runCreate.parse(req.body);

    // Fail-closed scope check. A session ('all') may target any app in its org (existence is enforced
    // org-scoped in enqueueRun); a service key may only target the apps it is scoped to.
    if (ctx.appScope.kind === 'list' && !ctx.appScope.appIds.includes(body.appId)) {
      throw new ApiError(403, 'app_forbidden', 'Not authorized for this app');
    }

    const source: Source = ctx.principal.kind === 'service_key' ? 'mcp' : 'dashboard';
    const result = await enqueueRun(
      { orgId: ctx.orgId },
      { appId: body.appId, goal: body.goal, url: body.url, source },
      {
        dal: deps.dal,
        cipher: deps.cipher,
        queue: deps.queue,
        modelDefaults: deps.modelDefaults,
        hostedApiKey: deps.config.openrouterApiKey,
      },
    );

    reply.status(202).send(result);
  });
}
