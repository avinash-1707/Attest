// Line-art icons for the three-step flow. Stroke-based, engraved feel, token colors.
// Accent on the active signal stroke, border tone on structure — matches the seal.

interface IconProps {
  className?: string;
}

const base = {
  width: 44,
  height: 44,
  viewBox: '0 0 44 44',
  fill: 'none',
} as const;

const structure = 'var(--surface-border)';
const signal = 'var(--accent-primary)';

// 01 — State the outcome: a dial target locked on center.
export function TargetIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden>
      <circle cx="22" cy="22" r="16" stroke={structure} strokeWidth="1.4" />
      <circle cx="22" cy="22" r="9" stroke={structure} strokeWidth="1.4" />
      <circle cx="22" cy="22" r="2.6" fill={signal} />
      <line x1="22" y1="2" x2="22" y2="8" stroke={signal} strokeWidth="1.6" strokeLinecap="round" />
      <line x1="22" y1="36" x2="22" y2="42" stroke={signal} strokeWidth="1.6" strokeLinecap="round" />
      <line x1="2" y1="22" x2="8" y2="22" stroke={signal} strokeWidth="1.6" strokeLinecap="round" />
      <line x1="36" y1="22" x2="42" y2="22" stroke={signal} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

// 02 — Drive a real browser: a window with a tracked cursor path.
export function BrowserIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden>
      <rect x="5" y="8" width="34" height="28" rx="3" stroke={structure} strokeWidth="1.4" />
      <line x1="5" y1="15" x2="39" y2="15" stroke={structure} strokeWidth="1.4" />
      <circle cx="9.5" cy="11.5" r="1.1" fill={structure} />
      <circle cx="13.5" cy="11.5" r="1.1" fill={structure} />
      <path
        d="M14 22 L26 26 L23 28.5 L26 32 L24 33 L21 29.5 L18.5 32 Z"
        fill={signal}
        stroke={signal}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// 03 — Judge and attest: a struck seal with a checkmark.
export function SealIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden>
      <circle cx="22" cy="22" r="16" stroke={structure} strokeWidth="1.4" />
      <circle cx="22" cy="22" r="11.5" stroke={structure} strokeWidth="1" strokeDasharray="1.5 3" />
      <path
        d="M15.5 22.5 L20 27 L29 16.5"
        stroke={signal}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
