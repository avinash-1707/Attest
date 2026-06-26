import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDiskUserAssetStore } from './user-assets-disk';

describe('disk user-asset store', () => {
  let root: string;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'attest-user-assets-'));
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('round-trips an avatar with the right content-type', async () => {
    const store = createDiskUserAssetStore({ root });
    const body = Buffer.from('webp-bytes');
    await store.putAvatar('user_1', body, 'webp');
    const got = await store.getAvatar('user_1');
    expect(got?.body.equals(body)).toBe(true);
    expect(got?.contentType).toBe('image/webp');
  });

  it('returns null for a user with no avatar', async () => {
    const store = createDiskUserAssetStore({ root });
    expect(await store.getAvatar('nobody')).toBeNull();
  });

  it('overwrites in place: a re-upload replaces, leaving no second object', async () => {
    const store = createDiskUserAssetStore({ root });
    await store.putAvatar('user_ow', Buffer.from('first'), 'png');
    await store.putAvatar('user_ow', Buffer.from('second'), 'webp');
    const got = await store.getAvatar('user_ow');
    expect(got?.body.toString()).toBe('second');
    expect(got?.contentType).toBe('image/webp');
    const files = await readdir(join(root, 'users', 'user_ow'));
    expect(files).toEqual(['avatar.webp']);
  });

  it('refuses putAvatar for a userId with a path separator before any fs access', async () => {
    const store = createDiskUserAssetStore({ root });
    await expect(store.putAvatar('a/../evil', Buffer.from('x'), 'webp')).rejects.toThrow();
  });

  it('refuses putAvatar for a userId of ..', async () => {
    const store = createDiskUserAssetStore({ root });
    await expect(store.putAvatar('..', Buffer.from('x'), 'webp')).rejects.toThrow();
  });

  it('refuses getAvatar for a traversal userId before any fs access', async () => {
    const store = createDiskUserAssetStore({ root });
    await expect(store.getAvatar('../../etc/passwd')).rejects.toThrow();
  });
});
