import { createHash, randomBytes } from 'node:crypto';
import { fromNodeHeaders } from 'better-auth/node';
import type { FastifyRequest } from 'fastify';
import type { DataAccess } from '@attest/db';
import type { Auth } from './auth';
import { ApiError } from '../platform/errors';

// The single type both auth doors converge on [arch §6, invariant 1]. Past this boundary a request
// is just "an org plus the apps I may act on" - the route does not know which door it came through.
export type AppScope = { kind: 'all' } | { kind: 'list'; appIds: string[] };

export interface RequestContext {
  orgId: string;
  // 'all' = every app in the org (a dashboard session) [decision D8]; 'list' = the apps a service
  // key is scoped to. The route checks the target appId against this before enqueue.
  appScope: AppScope;
  // Audit tag only; never carries secret material.
  principal: { kind: 'session'; userId: string } | { kind: 'service_key'; keyId: string };
}

// Canonical service-key hashing. The stored app_key.keyHash is the SHA-256 hex of the presented key
// [tech-arch §6, db schema]; key creation (a later unit) must hash the same way.
export function hashServiceKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

// Mints a new service key at creation: the full secret (returned once) + its display prefix (stored,
// safe to show). Only the hash of `key` is persisted [arch §6.2, invariant 4].
export function generateServiceKey(): { key: string; prefix: string } {
  const key = `ak_live_${randomBytes(24).toString('base64url')}`;
  return { key, prefix: key.slice(0, 12) };
}

export function bearerToken(req: FastifyRequest): string | undefined {
  const header = req.headers.authorization;
  if (!header) return undefined;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return undefined;
  const trimmed = token.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

// MCP path. Hash the bearer key, resolve it to an org + app scope, stamp last-used. The DAL already
// filters revoked/expired keys, so a missing result is a 401 regardless of why [arch §6.2].
export async function resolveServiceKeyContext(req: FastifyRequest, dal: DataAccess): Promise<RequestContext> {
  const raw = bearerToken(req);
  if (!raw) throw new ApiError(401, 'unauthorized', 'Missing or malformed Authorization header');

  const resolved = await dal.resolveServiceKey(hashServiceKey(raw));
  if (!resolved) throw new ApiError(401, 'unauthorized', 'Invalid or revoked service key');

  await dal.forOrg(resolved.key.orgId).appKeys.touchLastUsed(resolved.key.id);

  return {
    orgId: resolved.key.orgId,
    appScope: { kind: 'list', appIds: resolved.appIds },
    principal: { kind: 'service_key', keyId: resolved.key.id },
  };
}

// The unified resolver the route uses. A Bearer token means the MCP/service-key door; its absence
// means the cookie-based dashboard session. The two paths stay strictly separate - a session cookie
// can never satisfy the bearer path, nor vice versa [security].
export async function resolveContext(
  req: FastifyRequest,
  deps: { dal: DataAccess; auth: Auth },
): Promise<RequestContext> {
  // Route on a well-formed Bearer token, not raw header presence: a session request carrying a stray
  // non-Bearer Authorization header (proxy/extension) must still fall through to the session path.
  if (bearerToken(req)) return resolveServiceKeyContext(req, deps.dal);
  return resolveSessionContext(req, deps.auth, deps.dal);
}

// Dashboard path. Resolve the Better Auth session and its active org. A valid session with no active
// org is a 403 (the user must select one); no session is a 401.
export async function resolveSessionContext(
  req: FastifyRequest,
  auth: Auth,
  dal: DataAccess,
): Promise<RequestContext> {
  const result = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!result?.session) throw new ApiError(401, 'unauthorized', 'No active session');

  const orgId = result.session.activeOrganizationId;
  if (!orgId) throw new ApiError(403, 'no_active_org', 'No active organization selected');

  // Re-validate live membership: a session cookie carries an activeOrganizationId stamped at login, but
  // a user removed from that org mid-session would otherwise keep acting in it until the session expires
  // [invariant 3, audit 2026-06-27 M1]. The active org must be one the user is still a member of.
  const memberships = await dal.getUserOrgMemberships(result.user.id);
  if (!memberships.some((m) => m.organizationId === orgId)) {
    throw new ApiError(403, 'no_active_org', 'No active organization selected');
  }

  return {
    orgId,
    appScope: { kind: 'all' },
    principal: { kind: 'session', userId: result.user.id },
  };
}
