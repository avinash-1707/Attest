import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// The single AES-256-GCM primitive used for both layers of the envelope [tech-arch §6.2]: the KEK
// wraps a DEK, and the DEK seals secret values. A 96-bit random IV per call (safe for GCM at our
// volume) and the auth tag are packed with the ciphertext into one self-describing string.
const ALG = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
// v1 = no associated data; v2 = GCM AAD bound (e.g. the orgId), so a ciphertext is cryptographically
// tied to its context and cannot be opened under another org's key even if mis-routed [audit 2026-06-27
// M3]. v1 blobs stay decryptable, so existing sealed secrets need no re-encryption.
const VERSION_PLAIN = 'v1';
const VERSION_AAD = 'v2';

function toBuf(v: Buffer | string): Buffer {
  return typeof v === 'string' ? Buffer.from(v, 'utf8') : v;
}

export function gcmEncrypt(key: Buffer, plaintext: Buffer | string, aad?: Buffer | string): string {
  if (key.length !== KEY_BYTES) throw new Error('key must be 32 bytes (AES-256)');
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALG, key, iv);
  if (aad !== undefined) cipher.setAAD(toBuf(aad));
  const pt = toBuf(plaintext);
  const ct = Buffer.concat([cipher.update(pt), cipher.final()]);
  const tag = cipher.getAuthTag();
  const version = aad !== undefined ? VERSION_AAD : VERSION_PLAIN;
  return [version, iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join('.');
}

export function gcmDecrypt(key: Buffer, blob: string, aad?: Buffer | string): Buffer {
  if (key.length !== KEY_BYTES) throw new Error('key must be 32 bytes (AES-256)');
  const [version, ivB64, tagB64, ctB64] = blob.split('.');
  if ((version !== VERSION_PLAIN && version !== VERSION_AAD) || !ivB64 || !tagB64 || ctB64 === undefined) {
    throw new Error('malformed sealed secret');
  }
  const decipher = createDecipheriv(ALG, key, Buffer.from(ivB64, 'base64'));
  // A v2 blob was sealed with AAD, so the same AAD must be supplied to open it; the tag check fails
  // otherwise (wrong/missing context). A v1 blob predates AAD binding and takes none.
  if (version === VERSION_AAD) {
    if (aad === undefined) throw new Error('sealed secret requires associated data');
    decipher.setAAD(toBuf(aad));
  }
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]);
}
