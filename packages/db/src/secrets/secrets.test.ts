import { describe, it, expect, beforeEach } from 'vitest';
import { randomBytes } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from '../schema';
import { createDataAccess, type DataAccess } from '../dal';
import { gcmEncrypt, gcmDecrypt } from './envelope';
import { createEnvKeyProvider } from './key-provider';
import { createSecretCipher } from './cipher';

type Db = Parameters<typeof createSecretCipher>[0]['db'];

async function freshDb() {
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: 'migrations' });
  await db.insert(schema.organization).values([
    { id: 'org_a', name: 'A', slug: 'a', createdAt: new Date() },
    { id: 'org_b', name: 'B', slug: 'b', createdAt: new Date() },
  ]);
  return db as unknown as Db;
}

const KEK = randomBytes(32);

describe('envelope primitive (AES-256-GCM)', () => {
  it('round-trips, and rejects a tampered blob or wrong key', () => {
    const key = randomBytes(32);
    const sealed = gcmEncrypt(key, 'sk-or-v1-secret');
    expect(gcmDecrypt(key, sealed).toString('utf8')).toBe('sk-or-v1-secret');

    expect(() => gcmDecrypt(randomBytes(32), sealed)).toThrow();
    const tampered = sealed.slice(0, -2) + (sealed.endsWith('A') ? 'B' : 'A');
    expect(() => gcmDecrypt(key, tampered)).toThrow();
  });

  it('rejects a non-32-byte key', () => {
    expect(() => gcmEncrypt(randomBytes(16), 'x')).toThrow(/32 bytes/);
  });
});

describe('env key provider', () => {
  it('wraps and unwraps a DEK', async () => {
    const kp = createEnvKeyProvider(KEK);
    const dek = randomBytes(32);
    const wrapped = await kp.wrapDek(dek);
    expect(wrapped).not.toContain(dek.toString('base64'));
    expect((await kp.unwrapDek(wrapped)).equals(dek)).toBe(true);
  });

  it('rejects a bad KEK length', () => {
    expect(() => createEnvKeyProvider(randomBytes(8))).toThrow(/32 bytes/);
  });
});

describe('secret cipher (envelope at rest)', () => {
  let db: Db;
  beforeEach(async () => {
    db = await freshDb();
  });

  it('seals and opens per org, persisting one wrapped DEK', async () => {
    const cipher = createSecretCipher({ db, keyProvider: createEnvKeyProvider(KEK) });
    const sealed = await cipher.for('org_a').seal('hunter2');
    expect(sealed).not.toContain('hunter2');
    expect(await cipher.for('org_a').open(sealed)).toBe('hunter2');

    const deks = await db.select().from(schema.orgDek);
    expect(deks).toHaveLength(1);
    expect(deks[0]?.orgId).toBe('org_a');
    expect(deks[0]?.kekId).toBe('env');
  });

  it('uses a distinct DEK per org; one org cannot open another org sealed value', async () => {
    const cipher = createSecretCipher({ db, keyProvider: createEnvKeyProvider(KEK) });
    const sealedA = await cipher.for('org_a').seal('secret-a');
    await cipher.for('org_b').seal('secret-b');
    await expect(cipher.for('org_b').open(sealedA)).rejects.toThrow();
  });

  it('decrypts across a fresh cipher instance (DEK survives in DB, not just cache)', async () => {
    const sealed = await createSecretCipher({ db, keyProvider: createEnvKeyProvider(KEK) })
      .for('org_a')
      .seal('persisted');
    const reopened = await createSecretCipher({ db, keyProvider: createEnvKeyProvider(KEK) })
      .for('org_a')
      .open(sealed);
    expect(reopened).toBe('persisted');
  });
});

describe('secret repos store ciphertext only [arch §10, invariant 4]', () => {
  let dao: DataAccess;
  let db: Db;
  beforeEach(async () => {
    db = await freshDb();
    dao = createDataAccess(db as unknown as Parameters<typeof createDataAccess>[0]);
  });

  it('stores a BYOK model key as ciphertext and round-trips through the cipher', async () => {
    const cipher = createSecretCipher({ db, keyProvider: createEnvKeyProvider(KEK) });
    const ciphertext = await cipher.for('org_a').seal('sk-or-v1-realkey');
    const a = dao.forOrg('org_a');
    const mk = await a.modelKeys.create({
      label: 'prod',
      keyPrefix: 'sk-or-v1-...key',
      ciphertext,
    });

    const fetched = await a.modelKeys.get(mk.id);
    expect(fetched?.provider).toBe('openrouter');
    expect(fetched?.ciphertext).not.toContain('realkey');
    expect(await cipher.for('org_a').open(fetched!.ciphertext)).toBe('sk-or-v1-realkey');

    expect(await dao.forOrg('org_b').modelKeys.list()).toHaveLength(0);
  });

  it('stores app credentials sealed and refuses an app outside the org', async () => {
    const cipher = createSecretCipher({ db, keyProvider: createEnvKeyProvider(KEK) });
    const a = dao.forOrg('org_a');
    const app = await a.apps.create({ name: 'checkout' });
    const ciphertext = await cipher
      .for('org_a')
      .seal(JSON.stringify({ username: 'qa@app.com', password: 's3cret' }));

    const cred = await a.appCredentials.create({ appId: app.id, name: 'qa-user', ciphertext });
    const opened = JSON.parse(await cipher.for('org_a').open((await a.appCredentials.get(cred.id))!.ciphertext));
    expect(opened.password).toBe('s3cret');

    await expect(
      dao.forOrg('org_b').appCredentials.create({ appId: app.id, name: 'x', ciphertext }),
    ).rejects.toThrow(/not found in org/);
  });
});
