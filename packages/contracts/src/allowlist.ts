// The navigation allowlist guardrail [arch §10, tech-arch §7.4, invariant 7]. Enforced by the backend
// at enqueue AND re-checked by the worker before navigation, so the rule lives here and cannot drift.
//
// An entry is matched against the URL's hostname (case-insensitive):
//   "example.com"    matches exactly that host
//   "*.example.com"  matches any subdomain of example.com (but not the apex)
// An entry may be given as a bare host or a full URL; only its hostname is used. An empty allowlist
// denies everything (fail closed): a run with no configured targets must not navigate anywhere.
//
// Limitation: hosts are matched as ASCII. A Unicode/IDN host is denied (fail closed), so both the
// allowlist entry and the target URL must use punycode (xn--) form for an IDN domain to pass.

// Extracts the lowercase hostname from a bare host or a full URL, without depending on the URL global
// (contracts stays lib-free). Strips scheme, userinfo, path/query/fragment, and port.
function hostOf(value: string): string | undefined {
  const authority = value
    .trim()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
    .split(/[/?#]/, 1)[0];
  if (!authority) return undefined;
  const hostPort = authority.split('@').pop() ?? '';
  const host = hostPort.replace(/:\d+$/, '').toLowerCase();
  return /^[a-z0-9.-]+$/.test(host) && host.includes('.') ? host : undefined;
}

function entryMatches(host: string, entry: string): boolean {
  const trimmed = entry.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('*.')) {
    const base = trimmed.slice(2).toLowerCase();
    return !!base && host.endsWith(`.${base}`);
  }
  const entryHost = hostOf(trimmed);
  return entryHost !== undefined && host === entryHost;
}

export function isUrlAllowed(url: string, allowlist: readonly string[]): boolean {
  const host = hostOf(url);
  if (!host) return false;
  return allowlist.some((entry) => entryMatches(host, entry));
}
