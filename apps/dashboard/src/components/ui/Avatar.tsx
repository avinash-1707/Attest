'use client';

import { useState } from 'react';

export interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: number;
}

// Reusable avatar: renders a plain <img> when src is available (the /avatars/:userId route is
// public - no crossOrigin or credentials needed), with a graceful onError fallback to the
// initial-letter tile. The box is always reserved at the given size to prevent layout shift.
export function Avatar({ src, name, size = 22 }: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  const initial = (name || '?').charAt(0).toUpperCase();
  const showImage = !!src && !imgError;

  return (
    <span
      aria-hidden="true"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: 'var(--radius-full)',
        flexShrink: 0,
        overflow: 'hidden',
        backgroundColor: 'var(--surface-elevated)',
        boxShadow: 'var(--clay-shadow)',
        position: 'relative',
      }}
    >
      {showImage ? (
        <img
          src={src}
          alt={name ?? 'Avatar'}
          width={size}
          height={size}
          onError={() => setImgError(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
            borderRadius: 'var(--radius-full)',
          }}
        />
      ) : (
        <span
          style={{
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-sans)',
            fontSize: size <= 24 ? 'var(--text-2xs)' : size <= 40 ? 'var(--text-sm)' : 'var(--text-lg)',
            fontWeight: 700,
            lineHeight: 1,
            userSelect: 'none',
          }}
        >
          {initial}
        </span>
      )}
    </span>
  );
}
