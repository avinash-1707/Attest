import type { DataAccess } from '@attest/db';

// Default-workspace resolution [arch §6.1]. A logged-in user must land in exactly one obvious place
// and never be forced to choose, so login resolves an active org deterministically instead of leaving
// the session orgless and bouncing the user to a picker. The rule is a pure function so every edge
// case (removed-from-org, deleted-org, multi-org, zero-membership) is unit-tested without a DB; the
// DB reads/writes live in the DAL [packages/db org-scope].

export interface Membership {
  organizationId: string;
  // Join time; the multi-org tiebreaker opens the workspace the user joined first.
  createdAt: Date;
}

export interface ResolveActiveOrgInput {
  // Persisted per-user last selection (user.lastActiveOrganizationId). Honored only if still a member.
  lastActiveOrganizationId?: string | null;
  // An explicitly requested org (e.g. an invite landing). Honored only if already a member; an
  // unaccepted invite is not a membership and falls through to the normal resolution.
  desiredOrganizationId?: string | null;
}

// Returns the org id to make active, or null when the user belongs to no org (caller routes to the
// create-workspace surface). Resolution order: desired -> last-selected -> sole org -> oldest-joined.
export function resolveActiveOrg(
  memberships: Membership[],
  input: ResolveActiveOrgInput = {},
): string | null {
  if (memberships.length === 0) return null;

  const ids = new Set(memberships.map((m) => m.organizationId));
  const { desiredOrganizationId, lastActiveOrganizationId } = input;

  if (desiredOrganizationId && ids.has(desiredOrganizationId)) return desiredOrganizationId;
  if (lastActiveOrganizationId && ids.has(lastActiveOrganizationId)) return lastActiveOrganizationId;

  // Deterministic oldest-joined; tiebreak on id so equal timestamps never pick at random. A sole
  // membership naturally wins. reduce (no seed) returns an element, not undefined; the empty case
  // already returned above.
  const oldest = memberships.reduce((a, b) => {
    const byTime = a.createdAt.getTime() - b.createdAt.getTime();
    if (byTime !== 0) return byTime < 0 ? a : b;
    return a.organizationId.localeCompare(b.organizationId) <= 0 ? a : b;
  });
  return oldest.organizationId;
}

// DB-bound resolver used by the session-create hook: loads memberships + persisted last selection via
// the DAL, then applies the pure rule. Returns null for a zero-membership user.
export async function loadDefaultActiveOrg(
  dal: DataAccess,
  userId: string,
  desiredOrganizationId?: string | null,
): Promise<string | null> {
  const [memberships, lastActiveOrganizationId] = await Promise.all([
    dal.getUserOrgMemberships(userId),
    dal.getUserLastActiveOrg(userId),
  ]);
  return resolveActiveOrg(memberships, { lastActiveOrganizationId, desiredOrganizationId });
}

// Persists the user's last-active org after a successful switch (session.update hook). Only called
// with a real org id, so a sign-out or active-org clear never nulls the durable pointer.
export async function persistLastActiveOrg(
  dal: DataAccess,
  userId: string,
  organizationId: string,
): Promise<void> {
  await dal.setUserLastActiveOrg(userId, organizationId);
}
