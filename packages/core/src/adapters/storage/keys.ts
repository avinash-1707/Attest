import type { EvidenceKind, EvidenceRef } from '@attest/contracts';
import type { TenantNamespace } from '../types';

export const EXT: Record<EvidenceKind, string> = {
  screenshot: 'png',
  dom_snapshot: 'html',
  a11y_tree: 'json',
  console: 'json',
  network: 'json',
  video: 'webm',
};

export const CONTENT_TYPE: Record<EvidenceKind, string> = {
  screenshot: 'image/png',
  dom_snapshot: 'text/html',
  a11y_tree: 'application/json',
  console: 'application/json',
  network: 'application/json',
  video: 'video/webm',
};

// orgId/appId/id must be opaque single path segments. Tenant isolation [invariant 3] depends on a
// ref never crossing a namespace boundary, so reject empty, dot-segments, and any path separator.
const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;

function assertSegment(label: string, value: string): void {
  if (value === '.' || value === '..' || !SAFE_SEGMENT.test(value)) {
    throw new Error(`invalid ${label} segment`);
  }
}

export function evidenceKey(ns: TenantNamespace, kind: EvidenceKind, id: string): EvidenceRef {
  assertSegment('orgId', ns.orgId);
  assertSegment('appId', ns.appId);
  assertSegment('id', id);
  return `${ns.orgId}/${ns.appId}/${kind}/${id}.${EXT[kind]}`;
}

// The single ownership gate for get() on both backends: segment-exact tenant match (not a string
// prefix), known kind, and every segment safe, so a crafted ref cannot read another tenant's blob
// or traverse out of the namespace. Disk also routes through its root check as defense in depth.
export function assertOwnedRef(ns: TenantNamespace, ref: EvidenceRef): void {
  assertSegment('orgId', ns.orgId);
  assertSegment('appId', ns.appId);
  const segments = ref.split('/');
  if (segments.length < 4) {
    throw new Error('evidence ref is malformed');
  }
  for (const segment of segments) {
    assertSegment('ref', segment);
  }
  const [org, app, kind] = segments;
  if (org !== ns.orgId || app !== ns.appId) {
    throw new Error('evidence ref is not owned by this tenant');
  }
  if (kind === undefined || !(kind in EXT)) {
    throw new Error('evidence ref has an unknown kind');
  }
}
