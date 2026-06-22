import { describe, it, expect } from 'vitest';
import { isUrlAllowed } from './allowlist';

describe('isUrlAllowed', () => {
  it('empty allowlist denies everything (fail closed)', () => {
    expect(isUrlAllowed('https://example.com', [])).toBe(false);
  });

  it('matches an exact host', () => {
    expect(isUrlAllowed('https://example.com/login', ['example.com'])).toBe(true);
    expect(isUrlAllowed('https://other.com', ['example.com'])).toBe(false);
  });

  it('is case-insensitive on host', () => {
    expect(isUrlAllowed('https://EXAMPLE.com', ['example.com'])).toBe(true);
  });

  it('does not treat a subdomain as the apex', () => {
    expect(isUrlAllowed('https://app.example.com', ['example.com'])).toBe(false);
  });

  it('wildcard matches subdomains but not the apex', () => {
    expect(isUrlAllowed('https://app.example.com', ['*.example.com'])).toBe(true);
    expect(isUrlAllowed('https://a.b.example.com', ['*.example.com'])).toBe(true);
    expect(isUrlAllowed('https://example.com', ['*.example.com'])).toBe(false);
  });

  it('accepts an entry given as a full URL and uses only its host', () => {
    expect(isUrlAllowed('https://example.com/dash', ['https://example.com/anything'])).toBe(true);
  });

  it('rejects an unparseable url', () => {
    expect(isUrlAllowed('not a url', ['example.com'])).toBe(false);
  });

  it('does not match on substring confusion', () => {
    expect(isUrlAllowed('https://notexample.com', ['example.com'])).toBe(false);
    expect(isUrlAllowed('https://example.com.evil.com', ['example.com'])).toBe(false);
  });
});
