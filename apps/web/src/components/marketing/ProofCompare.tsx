import { Section, Eyebrow } from './Section';
import { Reveal } from './Reveal';

const evidence = ['screenshot', 'dom snapshot', 'network log'];

export function ProofCompare() {
  return (
    <Section className="py-20 md:py-28">
      <Reveal className="mx-auto max-w-2xl text-center">
        <Eyebrow>The difference</Eyebrow>
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
          Stop trusting the transcript.
        </h2>
        <p
          style={{
            fontSize: 'var(--text-lg)',
            lineHeight: 1.55,
            color: 'var(--text-secondary)',
            marginTop: 'var(--space-4)',
          }}
        >
          A model claiming success is not the same as success. Attest replaces the hopeful
          summary with something you can actually check.
        </p>
      </Reveal>

      <div className="mt-12 grid items-stretch gap-5 md:grid-cols-2">
        {/* The guess */}
        <Reveal
          index={0}
          className="flex flex-col"
          style={{
            backgroundColor: 'var(--surface-raised)',
            borderRadius: 'var(--radius-clay-md)',
            boxShadow: 'var(--clay-shadow)',
            padding: 'var(--space-8)',
          }}
        >
          <span
            className="uppercase"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
              letterSpacing: 'var(--tracking-wider)',
              color: 'var(--text-muted)',
            }}
          >
            Without Attest
          </span>

          <div
            className="mt-6 flex-1"
            style={{
              backgroundColor: 'var(--data-surface)',
              border: '1px dashed var(--data-border)',
              borderRadius: 'var(--radius-sm)',
              padding: 'var(--space-5)',
            }}
          >
            <p
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-base)',
                lineHeight: 1.6,
                color: 'var(--text-secondary)',
                fontStyle: 'italic',
              }}
            >
              &ldquo;I&rsquo;ve wired up checkout and tested the flow end to end. Everything
              works as expected.&rdquo;
            </p>
            <p
              className="mt-4 uppercase"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-2xs)',
                letterSpacing: 'var(--tracking-wide)',
                color: 'var(--color-warn-text)',
              }}
            >
              ~ unverified · no evidence · trust me
            </p>
          </div>

          <p
            style={{
              fontSize: 'var(--text-sm)',
              lineHeight: 1.55,
              color: 'var(--text-muted)',
              marginTop: 'var(--space-5)',
            }}
          >
            You merge it, or you go click through the flow yourself. Either way, you became
            the test.
          </p>
        </Reveal>

        {/* The proof */}
        <Reveal
          index={1}
          className="flex flex-col"
          style={{
            backgroundColor: 'var(--surface-raised)',
            borderRadius: 'var(--radius-clay-md)',
            boxShadow: 'var(--clay-shadow)',
            padding: 'var(--space-8)',
            border: '1px solid var(--accent-primary)',
          }}
        >
          <span
            className="uppercase"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
              letterSpacing: 'var(--tracking-wider)',
              color: 'var(--accent-primary)',
            }}
          >
            With Attest
          </span>

          <div
            className="mt-6 flex-1"
            style={{
              backgroundColor: 'var(--data-surface)',
              border: '1px solid var(--data-border)',
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden',
            }}
          >
            <div
              className="flex items-center justify-between"
              style={{
                padding: '9px 14px',
                backgroundColor: 'var(--color-pass)',
                color: 'var(--color-pass-text)',
                borderBottom: '1px solid var(--data-border)',
              }}
            >
              <span
                className="uppercase"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-sm)',
                  letterSpacing: 'var(--tracking-wide)',
                }}
              >
                + PASSED
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-2xs)',
                  color: 'var(--color-pass-text)',
                }}
              >
                24.8s
              </span>
            </div>

            <div style={{ padding: 'var(--space-4) var(--space-4) var(--space-3)' }}>
              <div
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--text-base)',
                  lineHeight: 1.5,
                  color: 'var(--data-text)',
                }}
              >
                User completes checkout with a saved card.
              </div>
              <div
                className="mt-3 flex flex-wrap gap-2"
                aria-label="evidence captured"
              >
                {evidence.map((e) => (
                  <span
                    key={e}
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 'var(--text-2xs)',
                      color: 'var(--data-text-muted)',
                      backgroundColor: 'var(--data-surface-alt)',
                      border: '1px solid var(--data-border)',
                      borderRadius: 'var(--radius-xs)',
                      padding: '2px 7px',
                    }}
                  >
                    {e}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <p
            style={{
              fontSize: 'var(--text-sm)',
              lineHeight: 1.55,
              color: 'var(--text-secondary)',
              marginTop: 'var(--space-5)',
            }}
          >
            A verdict, the root cause when it fails, and the evidence to back it, handed
            straight to the agent. It fixes its own work and you stay out of the loop.
          </p>
        </Reveal>
      </div>
    </Section>
  );
}
