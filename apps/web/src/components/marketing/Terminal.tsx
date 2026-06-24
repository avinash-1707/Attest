import { Section, Eyebrow } from './Section';
import { Reveal } from './Reveal';

type Line = { kind: 'cmd' | 'step' | 'pass' | 'muted'; text: string };

const lines: Line[] = [
  { kind: 'cmd', text: 'attest goal:"Sign up, verify email, land on dashboard"' },
  { kind: 'muted', text: '' },
  { kind: 'step', text: '→ planning journey · 5 steps' },
  { kind: 'step', text: '→ launching chromium · region us-east' },
  { kind: 'step', text: '→ executing 5/5 ✓' },
  { kind: 'step', text: '→ capturing evidence · 3 artifacts' },
  { kind: 'step', text: '→ running guards · 5/5 ✓' },
  { kind: 'step', text: '→ judging outcome' },
  { kind: 'muted', text: '' },
  { kind: 'pass', text: '+ PASSED   31.20s   verdict streamed to agent' },
];

function colorFor(kind: Line['kind']): string {
  switch (kind) {
    case 'cmd':
      return 'var(--data-text)';
    case 'pass':
      return 'var(--color-pass-text)';
    case 'step':
    case 'muted':
      return 'var(--data-text-muted)';
  }
}

export function Terminal() {
  return (
    <Section className="py-20 md:py-28">
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <Reveal className="max-w-xl">
          <Eyebrow>Same engine, both entry points</Eyebrow>
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
            A verdict your agent loops on.
          </h2>
          <p
            style={{
              fontSize: 'var(--text-lg)',
              lineHeight: 1.55,
              color: 'var(--text-secondary)',
              marginTop: 'var(--space-4)',
            }}
          >
            The agent reads the result and acts: ship on{' '}
            <span style={{ color: 'var(--color-pass-text)', fontFamily: 'var(--font-mono)' }}>
              passed
            </span>
            , fix on{' '}
            <span style={{ color: 'var(--color-fail-text)', fontFamily: 'var(--font-mono)' }}>
              failed
            </span>{' '}
            using the root-cause hypothesis and next action. Evidence stays stored and is
            returned by reference, so context stays cheap.
          </p>
        </Reveal>

        {/* Flat terminal readout — chrome materializes, lines stream once */}
        <Reveal
          style={{
            backgroundColor: 'var(--data-surface)',
            border: '1px solid var(--data-border)',
            borderRadius: 'var(--radius-0)',
          }}
        >
          <div
            className="flex items-center gap-2"
            style={{ padding: '8px 12px', borderBottom: '1px solid var(--data-border)' }}
          >
            <span style={{ width: 9, height: 9, borderRadius: 'var(--radius-full)', backgroundColor: 'var(--data-border)' }} />
            <span style={{ width: 9, height: 9, borderRadius: 'var(--radius-full)', backgroundColor: 'var(--data-border)' }} />
            <span style={{ width: 9, height: 9, borderRadius: 'var(--radius-full)', backgroundColor: 'var(--data-border)' }} />
            <span
              className="ml-2 uppercase"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-2xs)',
                letterSpacing: 'var(--tracking-wider)',
                color: 'var(--data-text-muted)',
              }}
            >
              mcp · attest
            </span>
          </div>
          <pre
            style={{
              margin: 0,
              padding: '14px',
              overflowX: 'auto',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
              lineHeight: 1.85,
            }}
          >
            {lines.map((l, i) => (
              <Reveal
                key={i}
                stream
                index={i}
                style={{ color: colorFor(l.kind), whiteSpace: 'pre' }}
              >
                {l.kind === 'cmd' ? (
                  <>
                    <span style={{ color: 'var(--accent-primary)' }}>$ </span>
                    {l.text}
                  </>
                ) : (
                  l.text || ' '
                )}
              </Reveal>
            ))}
          </pre>
        </Reveal>
      </div>
    </Section>
  );
}
