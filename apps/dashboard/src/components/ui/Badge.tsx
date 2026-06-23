import type { HTMLAttributes } from 'react';

type VerdictStatus = 'passed' | 'failed' | 'inconclusive';
type LifecycleStatus = 'queued' | 'running' | 'completed' | 'canceled';

export type BadgeStatus = VerdictStatus | LifecycleStatus;

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  status: BadgeStatus;
}

const verdictConfig: Record<VerdictStatus, { bg: string; text: string; label: string; prefix: string }> = {
  passed: {
    bg: 'var(--color-pass)',
    text: 'var(--color-pass-text)',
    label: 'PASSED',
    prefix: '+',
  },
  failed: {
    bg: 'var(--color-fail)',
    text: 'var(--color-fail-text)',
    label: 'FAILED',
    prefix: '-',
  },
  inconclusive: {
    bg: 'var(--color-warn)',
    text: 'var(--color-warn-text)',
    label: 'INCONCLUSIVE',
    prefix: '~',
  },
};

const lifecycleConfig: Record<LifecycleStatus, { bg: string; text: string; label: string; prefix: string }> = {
  queued: {
    bg: 'var(--surface-elevated)',
    text: 'var(--text-muted)',
    label: 'QUEUED',
    prefix: '·',
  },
  running: {
    bg: 'color-mix(in srgb, var(--color-warn) 60%, transparent)',
    text: 'var(--color-warn-text)',
    label: 'RUNNING',
    prefix: '·',
  },
  completed: {
    bg: 'var(--color-pass)',
    text: 'var(--color-pass-text)',
    label: 'COMPLETED',
    prefix: '+',
  },
  canceled: {
    bg: 'var(--surface-elevated)',
    text: 'var(--text-muted)',
    label: 'CANCELED',
    prefix: '×',
  },
};

const VERDICT_STATUSES = new Set<string>(['passed', 'failed', 'inconclusive']);

const isVerdict = (s: BadgeStatus): s is VerdictStatus => VERDICT_STATUSES.has(s);

export function Badge({ status, className = '', style, ...props }: BadgeProps) {
  const fallback = { bg: 'var(--surface-elevated)', text: 'var(--text-muted)', label: String(status), prefix: '·' };
  const config =
    isVerdict(status)
      ? (verdictConfig[status] ?? fallback)
      : (lifecycleConfig[status as LifecycleStatus] ?? fallback);

  return (
    <span
      role="status"
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        backgroundColor: config.bg,
        color: config.text,
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-xs)',
        fontWeight: 400,
        letterSpacing: 'var(--tracking-wide)',
        textTransform: 'uppercase',
        borderRadius: 'var(--radius-xs)',
        padding: '2px 6px',
        boxShadow: 'none',
        ...style,
      }}
      {...props}
    >
      <span aria-hidden="true" style={{ fontSize: '0.9em', lineHeight: 1 }}>{config.prefix}</span>
      {config.label}
    </span>
  );
}
