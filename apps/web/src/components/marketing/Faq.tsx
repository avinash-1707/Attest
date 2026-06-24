import { Section, Eyebrow } from './Section';
import { Reveal } from './Reveal';

const faqs = [
  {
    q: 'What exactly is an attestation?',
    a: 'A structured, evidence-backed verdict on whether a user outcome actually holds. It carries a result (passed, failed, or inconclusive), the root cause when something breaks, a suggested next action, and references to the captured evidence — screenshots, DOM, console, and network.',
  },
  {
    q: 'Does Attest read my source code?',
    a: 'No. Attest never ingests your codebase. It verifies the running product from the outside, exactly the way a real user meets it. That keeps the trust boundary clean and means it works regardless of language or framework.',
  },
  {
    q: 'How is this different from Playwright or Cypress?',
    a: 'Those make you write and maintain selector scripts that break when the UI shifts. With Attest you state an outcome in plain language; it plans and drives the journey itself, then judges the result. No brittle scripts, and the verdict is shaped for an agent to act on rather than a human to read.',
  },
  {
    q: 'Which agents and tools does it work with?',
    a: 'Anything that speaks MCP. Claude Code, Cursor, Codex, Cline, Windsurf, Zed, Gemini CLI, and more — your agent calls attest and loops on the verdict. A dashboard covers the same runs for people who prefer to click.',
  },
  {
    q: 'How are my credentials and secrets handled?',
    a: 'Credentials are encrypted at rest, never written to logs, never returned to a client, and never embedded in evidence. Every record is org-scoped with no cross-tenant query path, so isolation holds by construction.',
  },
  {
    q: 'Can I self-host?',
    a: 'Yes. The core is Apache-2.0 and self-hostable with no functional gap in the verdict loop. Run the whole thing on your own infrastructure, or let the hosted tier carry browsers, scaling, and billing — same codebase, same attestation.',
  },
  {
    q: 'What models does it use?',
    a: 'Models run through OpenRouter, so you can pick the model per role — planner, judge, and resolution fallback — and bring your own key. Most of the verdict is decided by deterministic guards, so model cost stays low.',
  },
  {
    q: 'What does a run cost?',
    a: 'The hosted tier is free to start with included credits, then usage-based — you pay per run, not per seat. Bring your own model key and a hosted run is infra-only. Self-hosting is free forever.',
  },
];

function Chevron() {
  return (
    <svg
      className="faq-chevron"
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden
      style={{ flexShrink: 0, transition: 'transform var(--dur-3) var(--ease-out)' }}
    >
      <path
        d="M4 7 L9 12 L14 7"
        stroke="var(--text-muted)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Faq() {
  return (
    <Section id="faq" className="py-20 md:py-28">
      <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <Reveal>
          <Eyebrow>FAQ</Eyebrow>
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
            Questions, answered.
          </h2>
          <p
            style={{
              fontSize: 'var(--text-lg)',
              lineHeight: 1.55,
              color: 'var(--text-secondary)',
              marginTop: 'var(--space-4)',
            }}
          >
            Still unsure?{' '}
            <a
              href="mailto:hello@attest.dev"
              className="attest-link"
              style={{ color: 'var(--accent-primary)', transition: 'color var(--dur-2) var(--ease-out)' }}
            >
              Ask us anything
            </a>
            .
          </p>
        </Reveal>

        <Reveal index={1} className="flex flex-col gap-3">
          {faqs.map((f) => (
            <details
              key={f.q}
              className="faq-item attest-lift"
              style={{
                backgroundColor: 'var(--surface-raised)',
                borderRadius: 'var(--radius-clay-md)',
                boxShadow: 'var(--clay-shadow)',
                overflow: 'hidden',
              }}
            >
              <summary
                className="flex cursor-pointer list-none items-center justify-between gap-4"
                style={{
                  padding: 'var(--space-5) var(--space-6)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--text-lg)',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                {f.q}
                <Chevron />
              </summary>
              <div className="faq-body">
                <p
                  style={{
                    padding: '0 var(--space-6) var(--space-5)',
                    fontSize: 'var(--text-base)',
                    lineHeight: 1.6,
                    color: 'var(--text-secondary)',
                  }}
                >
                  {f.a}
                </p>
              </div>
            </details>
          ))}
        </Reveal>
      </div>
    </Section>
  );
}
