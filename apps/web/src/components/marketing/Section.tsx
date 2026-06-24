import type { ReactNode } from 'react';

interface SectionProps {
  children: ReactNode;
  className?: string;
  id?: string;
}

export function Section({ children, className = '', id }: SectionProps) {
  return (
    <section id={id} className={`mx-auto w-full max-w-[1120px] px-6 ${className}`}>
      {children}
    </section>
  );
}

interface EyebrowProps {
  children: ReactNode;
}

export function Eyebrow({ children }: EyebrowProps) {
  return (
    <span
      className="inline-block uppercase"
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-xs)',
        letterSpacing: 'var(--tracking-wider)',
        color: 'var(--accent-primary)',
      }}
    >
      {children}
    </span>
  );
}
