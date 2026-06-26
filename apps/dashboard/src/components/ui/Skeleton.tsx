import type { CSSProperties } from 'react';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  style?: CSSProperties;
}

export function Skeleton({ width = '100%', height = 16, style }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      style={{
        width,
        height,
        backgroundColor: 'var(--surface-elevated)',
        borderRadius: 'var(--radius-clay-sm)',
        animation: 'attest-skeleton-pulse 1.8s cubic-bezier(0.37, 0, 0.63, 1) infinite',
        ...style,
      }}
    />
  );
}

interface SkeletonBlockProps {
  rows?: number;
  style?: CSSProperties;
}

export function SkeletonBlock({ rows = 3, style }: SkeletonBlockProps) {
  return (
    <div
      aria-label="Loading"
      aria-busy="true"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
        ...style,
      }}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton
          key={i}
          height={14}
          width={i === rows - 1 ? '70%' : '100%'}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ style }: { style?: CSSProperties }) {
  return (
    <div
      aria-label="Loading"
      aria-busy="true"
      style={{
        backgroundColor: 'var(--surface-raised)',
        borderRadius: 'var(--radius-clay-md)',
        boxShadow: 'var(--clay-shadow)',
        padding: 'var(--space-5)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
        ...style,
      }}
    >
      <Skeleton height={20} width="50%" />
      <SkeletonBlock rows={2} />
    </div>
  );
}
