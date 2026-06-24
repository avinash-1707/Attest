import { describe, it, expect, vi } from 'vitest';
import type { DataAccess } from '@attest/db';
import { resolveActiveOrg, loadDefaultActiveOrg, persistLastActiveOrg, type Membership } from './active-org';

function m(organizationId: string, createdAtIso: string): Membership {
  return { organizationId, createdAt: new Date(createdAtIso) };
}

describe('resolveActiveOrg', () => {
  it('returns null for a zero-membership user (routes to create-workspace)', () => {
    expect(resolveActiveOrg([])).toBeNull();
  });

  it('returns the sole org for a single-membership user (never sees the picker)', () => {
    expect(resolveActiveOrg([m('org_a', '2025-01-01')])).toBe('org_a');
  });

  it('honors a valid last-selected org over the oldest-joined default', () => {
    const memberships = [m('org_old', '2024-01-01'), m('org_new', '2025-01-01')];
    expect(resolveActiveOrg(memberships, { lastActiveOrganizationId: 'org_new' })).toBe('org_new');
  });

  it('ignores a stale last-selected org the user no longer belongs to', () => {
    const memberships = [m('org_old', '2024-01-01'), m('org_new', '2025-01-01')];
    // org_gone was deleted / user removed -> fall through to oldest-joined.
    expect(resolveActiveOrg(memberships, { lastActiveOrganizationId: 'org_gone' })).toBe('org_old');
  });

  it('honors a valid desired org (invite landing) above last-selected', () => {
    const memberships = [m('org_a', '2024-01-01'), m('org_b', '2025-01-01')];
    expect(
      resolveActiveOrg(memberships, {
        desiredOrganizationId: 'org_b',
        lastActiveOrganizationId: 'org_a',
      }),
    ).toBe('org_b');
  });

  it('ignores a desired org that is not yet a membership (unaccepted invite)', () => {
    const memberships = [m('org_a', '2024-01-01')];
    expect(resolveActiveOrg(memberships, { desiredOrganizationId: 'org_pending' })).toBe('org_a');
  });

  it('picks the oldest-joined org for a multi-org user with no valid last/desired', () => {
    const memberships = [m('org_new', '2025-06-01'), m('org_old', '2023-01-01'), m('org_mid', '2024-03-01')];
    expect(resolveActiveOrg(memberships)).toBe('org_old');
  });

  it('breaks an equal-timestamp tie deterministically by org id', () => {
    const same = '2024-01-01T00:00:00.000Z';
    const a = resolveActiveOrg([m('org_b', same), m('org_a', same)]);
    const b = resolveActiveOrg([m('org_a', same), m('org_b', same)]);
    expect(a).toBe('org_a');
    expect(b).toBe('org_a');
  });
});

function fakeDal(memberships: Membership[], lastActive: string | null): DataAccess {
  return {
    getUserOrgMemberships: vi.fn(async () => memberships),
    getUserLastActiveOrg: vi.fn(async () => lastActive),
    setUserLastActiveOrg: vi.fn(async () => undefined),
  } as unknown as DataAccess;
}

describe('loadDefaultActiveOrg (wiring over the DAL)', () => {
  it('returns null for a zero-membership user', async () => {
    expect(await loadDefaultActiveOrg(fakeDal([], null), 'user_1')).toBeNull();
  });

  it('honors a valid persisted last-active org', async () => {
    const dal = fakeDal([m('org_a', '2024-01-01'), m('org_b', '2025-01-01')], 'org_b');
    expect(await loadDefaultActiveOrg(dal, 'user_1')).toBe('org_b');
  });

  it('ignores a stale last-active org and falls through to oldest-joined [invariant 3]', async () => {
    const dal = fakeDal([m('org_a', '2024-01-01'), m('org_b', '2025-01-01')], 'org_gone');
    expect(await loadDefaultActiveOrg(dal, 'user_1')).toBe('org_a');
  });
});

describe('persistLastActiveOrg', () => {
  it('writes the org through the DAL', async () => {
    const dal = fakeDal([], null);
    await persistLastActiveOrg(dal, 'user_1', 'org_a');
    expect(dal.setUserLastActiveOrg).toHaveBeenCalledWith('user_1', 'org_a');
  });
});
