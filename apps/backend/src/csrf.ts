import type { FastifyInstance, FastifyRequest } from 'fastify';
import { bearerToken } from './context';
import { ApiError } from './errors';

// CSRF guard for the cookie/session door [security, Next up #3]. Better Auth runs its own origin check
// on /api/auth/*; this covers Attest's OWN state-changing routes, which Better Auth does not see.
//
// The threat is a browser silently attaching the session cookie to a cross-site request. Three facts
// close it: (1) CSRF needs an ambient credential - a request with no Cookie header carries no session
// for an attacker to ride, so it is not a CSRF vector and is not guarded; (2) the MCP/service-key door
// sends a Bearer token, which a browser never attaches ambiently, so a well-formed Bearer skips the
// check; (3) a forged cross-site request cannot set a trusted Origin, so a cookie-bearing state-
// changing request must present an Origin in the allowlist. GET/HEAD/OPTIONS are safe and not guarded.

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function requestOrigin(req: FastifyRequest): string | undefined {
  const origin = req.headers.origin;
  if (typeof origin === 'string' && origin.length > 0) return origin;
  // Fall back to the Referer's origin when Origin is absent (some same-origin navigations).
  const referer = req.headers.referer;
  if (typeof referer === 'string' && referer.length > 0) {
    try {
      return new URL(referer).origin;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export function registerCsrfGuard(app: FastifyInstance, opts: { trustedOrigins: string[] }): void {
  const allowed = new Set(opts.trustedOrigins);
  app.addHook('onRequest', async (req) => {
    if (SAFE_METHODS.has(req.method)) return;
    // Better Auth owns CSRF for its own routes.
    if (req.url.startsWith('/api/auth/')) return;
    // No ambient credential, no CSRF: a request without a Cookie header carries no session to ride.
    if (!req.headers.cookie) return;
    // The MCP/service-key door is CSRF-immune: a browser cannot ambiently send a Bearer token.
    if (bearerToken(req)) return;

    // A cookie-authed state-changing request must carry a trusted Origin. Fail closed: a missing or
    // untrusted Origin is rejected before any handler (and before the session is even resolved).
    const origin = requestOrigin(req);
    if (!origin || !allowed.has(origin)) {
      throw new ApiError(403, 'csrf_origin_rejected', 'Origin not allowed for a state-changing request');
    }
  });
}
