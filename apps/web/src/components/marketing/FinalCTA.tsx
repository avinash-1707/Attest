import Link from 'next/link';
import { Section } from './Section';
import { Reveal } from './Reveal';

export function FinalCTA() {
  return (
    <Section className="pb-24">
      <Reveal
        className="flex flex-col items-center text-center"
        style={{
          backgroundColor: 'var(--accent-primary)',
          borderRadius: 'var(--radius-clay-lg)',
          boxShadow: 'var(--clay-shadow-accent)',
          padding: 'clamp(40px, 7vw, 80px) var(--space-6)',
        }}
      >
        <h2
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 700,
            fontSize: 'clamp(1.9rem, 4.4vw, 3rem)',
            lineHeight: 1.08,
            letterSpacing: 'var(--tracking-tight)',
            color: 'var(--text-on-accent)',
            maxWidth: '20ch',
          }}
        >
          Stop being the verification loop.
        </h2>
        <p
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-lg)',
            lineHeight: 1.5,
            color: 'var(--oxblood-100)',
            marginTop: 'var(--space-4)',
            maxWidth: '42ch',
          }}
        >
          Let your agents prove their own work. Get evidence-backed verdicts in under a
          minute.
        </p>
        <Link
          href="/sign-up"
          className="mt-8 inline-flex items-center clay-interactive"
          style={{
            backgroundColor: 'var(--text-on-accent)',
            color: 'var(--accent-pressed)',
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-md)',
            fontWeight: 600,
            padding: '13px 26px',
            borderRadius: 'var(--radius-clay-sm)',
            boxShadow: 'var(--clay-shadow)',
          }}
        >
          Start attesting
        </Link>
      </Reveal>
    </Section>
  );
}
