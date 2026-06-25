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
  /** track the pointer across this element as --mx/--my (%) for clay-card light */
  interactive?: boolean;
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
  interactive = false,
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

  // Pointer telemetry for clay-card light. Gated to a real (non-touch) pointer
  // and disabled under reduced-motion; writes vars directly (local read, no cascade).
  useEffect(() => {
    if (!interactive) return;
    const el = ref.current;
    if (!el || typeof matchMedia === 'undefined') return;
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let raf = 0;
    let nx = 50;
    let ny = 0;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      nx = ((e.clientX - r.left) / r.width) * 100;
      ny = ((e.clientY - r.top) / r.height) * 100;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        el.style.setProperty('--mx', `${nx}%`);
        el.style.setProperty('--my', `${ny}%`);
        raf = 0;
      });
    };
    const onLeave = () => {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      el.style.removeProperty('--mx');
      el.style.removeProperty('--my');
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [interactive]);

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
