import type { HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padding?: 'default' | 'compact' | 'none';
  as?: 'div' | 'section' | 'article';
}

const paddingValues = {
  default: 'var(--space-5)',
  compact: 'var(--space-4)',
  none: '0',
};

export function Card({ children, padding = 'default', as: Tag = 'div', className = '', style, ...props }: CardProps) {
  return (
    <Tag
      className={className}
      style={{
        backgroundColor: 'var(--surface-raised)',
        borderRadius: 'var(--radius-clay-md)',
        boxShadow: 'var(--clay-shadow)',
        padding: paddingValues[padding],
        ...style,
      }}
      {...props}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({ children, className = '', style, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={className}
      style={{
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--text-lg)',
        fontWeight: 500,
        color: 'var(--text-primary)',
        marginBottom: 'var(--space-4)',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
