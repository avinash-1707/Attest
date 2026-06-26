// User-asset store: PUBLIC per-user identity blobs (avatars), keyed by the session userId only.
// Deliberately NOT an EvidenceStore: that interface is {orgId,appId}-bound, tenant-gated and
// read-only by design. Avatars live under a disjoint `users/` prefix on the SAME storage backend,
// with overwrite semantics (one object per user, no versioning/GC) [profile spec].
export type AvatarExt = 'png' | 'jpeg' | 'webp';

export interface UserAssetStore {
  putAvatar(userId: string, body: Buffer, ext: AvatarExt): Promise<void>;
  getAvatar(userId: string): Promise<{ body: Buffer; contentType: string } | null>;
}

export const AVATAR_CONTENT_TYPE: Record<AvatarExt, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

// The exts probed on read, since the stored ext is unknown at read time. Order is irrelevant; a
// user only ever has one avatar object (overwrite semantics).
export const AVATAR_EXTS: AvatarExt[] = ['webp', 'png', 'jpeg'];

// userId must be one opaque, safe path segment before it touches any path. This is the load-bearing
// traversal guard [profile spec]; it mirrors assertSegment in keys.ts so a crafted userId can never
// escape the `users/` prefix. Both the put and get paths route through here.
const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;

export function assertSafeUserId(userId: string): void {
  if (userId === '.' || userId === '..' || !SAFE_SEGMENT.test(userId)) {
    throw new Error('invalid userId segment');
  }
}

export function avatarKey(userId: string, ext: AvatarExt): string {
  assertSafeUserId(userId);
  return `users/${userId}/avatar.${ext}`;
}
