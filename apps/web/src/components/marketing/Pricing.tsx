import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { Section, Eyebrow } from './Section';
import { Reveal } from './Reveal';

// Launch pricing. Dollar amounts (Team $49 / Business $199) are provisional until finalized;
// plans sell on the credit allotment. Fill `price` per tier when numbers are locked. Base credits
// mirror ee/billing/plans.ts (Team 2,000 / Business 8,000); a run costs ~10 credits.
interface Tier {
  name: string;
  price: string;
  cadence: string;
  blurb: string;
  features: string[];
  cta: { label: string; href: string };
  featured?: boolean;
  footnote?: string;
}

const tiers: Tier[] = [
  {
    name: 'Open Source',
    price: '$0',
    cadence: 'self-hosted, forever',
    blurb: 'Run the entire verdict loop on your own infrastructure.',
    features: [
      'Unlimited runs',
      'Full attestation + evidence',
      'Bring your own models',
      'MCP server + dashboard',
      'Apache-2.0, no feature gate',
    ],
    cta: { label: 'View on GitHub', href: 'https://github.com' },
  },
  {
    name: 'Team',
    price: '$49',
    cadence: 'per month',
    blurb: 'Managed browsers and scaling for a team shipping daily.',
    features: [
      '2,500 credits / month',
      'Managed Chromium + autoscaling',
      'Live dashboard + evidence storage',
      'Pay-as-you-go top-ups',
      'Email support',
    ],
    cta: { label: 'Start attesting', href: '/sign-up' },
    footnote: '≈ 250 runs / month included. Extra credits are pay-as-you-go.',
  },
  {
    name: 'Business',
    price: '$199',
    cadence: 'per month',
    blurb: 'More headroom and faster turnaround for heavier pipelines.',
    features: [
      '10,000 credits / month',
      'Priority run queue',
      'Extended evidence retention',
      'Pay-as-you-go top-ups',
      'Priority support',
    ],
    cta: { label: 'Start attesting', href: '/sign-up' },
    featured: true,
    footnote: '≈ 1,000 runs / month included. Extra credits are pay-as-you-go.',
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    cadence: "let's talk",
    blurb: 'Control, scale, and a contract for the whole org.',
    features: [
      'SSO + roles',
      'Private cloud or self-host support',
      'Dedicated regions + BYOK',
      'SLA + priority support',
      'Hands-on onboarding',
    ],
    cta: { label: 'Talk to us', href: 'mailto:hello@attest.dev' },
  },
];

function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden style={{ flexShrink: 0, marginTop: 3 }}>
      <path
        d="M3 8.5 L6.5 12 L13 4"
        stroke="var(--accent-primary)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CardShell({ tier, children }: { tier: Tier; children: ReactNode }) {
  const style: CSSProperties = {
    backgroundColor: 'var(--surface-raised)',
    borderRadius: 'var(--radius-clay-md)',
    boxShadow: 'var(--clay-shadow)',
    padding: 'var(--space-6)',
    border: tier.featured ? '1px solid var(--accent-primary)' : '1px solid transparent',
  };
  return (
    <div className="relative flex flex-col" style={style}>
      {tier.featured && (
        <span
          className="absolute right-5 top-0 -translate-y-1/2 uppercase"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-2xs)',
            letterSpacing: 'var(--tracking-wider)',
            color: 'var(--text-on-accent)',
            backgroundColor: 'var(--accent-primary)',
            borderRadius: 'var(--radius-xs)',
            padding: '4px 10px',
            boxShadow: 'var(--clay-shadow-accent)',
          }}
        >
          Popular
        </span>
      )}
      {children}
    </div>
  );
}

export function Pricing() {
  return (
    <Section id="pricing" className="py-20 md:py-28">
      <Reveal className="mx-auto max-w-2xl text-center">
        <Eyebrow>Pricing</Eyebrow>
        <h2
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 700,
            fontSize: 'clamp(1.8rem, 3.8vw, 2.6rem)',
            lineHeight: 1.08,
            letterSpacing: 'var(--tracking-tight)',
            color: 'var(--text-primary)',
            marginTop: 'var(--space-4)',
          }}
        >
          Pay for proof, not for seats.
        </h2>
        <p
          style={{
            fontSize: 'var(--text-lg)',
            lineHeight: 1.55,
            color: 'var(--text-secondary)',
            marginTop: 'var(--space-4)',
          }}
        >
          Self-host the open core for nothing, or let us run the browsers. Each plan includes a monthly
          pool of credits; need more, top up as you go.
        </p>
      </Reveal>

      <div className="mt-14 grid items-start gap-5 md:grid-cols-2 lg:grid-cols-4">
        {tiers.map((t, i) => (
          <Reveal key={t.name} index={i}>
            <CardShell tier={t}>
              <span
                className="uppercase"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-xs)',
                  letterSpacing: 'var(--tracking-wider)',
                  color: t.featured ? 'var(--accent-primary)' : 'var(--text-muted)',
                }}
              >
                {t.name}
              </span>

              <div className="mt-4 flex items-baseline gap-2">
                <span
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: 'clamp(1.9rem, 3.4vw, 2.4rem)',
                    fontWeight: 700,
                    letterSpacing: 'var(--tracking-tight)',
                    color: 'var(--text-primary)',
                    lineHeight: 1,
                  }}
                >
                  {t.price}
                </span>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{t.cadence}</span>
              </div>

              <p
                style={{
                  fontSize: 'var(--text-sm)',
                  lineHeight: 1.55,
                  color: 'var(--text-secondary)',
                  marginTop: 'var(--space-4)',
                  minHeight: '3.4em',
                }}
              >
                {t.blurb}
              </p>

              <Link
                href={t.cta.href}
                className="clay-interactive mt-2 inline-flex items-center justify-center"
                style={{
                  width: '100%',
                  backgroundColor: t.featured ? 'var(--accent-primary)' : 'var(--surface-elevated)',
                  boxShadow: t.featured ? 'var(--clay-shadow-accent)' : 'var(--clay-shadow)',
                  color: t.featured ? 'var(--text-on-accent)' : 'var(--text-primary)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--text-md)',
                  fontWeight: 600,
                  padding: '11px 18px',
                  borderRadius: 'var(--radius-clay-sm)',
                }}
              >
                {t.cta.label}
              </Link>

              <hr className="attest-rule" style={{ margin: 'var(--space-5) 0' }} />

              <ul className="flex flex-1 flex-col gap-3">
                {t.features.map((f) => (
                  <li
                    key={f}
                    className="flex gap-3"
                    style={{ fontSize: 'var(--text-sm)', lineHeight: 1.5, color: 'var(--text-secondary)' }}
                  >
                    <Check />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              {t.footnote && (
                <p
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-2xs)',
                    lineHeight: 1.5,
                    color: 'var(--text-muted)',
                    marginTop: 'var(--space-5)',
                  }}
                >
                  {t.footnote}
                </p>
              )}
            </CardShell>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
