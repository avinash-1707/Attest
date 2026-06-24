'use client';

import { useEffect, useRef, useState } from 'react';

interface MetricProps {
  /** integer target to count to */
  value: number;
  prefix?: string;
  suffix?: string;
  label: string;
}

const DURATION = 900;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export function Metric({ value, prefix = '', suffix = '', label }: MetricProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [display, setDisplay] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || done) return;

    const reduce =
      typeof matchMedia !== 'undefined' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches;

    const start = () => {
      if (reduce || typeof requestAnimationFrame === 'undefined') {
        setDisplay(value);
        setDone(true);
        return;
      }
      let raf = 0;
      let t0 = 0;
      const tick = (ts: number) => {
        if (!t0) t0 = ts;
        const p = Math.min((ts - t0) / DURATION, 1);
        setDisplay(Math.round(easeOut(p) * value));
        if (p < 1) raf = requestAnimationFrame(tick);
        else setDone(true);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    };

    if (typeof IntersectionObserver === 'undefined') return start();
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          start();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [value, done]);

  return (
    <div ref={ref} style={{ padding: 'var(--space-6)' }}>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'clamp(1.9rem, 4vw, 2.6rem)',
          fontWeight: 500,
          lineHeight: 1,
          letterSpacing: 'var(--tracking-tight)',
          color: 'var(--text-primary)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {prefix}
        {display}
        {suffix}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--text-sm)',
          lineHeight: 1.45,
          color: 'var(--text-muted)',
          marginTop: 'var(--space-3)',
          maxWidth: '22ch',
        }}
      >
        {label}
      </div>
    </div>
  );
}
