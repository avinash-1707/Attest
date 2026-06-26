'use client';

import type { ReactNode, CSSProperties } from 'react';
import { useIsMobile } from '@/lib/useMediaQuery';

interface PageContainerProps {
  children: ReactNode;
  style?: CSSProperties;
}

export function PageContainer({ children, style }: PageContainerProps) {
  const isMobile = useIsMobile();

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 'var(--page-max)',
        margin: '0 auto',
        padding: isMobile ? 'var(--space-4)' : 'var(--space-8)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-6)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
