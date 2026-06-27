import type { DataAccess } from '@attest/db';

// A short-TTL cache over getUserOrgMemberships, applied at the composition root so it is transparent to
// callers (the auth active-org resolver and the per-request M1 membership re-check in context.ts both
// benefit) [audit 2026-06-27 M1 follow-up]. The membership re-check runs on every session request, so an
// uncached DB round-trip per request is wasteful; membership changes are rare. The TTL bounds how long a
// removed member can still act to a few seconds (vs. the full session lifetime the check exists to fix),
// while collapsing the common steady-state case to an in-process lookup. Per-process + per-deps-instance,
// so it needs no cross-instance invalidation and stays isolated in tests.

const DEFAULT_TTL_MS = 30_000;

type Membership = Awaited<ReturnType<DataAccess['getUserOrgMemberships']>>;

export function withMembershipCache(dal: DataAccess, ttlMs: number = DEFAULT_TTL_MS): DataAccess {
  const cache = new Map<string, { value: Membership; expires: number }>();

  return {
    ...dal,
    async getUserOrgMemberships(userId: string): Promise<Membership> {
      const now = Date.now();
      const hit = cache.get(userId);
      if (hit && hit.expires > now) return hit.value;
      const value = await dal.getUserOrgMemberships(userId);
      cache.set(userId, { value, expires: now + ttlMs });
      return value;
    },
  };
}
