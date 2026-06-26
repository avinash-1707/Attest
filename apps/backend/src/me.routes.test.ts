import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildApp } from './app';
import type { BackendDeps } from './platform/deps';

let getSession: ReturnType<typeof vi.fn>;
let putAvatar: ReturnType<typeof vi.fn>;
let getAvatar: ReturnType<typeof vi.fn>;

const BOUNDARY = 'testboundary123';

// Build a multipart/form-data body with a single (or extra) file part.
function multipartBody(
  parts: { name: string; filename?: string; contentType?: string; data: Buffer | string }[],
): Buffer {
  const chunks: Buffer[] = [];
  for (const p of parts) {
    let header = `--${BOUNDARY}\r\nContent-Disposition: form-data; name="${p.name}"`;
    if (p.filename) header += `; filename="${p.filename}"`;
    header += '\r\n';
    if (p.contentType) header += `Content-Type: ${p.contentType}\r\n`;
    header += '\r\n';
    chunks.push(Buffer.from(header, 'utf8'));
    chunks.push(typeof p.data === 'string' ? Buffer.from(p.data) : p.data);
    chunks.push(Buffer.from('\r\n', 'utf8'));
  }
  chunks.push(Buffer.from(`--${BOUNDARY}--\r\n`, 'utf8'));
  return Buffer.concat(chunks);
}

const webpBytes = Buffer.concat([
  Buffer.from('RIFF', 'ascii'),
  Buffer.from([0x00, 0x00, 0x00, 0x00]),
  Buffer.from('WEBP', 'ascii'),
  Buffer.from('payload-bytes'),
]);
const pngBytes = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('png-payload'),
]);
const jpegBytes = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.from('jpeg-payload'),
]);

function makeDeps(): BackendDeps {
  getSession = vi.fn(async () => ({ session: { activeOrganizationId: 'org_1' }, user: { id: 'u1' } }));
  putAvatar = vi.fn(async () => undefined);
  getAvatar = vi.fn(async () => null);

  return {
    config: { trustedOrigins: ['https://dash.test'], betterAuthUrl: 'https://api.test' },
    dal: {
      forOrg: () => ({ appKeys: { touchLastUsed: vi.fn(async () => undefined) } }),
      resolveServiceKey: vi.fn(async () => ({ key: { id: 'k1', orgId: 'org_1' }, appIds: ['app_1'] })),
    },
    cipher: { for: () => ({ seal: async (s: string) => s, open: async (s: string) => s }) },
    queue: {},
    redis: {},
    auth: { handler: async () => new Response(null), api: { getSession } },
    store: { get: vi.fn() },
    userAssets: { putAvatar, getAvatar },
    modelDefaults: { planner: 'p', judge: 'j', resolution: 'r' },
    closeDb: async () => undefined,
  } as unknown as BackendDeps;
}

function uploadAvatar(
  app: ReturnType<typeof buildApp>,
  parts: { name: string; filename?: string; contentType?: string; data: Buffer | string }[],
  headers: Record<string, string> = {},
) {
  return app.inject({
    method: 'POST',
    url: '/me/avatar',
    headers: { 'content-type': `multipart/form-data; boundary=${BOUNDARY}`, ...headers },
    payload: multipartBody(parts),
  });
}

