import multipart from '@fastify/multipart';
import type { FastifyInstance } from 'fastify';
import { avatarUploaded } from '@attest/contracts';
import { type AvatarExt, assertSafeUserId } from '@attest/core';
import type { BackendDeps } from './platform/deps';
import { resolveContext } from './auth/context';
import { ApiError } from './platform/errors';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const MIME_FOR_EXT: Record<AvatarExt, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};
const ALLOWED_MIME = new Set(Object.values(MIME_FOR_EXT));

// Magic-byte sniff: trust the bytes, never the declared MIME or the filename. The sniffed type is
// what decides the stored ext. Only the three allowed formats are recognized [profile spec].
function sniffAvatarExt(buf: Buffer): AvatarExt | null {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return 'png';
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'jpeg';
  }
  if (
    buf.length >= 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}

// The absolute public base the serve URL is built from: the backend's own public URL (where the
// auth catch-all is already mounted). Fail closed when unset rather than trusting the client Host
// header, since this URL is persisted into user.image by the dashboard.
function publicBaseUrl(deps: BackendDeps): string {
  const configured = deps.config.betterAuthUrl;
  if (!configured) {
    throw new ApiError(500, 'server_misconfigured', 'Backend public URL is not configured');
  }
  return configured.replace(/\/+$/, '');
}

export function registerMeRoutes(app: FastifyInstance, deps: BackendDeps): void {
  // Scope @fastify/multipart so it parses ONLY this subtree. Registering it app-wide would loosen
  // the app's JSON-only parsing for every route; here it stays contained, mirroring how app.ts
  // scopes better-auth's content-type parser.
  app.register(async (scope) => {
    scope.register(multipart, {
      limits: { fileSize: MAX_AVATAR_BYTES, files: 1, fields: 0 },
    });

    // POST /me/avatar - session-only self-service upload. A bearer/service-key principal is refused:
    // a service key runs attestations, never administers a user's own profile [arch §6.2].
    scope.post('/me/avatar', async (req, reply) => {
      const ctx = await resolveContext(req, deps);
      if (ctx.principal.kind !== 'session') {
        throw new ApiError(403, 'session_required', 'This endpoint requires a dashboard session');
      }
      const userId = ctx.principal.userId;

      // Read parts manually: exactly one file part, no fields, nothing extra. Iterating ourselves
      // lets us reject a second part as 400 rather than silently using the first.
      let buf: Buffer | undefined;
      let declaredMime: string | undefined;
      try {
        for await (const part of req.parts()) {
          if (part.type !== 'file') {
            throw new ApiError(400, 'invalid_upload', 'Expected exactly one file part');
          }
          if (buf !== undefined) {
            throw new ApiError(400, 'invalid_upload', 'Expected exactly one file part');
          }
          declaredMime = part.mimetype;
          buf = await part.toBuffer();
          if (part.file.truncated) {
            throw new ApiError(413, 'file_too_large', 'Avatar exceeds the 5MB limit');
          }
        }
      } catch (err) {
        if (err instanceof ApiError) throw err;
        // Match the stable error code, not the message. Only an over-size file is 413
        // (FST_REQ_FILE_TOO_LARGE); too many parts / extra fields / any other multipart error is a
        // malformed upload -> 400.
        if (err && typeof err === 'object' && 'code' in err && err.code === 'FST_REQ_FILE_TOO_LARGE') {
          throw new ApiError(413, 'file_too_large', 'Avatar exceeds the 5MB limit');
        }
        throw new ApiError(400, 'invalid_upload', 'Malformed multipart upload');
      }

      if (buf === undefined || declaredMime === undefined) {
        throw new ApiError(400, 'invalid_upload', 'Expected exactly one file part');
      }
      if (buf.length > MAX_AVATAR_BYTES) {
        throw new ApiError(413, 'file_too_large', 'Avatar exceeds the 5MB limit');
      }
      if (!ALLOWED_MIME.has(declaredMime)) {
        throw new ApiError(415, 'unsupported_media_type', 'Avatar must be png, jpeg, or webp');
      }

      // Sniff the bytes, then require the declared MIME to AGREE with them. A png-claimed webp (or
      // any spoofed type) is rejected: the ext is derived from the sniff, never the filename/MIME.
      const ext = sniffAvatarExt(buf);
      if (!ext || MIME_FOR_EXT[ext] !== declaredMime) {
        throw new ApiError(415, 'unsupported_media_type', 'Avatar bytes do not match a png, jpeg, or webp');
      }

      // userId is the session userId, server-side only - never read from the body or path.
      await deps.userAssets.putAvatar(userId, buf, ext);

      const base = publicBaseUrl(deps);
      const image = `${base}/avatars/${userId}?v=${Date.now()}`;
      return reply.send(avatarUploaded.parse({ image }));
    });
  });

  // GET /avatars/:userId - PUBLIC, un-gated identity data: no auth, no tenant gate [profile spec].
  // This route NEVER accepts a free-form storage key; it only ever builds users/{validatedUserId}/
  // avatar.* through the store. The `users/` prefix is disjoint from the evidence org/app/kind
  // namespace, so it can never address an evidence blob, even with a crafted :userId.
  app.get<{ Params: { userId: string } }>('/avatars/:userId', async (req, reply) => {
    try {
      assertSafeUserId(req.params.userId);
    } catch {
      throw new ApiError(400, 'invalid_request', 'Invalid avatar id');
    }

    const got = await deps.userAssets.getAvatar(req.params.userId);
    if (!got) {
      // Opaque 404: do not leak whether the user exists, only that no avatar is served.
      throw new ApiError(404, 'avatar_not_found', 'Avatar not found');
    }

    reply
      .header('content-type', got.contentType)
      .header('cache-control', 'public, max-age=31536000, immutable');
    return reply.send(got.body);
  });
}
