'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Wordmark } from './Wordmark';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useSession } from '@/lib/auth-client';
import { DASHBOARD_URL } from '@/lib/env';

const links = [
  { href: '#how', id: 'how', label: 'How it works' },
  { href: '#surfaces', id: 'surfaces', label: 'Surfaces' },
  { href: '#pricing', id: 'pricing', label: 'Pricing' },
  { href: '#faq', id: 'faq', label: 'FAQ' },
];

const signInStyle = {
  fontFamily: 'var(--font-sans)',
  fontSize: 'var(--text-md)',
  fontWeight: 500,
  color: 'var(--text-secondary)',
  padding: '8px 14px',
  borderRadius: 'var(--radius-clay-sm)',
} as const;

const ctaStyle = {
  backgroundColor: 'var(--accent-primary)',
  boxShadow: 'var(--clay-shadow-accent)',
  color: 'var(--text-on-accent)',
  fontFamily: 'var(--font-sans)',
  fontSize: 'var(--text-md)',
  fontWeight: 500,
  padding: '8px 16px',
  borderRadius: 'var(--radius-clay-sm)',
  textDecoration: 'none',
} as const;

export function SiteNav() {
  const [condensed, setCondensed] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const { data: session, isPending } = useSession();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        setCondensed(window.scrollY > 16);
        raf = 0;
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    const sections = links
      .map((l) => document.getElementById(l.id))
      .filter((el): el is HTMLElement => el !== null);
    if (!sections.length || typeof IntersectionObserver === 'undefined') return;
    const ratios = new Map<string, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          ratios.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0);
        }
        let best: string | null = null;
        let bestRatio = 0;
        for (const [id, ratio] of ratios) {
          if (ratio > bestRatio) {
            best = id;
            bestRatio = ratio;
          }
        }
        setActive(best);
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: [0, 0.5, 1] },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  const isAuthed = mounted && !isPending && !!session;
  const showPlaceholder = !mounted || isPending;

  return (
    <div
      className="sticky top-4 z-50 mx-auto mt-4 w-full px-6"
      style={{
        maxWidth: condensed ? '960px' : '1320px',
        transition: 'max-width 520ms var(--ease-out-expo)',
      }}
    >
      <nav
        className="attest-nav flex items-center justify-between"
        style={{
          backgroundColor: condensed ? 'var(--surface-raised)' : 'transparent',
          borderRadius: 'var(--radius-clay-lg)',
          boxShadow: condensed ? 'var(--clay-shadow-hover)' : 'none',
          padding: '9px 12px 9px 18px',
          transform: condensed ? 'translateY(8px)' : 'translateY(0)',
          transition:
            'transform 520ms var(--ease-out-expo), box-shadow 520ms var(--ease-out-expo), background-color 520ms var(--ease-out-expo)',
          willChange: 'transform',
        }}
      >
        <Link href="/" aria-label="Attest home">
          <Wordmark />
        </Link>

        <div
          className="hidden items-center gap-7 md:flex"
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-md)',
            color: 'var(--text-secondary)',
          }}
        >
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="attest-link attest-navlink"
              data-active={active === l.id || undefined}
              style={{ transition: 'color var(--dur-2) var(--ease-out)' }}
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />

          {showPlaceholder ? (
            /* Inert copy of the anonymous controls: identical box so the session resolving never shifts layout */
            <div aria-hidden style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: 0.5, pointerEvents: 'none' }}>
              <span className="hidden sm:inline-flex items-center" style={signInStyle}>
                Sign in
              </span>
              <span className="inline-flex items-center" style={ctaStyle}>
                Start attesting
              </span>
            </div>
          ) : isAuthed ? (
            /* Authenticated: show Dashboard CTA only */
            <a href={DASHBOARD_URL} className="inline-flex items-center clay-interactive" style={ctaStyle}>
              Dashboard
            </a>
          ) : (
            /* Anonymous: Sign in + Start attesting */
            <>
              <Link
                href="/sign-in"
                className="hidden sm:inline-flex items-center clay-interactive attest-link"
                style={signInStyle}
              >
                Sign in
              </Link>
              <Link href="/sign-up" className="inline-flex items-center clay-interactive" style={ctaStyle}>
                Start attesting
              </Link>
            </>
          )}
        </div>
      </nav>
    </div>
  );
}
