import type { ComponentType } from 'react';
import { Section, Eyebrow } from './Section';
import { Reveal } from './Reveal';
import { TargetIcon, BrowserIcon, SealIcon } from './art/StepIcons';

interface Step {
  n: string;
  title: string;
  body: string;
  Icon: ComponentType<{ className?: string }>;
}

const steps: Step[] = [
  {
    n: '01',
    title: 'State the outcome',
    body: 'Describe what a user should be able to do, in plain language. Your agent calls it over MCP, or you click Run in the dashboard.',
    Icon: TargetIcon,
  },
  {
    n: '02',
    title: 'Drive a real browser',
    body: 'Attest plans the journey, runs it in isolated Chromium exactly as a person would, and captures evidence at every step.',
    Icon: BrowserIcon,
  },
  {
    n: '03',
    title: 'Judge and attest',
    body: 'It weighs the outcome and returns a signed verdict: passed, failed, or inconclusive, with the root cause and what to do next.',
    Icon: SealIcon,
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
            fontSize: 'clamp(1.8rem, 3.8vw, 2.6rem)',
            lineHeight: 1.08,
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
          No selector scripts to babysit. No transcript to parse. Just describe the outcome
          and get back whether it holds.
        </p>
      </Reveal>

      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {steps.map((s, i) => (
          <Reveal
            key={s.n}
            index={i}
            interactive
            className="clay-card relative overflow-hidden"
            style={{
              backgroundColor: 'var(--surface-raised)',
              borderRadius: 'var(--radius-clay-md)',
              boxShadow: 'var(--clay-shadow)',
              padding: 'var(--space-6)',
            }}
          >
            <div className="flex items-center justify-between">
              <span
                className="clay-icon inline-flex items-center justify-center"
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 'var(--radius-clay-sm)',
                  backgroundColor: 'var(--surface-elevated)',
                  boxShadow: 'var(--clay-shadow)',
                }}
              >
                <s.Icon />
              </span>
              <span
                className="clay-stepnum"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-2xl)',
                  fontWeight: 500,
                  letterSpacing: 'var(--tracking-tight)',
                  color: 'var(--surface-border)',
                }}
              >
                {s.n}
              </span>
            </div>

            <h3
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-xl)',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginTop: 'var(--space-5)',
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
