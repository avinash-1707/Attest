import { describe, it, expect, vi } from 'vitest';
import type { DataAccess } from '@attest/db';
import { withMembershipCache } from './membership-cache';

function fakeDal(): { dal: DataAccess; spy: ReturnType<typeof vi.fn> } {
  const spy = vi.fn(async (_userId: string) => [{ organizationId: 'org_1', createdAt: new Date() }]);
  const dal = { getUserOrgMemberships: spy } as unknown as DataAccess;
  return { dal, spy };
}

describe('withMembershipCache', () => {
  it('serves repeated lookups for the same user from cache within the TTL (one DB hit)', async () => {
    const { dal, spy } = fakeDal();
    const cached = withMembershipCache(dal, 30_000);

    const a = await cached.getUserOrgMemberships('u1');
    const b = await cached.getUserOrgMemberships('u1');

    expect(spy).toHaveBeenCalledTimes(1);
    expect(b).toEqual(a);
  });

  it('caches per user (a different user is a separate fetch)', async () => {
    const { dal, spy } = fakeDal();
    const cached = withMembershipCache(dal, 30_000);

    await cached.getUserOrgMemberships('u1');
    await cached.getUserOrgMemberships('u2');

    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('refetches once the entry expires', async () => {
    const { dal, spy } = fakeDal();
    const cached = withMembershipCache(dal, 0); // expires immediately

    await cached.getUserOrgMemberships('u1');
    await cached.getUserOrgMemberships('u1');

    expect(spy).toHaveBeenCalledTimes(2);
  });
});
