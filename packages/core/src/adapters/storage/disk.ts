import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { nanoid } from 'nanoid';
import type { EvidenceKind, EvidenceRef } from '@attest/contracts';
import type { TenantNamespace } from '../types';
import type { EvidenceStore } from './index';
import { assertOwnedRef, evidenceKey } from './keys';

export function createDiskEvidenceStore(opts: { root: string }): EvidenceStore {
  const root = resolve(opts.root);

  function pathFor(ref: EvidenceRef): string {
    const full = resolve(join(root, ref));
    const within = full === root || full.startsWith(root + sep);
    if (!within) {
      throw new Error('evidence ref escapes storage root');
    }
    return full;
  }

  return {
    async put(ns: TenantNamespace, blob: Buffer, kind: EvidenceKind): Promise<EvidenceRef> {
      const ref = evidenceKey(ns, kind, nanoid());
      const full = pathFor(ref);
      await mkdir(dirname(full), { recursive: true });
      await writeFile(full, blob);
      return ref;
    },

    async get(ns: TenantNamespace, ref: EvidenceRef): Promise<Buffer> {
      assertOwnedRef(ns, ref);
      return readFile(pathFor(ref));
    },
  };
}
