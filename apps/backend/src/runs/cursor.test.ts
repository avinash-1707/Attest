import { describe, it, expect } from 'vitest';
import { encodeRunCursor, decodeRunCursor } from './cursor';

const VALID_ID = 'run_abcdefghijklmnopqrstuvwx'; // run_ + 24 chars

describe('run cursor codec', () => {
  it('round-trips position with millisecond precision', () => {
    const cursor = { createdAt: new Date('2026-06-23T12:34:56.789Z'), id: VALID_ID };
    const decoded = decodeRunCursor(encodeRunCursor(cursor));
    expect(decoded.id).toBe(cursor.id);
    expect(decoded.createdAt.toISOString()).toBe(cursor.createdAt.toISOString());
  });

  it('rejects garbage (non-base64/JSON) with invalid_cursor', () => {
    expect(() => decodeRunCursor('not-a-real-cursor')).toThrow(/Malformed pagination cursor/);
  });

  it('rejects a valid token whose shape is wrong', () => {
    const tampered = Buffer.from(JSON.stringify({ c: '2026-06-23T00:00:00.000Z' }), 'utf8').toString('base64url');
    expect(() => decodeRunCursor(tampered)).toThrow(/Malformed pagination cursor/);
  });

  it('rejects a token whose id is not a run id', () => {
    const bad = Buffer.from(JSON.stringify({ c: '2026-06-23T00:00:00.000Z', i: 'evil' }), 'utf8').toString('base64url');
    expect(() => decodeRunCursor(bad)).toThrow(/Malformed pagination cursor/);
  });

  it('rejects a token whose timestamp is unparseable', () => {
    const bad = Buffer.from(JSON.stringify({ c: 'not-a-date', i: VALID_ID }), 'utf8').toString('base64url');
    expect(() => decodeRunCursor(bad)).toThrow(/Malformed pagination cursor/);
  });

  it('rejects an oversized token', () => {
    const huge = 'A'.repeat(500);
    expect(() => decodeRunCursor(huge)).toThrow(/Malformed pagination cursor/);
  });
});
