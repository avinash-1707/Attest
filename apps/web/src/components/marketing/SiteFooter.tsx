import Link from 'next/link';
import { Wordmark } from './Wordmark';

const cols: Array<{ title: string; links: Array<{ label: string; href: string }> }> = [
  {
    title: 'Product',
    links: [
      { label: 'How it works', href: '#how' },
      { label: 'Surfaces', href: '#surfaces' },
      { label: 'Pricing', href: '#pricing' },
      { label: 'FAQ', href: '#faq' },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'Sign in', href: '/sign-in' },
      { label: 'Start attesting', href: '/sign-up' },
    ],
  },
  {
    title: 'Source',
    links: [{ label: 'GitHub', href: 'https://github.com' }],
  },
];

export function SiteFooter() {
  return (
    <footer
      style={{
        borderTop: '1px solid var(--surface-border)',
        backgroundColor: 'var(--surface-base)',
      }}
    >
      <div className="mx-auto w-full max-w-[1120px] px-6 py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Wordmark />
            <p
              style={{
                fontSize: 'var(--text-sm)',
                lineHeight: 1.6,
                color: 'var(--text-muted)',
                marginTop: 'var(--space-4)',
                maxWidth: '28ch',
              }}
            >
              The QA primitive that verifies user outcomes in a real browser and returns a
              verdict agents loop on.
            </p>
          </div>

          {cols.map((c) => (
            <div key={c.title}>
              <div
                className="uppercase"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-2xs)',
                  letterSpacing: 'var(--tracking-wider)',
                  color: 'var(--text-muted)',
                  marginBottom: 'var(--space-4)',
                }}
              >
                {c.title}
              </div>
              <ul className="flex flex-col gap-3">
                {c.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="attest-link"
                      style={{
                        fontFamily: 'var(--font-sans)',
                        fontSize: 'var(--text-sm)',
                        color: 'var(--text-secondary)',
                        transition: 'color var(--dur-2) var(--ease-out)',
                      }}
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          className="mt-12 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center"
          style={{
            borderTop: '1px solid var(--surface-border)',
            paddingTop: 'var(--space-6)',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
              color: 'var(--text-muted)',
            }}
          >
            © 2026 Attest · Apache-2.0
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
              color: 'var(--text-muted)',
            }}
          >
            to bear witness that something is true
          </span>
        </div>
      </div>
    </footer>
  );
}
