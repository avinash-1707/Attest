import type { EvidenceKind, EvidenceRef } from '@attest/contracts';
import type { TenantNamespace } from '../types';

// Storage adapter: object store (hosted) / local disk (self-hosted) behind one interface [tech-arch §3.4].
// Secrets are never written through this interface [arch §9, §10].
export interface EvidenceStore {
  // `id` is the object's identity segment within the tenant/kind namespace. When the caller passes a
  // stable id (run+step derived), a job re-delivery overwrites the same key idempotently and the
  // storageKey unique index dedupes the row; absent, a random id is minted [audit 2026-06-27 H3].
  put(ns: TenantNamespace, blob: Buffer, kind: EvidenceKind, id?: string): Promise<EvidenceRef>;
  get(ns: TenantNamespace, ref: EvidenceRef): Promise<Buffer>;
}

export type { UserAssetStore, AvatarExt } from './user-assets';
export { assertSafeUserId } from './user-assets';
