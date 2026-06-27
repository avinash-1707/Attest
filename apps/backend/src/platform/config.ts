import { z } from 'zod';

// Process-start configuration, validated once at the boundary [tech-arch §8]. Fail-closed: a
// backend that can't open secrets or sign sessions must never bind the port, so DATABASE_URL,
// REDIS_URL, ATTEST_KEK and BETTER_AUTH_SECRET are all required and loadConfig throws if absent.

const base = z.object({
  port: z.number().int().positive().default(3000),
  databaseUrl: z.string().min(1),
  redisUrl: z.string().min(1),
  // Base64-encoded KEK; the 32-byte length is checked by kekFromEnv when the cipher is built at
  // boot (deps.ts), which also fails the process before listen [tech-arch §6.2].
  kek: z.string().min(1),
  kekId: z.string().min(1).default('env'),
  betterAuthSecret: z.string().min(1),
  betterAuthUrl: z.string().min(1),
  // Parent domain the session cookie is scoped to, for cross-subdomain SSO (web on the root domain,
  // dashboard on the app. subdomain) [arch §3.1]. Set to the shared parent in prod (e.g. ".attest.io");
  // leave UNSET locally so the cookie stays host-only (localhost has no shared parent, and a "."-domain
  // would be rejected there). When set, BetterAuth's crossSubDomainCookies is enabled with this domain.
  cookieDomain: z.string().min(1).optional(),
  // Allowlist for the browser origins that talk to the backend: apps/web (auth) + apps/dashboard.
  // This ONE list is load-bearing three ways - CORS allow-origin (app.ts), the CSRF Origin guard
  // (csrf.ts), AND BetterAuth's OAuth callbackURL validation (the open-redirect gate). Never put a
  // wildcard here: a broadened entry silently widens where OAuth will redirect post-auth [security].
  trustedOrigins: z.array(z.string().min(1)).default([]),
  google: z.object({ clientId: z.string().min(1), clientSecret: z.string().min(1) }).optional(),
  // Hosted default OpenRouter key, used when an org has no BYOK model key [arch §7.2]. Optional so a
  // self-hoster relying solely on BYOK (or a local endpoint) need not set it.
  openrouterApiKey: z.string().min(1).optional(),
  modelBaseUrl: z.string().min(1).optional(),
  // Per-role model ids [tech-arch §3.3, §8]. Defaulted so dev boot needs no model env; override via
  // MODEL_DEFAULT_*. The app table carries no per-app model choice in MVP, so these apply to every run.
  modelDefaults: z.object({
    planner: z.string().min(1).default('anthropic/claude-sonnet-4-6'),
    judge: z.string().min(1).default('anthropic/claude-haiku-4-5'),
    resolution: z.string().min(1).default('anthropic/claude-haiku-4-5'),
  }),
  // Hosted-tier credit gating: when enabled, enqueue checks the org's balance via ee/billing and 402s
  // an org that can't cover a run. OFF for the OSS build (self-hosters run unlimited) [tech-arch §13].
  // requireBilling makes a hosted boot fail closed if @attest/ee is absent, rather than run ungated.
  billingEnabled: z.boolean().default(false),
  requireBilling: z.boolean().default(false),
  // Dodo Payments Standard-Webhooks signing key, used to verify inbound webhook signatures [tech-arch
  // §13.5]. Required (with billingEnabled) for the /webhooks/dodo route to verify; never logged.
  dodoWebhookKey: z.string().min(1).optional(),
  // Dodo Payments API bearer token, used for OUTBOUND calls (checkout sessions, customer portal)
  // [tech-arch §13.6]. Distinct from the webhook signing key. Required (with billingEnabled) for the
  // self-serve checkout/portal routes; never logged.
  dodoApiKey: z.string().min(1).optional(),
  // Dodo environment for outbound API calls: 'test_mode' for dev/staging, 'live_mode' for production.
  dodoEnvironment: z.enum(['test_mode', 'live_mode']).default('test_mode'),
  // The dashboard URL Dodo redirects back to after checkout / from the customer portal [tech-arch §13.6].
  dashboardUrl: z.string().min(1).optional(),
  // Perimeter HTTP rate limiting [security]. OFF in the OSS/self-host build (self-hosters own their
  // perimeter, mirroring billingEnabled); the hosted deploy opts in via RATE_LIMIT_ENABLED=true.
  // trustProxyHops is the load-bearing number: it MUST equal the real proxy-chain length (1 = single
  // LB, 2 = CDN+LB). Too low keys every request on the proxy IP (one global throttle that locks out
  // all users); too high trusts an attacker-controlled X-Forwarded-For entry (the limiter is bypassed
  // by spoofing). Defaults to 0 (no proxy) so a self-host boot is never silently mis-keyed.
  rateLimit: z
    .object({
      enabled: z.boolean().default(false),
      trustProxyHops: z.number().int().min(0).default(0),
      globalMax: z.number().int().positive().default(100),
      authMax: z.number().int().positive().default(8),
      enqueueMax: z.number().int().positive().default(30),
    })
    .default({ enabled: false, trustProxyHops: 0, globalMax: 100, authMax: 8, enqueueMax: 30 }),
});

