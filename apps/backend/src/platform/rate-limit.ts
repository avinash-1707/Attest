import IORedis from 'ioredis';
import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { BackendDeps } from './deps';
import { bearerToken, hashServiceKey } from '../auth/context';
import { ApiError } from './errors';

// Perimeter HTTP rate limiting [security]. OFF in the OSS/self-host build (config.rateLimit.enabled),
// mirroring the unlimited-credit-gate posture; the hosted deploy opts in via RATE_LIMIT_ENABLED.
// Three buckets: a generous global IP net (registerRateLimit), a tight per-route cap on the
// credential auth endpoints (brute-force is the sharp edge), and a moderate cap on run-enqueue so a
// flood can't spin up browsers / saturate the queue. Fail-open on a Redis outage (skipOnError):
// Redis also backs the BullMQ queue, so a blip must not turn the front door fail-closed and lock
// everyone out [decision]. On exceed the plugin sets Retry-After / X-RateLimit-* headers and then
// THROWS the errorResponseBuilder result; returning an ApiError routes it through the house
// setErrorHandler so the 429 body is the same {code, message} shape as every other error [errors.ts].

const rateLimitedError = () => new ApiError(429, 'rate_limited', 'Too many requests, retry later');

// Key MCP/service-key traffic per key (the high-volume agent door), browser traffic per client IP.
// Both are synchronous: keying by org_id would force resolveContext (a DB/auth round-trip) in front
// of the limiter whose whole job is to shed load cheaply, so org-level fairness is deferred [plan].
function keyGenerator(req: FastifyRequest): string {
  const raw = bearerToken(req);
  return raw ? `k:${hashServiceKey(raw)}` : req.ip;
}

// better-auth credential/abuse endpoints that earn the tight bucket. Session polling (get-session)
// and other reads stay off it so the dashboard isn't throttled at the credential rate.
const SENSITIVE_AUTH = ['sign-in', 'sign-up', 'forget-password', 'reset-password', 'email-otp'];

function isSensitiveAuthPath(url: string): boolean {
  // Match the pathname only: a redirect/callback query (e.g. ?callbackURL=/sign-in) must not pull a
  // benign auth route into the tight bucket.
  const path = url.split('?', 1)[0] ?? url;
  return SENSITIVE_AUTH.some((p) => path.includes(p));
}

export function rateLimitEnabled(deps: BackendDeps): boolean {
  return deps.config.rateLimit?.enabled === true;
}

// Registers the global IP/key-keyed net. No-op when disabled, so the OSS build and existing tests are
// untouched. Uses the shared ioredis (deps.ts) as the store for cross-instance correctness; falls
// back to the plugin's in-memory store when no real client is wired (unit tests).
export function registerRateLimit(app: FastifyInstance, deps: BackendDeps): void {
  const cfg = deps.config.rateLimit;
  if (!cfg?.enabled) return;

  // hops=0 means req.ip is the socket peer. Behind a proxy that collapses every client onto the LB IP
  // -> a single global bucket that locks out all users at once. Warn loudly; a proxied hosted deploy
  // must set RATE_LIMIT_TRUST_PROXY_HOPS.
  if (cfg.trustProxyHops === 0) {
    app.log.warn(
      'rate limiting enabled with trustProxyHops=0: if the backend sits behind a proxy/LB, all clients share one IP bucket. Set RATE_LIMIT_TRUST_PROXY_HOPS to the real proxy-chain length.',
    );
  }

  const store = deps.redis instanceof IORedis ? deps.redis : undefined;

  app.register(rateLimit, {
    global: true,
    max: cfg.globalMax,
    timeWindow: '1 minute',
    ...(store ? { redis: store } : {}),
    nameSpace: 'attest-rl-',
    keyGenerator,
    skipOnError: true,
    errorResponseBuilder: () => rateLimitedError(),
  });
}

// Per-route override for the auth catch-all: a tight cap, applied ONLY to the sensitive credential
// paths (allowList bypasses everything else so it falls back to the global net). undefined when
// disabled so the route registers with no rate-limit config.
export function authRouteRateLimit(deps: BackendDeps) {
  if (!rateLimitEnabled(deps)) return undefined;
  return {
    max: deps.config.rateLimit.authMax,
    timeWindow: '1 minute',
    allowList: (req: FastifyRequest) => !isSensitiveAuthPath(req.url),
  };
}

// Per-route override for run-enqueue: a moderate cap, tighter than the global net.
export function enqueueRouteRateLimit(deps: BackendDeps) {
  if (!rateLimitEnabled(deps)) return undefined;
  return {
    max: deps.config.rateLimit.enqueueMax,
    timeWindow: '1 minute',
  };
}
