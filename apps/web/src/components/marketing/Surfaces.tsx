import type { ComponentType } from 'react';
import { Section, Eyebrow } from './Section';
import { Reveal } from './Reveal';
import { McpArt, DashboardArt } from './art/SurfaceArt';

interface Surface {
  tag: string;
  title: string;
  body: string;
  Art: ComponentType<{ className?: string }>;
}

const surfaces: Surface[] = [
  {
    tag: 'For your agent',
    title: 'MCP server',
    body: 'A thin client your coding agent runs locally. Any MCP host (Claude Code, Cursor, Codex, Cline) calls attest and loops on the verdict until the work is real.',
    Art: McpArt,
  },
  {
    tag: 'For your team',
    title: 'Dashboard',
    body: 'Trigger the same runs by hand, watch them execute live, and review every attestation with full evidence: screenshots, DOM, console, and network.',
    Art: DashboardArt,
  },
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
            fontSize: 'clamp(1.8rem, 3.8vw, 2.6rem)',
            lineHeight: 1.08,
            letterSpacing: 'var(--tracking-tight)',
            color: 'var(--text-primary)',
            marginTop: 'var(--space-4)',
          }}
        >
          Two ways in. One source of truth.
        </h2>
        <p
          style={{
            fontSize: 'var(--text-lg)',
            lineHeight: 1.5,
            color: 'var(--text-secondary)',
            marginTop: 'var(--space-4)',
          }}
        >
          Whether a verdict is requested by an agent or a human, it runs the same engine and
          returns the same attestation.
        </p>
      </Reveal>

      <div className="mt-12 grid gap-5 md:grid-cols-2">
        {surfaces.map((s, i) => (
          <Reveal
            key={s.title}
            index={i}
            className="attest-lift flex flex-col"
            style={{
              backgroundColor: 'var(--surface-raised)',
              borderRadius: 'var(--radius-clay-md)',
              boxShadow: 'var(--clay-shadow)',
              padding: 'var(--space-8)',
            }}
          >
            <div
              className="overflow-hidden"
              style={{
                backgroundColor: 'var(--surface-base)',
                border: '1px solid var(--surface-border)',
                borderRadius: 'var(--radius-clay-sm)',
                padding: 'var(--space-5)',
              }}
            >
              <s.Art />
            </div>

            <span
              className="mt-6 uppercase"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-xs)',
                letterSpacing: 'var(--tracking-wider)',
                color: 'var(--accent-primary)',
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
                marginTop: 'var(--space-2)',
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
    </Section>
  );
}
