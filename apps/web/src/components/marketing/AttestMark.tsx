interface AttestMarkProps {
  size?: number;
  className?: string;
  title?: string;
}

// The Attest mark: an observation aperture (the real browser Attest watches through) closing onto a
// verdict checkmark - "watched where it actually happens, then proven." Oxblood medallion + cream
// signal, the house palette; token-colored so it reads on both dark and light grounds.
export function AttestMark({ size = 28, className = '', title = 'Attest' }: AttestMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      role="img"
      aria-label={title}
      className={className}
    >
      <circle cx="16" cy="16" r="13.5" fill="var(--accent-primary)" />
      <g fill="var(--text-on-accent)">
        <path d="M16 4 A12 12 0 0 1 26.4 10 L18.5 14.5 Z" opacity="0.92" />
        <path d="M26.4 10 A12 12 0 0 1 26.4 22 L17.5 16 Z" opacity="0.66" />
        <path d="M26.4 22 A12 12 0 0 1 16 28 L16.5 17.5 Z" opacity="0.8" />
      </g>
      <circle cx="16" cy="16" r="6" fill="var(--accent-primary)" />
      <path
        d="M13 16.3 L15.4 18.7 L19.4 13.6"
        stroke="var(--text-on-accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
