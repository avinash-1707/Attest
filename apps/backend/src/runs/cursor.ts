import { z } from 'zod';
import type { RunCursor } from '@attest/db';
import { ApiError } from '../platform/errors';

// Opaque, forward-only pagination token for GET /runs. Carries ONLY the last row's position
// (created_at + id) - both already returned to the client in that page - so it leaks nothing new and
// grants no capability. It never carries org_id: tenancy is re-derived from the session on every
// request, and the decoded cursor is used purely as a WHERE predicate inside the org-scoped query
// [invariant 3]. base64url(JSON) keeps the token querystring-safe and lets the internal shape evolve
// behind the opacity. Codec lives in the transport layer (here), never in packages/db or contracts.
// `i` is validated to the run-id shape (run_<nanoid24>), not just non-empty: a crafted token can't
// push an arbitrary string into the keyset comparison, and a clearly-bad id 400s instead of running.
const cursorShape = z.object({ c: z.iso.datetime(), i: z.string().regex(/^run_[A-Za-z0-9_-]{24}$/) });

// Cap the raw token before decoding so an attacker can't force an unbounded base64 decode + JSON.parse
// (a cheap DoS). A legitimate cursor is well under 100 bytes.
const MAX_CURSOR_LENGTH = 256;

function reject(): never {
  throw new ApiError(400, 'invalid_cursor', 'Malformed pagination cursor');
}

export function encodeRunCursor(cursor: RunCursor): string {
  const json = JSON.stringify({ c: cursor.createdAt.toISOString(), i: cursor.id });
  return Buffer.from(json, 'utf8').toString('base64url');
}

// Treats the token as fully attacker-controlled: any malformation (oversized, non-canonical base64,
// bad JSON, wrong shape, unparseable date) -> 400 invalid_cursor. Never falls back to "first page" - a
// silent fallback would make a poller quietly restart its walk and reprocess everything.
export function decodeRunCursor(raw: string): RunCursor {
  if (raw.length > MAX_CURSOR_LENGTH) reject();
  const buf = Buffer.from(raw, 'base64url');
  // Buffer.from(.,'base64url') is lenient (silently drops invalid chars), so a tampered token could
  // decode to a *different* valid cursor. Re-encode and require it to round-trip exactly: this rejects
  // any non-canonical/tampered input deterministically.
  if (buf.toString('base64url') !== raw) reject();
  let parsed: unknown;
  try {
    parsed = JSON.parse(buf.toString('utf8'));
  } catch {
    reject();
  }
  const result = cursorShape.safeParse(parsed);
  if (!result.success) reject();
  const createdAt = new Date(result.data.c);
  if (Number.isNaN(createdAt.getTime())) reject();
  return { createdAt, id: result.data.i };
}
