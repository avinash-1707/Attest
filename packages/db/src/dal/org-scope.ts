import { and, eq, isNull } from 'drizzle-orm';
import type { Db } from './types';
import { appKey, appKeyApp, orgBilling, webhookEvent } from '../schema';
import { appRepo } from './app.repo';
import { appKeyRepo, type AppKey } from './app-key.repo';
import { runRepo } from './run.repo';
import { attestationRepo } from './attestation.repo';
import { evidenceRepo } from './evidence.repo';
import { usageRepo } from './usage.repo';
import { modelKeyRepo } from './model-key.repo';
import { appCredentialRepo } from './app-credential.repo';
import { creditLedgerRepo } from './credit-ledger.repo';
import { orgBillingRepo } from './org-billing.repo';

// Every repository here is pre-bound to one orgId. This is the only way to reach tenant data:
// there is no "all rows" path [arch §5.2, invariant 3].
export function forOrg(db: Db, orgId: string) {
  return {
    orgId,
    apps: appRepo(db, orgId),
    appKeys: appKeyRepo(db, orgId),
    runs: runRepo(db, orgId),
    attestations: attestationRepo(db, orgId),
    evidence: evidenceRepo(db, orgId),
    usage: usageRepo(db, orgId),
    modelKeys: modelKeyRepo(db, orgId),
    appCredentials: appCredentialRepo(db, orgId),
    // ee/ only; the OSS build never reads or writes the ledger [tech-arch §13].
    credits: creditLedgerRepo(db, orgId),
    orgBilling: orgBillingRepo(db, orgId),
  };
}

export type OrgScope = ReturnType<typeof forOrg>;

export type ResolvedServiceKey = { key: AppKey; appIds: string[] };

// The single legitimate cross-org lookup: given a presented key's hash, find which org it belongs
// to so the request can be scoped. By design it carries no orgId input (the org is the answer).
// Revoked/expired keys resolve to undefined. Everything downstream goes through forOrg(key.orgId).
export async function resolveServiceKey(
  db: Db,
  keyHash: string,
): Promise<ResolvedServiceKey | undefined> {
  const [key] = await db
    .select()
    .from(appKey)
    .where(and(eq(appKey.keyHash, keyHash), isNull(appKey.revokedAt)));
  if (!key) return undefined;
  if (key.expiresAt && key.expiresAt.getTime() <= Date.now()) return undefined;
  const scopes = await db
    .select({ appId: appKeyApp.appId })
    .from(appKeyApp)
    .where(eq(appKeyApp.appKeyId, key.id));
  return { key, appIds: scopes.map((s) => s.appId) };
}

// Resolve the org that owns a Dodo customer, for inbound webhook fulfillment [tech-arch §13.5]. Like
// resolveServiceKey, this is a legitimate non-org-scoped lookup whose RESULT is the org; everything
// downstream goes through forOrg(orgId). ee/ only.
export async function resolveOrgByDodoCustomer(
  db: Db,
  dodoCustomerId: string,
): Promise<string | undefined> {
  const [row] = await db
    .select({ orgId: orgBilling.orgId })
    .from(orgBilling)
    .where(eq(orgBilling.dodoCustomerId, dodoCustomerId));
  return row?.orgId;
}

// Record a verified webhook delivery for dedupe + audit [tech-arch §13.5]. Returns { fresh: false }
// when the webhook-id was already seen (a duplicate delivery), so the caller can skip re-processing.
// Idempotent on the webhook-id primary key. System-scoped (the event is pre-org-resolution).
export async function recordWebhookEvent(
  db: Db,
  input: { webhookId: string; eventType: string; status: string },
): Promise<{ fresh: boolean }> {
  const inserted = await db
    .insert(webhookEvent)
    .values({ webhookId: input.webhookId, eventType: input.eventType, status: input.status })
    .onConflictDoNothing({ target: webhookEvent.webhookId })
    .returning({ webhookId: webhookEvent.webhookId });
  return { fresh: inserted.length > 0 };
}
