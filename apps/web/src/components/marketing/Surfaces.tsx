import { Section, Eyebrow } from './Section';
import { Reveal } from './Reveal';

const surfaces = [
  {
    tag: 'apps/mcp',
    title: 'MCP server',
    body: 'A thin client your coding agent runs locally. Claude Code, Codex, Gemini CLI, Cline, Cursor, Windsurf — any MCP host calls attest and loops on the verdict.',
  },
  {
    tag: 'apps/dashboard',
    title: 'Dashboard',
    body: 'A human surface to trigger the same runs, watch them live, and review attestations with full evidence — screenshots, DOM, console, and network.',
  },
];

const trust = [
  { k: 'No source ingestion', v: 'Attest never reads your codebase. It verifies the running product, from the outside.' },
  { k: 'Tenant isolation', v: 'Every row is org-scoped. There is no cross-tenant query path, by construction.' },
  { k: 'Secrets stay secret', v: 'Credentials are encrypted, never logged, never returned to a client, never in evidence.' },
  { k: 'Self-hostable', v: 'Apache-2.0 core. Run it in our cloud or your own — no functional gap in the verdict loop.' },
];

export function Surfaces() {
  return (
    <Section id="surfaces" className="py-20 md:py-28">
      <Reveal className="max-w-2xl">
        <Eyebrow>Surfaces</Eyebrow>
        <h2
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 700,
            fontSize: 'clamp(1.7rem, 3.6vw, 2.4rem)',
            lineHeight: 1.1,
            letterSpacing: 'var(--tracking-tight)',
            color: 'var(--text-primary)',
            marginTop: 'var(--space-4)',
          }}
        >
          Two ways in. One source of truth.
        </h2>
      </Reveal>

      <div className="mt-12 grid gap-5 md:grid-cols-2">
        {surfaces.map((s, i) => (
          <Reveal
            key={s.tag}
            index={i}
            className="attest-lift"
            style={{
              backgroundColor: 'var(--surface-raised)',
              borderRadius: 'var(--radius-clay-md)',
              boxShadow: 'var(--clay-shadow)',
              padding: 'var(--space-8)',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-xs)',
                color: 'var(--data-text-muted)',
                backgroundColor: 'var(--data-surface)',
                border: '1px solid var(--data-border)',
                borderRadius: 'var(--radius-xs)',
                padding: '2px 6px',
              }}
            >
              {s.tag}
            </span>
            <h3
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-2xl)',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginTop: 'var(--space-4)',
              }}
            >
              {s.title}
            </h3>
            <p
              style={{
                fontSize: 'var(--text-base)',
                lineHeight: 1.6,
                color: 'var(--text-secondary)',
                marginTop: 'var(--space-3)',
              }}
            >
              {s.body}
            </p>
          </Reveal>
        ))}
      </div>

      {/* Trust strip */}
      <Reveal
        className="mt-5 grid gap-px md:grid-cols-2 lg:grid-cols-4"
        style={{
          backgroundColor: 'var(--surface-border)',
          borderRadius: 'var(--radius-clay-md)',
          boxShadow: 'var(--clay-shadow)',
          overflow: 'hidden',
        }}
      >
        {trust.map((t) => (
          <div
            key={t.k}
            style={{ backgroundColor: 'var(--surface-raised)', padding: 'var(--space-5)' }}
          >
            <div
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-md)',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              {t.k}
            </div>
            <p
              style={{
                fontSize: 'var(--text-sm)',
                lineHeight: 1.55,
                color: 'var(--text-muted)',
                marginTop: 'var(--space-2)',
              }}
            >
              {t.v}
            </p>
          </div>
        ))}
      </Reveal>
    </Section>
  );
}
