import { describe, it, expect, vi } from 'vitest';
import type { FastifyRequest } from 'fastify';
import type { DataAccess } from '@attest/db';
import { hashServiceKey, resolveServiceKeyContext } from './context';

function req(headers: Record<string, string>): FastifyRequest {
  return { headers } as unknown as FastifyRequest;
}

describe('hashServiceKey', () => {
  it('is a deterministic 64-char sha256 hex', () => {
    const h = hashServiceKey('ak_live_secret');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(hashServiceKey('ak_live_secret')).toBe(h);
    expect(hashServiceKey('other')).not.toBe(h);
  });
});

describe('resolveServiceKeyContext', () => {
  function dalWith(resolved: unknown, touch = vi.fn(async () => undefined)) {
    const dal = {
      resolveServiceKey: vi.fn(async () => resolved),
      forOrg: () => ({ appKeys: { touchLastUsed: touch } }),
    } as unknown as DataAccess;
    return { dal, touch };
  }

  it('resolves a valid bearer key to org + app scope and stamps last-used', async () => {
    const { dal, touch } = dalWith({ key: { id: 'k1', orgId: 'org_1' }, appIds: ['app_1', 'app_2'] });

    const ctx = await resolveServiceKeyContext(req({ authorization: 'Bearer ak_live_secret' }), dal);

    expect(ctx.orgId).toBe('org_1');
    expect(ctx.appScope).toEqual({ kind: 'list', appIds: ['app_1', 'app_2'] });
    expect(ctx.principal).toEqual({ kind: 'service_key', keyId: 'k1' });
    expect(touch).toHaveBeenCalledWith('k1');
    // It hashes the presented key before lookup, never passes the raw key.
    expect((dal.resolveServiceKey as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toBe(
      hashServiceKey('ak_live_secret'),
    );
  });

  it('401s a revoked/unknown key (DAL returns undefined)', async () => {
    const { dal } = dalWith(undefined);
    await expect(
      resolveServiceKeyContext(req({ authorization: 'Bearer nope' }), dal),
    ).rejects.toMatchObject({ statusCode: 401, code: 'unauthorized' });
  });

  it('401s a missing or malformed Authorization header', async () => {
    const { dal } = dalWith({ key: { id: 'k1', orgId: 'org_1' }, appIds: [] });
    await expect(resolveServiceKeyContext(req({}), dal)).rejects.toMatchObject({ statusCode: 401 });
    await expect(
      resolveServiceKeyContext(req({ authorization: 'Basic xyz' }), dal),
    ).rejects.toMatchObject({ statusCode: 401 });
  });
});
