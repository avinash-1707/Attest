import type { Db } from './types';
import { forOrg, resolveServiceKey } from './org-scope';

// The tenant-scoped data-access layer [arch §5.2]. The only entry points: forOrg(orgId) for all
// tenant data, and resolveServiceKey(hash) for auth (the org is the lookup's result, not input).
export function createDataAccess(db: Db) {
  return {
    forOrg: (orgId: string) => forOrg(db, orgId),
    resolveServiceKey: (keyHash: string) => resolveServiceKey(db, keyHash),
  };
}

export type DataAccess = ReturnType<typeof createDataAccess>;

export type { Db } from './types';
export type { OrgScope, ResolvedServiceKey } from './org-scope';
export type { App } from './app.repo';
export type { AppKey } from './app-key.repo';
export type { Run } from './run.repo';
export type { EvidenceRefRow, NewEvidence } from './evidence.repo';
export type { UsageEvent } from './usage.repo';
export type { ModelKey } from './model-key.repo';
export type { AppCredential } from './app-credential.repo';
