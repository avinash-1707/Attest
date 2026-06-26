import { z } from 'zod';
import { runStatus, runLifecycle, source, evidenceKind } from './enums';

// API DTOs: the HTTP request/response shapes for apps/backend [tech-arch §2.1, §2.2].
// Distinct from the MCP tool I/O (tools.ts) and the internal queue message (job.ts).
//
// View (response) DTOs project storage rows to client-safe fields ONLY. They never carry a secret:
// no `ciphertext`, no `keyHash`, no decrypted value [invariant 4]. Zod strips unknown keys by
// default, so parsing a raw row through a *View also drops any secret column as a safety net.
// The single deliberate exception is appKeyCreated.key (the service key shown ONCE at creation,
// arch §6.2) and the *Create request bodies that carry an inbound secret to be sealed server-side.

// ---------------------------------------------------------------------------
// Run create (the write path; already consumed by POST /runs)
// ---------------------------------------------------------------------------

// POST /runs body. The dashboard and MCP both post this; the backend resolves the app's secrets
// (model key + credentials) server-side, so the caller names no secret [arch §10].
export const runCreate = z.object({
  appId: z.string().min(1),
  goal: z.string().min(1),
  url: z.url(),
});
export type RunCreate = z.infer<typeof runCreate>;

// POST /runs response: the allocated runId. A freshly enqueued run is always 'queued'; verdict
// status (passed/failed/inconclusive) lands on the attestation later, via the read API.
export const runCreated = z.object({
  runId: z.string().min(1),
  status: z.literal('queued'),
});
export type RunCreated = z.infer<typeof runCreated>;

// ---------------------------------------------------------------------------
// Read API
// ---------------------------------------------------------------------------

// GET /runs/:id - operational + verdict status. `lifecycle` is queue/exec state (for live-watch);
// `status` is the verdict, null until the attestation is written [tech-arch §4.3, §5].
export const runStatusView = z.object({
  runId: z.string().min(1),
  appId: z.string().min(1),
  source,
  goal: z.string().min(1),
  url: z.url(),
  lifecycle: runLifecycle,
  status: runStatus.nullable(),
  attempt: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  startedAt: z.iso.datetime().nullable(),
  finishedAt: z.iso.datetime().nullable(),
  durationMs: z.number().int().nonnegative().nullable(),
  // Operational error summary only (never a secret/evidence payload) [invariant 4].
  error: z.string().nullable(),
});
export type RunStatusView = z.infer<typeof runStatusView>;

// GET /runs - history listing item (a compact projection of runStatusView).
export const runListItem = z.object({
  runId: z.string().min(1),
  appId: z.string().min(1),
  goal: z.string().min(1),
  lifecycle: runLifecycle,
  status: runStatus.nullable(),
  createdAt: z.iso.datetime(),
  durationMs: z.number().int().nonnegative().nullable(),
});
export type RunListItem = z.infer<typeof runListItem>;

export const runList = z.object({ runs: z.array(runListItem) });
export type RunList = z.infer<typeof runList>;

// GET /runs/:id/evidence and /evidence/:ref - resolve an opaque ref to its metadata + a fetch URL.
// The ref is resolved by storageKey server-side; the bytes are served via `url`, never inlined
// [arch §8 G5, §9]. Tenant-checked: a ref outside the caller's org does not resolve [invariant 3].
export const evidenceRefView = z.object({
  ref: z.string().min(1),
  kind: evidenceKind,
  stepIndex: z.number().int().nonnegative().nullable(),
  contentType: z.string().min(1).nullable(),
  bytes: z.number().int().nonnegative().nullable(),
  url: z.string().min(1),
});
export type EvidenceRefView = z.infer<typeof evidenceRefView>;

export const evidenceList = z.object({ evidence: z.array(evidenceRefView) });
export type EvidenceList = z.infer<typeof evidenceList>;

// ---------------------------------------------------------------------------
// Management: App
// ---------------------------------------------------------------------------

export const appCreate = z.object({
  name: z.string().min(1),
  allowlist: z.array(z.string().min(1)).optional(),
});
export type AppCreate = z.infer<typeof appCreate>;

export const appUpdate = z.object({
  name: z.string().min(1).optional(),
  allowlist: z.array(z.string().min(1)).optional(),
});
export type AppUpdate = z.infer<typeof appUpdate>;

