import type { EvidenceKind, EvidenceRef } from '@attest/contracts';
import type { TenantNamespace } from '../types';

// Storage adapter: object store (hosted) / local disk (self-hosted) behind one interface [tech-arch §3.4].
// Secrets are never written through this interface [arch §9, §10].
export interface EvidenceStore {
  put(ns: TenantNamespace, blob: Buffer, kind: EvidenceKind): Promise<EvidenceRef>;
  get(ns: TenantNamespace, ref: EvidenceRef): Promise<Buffer>;
}

export type { UserAssetStore, AvatarExt } from './user-assets';
export { assertSafeUserId } from './user-assets';
