import type { SVGAttributes } from 'react';

interface SpinnerProps extends SVGAttributes<SVGSVGElement> {
  size?: 'sm' | 'md' | 'lg';
}

const sizes = { sm: 14, md: 20, lg: 28 } as const;

export function Spinner({ size = 'md', className = '', style, ...props }: SpinnerProps) {
  const px = sizes[size];

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className={`attest-spinner ${className}`}
      style={{ flexShrink: 0, ...style }}
      {...props}
    >
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" opacity="0.2" />
      <path
        d="M10 2a8 8 0 0 1 8 8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        style={{ transformOrigin: '10px 10px', animation: 'attest-spin 0.65s linear infinite' }}
      />
    </svg>
  );
}
