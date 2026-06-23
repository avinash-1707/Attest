import { z } from 'zod';
import { InsufficientCreditsError } from '@attest/contracts';
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

// Typed client-facing error [tech-arch §5.1]. A thrown ApiError is the only way a route surfaces a
// 4xx; everything else falls through to an opaque 500 so internal detail (stack, crypto, DB, or a
// secret) never reaches a client [arch §10, invariant 4].
export class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ErrorBody {
  code: string;
  message: string;
}

// Registers the global error handler. ApiError -> its status + {code, message}. ZodError -> 400 with
// issue *paths* only (never the offending values, which could carry a secret). Anything else -> 500
// with an opaque body; the real error is logged server-side.
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, req: FastifyRequest, reply: FastifyReply) => {
    if (error instanceof ApiError) {
      reply.status(error.statusCode).send({ code: error.code, message: error.message } satisfies ErrorBody);
      return;
    }

    // The ee/ credit gate throws this from enqueue; map to 402 Payment Required so the MCP + dashboard
    // doors get a distinct buy-credits signal (not conflated with the 400 config errors) [tech-arch §13.4].
    if (error instanceof InsufficientCreditsError) {
      reply.status(402).send({ code: error.code, message: error.message } satisfies ErrorBody);
      return;
    }

    if (error instanceof z.ZodError) {
      const paths = error.issues.map((i) => i.path.join('.') || '(root)');
      reply.status(400).send({ code: 'invalid_request', message: `Invalid request: ${paths.join(', ')}` } satisfies ErrorBody);
      return;
    }

    // Fastify's own validation/parse errors carry a statusCode; surface as a generic 4xx without echoing input.
    if (typeof error.statusCode === 'number' && error.statusCode >= 400 && error.statusCode < 500) {
      reply.status(error.statusCode).send({ code: 'invalid_request', message: 'Invalid request' } satisfies ErrorBody);
      return;
    }

    req.log.error({ err: error }, 'unhandled backend error');
    reply.status(500).send({ code: 'internal', message: 'Internal server error' } satisfies ErrorBody);
  });
}