// Evidence backend, selected once at start [tech-arch §8], same shape the worker uses so the read
// API serves bytes from the store the worker wrote to. Disk (self-hosted) / S3-compatible (hosted).
const diskConfig = base.extend({
  evidence: z.object({ backend: z.literal('disk'), root: z.string().min(1) }),
});

const s3Config = base.extend({
  evidence: z.object({
    backend: z.literal('s3'),
    bucket: z.string().min(1),
    endpoint: z.string().min(1).optional(),
    region: z.string().min(1).optional(),
    accessKeyId: z.string().min(1).optional(),
    secretAccessKey: z.string().min(1).optional(),
  }),
});

export type BackendConfig = z.infer<typeof diskConfig> | z.infer<typeof s3Config>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): BackendConfig {
  // An env var set to "" (common in a copied .env / .env.example) means unset, not present-empty:
  // collapse it to undefined so optional fields stay optional and defaulted fields take their default.
  const v = (key: string): string | undefined => {
    const raw = env[key];
    return raw && raw.length > 0 ? raw : undefined;
  };

  const common = {
    port: v('PORT') ? Number(v('PORT')) : undefined,
    databaseUrl: v('DATABASE_URL'),
    redisUrl: v('REDIS_URL'),
    kek: v('ATTEST_KEK'),
    kekId: v('ATTEST_KEK_ID'),
    betterAuthSecret: v('BETTER_AUTH_SECRET'),
    betterAuthUrl: v('BETTER_AUTH_URL'),
    cookieDomain: v('COOKIE_DOMAIN'),
    trustedOrigins: v('TRUSTED_ORIGINS')
      ? v('TRUSTED_ORIGINS')!.split(',').map((o) => o.trim()).filter(Boolean)
      : undefined,
    google:
      v('GOOGLE_CLIENT_ID') && v('GOOGLE_CLIENT_SECRET')
        ? { clientId: v('GOOGLE_CLIENT_ID')!, clientSecret: v('GOOGLE_CLIENT_SECRET')! }
        : undefined,
    openrouterApiKey: v('OPENROUTER_API_KEY'),
    modelBaseUrl: v('MODEL_BASE_URL'),
    modelDefaults: {
      planner: v('MODEL_DEFAULT_PLANNER'),
      judge: v('MODEL_DEFAULT_JUDGE'),
      resolution: v('MODEL_DEFAULT_RESOLUTION'),
    },
    billingEnabled: env.BILLING_ENABLED === 'true',
    requireBilling: env.REQUIRE_BILLING === 'true',
    dodoWebhookKey: v('DODO_WEBHOOK_KEY'),
    dodoApiKey: v('DODO_PAYMENTS_API_KEY'),
    dodoEnvironment: v('DODO_ENVIRONMENT'),
    dashboardUrl: v('DASHBOARD_URL'),
    rateLimit: {
      enabled: env.RATE_LIMIT_ENABLED === 'true',
      trustProxyHops: v('RATE_LIMIT_TRUST_PROXY_HOPS') ? Number(v('RATE_LIMIT_TRUST_PROXY_HOPS')) : undefined,
      globalMax: v('RATE_LIMIT_GLOBAL_MAX') ? Number(v('RATE_LIMIT_GLOBAL_MAX')) : undefined,
      authMax: v('RATE_LIMIT_AUTH_MAX') ? Number(v('RATE_LIMIT_AUTH_MAX')) : undefined,
      enqueueMax: v('RATE_LIMIT_ENQUEUE_MAX') ? Number(v('RATE_LIMIT_ENQUEUE_MAX')) : undefined,
    },
  };

  if ((v('EVIDENCE_BACKEND') ?? 'disk') === 's3') {
    return s3Config.parse({
      ...common,
      evidence: {
        backend: 's3',
        bucket: v('EVIDENCE_BUCKET'),
        endpoint: v('EVIDENCE_ENDPOINT'),
        region: v('EVIDENCE_REGION'),
        accessKeyId: v('EVIDENCE_ACCESS_KEY_ID'),
        secretAccessKey: v('EVIDENCE_SECRET_ACCESS_KEY'),
      },
    });
  }

  return diskConfig.parse({
    ...common,
    evidence: { backend: 'disk', root: v('EVIDENCE_ROOT') },
  });
}
