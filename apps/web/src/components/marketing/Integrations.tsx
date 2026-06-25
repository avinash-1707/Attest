import { Section } from './Section';

const hosts = [
  'Claude Code',
  'Cursor',
  'Codex',
  'Cline',
  'Windsurf',
  'Zed',
  'Gemini CLI',
  'Continue',
  'Roo Code',
];

function Row() {
  return (
    <div className="flex shrink-0 items-center attest-marquee" aria-hidden>
      {hosts.map((h) => (
        <span
          key={h}
          className="attest-host flex items-center gap-3"
          style={{ padding: '0 var(--space-8)', whiteSpace: 'nowrap' }}
        >
          <span
            aria-hidden
            className="attest-host-dot"
            style={{
              width: 5,
              height: 5,
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--accent-primary)',
              opacity: 0.7,
            }}
          />
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--text-lg)',
              fontWeight: 500,
            }}
          >
            {h}
          </span>
        </span>
      ))}
    </div>
  );
}

export function Integrations() {
  return (
    <Section className="pb-6 md:pb-10">
      <p
        className="text-center uppercase"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-xs)',
          letterSpacing: 'var(--tracking-wider)',
          color: 'var(--text-muted)',
          marginBottom: 'var(--space-6)',
        }}
      >
        Speaks MCP. Drops into any agent you already run
      </p>

      <div className="attest-marquee-track attest-edge-fade overflow-hidden">
        <div className="flex w-max">
          <Row />
          <Row />
        </div>
      </div>
    </Section>
  );
}
