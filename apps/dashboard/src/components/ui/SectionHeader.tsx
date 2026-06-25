import type { ReactNode } from 'react';

interface SectionHeaderProps {
  description: string;
  action?: ReactNode;
}

export function SectionHeader({ description, action }: SectionHeaderProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-4)' }}>
      <p
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--text-sm)',
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
          maxWidth: '46ch',
        }}
      >
        {description}
      </p>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
}
