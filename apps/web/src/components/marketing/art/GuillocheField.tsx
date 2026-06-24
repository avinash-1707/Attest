import type { CSSProperties } from 'react';
import { guillocheStack } from './guilloche';

interface GuillocheFieldProps {
  className?: string;
  style?: CSSProperties;
  /** rosette lobe count — odd numbers read as more "engraved" */
  petals?: number;
  rings?: number;
  opacity?: number;
}

// Faint engraved weave that sits behind a section for certificate-grade texture.
// Decorative only (aria-hidden); stroke hairlines in the warm border tone, never a
// colored gradient fill. Radial-masked so it dissolves at the edges.
export function GuillocheField({
  className = '',
  style,
  petals = 13,
  rings = 16,
  opacity = 0.5,
}: GuillocheFieldProps) {
  const paths = guillocheStack({
    cx: 200,
    cy: 200,
    rings,
    innerBase: 26,
    ringGap: 9.5,
    amp: 7,
    petals,
  });

  return (
    <svg
      aria-hidden
      viewBox="0 0 400 400"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        opacity,
        WebkitMaskImage:
          'radial-gradient(circle at 50% 50%, #000 0%, #000 42%, transparent 72%)',
        maskImage:
          'radial-gradient(circle at 50% 50%, #000 0%, #000 42%, transparent 72%)',
        ...style,
      }}
    >
      {paths.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke={i % 4 === 0 ? 'var(--accent-primary)' : 'var(--surface-border)'}
          strokeWidth={i % 4 === 0 ? 0.5 : 0.4}
        />
      ))}
    </svg>
  );
}
