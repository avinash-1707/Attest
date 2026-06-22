import { eq } from 'drizzle-orm';
import type { Db } from '../dal/types';
import { orgDek } from '../schema';
import { gcmEncrypt, gcmDecrypt } from './envelope';
import { generateDek, type KeyProvider } from './key-provider';

// Per-org seal/open of secret values: get-or-create the org DEK, unwrap it with the KeyProvider,
// then AES-256-GCM the value [tech-arch §6.2]. Used by the backend only - on write (seal) and at
// enqueue (open). Plaintext never reaches the DAL repos, which store only the sealed ciphertext.
export interface OrgCipher {
  seal(plaintext: string): Promise<string>;
  open(sealed: string): Promise<string>;
}

export function createSecretCipher(opts: { db: Db; keyProvider: KeyProvider }) {
  const { db, keyProvider } = opts;
  // Unwrapped DEKs cached in process memory (same trust level as the KEK [tech-arch §6.2]) so a
  // future KMS-backed KeyProvider is not hit on every secret. Cleared on restart.
  const dekCache = new Map<string, Buffer>();

  async function loadOrCreateDek(orgId: string): Promise<Buffer> {
    const [existing] = await db.select().from(orgDek).where(eq(orgDek.orgId, orgId));
    if (existing) return keyProvider.unwrapDek(existing.wrappedDek);
    const wrappedDek = await keyProvider.wrapDek(generateDek());
    const [inserted] = await db
      .insert(orgDek)
      .values({ orgId, wrappedDek, kekId: keyProvider.keyId })
      .onConflictDoNothing({ target: orgDek.orgId })
      .returning();
    if (inserted) return keyProvider.unwrapDek(inserted.wrappedDek);
    // A concurrent writer won the insert; ON CONFLICT waited for it to commit, so it is now visible.
    const [row] = await db.select().from(orgDek).where(eq(orgDek.orgId, orgId));
    if (!row) throw new Error('failed to persist org DEK');
    return keyProvider.unwrapDek(row.wrappedDek);
  }

  async function dekFor(orgId: string): Promise<Buffer> {
    const cached = dekCache.get(orgId);
    if (cached) return cached;
    const dek = await loadOrCreateDek(orgId);
    dekCache.set(orgId, dek);
    return dek;
  }

  return {
    for(orgId: string): OrgCipher {
      return {
        async seal(plaintext: string): Promise<string> {
          return gcmEncrypt(await dekFor(orgId), plaintext);
        },
        async open(sealed: string): Promise<string> {
          return gcmDecrypt(await dekFor(orgId), sealed).toString('utf8');
        },
      };
    },
  };
}

export type SecretCipher = ReturnType<typeof createSecretCipher>;
