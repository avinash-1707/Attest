import type { Db } from './types';
import {
  forOrg,
  resolveServiceKey,
  resolveOrgByDodoCustomer,
  recordWebhookEvent,
  getUserOrgMemberships,
  getUserLastActiveOrg,
  setUserLastActiveOrg,
} from './org-scope';

// The tenant-scoped data-access layer [arch §5.2]. The only entry points: forOrg(orgId) for all
// tenant data, and the few legitimate non-org lookups whose RESULT is the org (service-key auth,
// Dodo webhook fulfillment) plus the system-scoped webhook dedupe.
export function createDataAccess(db: Db) {
  return {
    forOrg: (orgId: string) => forOrg(db, orgId),
    resolveServiceKey: (keyHash: string) => resolveServiceKey(db, keyHash),
    resolveOrgByDodoCustomer: (dodoCustomerId: string) => resolveOrgByDodoCustomer(db, dodoCustomerId),
    recordWebhookEvent: (input: { webhookId: string; eventType: string; status: string }) =>
      recordWebhookEvent(db, input),
    getUserOrgMemberships: (userId: string) => getUserOrgMemberships(db, userId),
    getUserLastActiveOrg: (userId: string) => getUserLastActiveOrg(db, userId),
    setUserLastActiveOrg: (userId: string, organizationId: string) =>
      setUserLastActiveOrg(db, userId, organizationId),
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
export type { CreditLedger } from './credit-ledger.repo';
export type { OrgBilling } from './org-billing.repo';
