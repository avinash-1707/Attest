import { Section, Eyebrow } from './Section';
import { Reveal } from './Reveal';

export function OpenCore() {
  return (
    <Section id="open" className="py-20 md:py-28">
      <Reveal
        className="grid items-center gap-10 lg:grid-cols-[1fr_auto]"
        style={{
          backgroundColor: 'var(--surface-raised)',
          borderRadius: 'var(--radius-clay-lg)',
          boxShadow: 'var(--clay-shadow)',
          padding: 'clamp(28px, 5vw, 56px)',
        }}
      >
        <div className="max-w-2xl">
          <Eyebrow>Open core · Apache-2.0</Eyebrow>
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
            Trust you can read. Convenience when you want it.
          </h2>
          <p
            style={{
              fontSize: 'var(--text-lg)',
              lineHeight: 1.55,
              color: 'var(--text-secondary)',
              marginTop: 'var(--space-4)',
            }}
          >
            The core is open source and self-hostable. Run the whole verdict loop on your
            own infrastructure, or let the hosted tier handle browsers, scaling, and
            billing. Same codebase, same attestation.
          </p>
        </div>

        <a
          href="https://github.com"
          className="inline-flex items-center gap-2 clay-interactive attest-secondary-btn self-start"
          style={{
            backgroundColor: 'var(--surface-elevated)',
            boxShadow: 'var(--clay-shadow)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-md)',
            fontWeight: 500,
            padding: '12px 20px',
            borderRadius: 'var(--radius-clay-sm)',
            whiteSpace: 'nowrap',
          }}
        >
          <svg width="17" height="17" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          View on GitHub
        </a>
      </Reveal>
    </Section>
  );
}
