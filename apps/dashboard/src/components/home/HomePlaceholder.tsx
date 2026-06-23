'use client';

import Link from 'next/link';
import { useSession } from '@/lib/auth-client';
import { useRuns } from '@/lib/hooks';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import type { BadgeStatus } from '@/components/ui/Badge';

export function HomePlaceholder() {
  const { data: session } = useSession();
  const { data: runsData, isPending: runsPending } = useRuns();

  const name = session?.user?.name ?? session?.user?.email ?? 'there';
  const firstName = name.split(' ')[0] ?? name;
  const recentRuns = runsData?.runs.slice(0, 5) ?? [];

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
      <div>
        <h1
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-2xl)',
            fontWeight: 600,
            color: 'var(--text-primary)',
            letterSpacing: 'var(--tracking-tight)',
            marginBottom: 'var(--space-2)',
          }}
        >
          Welcome, {firstName}
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-base)',
            color: 'var(--text-muted)',
          }}
        >
          Recent attestation runs are shown below.
        </p>
      </div>

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            {runsPending && <Spinner size="sm" style={{ color: 'var(--text-muted)' }} />}
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
        </div>

        {!runsPending && recentRuns.length === 0 && (
          <EmptyState
            title="No runs yet"
            description="Attestation runs submitted via the MCP or API will appear here."
            action={
              <Link href="/runs">
                <Button>Go to Runs</Button>
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
                        padding: 'var(--space-3) var(--space-5)',
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
