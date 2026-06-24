'use client';

import { useState } from 'react';
import { useBillingSummary, useCheckout, useBillingPortal } from '@/lib/hooks';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { PageHeader } from '@/components/ui/PageHeader';

function planLabel(planId: string): string {
  if (planId === 'team') return 'Team';
  if (planId === 'business') return 'Business';
  return planId.charAt(0).toUpperCase() + planId.slice(1);
}

function SubscriptionStatusBadge({ status }: { status: string }) {
  const isActive = status === 'active';
  const isPastDue = status === 'past_due';

  const bg = isActive
    ? 'var(--color-pass)'
    : isPastDue
      ? 'var(--color-warn)'
      : 'var(--surface-elevated)';

  const text = isActive
    ? 'var(--color-pass-text)'
    : isPastDue
      ? 'var(--color-warn-text)'
      : 'var(--text-muted)';

  const prefix = isActive ? '+' : isPastDue ? '~' : '·';

  return (
    <span
      role="status"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        backgroundColor: bg,
        color: text,
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-xs)',
        letterSpacing: 'var(--tracking-wide)',
        textTransform: 'uppercase',
        borderRadius: 'var(--radius-xs)',
        padding: '2px 6px',
      }}
    >
      <span aria-hidden="true" style={{ fontSize: '0.9em', lineHeight: 1 }}>{prefix}</span>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

interface PlanCardProps {
  name: string;
  planId: string;
  credits: string;
  activePlanId: string | null;
  onSubscribe: (planId: string) => void;
  isPending: boolean;
  pendingPlanId: string | null;
}

function PlanCard({ name, planId, credits, activePlanId, onSubscribe, isPending, pendingPlanId }: PlanCardProps) {
  const isActive = activePlanId === planId;
  const isOtherActive = activePlanId !== null && activePlanId !== planId;
  const isThisPending = pendingPlanId === planId && isPending;

  const buttonLabel = isOtherActive ? `Switch to ${name}` : 'Subscribe';

  return (
    <Card
      as="article"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
        flex: 1,
        minWidth: 220,
        outline: isActive ? '1px solid var(--accent-primary)' : undefined,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--text-lg)',
              fontWeight: 500,
              color: 'var(--text-primary)',
            }}
          >
            {name}
          </span>
          {isActive && (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-2xs)',
                letterSpacing: 'var(--tracking-wide)',
                textTransform: 'uppercase',
                color: 'var(--accent-primary)',
              }}
            >
              Current
            </span>
          )}
        </div>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-sm)',
            color: 'var(--data-text-muted)',
          }}
        >
          {credits}
        </span>
      </div>

      {!isActive && (
        <Button
          variant="secondary"
          size="sm"
          disabled={isPending}
          loading={isThisPending}
          onClick={() => onSubscribe(planId)}
          aria-label={`${buttonLabel} plan`}
        >
          {buttonLabel}
        </Button>
      )}
    </Card>
  );
}

export function BillingView() {
  const { data: summary, isPending: summaryPending, error: summaryError } = useBillingSummary();
  const checkout = useCheckout();
  const portal = useBillingPortal();

  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);

  async function handleSubscribe(planId: string) {
    setPendingPlanId(planId);
    try {
      const result = await checkout.mutateAsync({ kind: 'plan', planId });
      window.location.href = result.url;
    } finally {
      setPendingPlanId(null);
    }
  }

  async function handleBuyPack() {
    const result = await checkout.mutateAsync({ kind: 'pack', planId: 'pack' });
    window.location.href = result.url;
  }

  async function handlePortal() {
    const result = await portal.mutateAsync();
    window.location.href = result.url;
  }

  return (
    <div
      style={{
        padding: 'var(--space-8)',
        maxWidth: 820,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-6)',
      }}
    >
      <PageHeader
        title="Billing"
        description="Credits fund attestation runs. Each run costs approximately 10 credits."
      />

      {summaryPending ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
          <Spinner style={{ color: 'var(--text-muted)' }} />
        </div>
      ) : summaryError ? (
        <ErrorMessage message={(summaryError as Error).message} />
      ) : !summary?.enabled ? (
        <EmptyState
          title="Self-hosted"
          description="This deployment runs unlimited. No credits, no billing."
        />
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <h2
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-xl)',
                fontWeight: 600,
                color: 'var(--text-primary)',
                letterSpacing: 'var(--tracking-tight)',
              }}
            >
              Balance
            </h2>

            <Card style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-8)', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    letterSpacing: 'var(--tracking-wider)',
                    textTransform: 'uppercase',
                  }}
                >
                  Credits
                </span>
                <span
                  aria-label={`${summary.balance} credits`}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-3xl)',
                    fontWeight: 700,
                    color: 'var(--data-text)',
                    letterSpacing: 'var(--tracking-tight)',
                    lineHeight: 1.1,
                  }}
                >
                  {summary.balance.toLocaleString()}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--data-text-muted)',
                  }}
                >
                  {'≈'} {Math.floor(summary.balance / 10).toLocaleString()} runs
                </span>
              </div>

              <div
                style={{
                  width: 1,
                  alignSelf: 'stretch',
                  backgroundColor: 'var(--surface-border)',
                  flexShrink: 0,
                }}
                aria-hidden="true"
              />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    letterSpacing: 'var(--tracking-wider)',
                    textTransform: 'uppercase',
                  }}
                >
                  Plan
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: 'var(--text-md)',
                      fontWeight: 500,
                      color: summary.planId ? 'var(--text-primary)' : 'var(--text-muted)',
                    }}
                  >
                    {summary.planId ? planLabel(summary.planId) : 'No active plan'}
                  </span>
                  {summary.subscriptionStatus && (
                    <SubscriptionStatusBadge status={summary.subscriptionStatus} />
                  )}
                </div>
              </div>
            </Card>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <h2
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-xl)',
                fontWeight: 600,
                color: 'var(--text-primary)',
                letterSpacing: 'var(--tracking-tight)',
              }}
            >
              Plans
            </h2>

            <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
              <PlanCard
                name="Team"
                planId="team"
                credits="2,500 credits / month · $49"
                activePlanId={summary.planId}
                onSubscribe={handleSubscribe}
                isPending={checkout.isPending}
                pendingPlanId={pendingPlanId}
              />
              <PlanCard
                name="Business"
                planId="business"
                credits="10,000 credits / month · $199"
                activePlanId={summary.planId}
                onSubscribe={handleSubscribe}
                isPending={checkout.isPending}
                pendingPlanId={pendingPlanId}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <h2
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-xl)',
                fontWeight: 600,
                color: 'var(--text-primary)',
                letterSpacing: 'var(--tracking-tight)',
              }}
            >
              Add credits
            </h2>

            <Card>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--space-6)',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: 'var(--text-md)',
                      fontWeight: 500,
                      color: 'var(--text-primary)',
                    }}
                  >
                    Credit pack
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: 'var(--text-sm)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    One-time top-up. Credits do not expire.
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={checkout.isPending}
                    loading={checkout.isPending && pendingPlanId === null}
                    onClick={handleBuyPack}
                    aria-label="Buy a credit pack"
                  >
                    Buy a credit pack
                  </Button>

                  {summary.planId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={portal.isPending}
                      loading={portal.isPending}
                      onClick={handlePortal}
                      aria-label="Manage billing in the customer portal"
                    >
                      Manage billing
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          </div>

          {(checkout.error || portal.error) && (
            <ErrorMessage
              message={
                ((checkout.error ?? portal.error) as Error).message
              }
              onDismiss={() => {
                if (checkout.error) checkout.reset();
                if (portal.error) portal.reset();
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
