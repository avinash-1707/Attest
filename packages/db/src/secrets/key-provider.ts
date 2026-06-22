import { randomBytes } from 'node:crypto';
import { gcmEncrypt, gcmDecrypt } from './envelope';

// The KEK backend, behind one interface so it is swappable without touching call sites [tech-arch §6.2].
// MVP uses an env-sourced KEK held in process memory; a server-side KMS (Vault Transit / AWS / GCP)
// can replace this later with the same wrapped-DEK encoding, making it a config change, not a re-encrypt.
export interface KeyProvider {
  readonly keyId: string;
  wrapDek(dek: Buffer): Promise<string>;
  unwrapDek(wrapped: string): Promise<Buffer>;
}

const KEY_BYTES = 32;

export const generateDek = (): Buffer => randomBytes(KEY_BYTES);

// Wraps/unwraps per-org DEKs with a KEK held in this process's memory. The KEK is never logged,
// never persisted, never returned [tech-arch §6.2]. Rotation requires a restart (accepted for MVP).
export function createEnvKeyProvider(kek: Buffer, keyId = 'env'): KeyProvider {
  if (kek.length !== KEY_BYTES) throw new Error('KEK must be 32 bytes (AES-256)');
  return {
    keyId,
    async wrapDek(dek: Buffer): Promise<string> {
      return gcmEncrypt(kek, dek);
    },
    async unwrapDek(wrapped: string): Promise<Buffer> {
      return gcmDecrypt(kek, wrapped);
    },
  };
}

// Sources the KEK from the deployment's own secret mechanism, injected at container launch
// [tech-arch §6.2]. Expects 32 raw bytes, base64-encoded. The caller (backend) constructs the
// provider; the data layer stays config-free.
export function kekFromEnv(value = process.env.ATTEST_KEK): Buffer {
  if (!value) throw new Error('ATTEST_KEK is not set');
  const kek = Buffer.from(value, 'base64');
  if (kek.length !== KEY_BYTES) throw new Error('ATTEST_KEK must decode to 32 bytes (base64 AES-256 key)');
  return kek;
}
