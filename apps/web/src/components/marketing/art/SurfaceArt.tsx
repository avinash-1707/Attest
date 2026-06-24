// Engraved illustrations for the two product surfaces. Schematic line-art, token colors.

const structure = 'var(--surface-border)';
const signal = 'var(--accent-primary)';
const ink = 'var(--text-muted)';

// MCP: a hub the agents plug into, all routing to one engine.
export function McpArt({ className }: { className?: string }) {
  const nodes = [
    { x: 26, y: 26 },
    { x: 26, y: 64 },
    { x: 26, y: 102 },
  ];
  return (
    <svg viewBox="0 0 260 128" width="100%" className={className} fill="none" aria-hidden>
      {nodes.map((n, i) => (
        <g key={i}>
          <path d={`M${n.x + 22} ${n.y} H120`} stroke={structure} strokeWidth="1.2" strokeDasharray="2 3" />
          <rect x={n.x - 22} y={n.y - 11} width="44" height="22" rx="4" stroke={structure} strokeWidth="1.2" />
          <circle cx={n.x - 10} cy={n.y} r="2" fill={ink} />
          <line x1={n.x - 2} y1={n.y} x2={n.x + 12} y2={n.y} stroke={ink} strokeWidth="1.2" />
        </g>
      ))}
      {/* central engine node */}
      <circle cx="148" cy="64" r="22" stroke={signal} strokeWidth="1.6" />
      <circle cx="148" cy="64" r="13" stroke={structure} strokeWidth="1" strokeDasharray="1.5 2.5" />
      <path d="M141 64 L146 69 L156 58" stroke={signal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* verdict out */}
      <path d="M170 64 H232" stroke={signal} strokeWidth="1.4" />
      <path d="M226 59 L234 64 L226 69" stroke={signal} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

// Dashboard: a window with a verdict row and an evidence preview.
export function DashboardArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 260 128" width="100%" className={className} fill="none" aria-hidden>
      <rect x="14" y="14" width="232" height="100" rx="5" stroke={structure} strokeWidth="1.2" />
      <line x1="14" y1="34" x2="246" y2="34" stroke={structure} strokeWidth="1.2" />
      <circle cx="24" cy="24" r="2" fill={ink} />
      <circle cx="32" cy="24" r="2" fill={ink} />
      <circle cx="40" cy="24" r="2" fill={ink} />
      {/* verdict pill */}
      <rect x="28" y="48" width="78" height="18" rx="2" stroke={signal} strokeWidth="1.3" />
      <path d="M37 57 L41 61 L48 52" stroke={signal} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="58" y1="57" x2="98" y2="57" stroke={ink} strokeWidth="1.4" />
      {/* rows */}
      <line x1="28" y1="80" x2="150" y2="80" stroke={structure} strokeWidth="1.2" />
      <line x1="28" y1="92" x2="120" y2="92" stroke={structure} strokeWidth="1.2" />
      <line x1="28" y1="104" x2="138" y2="104" stroke={structure} strokeWidth="1.2" />
      {/* evidence thumb */}
      <rect x="170" y="48" width="58" height="56" rx="3" stroke={structure} strokeWidth="1.2" />
      <path d="M170 92 L186 78 L198 88 L210 76 L228 92" stroke={ink} strokeWidth="1.2" fill="none" strokeLinejoin="round" />
      <circle cx="208" cy="62" r="4" stroke={signal} strokeWidth="1.3" />
    </svg>
  );
}
