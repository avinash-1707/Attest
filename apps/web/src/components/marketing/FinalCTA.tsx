import Link from 'next/link';
import { Section } from './Section';
import { Reveal } from './Reveal';
import { rosette } from './art/guilloche';

const rings = Array.from({ length: 9 }, (_, i) =>
  rosette({ cx: 200, cy: 200, base: 60 + i * 16, amp: 9, petals: 14, phase: i * 0.5 }),
);

export function FinalCTA() {
  return (
    <Section className="pb-24">
      <Reveal
        className="relative flex flex-col items-center overflow-hidden text-center"
        style={{
          backgroundColor: 'var(--accent-primary)',
          borderRadius: 'var(--radius-clay-lg)',
          boxShadow: 'var(--clay-shadow-accent)',
          padding: 'clamp(48px, 8vw, 92px) var(--space-6)',
        }}
      >
        {/* engraved guilloche, washed light over oxblood */}
        <svg
          aria-hidden
          viewBox="0 0 400 400"
          preserveAspectRatio="xMidYMid slice"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            opacity: 0.13,
            pointerEvents: 'none',
            WebkitMaskImage: 'radial-gradient(circle at 50% 50%, #000 0%, transparent 70%)',
            maskImage: 'radial-gradient(circle at 50% 50%, #000 0%, transparent 70%)',
          }}
        >
          {rings.map((d, i) => (
            <path key={i} d={d} fill="none" stroke="var(--oxblood-100)" strokeWidth={0.6} />
          ))}
        </svg>

        <div className="relative">
          <h2
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 700,
              fontSize: 'clamp(2rem, 4.8vw, 3.1rem)',
              lineHeight: 1.06,
              letterSpacing: 'var(--tracking-tight)',
              color: 'var(--text-on-accent)',
              maxWidth: '18ch',
              margin: '0 auto',
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
              maxWidth: '40ch',
              marginInline: 'auto',
            }}
          >
            Let your agents prove their own work. Evidence-backed verdicts in under a minute,
            free to start.
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
              padding: '14px 28px',
              borderRadius: 'var(--radius-clay-sm)',
              boxShadow: 'var(--clay-shadow)',
            }}
          >
            Start attesting free
          </Link>
        </div>
      </Reveal>
    </Section>
  );
}