describe('POST /me/avatar', () => {
  beforeEach(() => vi.clearAllMocks());

  it('accepts a valid webp upload and returns {image} with a ?v= cache-bust', async () => {
    const app = buildApp(makeDeps());
    const res = await uploadAvatar(app, [
      { name: 'file', filename: 'a.webp', contentType: 'image/webp', data: webpBytes },
    ]);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.image).toMatch(/^https:\/\/api\.test\/avatars\/u1\?v=\d+$/);
    expect(putAvatar).toHaveBeenCalledWith('u1', expect.any(Buffer), 'webp');
    await app.close();
  });

  it('writes under the SESSION userId, ignoring any body-supplied userId', async () => {
    const app = buildApp(makeDeps());
    const res = await uploadAvatar(app, [
      { name: 'file', filename: 'a.webp', contentType: 'image/webp', data: webpBytes },
    ]);
    expect(res.statusCode).toBe(200);
    // userId came from the session (u1), never from the part name or filename.
    expect(putAvatar.mock.calls[0]![0]).toBe('u1');
    expect(res.json().image).toContain('/avatars/u1?');
    await app.close();
  });

  it('rejects a non-allowlist MIME (image/svg+xml)', async () => {
    const app = buildApp(makeDeps());
    const res = await uploadAvatar(app, [
      { name: 'file', filename: 'x.svg', contentType: 'image/svg+xml', data: '<svg/>' },
    ]);
    expect(res.statusCode).toBe(415);
    expect(putAvatar).not.toHaveBeenCalled();
    await app.close();
  });

  it('rejects declared image/png whose bytes are not a PNG (magic-byte mismatch)', async () => {
    const app = buildApp(makeDeps());
    const res = await uploadAvatar(app, [
      { name: 'file', filename: 'fake.png', contentType: 'image/png', data: webpBytes },
    ]);
    expect(res.statusCode).toBe(415);
    expect(putAvatar).not.toHaveBeenCalled();
    await app.close();
  });

  it('accepts a genuine PNG (declared + sniffed agree)', async () => {
    const app = buildApp(makeDeps());
    const res = await uploadAvatar(app, [
      { name: 'file', filename: 'a.png', contentType: 'image/png', data: pngBytes },
    ]);
    expect(res.statusCode).toBe(200);
    expect(putAvatar).toHaveBeenCalledWith('u1', expect.any(Buffer), 'png');
    await app.close();
  });

  it('accepts a genuine JPEG (declared + sniffed agree)', async () => {
    const app = buildApp(makeDeps());
    const res = await uploadAvatar(app, [
      { name: 'file', filename: 'a.jpg', contentType: 'image/jpeg', data: jpegBytes },
    ]);
    expect(res.statusCode).toBe(200);
    expect(putAvatar).toHaveBeenCalledWith('u1', expect.any(Buffer), 'jpeg');
    await app.close();
  });

  it('rejects a file over 5MB (413)', async () => {
    const app = buildApp(makeDeps());
    const big = Buffer.concat([webpBytes, Buffer.alloc(5 * 1024 * 1024 + 16, 0x61)]);
    const res = await uploadAvatar(app, [
      { name: 'file', filename: 'big.webp', contentType: 'image/webp', data: big },
    ]);
    expect(res.statusCode).toBe(413);
    expect(putAvatar).not.toHaveBeenCalled();
    await app.close();
  });

  it('rejects more than one file part (400)', async () => {
    const app = buildApp(makeDeps());
    const res = await uploadAvatar(app, [
      { name: 'file', filename: 'a.webp', contentType: 'image/webp', data: webpBytes },
      { name: 'file2', filename: 'b.webp', contentType: 'image/webp', data: webpBytes },
    ]);
    expect(res.statusCode).toBe(400);
    expect(putAvatar).not.toHaveBeenCalled();
    await app.close();
  });

  it('rejects a request with no file part (400)', async () => {
    const app = buildApp(makeDeps());
    const res = await app.inject({
      method: 'POST',
      url: '/me/avatar',
      headers: { 'content-type': `multipart/form-data; boundary=${BOUNDARY}` },
      payload: Buffer.from(`--${BOUNDARY}--\r\n`, 'utf8'),
    });
    expect(res.statusCode).toBe(400);
    expect(putAvatar).not.toHaveBeenCalled();
    await app.close();
  });

  it('refuses a bearer/service-key principal (403)', async () => {
    const app = buildApp(makeDeps());
    const res = await uploadAvatar(
      app,
      [{ name: 'file', filename: 'a.webp', contentType: 'image/webp', data: webpBytes }],
      { authorization: 'Bearer ak_live_secret' },
    );
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('session_required');
    expect(putAvatar).not.toHaveBeenCalled();
    await app.close();
  });
});

describe('GET /avatars/:userId', () => {
  beforeEach(() => vi.clearAllMocks());

  it('serves an existing avatar with content-type and a public immutable cache-control', async () => {
    const deps = makeDeps();
    (deps.userAssets.getAvatar as ReturnType<typeof vi.fn>).mockResolvedValue({
      body: webpBytes,
      contentType: 'image/webp',
    });
    const app = buildApp(deps);
    const res = await app.inject({ method: 'GET', url: '/avatars/u1' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('image/webp');
    expect(res.headers['cache-control']).toContain('public');
    expect(res.headers['cache-control']).toContain('immutable');
    await app.close();
  });

  it('returns 404 for a missing avatar (no body leak)', async () => {
    const app = buildApp(makeDeps());
    const res = await app.inject({ method: 'GET', url: '/avatars/ghost' });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('rejects a traversal :userId before any store access', async () => {
    const deps = makeDeps();
    const app = buildApp(deps);
    // Encoded traversal: %2e%2e%2f decodes to ../, %2f to /. Either is rejected, and the store is
    // never asked to read outside users/.
    const res = await app.inject({ method: 'GET', url: '/avatars/%2e%2e%2f%2e%2e%2fetc%2fpasswd' });
    expect(res.statusCode === 400 || res.statusCode === 404).toBe(true);
    expect(deps.userAssets.getAvatar).not.toHaveBeenCalled();
    await app.close();
  });
});
