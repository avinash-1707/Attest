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
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: [0, 0.5, 1] },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  const isAuthed = mounted && !isPending && !!session;
  const showPlaceholder = !mounted || isPending;

  return (
    <div className="sticky top-4 z-50 mx-auto w-full max-w-[1120px] px-6">
      <nav
        className="attest-nav flex items-center justify-between"
        style={{
          backgroundColor: 'var(--surface-raised)',
          borderRadius: 'var(--radius-clay-lg)',
          boxShadow: condensed ? 'var(--clay-shadow-hover)' : 'var(--clay-shadow)',
          padding: '9px 12px 9px 18px',
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
            /* Stable-dimension placeholder prevents layout shift while session resolves */
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                opacity: 0.5,
                pointerEvents: 'none',
              }}
            >
              <div
                style={{
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-clay-sm)',
                  backgroundColor: 'var(--surface-elevated)',
                  width: 68,
                  height: 36,
                }}
              />
              <div
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-clay-sm)',
                  backgroundColor: 'var(--accent-primary)',
                  width: 116,
                  height: 36,
                }}
              />
            </div>
          ) : isAuthed ? (
            /* Authenticated: show Dashboard CTA only */
            <a
              href={DASHBOARD_URL}
              className="inline-flex items-center clay-interactive"
              style={{
                backgroundColor: 'var(--accent-primary)',
                boxShadow: 'var(--clay-shadow-accent)',
                color: 'var(--text-on-accent)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-md)',
                fontWeight: 500,
                padding: '8px 16px',
                borderRadius: 'var(--radius-clay-sm)',
                textDecoration: 'none',
              }}
            >
              Dashboard
            </a>
          ) : (
            /* Anonymous: original Sign in + Start attesting */
            <>
              <Link
                href="/sign-in"
                className="hidden sm:inline-flex items-center clay-interactive attest-link"
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--text-md)',
                  fontWeight: 500,
                  color: 'var(--text-secondary)',
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-clay-sm)',
                }}
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="inline-flex items-center clay-interactive"
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  boxShadow: 'var(--clay-shadow-accent)',
                  color: 'var(--text-on-accent)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--text-md)',
                  fontWeight: 500,
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-clay-sm)',
                }}
              >
                Start attesting
              </Link>
            </>
          )}
        </div>
      </nav>
    </div>
  );
}
