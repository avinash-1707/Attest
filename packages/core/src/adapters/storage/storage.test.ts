import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDiskEvidenceStore } from './disk';

const ns = { orgId: 'org_1', appId: 'app_1' };

describe('disk evidence store', () => {
  let root: string;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'attest-storage-'));
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('round-trips identical bytes', async () => {
    const store = createDiskEvidenceStore({ root });
    const blob = Buffer.from('the quick brown fox');
    const ref = await store.put(ns, blob, 'dom_snapshot');
    const got = await store.get(ns, ref);
    expect(got.equals(blob)).toBe(true);
  });

  it('returns a ref matching the org/app/kind scheme', async () => {
    const store = createDiskEvidenceStore({ root });
    const ref = await store.put(ns, Buffer.from('png-bytes'), 'screenshot');
    expect(ref).toMatch(/^org_1\/app_1\/screenshot\/[^/]+\.png$/);
  });

  it('rejects a ref from a different org', async () => {
    const store = createDiskEvidenceStore({ root });
    const ref = await store.put(ns, Buffer.from('data'), 'console');
    const other = { orgId: 'org_2', appId: 'app_1' };
    await expect(store.get(other, ref)).rejects.toThrow();
  });

  it('rejects an unknown ref', async () => {
    const store = createDiskEvidenceStore({ root });
    const ref = `${ns.orgId}/${ns.appId}/screenshot/does-not-exist.png`;
    await expect(store.get(ns, ref)).rejects.toThrow();
  });

  it('rejects a traversal ref that would escape the namespace', async () => {
    const store = createDiskEvidenceStore({ root });
    const ref = 'org_1/app_1/../../org_2/app_2/screenshot/x.png';
    await expect(store.get(ns, ref)).rejects.toThrow();
  });

  it('rejects a prefix-collision ref (segment match, not string prefix)', async () => {
    const store = createDiskEvidenceStore({ root });
    // startsWith("org_1/app_1") would be fooled by app_10; segment-exact match must not be.
    const ref = 'org_1/app_10/screenshot/x.png';
    await expect(store.get({ orgId: 'org_1', appId: 'app_1' }, ref)).rejects.toThrow();
  });

  it('rejects a ref with an unknown kind segment', async () => {
    const store = createDiskEvidenceStore({ root });
    await expect(store.get(ns, 'org_1/app_1/secrets/x.png')).rejects.toThrow();
  });

  it('refuses a put for a tenant id containing a path separator', async () => {
    const store = createDiskEvidenceStore({ root });
    await expect(
      store.put({ orgId: 'org_1', appId: 'app/../evil' }, Buffer.from('x'), 'screenshot'),
    ).rejects.toThrow();
  });
});
