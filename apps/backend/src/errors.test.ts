import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { z } from 'zod';
import { ApiError, registerErrorHandler } from './errors';

function appWithThrowingRoutes() {
  const app = Fastify();
  registerErrorHandler(app);
  app.get('/api-error', async () => {
    throw new ApiError(403, 'app_forbidden', 'Not authorized for this app');
  });
  app.get('/zod', async () => {
    z.object({ appId: z.string() }).parse({});
  });
  app.get('/zod-secret', async () => {
    // The offending value is secret-shaped; the response must never echo it.
    z.object({ token: z.literal('expected') }).parse({ token: 'SUPERSECRETVALUE' });
  });
  app.get('/boom', async () => {
    throw new Error('connect failed postgres://user:hunter2@db:5432');
  });
  return app;
}

describe('registerErrorHandler', () => {
  it('maps ApiError to its status + {code, message}', async () => {
    const app = appWithThrowingRoutes();
    const res = await app.inject({ method: 'GET', url: '/api-error' });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ code: 'app_forbidden', message: 'Not authorized for this app' });
    await app.close();
  });

  it('maps a ZodError to 400 invalid_request listing the path only', async () => {
    const app = appWithThrowingRoutes();
    const res = await app.inject({ method: 'GET', url: '/zod' });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('invalid_request');
    expect(res.json().message).toContain('appId');
    await app.close();
  });

  it('never echoes the offending value in a ZodError response (invariant 4)', async () => {
    const app = appWithThrowingRoutes();
    const res = await app.inject({ method: 'GET', url: '/zod-secret' });
    expect(res.statusCode).toBe(400);
    expect(res.payload).not.toContain('SUPERSECRETVALUE');
    await app.close();
  });

  it('maps any other error to an opaque 500 with no internal detail (invariant 4)', async () => {
    const app = appWithThrowingRoutes();
    const res = await app.inject({ method: 'GET', url: '/boom' });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ code: 'internal', message: 'Internal server error' });
    expect(res.payload).not.toContain('postgres');
    expect(res.payload).not.toContain('hunter2');
    await app.close();
  });
});
