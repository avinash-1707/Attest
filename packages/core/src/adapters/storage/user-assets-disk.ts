import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import {
  AVATAR_CONTENT_TYPE,
  AVATAR_EXTS,
  type AvatarExt,
  type UserAssetStore,
  assertSafeUserId,
  avatarKey,
} from './user-assets';

export function createDiskUserAssetStore(opts: { root: string }): UserAssetStore {
  const root = resolve(opts.root);

  // Defense in depth on top of assertSafeUserId (already in avatarKey): even a safe segment must
  // resolve inside the storage root, mirroring the evidence disk store's within-root check.
  function pathFor(key: string): string {
    const full = resolve(join(root, key));
    const within = full === root || full.startsWith(root + sep);
    if (!within) {
      throw new Error('user asset key escapes storage root');
    }
    return full;
  }

  return {
    async putAvatar(userId: string, body: Buffer, ext: AvatarExt): Promise<void> {
      const full = pathFor(avatarKey(userId, ext));
      await mkdir(dirname(full), { recursive: true });
      await writeFile(full, body);
      // Overwrite semantics: one object per user. Drop any prior avatar in another format so a
      // format change does not leave a stale object the probe could resurface.
      for (const other of AVATAR_EXTS) {
        if (other === ext) continue;
        await rm(pathFor(avatarKey(userId, other)), { force: true });
      }
    },

    async getAvatar(userId: string): Promise<{ body: Buffer; contentType: string } | null> {
      assertSafeUserId(userId);
      for (const ext of AVATAR_EXTS) {
        try {
          const body = await readFile(pathFor(avatarKey(userId, ext)));
          return { body, contentType: AVATAR_CONTENT_TYPE[ext] };
        } catch (err) {
          // Missing object for this ext: try the next. A real I/O error (EACCES, EIO) must
          // surface, not masquerade as "no avatar".
          if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
            continue;
          }
          throw err;
        }
      }
      return null;
    },
  };
}
