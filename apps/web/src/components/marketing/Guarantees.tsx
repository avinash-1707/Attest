import { Section, Eyebrow } from './Section';
import { Reveal } from './Reveal';

const items = [
  {
    k: 'No source ingestion',
    v: 'Attest never reads your codebase. It verifies the running product from the outside, the way a user meets it.',
  },
  {
    k: 'Tenant isolation',
    v: 'Every record is org-scoped. There is no cross-tenant query path — isolation holds by construction, not by policy.',
  },
  {
    k: 'Secrets stay secret',
    v: 'Credentials are encrypted at rest, never logged, never returned to a client, and never written into evidence.',
  },
  {
    k: 'Yours to run',
    v: 'Apache-2.0 core. Run the whole loop on your own infrastructure, or let the hosted tier carry it. No verdict gap.',
  },
];

function ShieldCheck() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <path
        d="M11 2 L19 5 V11 C19 16 15.5 19 11 20.5 C6.5 19 3 16 3 11 V5 Z"
        stroke="var(--surface-border)"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M7.5 11 L10 13.5 L14.5 8"
        stroke="var(--accent-primary)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Guarantees() {
  return (
    <Section className="py-20 md:py-28">
      <Reveal className="max-w-2xl">
        <Eyebrow>Built to be trusted</Eyebrow>
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
          A verdict you can stake the deploy on.
        </h2>
      </Reveal>

      <div className="mt-12 grid gap-5 sm:grid-cols-2">
        {items.map((t, i) => (
          <Reveal
            key={t.k}
            index={i % 2}
            className="flex gap-4"
            style={{
              backgroundColor: 'var(--surface-raised)',
              borderRadius: 'var(--radius-clay-md)',
              boxShadow: 'var(--clay-shadow)',
              padding: 'var(--space-6)',
            }}
          >
            <span
              className="inline-flex shrink-0 items-center justify-center"
              style={{
                width: 40,
                height: 40,
                borderRadius: 'var(--radius-clay-sm)',
                backgroundColor: 'var(--surface-elevated)',
                boxShadow: 'var(--clay-shadow)',
              }}
            >
              <ShieldCheck />
            </span>
            <div>
              <div
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--text-lg)',
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
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
