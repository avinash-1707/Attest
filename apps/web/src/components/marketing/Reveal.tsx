'use client';

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ElementType, ReactNode } from 'react';

interface RevealProps {
  children: ReactNode;
  as?: ElementType;
  index?: number;
  className?: string;
  style?: CSSProperties;
  /** marks each child as a terminal stream line instead of a block reveal */
  stream?: boolean;
  id?: string;
}

// Duration-driven entrance, gated by IntersectionObserver (not scroll-linked).
// Reveals once, then unobserves. Fails open: no IO support -> shown immediately.
export function Reveal({
  children,
  as,
  index = 0,
  className = '',
  style,
  stream = false,
  id,
}: RevealProps) {
  const Tag = (as ?? 'div') as ElementType;
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || shown) return;
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShown(true);
            io.disconnect();
            break;
          }
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown]);

  const dataAttr = stream ? { 'data-stream-line': '' } : { 'data-reveal': '' };

  return (
    <Tag
      ref={ref}
      id={id}
      {...dataAttr}
      data-shown={shown || undefined}
      className={className}
      style={{ '--reveal-i': index, ...style } as CSSProperties}
    >
      {children}
    </Tag>
  );
}
