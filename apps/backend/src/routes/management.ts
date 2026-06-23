import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  appCreate,
  appUpdate,
  appView,
  appKeyCreate,
  appKeyView,
  appKeyCreated,
  modelKeyCreate,
  modelKeyView,
  appCredentialCreate,
  appCredentialView,
} from '@attest/contracts';
import type { App, AppKey, ModelKey, AppCredential } from '@attest/db';
import type { BackendDeps } from '../deps';
import { resolveContext, hashServiceKey, generateServiceKey, type RequestContext } from '../context';
import { ApiError } from '../errors';

// Management API: org/app/key/secret administration. Session-only - a service key is for running
// attestations, never for self-administration [arch §6.2], so a bearer principal is refused.
// Every write that takes a secret seals it before it reaches the DAL [invariant 4]; every view
// projects to client-safe fields only.
//
// NOTE (deferred): fine-grained role gating (owner/admin/member per arch §6.1) is not enforced yet -
// any member with an active org may administer it. Add a member-role check when the member repo lands.

async function sessionCtx(req: FastifyRequest, deps: BackendDeps): Promise<RequestContext> {
  const ctx = await resolveContext(req, deps);
  if (ctx.principal.kind !== 'session') {
    throw new ApiError(403, 'session_required', 'This endpoint requires a dashboard session');
  }
  return ctx;
}

// The DAL throws a plain Error when a request references an app outside the org; surface it as a 400
// rather than an opaque 500 (it is a client-supplied bad appId, not a backend fault).
function mapAppScopeError(err: unknown): never {
  if (err instanceof Error && /(outside this org|not found in org)/.test(err.message)) {
    throw new ApiError(400, 'invalid_app', 'A referenced app is not in your org');
  }
  throw err;
}

function toAppView(a: App) {
  return appView.parse({
    id: a.id,
    name: a.name,
    allowlist: a.allowlist,
    archivedAt: a.archivedAt?.toISOString() ?? null,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  });
}

function toAppKeyView(k: AppKey & { appIds: string[] }) {
  return appKeyView.parse({
    id: k.id,
    name: k.name,
    keyPrefix: k.keyPrefix,
    appIds: k.appIds,
    lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
    revokedAt: k.revokedAt?.toISOString() ?? null,
    expiresAt: k.expiresAt?.toISOString() ?? null,
    createdAt: k.createdAt.toISOString(),
  });
}

function toModelKeyView(k: ModelKey) {
  return modelKeyView.parse({
    id: k.id,
    label: k.label,
    provider: k.provider,
    keyPrefix: k.keyPrefix,
    createdAt: k.createdAt.toISOString(),
  });
}

function toCredentialView(c: AppCredential) {
  return appCredentialView.parse({
    id: c.id,
    appId: c.appId,
    name: c.name,
    createdAt: c.createdAt.toISOString(),
  });
}

export function registerManagementRoutes(app: FastifyInstance, deps: BackendDeps): void {
  // --- Apps ---
  app.post('/apps', async (req, reply) => {
    const ctx = await sessionCtx(req, deps);
    const body = appCreate.parse(req.body);
    const created = await deps.dal.forOrg(ctx.orgId).apps.create(body);
    reply.status(201).send(toAppView(created));
  });

  app.get('/apps', async (req) => {
    const ctx = await sessionCtx(req, deps);
    const apps = await deps.dal.forOrg(ctx.orgId).apps.list();
    return { apps: apps.map(toAppView) };
  });

  app.patch<{ Params: { id: string } }>('/apps/:id', async (req) => {
    const ctx = await sessionCtx(req, deps);
    const body = appUpdate.parse(req.body);
    const updated = await deps.dal.forOrg(ctx.orgId).apps.update(req.params.id, body);
    if (!updated) throw new ApiError(404, 'app_not_found', 'App not found');
    return toAppView(updated);
  });

  app.delete<{ Params: { id: string } }>('/apps/:id', async (req, reply) => {
    const ctx = await sessionCtx(req, deps);
    await deps.dal.forOrg(ctx.orgId).apps.archive(req.params.id);
    reply.status(204).send();
  });

  // --- Service keys ---
  app.post('/keys', async (req, reply) => {
    const ctx = await sessionCtx(req, deps);
    const body = appKeyCreate.parse(req.body);
    const { key, prefix } = generateServiceKey();
    const row = await deps.dal
      .forOrg(ctx.orgId)
      .appKeys.create({
        name: body.name,
        keyHash: hashServiceKey(key),
        keyPrefix: prefix,
        appIds: body.appIds,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      })
      .catch(mapAppScopeError);
    // The only response that carries the plaintext key, returned once [arch §6.2].
    reply.status(201).send(
      appKeyCreated.parse({
        id: row.id,
        name: row.name,
        keyPrefix: row.keyPrefix,
        appIds: body.appIds,
        lastUsedAt: null,
        revokedAt: null,
        expiresAt: row.expiresAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        key,
      }),
    );
  });

  app.get('/keys', async (req) => {
    const ctx = await sessionCtx(req, deps);
    const keys = await deps.dal.forOrg(ctx.orgId).appKeys.listWithScopes();
    return { keys: keys.map(toAppKeyView) };
  });

  app.delete<{ Params: { id: string } }>('/keys/:id', async (req, reply) => {
    const ctx = await sessionCtx(req, deps);
    await deps.dal.forOrg(ctx.orgId).appKeys.revoke(req.params.id);
    reply.status(204).send();
  });

  // --- BYOK model keys (seal-on-write) ---
  app.post('/model-keys', async (req, reply) => {
    const ctx = await sessionCtx(req, deps);
    const body = modelKeyCreate.parse(req.body);
    const ciphertext = await deps.cipher.for(ctx.orgId).seal(body.key);
    const row = await deps.dal.forOrg(ctx.orgId).modelKeys.create({
      label: body.label,
      provider: body.provider,
      keyPrefix: body.key.slice(0, 8),
      ciphertext,
    });
    reply.status(201).send(toModelKeyView(row));
  });

  app.get('/model-keys', async (req) => {
    const ctx = await sessionCtx(req, deps);
    const keys = await deps.dal.forOrg(ctx.orgId).modelKeys.list();
    return { modelKeys: keys.map(toModelKeyView) };
  });

  app.delete<{ Params: { id: string } }>('/model-keys/:id', async (req, reply) => {
    const ctx = await sessionCtx(req, deps);
    await deps.dal.forOrg(ctx.orgId).modelKeys.delete(req.params.id);
    reply.status(204).send();
  });

  // --- App login credentials (seal-on-write) ---
  app.post('/credentials', async (req, reply) => {
    const ctx = await sessionCtx(req, deps);
    const body = appCredentialCreate.parse(req.body);
    const ciphertext = await deps.cipher.for(ctx.orgId).seal(body.value);
    const row = await deps.dal
      .forOrg(ctx.orgId)
      .appCredentials.create({ appId: body.appId, name: body.name, ciphertext })
      .catch(mapAppScopeError);
    reply.status(201).send(toCredentialView(row));
  });

  app.get<{ Querystring: { appId?: string } }>('/credentials', async (req) => {
    const ctx = await sessionCtx(req, deps);
    const appId = req.query.appId;
    const creds = await deps.dal.forOrg(ctx.orgId).appCredentials.list(appId ? { appId } : undefined);
    return { credentials: creds.map(toCredentialView) };
  });

  app.delete<{ Params: { id: string } }>('/credentials/:id', async (req, reply) => {
    const ctx = await sessionCtx(req, deps);
    await deps.dal.forOrg(ctx.orgId).appCredentials.delete(req.params.id);
    reply.status(204).send();
  });
}