export const appView = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  allowlist: z.array(z.string()),
  archivedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type AppView = z.infer<typeof appView>;

// ---------------------------------------------------------------------------
// Management: Service key (app_key)
// ---------------------------------------------------------------------------

export const appKeyCreate = z.object({
  name: z.string().min(1),
  // The apps this key may run against [arch §6.2]; at least one.
  appIds: z.array(z.string().min(1)).min(1),
  expiresAt: z.iso.datetime().optional(),
});
export type AppKeyCreate = z.infer<typeof appKeyCreate>;

// View: never the keyHash; keyPrefix is the safe display value [invariant 4].
export const appKeyView = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  keyPrefix: z.string().min(1),
  appIds: z.array(z.string()),
  lastUsedAt: z.iso.datetime().nullable(),
  revokedAt: z.iso.datetime().nullable(),
  expiresAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});
export type AppKeyView = z.infer<typeof appKeyView>;

// Create response: the plaintext key, returned ONCE at creation and never again [arch §6.2].
// This is the single legitimate secret-bearing response in the API.
export const appKeyCreated = appKeyView.extend({
  key: z.string().min(1),
});
export type AppKeyCreated = z.infer<typeof appKeyCreated>;

// ---------------------------------------------------------------------------
// Management: BYOK model key
// ---------------------------------------------------------------------------

// Request carries the plaintext key inbound; the backend seals it before store, never persisting
// plaintext [invariant 4]. provider defaults to openrouter server-side.
export const modelKeyCreate = z.object({
  label: z.string().min(1),
  provider: z.string().min(1).optional(),
  key: z.string().min(1),
});
export type ModelKeyCreate = z.infer<typeof modelKeyCreate>;

// View: label/provider/keyPrefix only; never the ciphertext [invariant 4].
export const modelKeyView = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  provider: z.string().min(1),
  keyPrefix: z.string().min(1),
  createdAt: z.iso.datetime(),
});
export type ModelKeyView = z.infer<typeof modelKeyView>;

// ---------------------------------------------------------------------------
// Management: App login credential
// ---------------------------------------------------------------------------

// Request carries the plaintext value inbound; sealed server-side before store [invariant 4].
export const appCredentialCreate = z.object({
  appId: z.string().min(1),
  name: z.string().min(1),
  value: z.string().min(1),
});
export type AppCredentialCreate = z.infer<typeof appCredentialCreate>;

// View: name + ownership only; never the ciphertext/value [invariant 4].
export const appCredentialView = z.object({
  id: z.string().min(1),
  appId: z.string().min(1),
  name: z.string().min(1),
  createdAt: z.iso.datetime(),
});
export type AppCredentialView = z.infer<typeof appCredentialView>;

// ---------------------------------------------------------------------------
// Profile: avatar upload
// ---------------------------------------------------------------------------

// POST /me/avatar is the system's FIRST non-JSON request surface: the body is multipart binary
// (the raw image), so it has no zod request schema. Only the response is validated, here. `image`
// is the absolute public serve URL with a ?v= cache-bust appended on each upload.
export const avatarUploaded = z.object({ image: z.string().url() });
export type AvatarUploaded = z.infer<typeof avatarUploaded>;

// ---------------------------------------------------------------------------
// Billing: summary read + checkout/portal (hosted tier; ee/ fulfills) [tech-arch §13.6]
// ---------------------------------------------------------------------------

// Read model for the dashboard billing view. Carries no secret: planId/status are opaque references
// and balance is the live ledger SUM. `enabled` is false on the OSS/self-hosted build (unlimited, no
// metering), letting the UI show "unlimited" instead of a meaningless zero balance.
export const billingSummary = z.object({
  enabled: z.boolean(),
  planId: z.string().nullable(),
  subscriptionStatus: z.string().nullable(),
  balance: z.number().int(),
});
export type BillingSummary = z.infer<typeof billingSummary>;

// Request to open a hosted checkout: subscribe to a plan, or buy a one-time credit pack.
export const checkoutCreate = z.object({
  kind: z.enum(['plan', 'pack']),
  planId: z.string().min(1),
});
export type CheckoutCreate = z.infer<typeof checkoutCreate>;

// Response for checkout + portal: a hosted URL the client redirects to.
export const checkoutSession = z.object({ url: z.string().min(1) });
export type CheckoutSession = z.infer<typeof checkoutSession>;
