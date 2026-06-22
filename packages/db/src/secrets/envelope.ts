import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// The single AES-256-GCM primitive used for both layers of the envelope [tech-arch §6.2]: the KEK
// wraps a DEK, and the DEK seals secret values. A 96-bit random IV per call (safe for GCM at our
// volume) and the auth tag are packed with the ciphertext into one self-describing string.
const ALG = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const VERSION = 'v1';

export function gcmEncrypt(key: Buffer, plaintext: Buffer | string): string {
  if (key.length !== KEY_BYTES) throw new Error('key must be 32 bytes (AES-256)');
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALG, key, iv);
  const pt = typeof plaintext === 'string' ? Buffer.from(plaintext, 'utf8') : plaintext;
  const ct = Buffer.concat([cipher.update(pt), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join('.');
}

export function gcmDecrypt(key: Buffer, blob: string): Buffer {
  if (key.length !== KEY_BYTES) throw new Error('key must be 32 bytes (AES-256)');
  const [version, ivB64, tagB64, ctB64] = blob.split('.');
  if (version !== VERSION || !ivB64 || !tagB64 || ctB64 === undefined) {
    throw new Error('malformed sealed secret');
  }
  const decipher = createDecipheriv(ALG, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]);
}
