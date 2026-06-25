import type { CSSProperties } from 'react';
import Link from 'next/link';
import { Section, Eyebrow } from './Section';
import { AttestSeal } from './art/AttestSeal';
import { GuillocheField } from './art/GuillocheField';

export function Hero() {
  return (
    <div className="relative">
      <div className="instrument-grid" aria-hidden />
      <Section className="relative pt-20 pb-14 md:pt-28 md:pb-20">
        <div className="grid items-center gap-12 lg:grid-cols-[1.04fr_0.96fr] lg:gap-14">
          {/* Left: message */}
          <div className="attest-enter">
            <Eyebrow>The proof layer for coding agents</Eyebrow>

            <h1
              style={{
                fontFamily: 'var(--font-sans)',
                fontWeight: 700,
                fontSize: 'clamp(2.3rem, 5.6vw, 3.7rem)',
                lineHeight: 1.02,
                letterSpacing: 'var(--tracking-tight)',
                color: 'var(--text-primary)',
                marginTop: 'var(--space-5)',
              }}
            >
              Your agent says
              <br />
              it works.
              <br />
              <span style={{ color: 'var(--accent-primary)' }}>Attest proves it.</span>
            </h1>

            <p
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 'clamp(1.05rem, 1.8vw, 1.25rem)',
                lineHeight: 1.5,
                color: 'var(--text-secondary)',
                marginTop: 'var(--space-6)',
                maxWidth: '33rem',
              }}
            >
              Attest drives a real browser, watches what actually happens, and hands back a
              signed verdict your agent can act on. Real proof, in under a minute, instead of
              a hopeful guess.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href="/sign-up"
                className="inline-flex items-center clay-interactive attest-cta"
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  boxShadow: 'var(--clay-shadow-accent)',
                  color: 'var(--text-on-accent)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--text-md)',
                  fontWeight: 600,
                  padding: '13px 24px',
                  borderRadius: 'var(--radius-clay-sm)',
                }}
              >
                Start attesting free
              </Link>
              <a
                href="#how"
                className="inline-flex items-center gap-2 clay-interactive attest-secondary-btn"
                style={{
                  backgroundColor: 'var(--surface-elevated)',
                  boxShadow: 'var(--clay-shadow)',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--text-md)',
                  fontWeight: 500,
                  padding: '13px 22px',
                  borderRadius: 'var(--radius-clay-sm)',
                }}
              >
                See how it works
              </a>
            </div>

            <p
              className="mt-7"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-xs)',
                letterSpacing: 'var(--tracking-wide)',
                color: 'var(--text-muted)',
              }}
            >
              No card required · Apache-2.0 core · Self-hostable
            </p>
          </div>

          {/* Right: the seal, struck on an engraved field inside a clay instrument frame */}
          <div
            className="attest-enter relative"
            style={{ '--stagger-index': 2 } as CSSProperties}
          >
            <div
              className="relative overflow-hidden"
              style={{
                backgroundColor: 'var(--surface-base)',
                borderRadius: 'var(--radius-clay-lg)',
                boxShadow: 'var(--clay-shadow)',
                border: '1px solid var(--surface-border)',
                padding: 'clamp(20px, 4vw, 40px)',
              }}
            >
              <GuillocheField opacity={0.55} petals={15} rings={18} />
              <div className="relative">
                <AttestSeal />
              </div>
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}
