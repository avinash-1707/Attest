'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRuns, useCreateRun } from '@/lib/hooks';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { CreateRunForm } from './CreateRunForm';
import type { RunListItem, RunCreate } from '@attest/contracts';
import type { BadgeStatus } from '@/components/ui/Badge';

type VerdictFilter = 'all' | 'passed' | 'failed' | 'inconclusive';

export function RunsView() {
  const router = useRouter();
  const { data: runsData, isPending } = useRuns();
  const createRun = useCreateRun();

  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<VerdictFilter>('all');

  const allRuns = runsData?.runs ?? [];

  const filtered = filter === 'all'
    ? allRuns
    : allRuns.filter((r) => {
        if (filter === 'passed') return r.status === 'passed';
        if (filter === 'failed') return r.status === 'failed';
        if (filter === 'inconclusive') return r.status === 'inconclusive';
        return true;
      });

  function handleCreate(data: RunCreate) {
    createRun.mutate(data, {
      onSuccess: (created) => {
        setShowCreate(false);
        createRun.reset();
        router.push(`/runs/${created.runId}`);
      },
    });
  }

  return (
    <div style={{ padding: 'var(--space-8)', maxWidth: 900, display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}> {/* wide table width; standard content pages use 800 */}
      <PageHeader
        title="Runs"
        description="Attestation runs submitted via the MCP server or dashboard. Click any row to see the full report."
        action={<Button onClick={() => setShowCreate(true)}>New run</Button>}
      />

      <FilterTabs current={filter} onChange={setFilter} runs={allRuns} />

      {isPending ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
          <Spinner style={{ color: 'var(--text-muted)' }} />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={filter === 'all' ? 'No runs yet' : `No ${filter} runs`}
          description={
            filter === 'all'
              ? 'Start a run from the MCP server, the API, or the button above.'
              : `There are no runs with a ${filter} verdict yet.`
          }
          action={filter === 'all' ? <Button onClick={() => setShowCreate(true)}>Start your first run</Button> : undefined}
        />
      ) : (
        <Card padding="none" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                tableLayout: 'fixed',
              }}
            >
              <caption style={{ display: 'none' }}>Attestation runs</caption>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--data-border)' }}>
                  <Th style={{ width: '35%' }}>Goal</Th>
                  <Th style={{ width: '14%' }}>Lifecycle</Th>
                  <Th style={{ width: '13%' }}>Verdict</Th>
                  <Th style={{ width: '12%' }}>Duration</Th>
                  <Th style={{ width: '16%' }}>Started</Th>
                  <Th style={{ width: '10%' }} />
                </tr>
              </thead>
              <tbody>
                {filtered.map((run, i) => (
                  <RunRow key={run.runId} run={run} even={i % 2 === 0} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        open={showCreate}
        onClose={() => { setShowCreate(false); createRun.reset(); }}
        title="New run"
        width={520}
      >
        <CreateRunForm
          onSubmit={handleCreate}
          onCancel={() => { setShowCreate(false); createRun.reset(); }}
          isPending={createRun.isPending}
          error={createRun.error ? (createRun.error as Error).message : null}
        />
      </Modal>
    </div>
  );
}

function FilterTabs({
  current,
  onChange,
  runs,
}: {
  current: VerdictFilter;
  onChange: (f: VerdictFilter) => void;
  runs: RunListItem[];
}) {
  const counts: Record<VerdictFilter, number> = {
    all: runs.length,
    passed: runs.filter((r) => r.status === 'passed').length,
    failed: runs.filter((r) => r.status === 'failed').length,
    inconclusive: runs.filter((r) => r.status === 'inconclusive').length,
  };

  const tabs: { value: VerdictFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'passed', label: 'Passed' },
    { value: 'failed', label: 'Failed' },
    { value: 'inconclusive', label: 'Inconclusive' },
  ];

  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--space-2)',
        borderBottom: '1px solid var(--surface-border)',
        paddingBottom: 0,
      }}
    >
      {tabs.map((tab) => {
        const active = current === tab.value;
        return (
          <button
            key={tab.value}
            onClick={() => onChange(tab.value)}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--text-sm)',
              fontWeight: active ? 500 : 400,
              color: active ? 'var(--text-primary)' : 'var(--text-muted)',
              background: 'none',
              border: 'none',
              borderBottom: active ? '2px solid var(--accent-primary)' : '2px solid transparent',
              marginBottom: -1,
              cursor: 'pointer',
              transition: 'color var(--dur-2) var(--ease-out), border-bottom-color var(--dur-2) var(--ease-out)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
            }}
          >
            {tab.label}
            {counts[tab.value] > 0 && (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-2xs)',
                  color: active ? 'var(--accent-primary)' : 'var(--text-muted)',
                  backgroundColor: 'var(--surface-elevated)',
                  borderRadius: 'var(--radius-xs)',
                  padding: '0 5px',
                  lineHeight: '18px',
                  display: 'inline-block',
                }}
              >
                {counts[tab.value]}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function Th({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <th
      scope="col"
      style={{
        padding: 'var(--space-3) var(--space-4)',
        textAlign: 'left',
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--text-xs)',
        fontWeight: 600,
        color: 'var(--text-muted)',
        letterSpacing: 'var(--tracking-wider)',
        textTransform: 'uppercase',
        backgroundColor: 'var(--surface-raised)',
        ...style,
      }}
    >
      {children}
    </th>
  );
}

function RunRow({ run, even }: { run: RunListItem; even: boolean }) {
  const baseBg = even ? 'var(--data-surface)' : 'var(--data-surface-alt)';
  return (
    <tr
      style={{
        backgroundColor: baseBg,
        borderBottom: '1px solid var(--data-border)',
        transition: 'background-color var(--dur-2) var(--ease-out)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--surface-elevated)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = baseBg; }}
    >
      <td
        style={{
          padding: 'var(--space-3) var(--space-4)',
          color: 'var(--data-text)',
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--text-sm)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: 0,
        }}
        title={run.goal}
      >
        {run.goal}
      </td>
      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
        <Badge status={run.lifecycle as BadgeStatus} />
      </td>
      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
        {run.status ? <Badge status={run.status as BadgeStatus} /> : (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>
            --
          </span>
        )}
      </td>
      <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--data-text-muted)', whiteSpace: 'nowrap' }}>
        {run.durationMs != null ? formatDuration(run.durationMs) : '--'}
      </td>
      <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-2xs)', color: 'var(--data-text-muted)', whiteSpace: 'nowrap' }}>
        {new Date(run.createdAt).toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </td>
      <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>
        <Link
          href={`/runs/${run.runId}`}
          className="attest-lift"
          style={{
            display: 'inline-block',
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
            textDecoration: 'none',
            padding: 'var(--space-1) var(--space-2)',
            borderRadius: 'var(--radius-clay-sm)',
            backgroundColor: 'var(--surface-elevated)',
            boxShadow: 'var(--clay-shadow)',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
        >
          View
        </Link>
      </td>
    </tr>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}
