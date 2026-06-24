interface WordmarkProps {
  className?: string;
}

// The mark: a clay-framed aperture with a flat readout tick inside it.
// Soft frame, hard signal — the governing tension, at glyph scale.
export function Wordmark({ className = '' }: WordmarkProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span
        aria-hidden
        className="inline-flex items-center justify-center"
        style={{
          width: 26,
          height: 26,
          borderRadius: 'var(--radius-clay-sm)',
          backgroundColor: 'var(--accent-primary)',
          boxShadow: 'var(--clay-shadow-accent)',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M2.5 7.5L5.5 10.5L11.5 3.5"
            stroke="var(--text-on-accent)"
            strokeWidth="1.8"
            strokeLinecap="square"
          />
        </svg>
      </span>
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--text-lg)',
          fontWeight: 600,
          letterSpacing: 'var(--tracking-tight)',
          color: 'var(--text-primary)',
        }}
      >
        Attest
      </span>
    </span>
  );
}
