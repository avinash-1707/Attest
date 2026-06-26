'use client';

import Link from 'next/link';
import { useSession } from '@/lib/auth-client';
import { useRuns, useApps, useBillingSummary } from '@/lib/hooks';
import { summarizeRuns } from '@/lib/summarize';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';
import { OnboardingCard } from './OnboardingCard';
import type { BadgeStatus } from '@/components/ui/Badge';

export function HomePlaceholder() {
  const { data: session } = useSession();
  const { data: runsData, isPending: runsPending, error: runsError } = useRuns();
  const { data: apps, isPending: appsPending } = useApps();
  const { data: billing } = useBillingSummary();

  const name = session?.user?.name ?? session?.user?.email ?? 'there';
  const firstName = name.split(' ')[0] ?? name;
  const recentRuns = runsData?.runs.slice(0, 5) ?? [];
  const summary = runsData ? summarizeRuns(runsData.runs) : null;
  const activeApps = (apps ?? []).filter((a) => !a.archivedAt);
  const zeroApps = !appsPending && activeApps.length === 0;

  return (
    <div
      style={{
        padding: 'var(--space-8)',
        maxWidth: 800,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-8)',
      }}
    >
      <PageHeader
        title={`Welcome, ${firstName}`}
        description="Overview of recent attestation runs for this workspace."
        action={
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <Link href="/runs">
              <Button variant="secondary" size="sm">View all runs</Button>
            </Link>
            <Link href="/apps">
              <Button size="sm">Add app</Button>
            </Link>
          </div>
        }
      />

      {zeroApps && <OnboardingCard />}

      <StatCards summary={summary} runsPending={runsPending} billing={billing} />

      <div
        style={{
          backgroundColor: 'var(--surface-raised)',
          borderRadius: 'var(--radius-clay-md)',
          boxShadow: 'var(--clay-shadow)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: 'var(--space-4) var(--space-5)',
            borderBottom: '1px solid var(--surface-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--text-lg)',
              fontWeight: 500,
              color: 'var(--text-primary)',
            }}
          >
            Recent runs
          </h2>
          <Link
            href="/runs"
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--text-sm)',
              color: 'var(--text-muted)',
              textDecoration: 'none',
            }}
          >
            View all
          </Link>
        </div>

        {runsError && (
          <div style={{ padding: 'var(--space-5)' }}>
            <ErrorMessage
              message={`Runs failed to load: ${(runsError as Error).message}. Check your connection and reload.`}
            />
          </div>
        )}

        {runsPending && (
          <div style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} height={36} />
            ))}
          </div>
        )}

        {!runsPending && !runsError && recentRuns.length === 0 && (
          <EmptyState
            title="No runs yet"
            description="Attestation runs submitted via the MCP or API will appear here."
            action={
              <Link href="/runs">
                <Button variant="secondary">Go to Runs</Button>
              </Link>
            }
          />
        )}

        {recentRuns.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                tableLayout: 'fixed',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-sm)',
              }}
            >
              <caption style={{ display: 'none' }}>Recent attestation runs</caption>
              <thead>
                <tr style={{ backgroundColor: 'var(--surface-raised)', borderBottom: '1px solid var(--data-border)' }}>
                  <th scope="col" style={thStyle({ width: '38%' })}>Goal</th>
                  <th scope="col" style={thStyle({ width: '20%' })}>Status</th>
                  <th scope="col" style={thStyle({ width: '25%' })}>Run ID</th>
                  <th scope="col" style={thStyle({ width: '17%', textAlign: 'right' })}>Started</th>
                </tr>
              </thead>
              <tbody>
                {recentRuns.map((run, i) => (
                  <tr
                    key={run.runId}
                    style={{
                      backgroundColor: i % 2 === 0 ? 'var(--data-surface)' : 'var(--data-surface-alt)',
                      borderBottom: '1px solid var(--data-border)',
                    }}
                  >
                    <td
                      style={{
                        padding: 'var(--space-3) var(--space-4)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: 0,
                      }}
                      title={run.goal}
                    >
                      <Link
                        href={`/runs/${run.runId}`}
                        style={{
                          color: 'var(--data-text)',
                          textDecoration: 'none',
                          fontFamily: 'var(--font-sans)',
                          fontSize: 'var(--text-sm)',
                        }}
                      >
                        {run.goal}
                      </Link>
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                      <Badge status={(run.status ?? run.lifecycle) as BadgeStatus} />
                    </td>
                    <td
                      style={{
                        padding: 'var(--space-3) var(--space-4)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 'var(--text-xs)',
                        color: 'var(--data-text-muted)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: 0,
                      }}
                    >
                      {run.runId}
                    </td>
                    <td
                      style={{
                        padding: 'var(--space-3) var(--space-4)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 'var(--text-2xs)',
                        color: 'var(--data-text-muted)',
                        textAlign: 'right',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {new Date(run.createdAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

interface StatCardsProps {
  summary: ReturnType<typeof summarizeRuns> | null;
  runsPending: boolean;
  billing: { enabled: boolean; balance: number } | null | undefined;
}

function StatCards({ summary, runsPending, billing }: StatCardsProps) {
  if (runsPending) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-4)' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  const lowBalance = billing?.enabled && billing.balance < 100;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-4)' }}>
      <StatCard
        label="Total"
        value={summary ? String(summary.total) : '0'}
        qualifier="loaded"
      />
      <StatCard
        label="Passed"
        value={summary ? String(summary.passed) : '0'}
        valueColor="var(--color-pass-text)"
      />
      <StatCard
        label="Failed"
        value={summary ? String(summary.failed) : '0'}
        valueColor={summary && summary.failed > 0 ? 'var(--color-fail-text)' : undefined}
      />
      <StatCard
        label="In progress"
        value={summary ? String(summary.running + summary.queued) : '0'}
      />
      {billing !== undefined && (
        <StatCard
          label="Credits"
          value={billing?.enabled ? billing.balance.toLocaleString() : 'Unlimited'}
          valueColor={lowBalance ? 'var(--color-warn-text)' : undefined}
          warning={lowBalance ? 'Low balance' : undefined}
        />
      )}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  qualifier?: string;
  valueColor?: string;
  warning?: string;
}

function StatCard({ label, value, qualifier, valueColor, warning }: StatCardProps) {
  return (
    <Card className="attest-enter">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            color: 'var(--text-muted)',
            letterSpacing: 'var(--tracking-wider)',
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}
        >
          {label}
          {qualifier && (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-2xs)',
                color: 'var(--text-placeholder)',
                fontWeight: 400,
                letterSpacing: 0,
                textTransform: 'none',
              }}
            >
              ({qualifier})
            </span>
          )}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-2xl)',
            fontWeight: 700,
            color: valueColor ?? 'var(--data-text)',
            letterSpacing: 'var(--tracking-tight)',
            lineHeight: 1.1,
          }}
        >
          {value}
        </span>
        {warning && (
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--text-xs)',
              color: 'var(--color-warn-text)',
            }}
          >
            {warning}
          </span>
        )}
      </div>
    </Card>
  );
}

function thStyle(overrides?: React.CSSProperties): React.CSSProperties {
  return {
    padding: 'var(--space-3) var(--space-4)',
    textAlign: 'left',
    fontFamily: 'var(--font-sans)',
    fontSize: 'var(--text-xs)',
    fontWeight: 600,
    color: 'var(--text-muted)',
    letterSpacing: 'var(--tracking-wider)',
    textTransform: 'uppercase',
    ...overrides,
  };
}
