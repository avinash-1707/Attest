import { Section, Eyebrow } from './Section';
import { Reveal } from './Reveal';

const steps = [
  {
    n: '01',
    title: 'State the outcome',
    body: 'An agent calls attest(goal) over MCP, or a human clicks Run in the dashboard. Both hit one backend, one queue, one worker.',
  },
  {
    n: '02',
    title: 'Drive a real browser',
    body: 'The worker plans the journey from the goal, executes it server-side in isolated Chromium, and captures evidence at every step.',
  },
  {
    n: '03',
    title: 'Judge and attest',
    body: 'Five deterministic guards plus outcome-level judgment return passed, failed, or inconclusive — with root cause, evidence refs, and a next action.',
  },
];

export function HowItWorks() {
  return (
    <Section id="how" className="py-20 md:py-28">
      <Reveal className="max-w-2xl">
        <Eyebrow>How it works</Eyebrow>
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
          One goal in. One verdict out.
        </h2>
        <p
          style={{
            fontSize: 'var(--text-lg)',
            lineHeight: 1.5,
            color: 'var(--text-secondary)',
            marginTop: 'var(--space-4)',
          }}
        >
          No flaky selector scripts to maintain. No transcript to parse. Describe what a
          user should be able to do; get back whether they can.
        </p>
      </Reveal>

      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {steps.map((s, i) => (
          <Reveal
            key={s.n}
            index={i}
            className="attest-lift"
            style={{
              backgroundColor: 'var(--surface-raised)',
              borderRadius: 'var(--radius-clay-md)',
              boxShadow: 'var(--clay-shadow)',
              padding: 'var(--space-6)',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-sm)',
                letterSpacing: 'var(--tracking-wide)',
                color: 'var(--accent-primary)',
              }}
            >
              {s.n}
            </span>
            <h3
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-xl)',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginTop: 'var(--space-3)',
              }}
            >
              {s.title}
            </h3>
            <p
              style={{
                fontSize: 'var(--text-base)',
                lineHeight: 1.6,
                color: 'var(--text-secondary)',
                marginTop: 'var(--space-2)',
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
