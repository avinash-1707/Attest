'use client';

import { useSession } from '@/lib/auth-client';
import { useRuns } from '@/lib/hooks';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import type { BadgeStatus } from '@/components/ui/Badge';

export function HomePlaceholder() {
  const { data: session } = useSession();
  const { data: runsData, isPending: runsPending } = useRuns();

  const name = session?.user?.name ?? session?.user?.email ?? 'there';
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
          Welcome, {name.split(' ')[0] ?? name}
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-base)',
            color: 'var(--text-muted)',
          }}
        >
          Recent attestation runs are shown below. Full run management and live watch come in the next passes.
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
            padding: `var(--space-4) var(--space-5)`,
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
          {runsPending && <Spinner size="sm" style={{ color: 'var(--text-muted)' }} />}
        </div>

        {!runsPending && recentRuns.length === 0 && (
          <EmptyState
            title="No runs yet"
            description="Attestation runs submitted via the MCP or API will appear here."
          />
        )}

        {recentRuns.length > 0 && (
          <div
            style={{
              overflowX: 'auto',
            }}
          >
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
                <tr
                  style={{
                    backgroundColor: 'var(--surface-raised)',
                    borderBottom: '1px solid var(--data-border)',
                  }}
                >
                  <th
                    scope="col"
                    style={{
                      padding: `var(--space-3) var(--space-5)`,
                      textAlign: 'left',
                      fontFamily: 'var(--font-sans)',
                      fontSize: 'var(--text-xs)',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      letterSpacing: 'var(--tracking-wider)',
                      textTransform: 'uppercase',
                      width: '35%',
                    }}
                  >
                    Goal
                  </th>
                  <th
                    scope="col"
                    style={{
                      padding: `var(--space-3) var(--space-4)`,
                      textAlign: 'left',
                      fontFamily: 'var(--font-sans)',
                      fontSize: 'var(--text-xs)',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      letterSpacing: 'var(--tracking-wider)',
                      textTransform: 'uppercase',
                      width: '20%',
                    }}
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    style={{
                      padding: `var(--space-3) var(--space-4)`,
                      textAlign: 'left',
                      fontFamily: 'var(--font-sans)',
                      fontSize: 'var(--text-xs)',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      letterSpacing: 'var(--tracking-wider)',
                      textTransform: 'uppercase',
                      width: '25%',
                    }}
                  >
                    Run ID
                  </th>
                  <th
                    scope="col"
                    style={{
                      padding: `var(--space-3) var(--space-4)`,
                      textAlign: 'right',
                      fontFamily: 'var(--font-sans)',
                      fontSize: 'var(--text-xs)',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      letterSpacing: 'var(--tracking-wider)',
                      textTransform: 'uppercase',
                      width: '20%',
                    }}
                  >
                    Started
                  </th>
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
                        padding: `var(--space-3) var(--space-5)`,
                        color: 'var(--data-text)',
                        fontFamily: 'var(--font-sans)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={run.goal}
                    >
                      {run.goal}
                    </td>
                    <td style={{ padding: `var(--space-3) var(--space-4)` }}>
                      <Badge
                        status={(run.status ?? run.lifecycle) as BadgeStatus}
                      />
                    </td>
                    <td
                      style={{
                        padding: `var(--space-3) var(--space-4)`,
                        fontFamily: 'var(--font-mono)',
                        fontSize: 'var(--text-xs)',
                        color: 'var(--data-text-muted)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {run.runId}
                    </td>
                    <td
                      style={{
                        padding: `var(--space-3) var(--space-4)`,
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
