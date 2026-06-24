import type { CSSProperties } from 'react';
import Link from 'next/link';
import { Section, Eyebrow } from './Section';
import { AttestationPanel } from './AttestationPanel';

export function Hero() {
  return (
    <div className="relative">
      <div className="instrument-grid" aria-hidden />
      <Section className="relative pt-20 pb-16 md:pt-28 md:pb-20">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          {/* Left: message */}
          <div className="attest-enter">
            <Eyebrow>QA primitive for coding agents</Eyebrow>

            <h1
              style={{
                fontFamily: 'var(--font-sans)',
                fontWeight: 700,
                fontSize: 'clamp(2.1rem, 5.2vw, 3.4rem)',
                lineHeight: 1.04,
                letterSpacing: 'var(--tracking-tight)',
                color: 'var(--text-primary)',
                marginTop: 'var(--space-5)',
              }}
            >
              Agents assert their code works.
              <br />
              <span style={{ color: 'var(--accent-primary)' }}>Attest proves it.</span>
            </h1>

            <p
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-xl)',
                lineHeight: 1.5,
                color: 'var(--text-secondary)',
                marginTop: 'var(--space-6)',
                maxWidth: '34rem',
              }}
            >
              Attest drives a real browser, watches the outcome, and returns an
              evidence-backed verdict your agent can loop on — not a transcript it has to
              interpret. Open core, self-hostable, hosted when you want it.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href="/sign-up"
                className="inline-flex items-center clay-interactive"
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  boxShadow: 'var(--clay-shadow-accent)',
                  color: 'var(--text-on-accent)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--text-md)',
                  fontWeight: 500,
                  padding: '12px 22px',
                  borderRadius: 'var(--radius-clay-sm)',
                }}
              >
                Start attesting
              </Link>
              <a
                href="#how"
                className="inline-flex items-center clay-interactive attest-secondary-btn"
                style={{
                  backgroundColor: 'var(--surface-elevated)',
                  boxShadow: 'var(--clay-shadow)',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--text-md)',
                  fontWeight: 500,
                  padding: '12px 22px',
                  borderRadius: 'var(--radius-clay-sm)',
                }}
              >
                See how it works
              </a>
            </div>

            {/* Positioning one-liner, flat/mono — instrument voice */}
            <p
              className="mt-9"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-sm)',
                lineHeight: 1.7,
                color: 'var(--text-muted)',
                maxWidth: '36rem',
              }}
            >
              Most browser tools expose{' '}
              <span style={{ color: 'var(--text-secondary)' }}>click()</span> and{' '}
              <span style={{ color: 'var(--text-secondary)' }}>type()</span>. Attest exposes{' '}
              <span style={{ color: 'var(--accent-primary)' }}>attest(goal)</span>.
            </p>
          </div>

          {/* Right: the readout */}
          <div
            className="attest-enter"
            style={{ '--stagger-index': 2 } as CSSProperties}
          >
            <AttestationPanel />
          </div>
        </div>
      </Section>
    </div>
  );
}
