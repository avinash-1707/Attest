'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRun, useAttestation, useEvidence } from '@/lib/hooks';
import { BACKEND_URL } from '@/lib/env';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { Skeleton, SkeletonBlock } from '@/components/ui/Skeleton';
import type { BadgeStatus } from '@/components/ui/Badge';
import { PageContainer } from '@/components/ui/PageContainer';
import type { RunStatusView, Attestation, AttestationStep, Failure, EvidenceRefView } from '@attest/contracts';

// Defense-in-depth against a non-http(s) run.url rendering as a clickable XSS sink. The contract now
// rejects such URLs at enqueue, but guard the render too: only http(s) links through [audit 2026-06-27 H1].
function safeHref(url: string): string | undefined {
  return /^https?:\/\//i.test(url) ? url : undefined;
}

interface RunDetailProps {
  id: string;
}

export function RunDetail({ id }: RunDetailProps) {
  const { data: run, isPending: runPending, error: runError } = useRun(id, { live: true });
  const attestationEnabled = run?.lifecycle === 'completed';
  const { data: attestation, isPending: attPending, error: attError } = useAttestation(id, { enabled: attestationEnabled });
  const { data: evidenceData, error: evidenceError } = useEvidence(id, { enabled: attestationEnabled });

  const breadcrumb = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
      <Link
        href="/runs"
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--text-sm)',
          color: 'var(--text-muted)',
          textDecoration: 'none',
        }}
      >
        Runs
      </Link>
      <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>/</span>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-xs)',
          color: 'var(--data-text-muted)',
        }}
      >
        {id}
      </span>
    </div>
  );

  if (runPending) {
    return (
      <PageContainer>
        {breadcrumb}
        <VerdictHeroSkeleton />
      </PageContainer>
    );
  }

  if (runError || !run) {
    return (
      <PageContainer>
        {breadcrumb}
        <ErrorMessage message="Run not found or you do not have access to it." />
      </PageContainer>
    );
  }

  const evidenceItems = evidenceData?.evidence ?? [];
  const attErrorMsg = attError ? (attError as Error).message : null;
  const evidenceErrorMsg = evidenceError ? (evidenceError as Error).message : null;

  return (
    <PageContainer style={{ animation: 'attest-fade-up var(--dur-3) var(--ease-out) both' }}>
      {breadcrumb}

      <VerdictHero run={run} attestation={attestation ?? null} attPending={attPending} />

      {attestationEnabled && attErrorMsg && (
        <ErrorMessage message={`Attestation unavailable: ${attErrorMsg}. Check that the run completed successfully, then reload.`} />
      )}

      {run.status === 'failed' && attestation?.failure && (
        <FailureDossier failure={attestation.failure} />
      )}

      {attestation && attestation.steps.length > 0 && (
        <StepsCard steps={attestation.steps} />
      )}

      {attestationEnabled && evidenceErrorMsg && (
        <ErrorMessage message={`Evidence unavailable: ${evidenceErrorMsg}. The run completed, but evidence files could not be retrieved.`} />
      )}

      {evidenceItems.length > 0 && (
        <EvidenceSection items={evidenceItems} />
      )}

      <RunMetadata run={run} />
    </PageContainer>
  );
}

function VerdictHeroSkeleton() {
  return (
    <div
      style={{
        borderRadius: 'var(--radius-0)',
        border: '1px solid var(--data-border)',
        backgroundColor: 'var(--data-surface)',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: 'var(--space-5) var(--space-6)', borderBottom: '1px solid var(--data-border)' }}>
        <Skeleton height={24} width="30%" />
      </div>
      <div style={{ padding: 'var(--space-6)' }}>
        <SkeletonBlock rows={2} />
      </div>
    </div>
  );
}

interface VerdictHeroProps {
  run: RunStatusView;
  attestation: Attestation | null;
  attPending: boolean;
}

function VerdictHero({ run, attestation, attPending }: VerdictHeroProps) {
  const isLive = run.lifecycle === 'queued' || run.lifecycle === 'running';
  const isCompleted = run.lifecycle === 'completed';

  const verdictMap: Record<string, { bg: string; text: string; symbol: string; label: string }> = {
    passed: { bg: 'var(--color-pass)', text: 'var(--color-pass-text)', symbol: '+', label: 'PASSED' },
    failed: { bg: 'var(--color-fail)', text: 'var(--color-fail-text)', symbol: '-', label: 'FAILED' },
    inconclusive: { bg: 'var(--color-warn)', text: 'var(--color-warn-text)', symbol: '~', label: 'INCONCLUSIVE' },
  };

  const verdict = run.status ? (verdictMap[run.status] ?? verdictMap['inconclusive']) : null;

  if (isLive || (isCompleted && attPending)) {
    return (
      <div
        aria-live="polite"
        style={{
          borderRadius: 'var(--radius-0)',
          border: '1px solid var(--data-border)',
          backgroundColor: 'var(--data-surface)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--surface-elevated)',
            borderBottom: '1px solid var(--data-border)',
            padding: 'var(--space-4) var(--space-6)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
          }}
        >
          <Spinner size="sm" style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-sm)',
              fontWeight: 500,
              color: 'var(--data-text)',
              letterSpacing: 'var(--tracking-wide)',
              textTransform: 'uppercase',
            }}
          >
            {run.lifecycle === 'queued' ? 'Waiting in queue' : isCompleted ? 'Reading attestation...' : 'Run in progress'}
          </span>
        </div>
        <div style={{ padding: 'var(--space-6)' }}>
          <p
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--text-xl)',
              fontWeight: 600,
              color: 'var(--text-primary)',
              letterSpacing: 'var(--tracking-tight)',
              marginBottom: 'var(--space-2)',
              maxWidth: 720,
            }}
          >
            {run.goal}
          </p>
          <a
            href={safeHref(run.url)}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
              color: 'var(--text-muted)',
              textDecoration: 'none',
              wordBreak: 'break-all',
            }}
          >
            {run.url}
          </a>
        </div>
      </div>
    );
  }

  if (!verdict) {
    const isCanceled = run.lifecycle === 'canceled';
    return (
      <div
        style={{
          borderRadius: 'var(--radius-0)',
          border: '1px solid var(--data-border)',
          backgroundColor: 'var(--data-surface)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--surface-elevated)',
            borderBottom: '1px solid var(--data-border)',
            padding: 'var(--space-4) var(--space-6)',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-sm)',
              fontWeight: 500,
              color: 'var(--data-text-muted)',
              letterSpacing: 'var(--tracking-wide)',
              textTransform: 'uppercase',
            }}
          >
            {isCanceled ? '× CANCELED' : '· PENDING'}
          </span>
        </div>
        <div style={{ padding: 'var(--space-6)' }}>
          <p
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--text-xl)',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: 'var(--space-2)',
              letterSpacing: 'var(--tracking-tight)',
            }}
          >
            {run.goal}
          </p>
          <a
            href={safeHref(run.url)}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
              color: 'var(--text-muted)',
              textDecoration: 'none',
              wordBreak: 'break-all',
            }}
          >
            {run.url}
          </a>
          {run.error && (
            <div style={{ marginTop: 'var(--space-4)' }}>
              <ErrorMessage message={`Run canceled: ${run.error}`} />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="attest-verdict-arrive"
      style={{
        borderRadius: 'var(--radius-0)',
        border: '1px solid var(--data-border)',
        backgroundColor: 'var(--data-surface)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          backgroundColor: verdict.bg,
          borderBottom: '1px solid var(--data-border)',
          padding: 'var(--space-4) var(--space-6)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-xl)',
            fontWeight: 700,
            color: verdict.text,
            lineHeight: 1,
          }}
        >
          {verdict.symbol}
        </span>
        <span
          role="status"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-md)',
            fontWeight: 600,
            letterSpacing: 'var(--tracking-wide)',
            textTransform: 'uppercase',
            color: verdict.text,
          }}
        >
          {verdict.label}
        </span>
        {attestation && (
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-2xs)',
              color: verdict.text,
              opacity: 0.6,
              marginLeft: 'auto',
            }}
          >
            schema {attestation.schemaVersion}
          </span>
        )}
      </div>

      <div style={{ padding: 'var(--space-6)' }}>
        <p
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-xl)',
            fontWeight: 600,
            color: 'var(--text-primary)',
            letterSpacing: 'var(--tracking-tight)',
            marginBottom: 'var(--space-2)',
          }}
        >
          {run.goal}
        </p>
        <a
          href={safeHref(run.url)}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
            textDecoration: 'none',
            wordBreak: 'break-all',
          }}
        >
          {run.url}
        </a>
      </div>
    </div>
  );
}

function FailureDossier({ failure }: { failure: Failure }) {
  return (
    <Card className="attest-enter" style={{ ['--stagger-index']: 1 } as React.CSSProperties}>
      <CardHeader>
        <span style={{ color: 'var(--color-fail-text)' }}>Failure analysis</span>
      </CardHeader>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        {failure.suggestedNextAction && (
          <div
            style={{
              backgroundColor: 'var(--data-surface)',
              border: '1px solid var(--data-border)',
              borderLeft: '3px solid var(--accent-primary)',
              padding: 'var(--space-4)',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                color: 'var(--text-muted)',
                letterSpacing: 'var(--tracking-wider)',
                textTransform: 'uppercase',
                marginBottom: 'var(--space-2)',
              }}
            >
              Next action
            </div>
            <p
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-base)',
                color: 'var(--text-primary)',
                lineHeight: 1.65,
                fontWeight: 500,
                margin: 0,
                maxWidth: 720,
              }}
            >
              {failure.suggestedNextAction}
            </p>
          </div>
        )}

        <DossierField label="Failed at step" value={failure.step} />
        <DossierField label="Reason" value={failure.reason} />
        <DossierField label="Root cause hypothesis" value={failure.rootCauseHypothesis} />

        {(failure.evidence.console.length > 0 || failure.evidence.network.length > 0) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {failure.evidence.console.length > 0 && (
              <div>
                <SectionLabel>Console</SectionLabel>
                <pre
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--data-text)',
                    backgroundColor: 'var(--data-surface)',
                    border: '1px solid var(--data-border)',
                    borderLeft: '3px solid var(--color-fail)',
                    borderRadius: 0,
                    padding: 'var(--space-3) var(--space-4)',
                    overflowX: 'auto',
                    margin: 0,
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}
                >
                  {failure.evidence.console.join('\n')}
                </pre>
              </div>
            )}

            {failure.evidence.network.length > 0 && (
              <div>
                <SectionLabel>Network</SectionLabel>
                <pre
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--data-text)',
                    backgroundColor: 'var(--data-surface)',
                    border: '1px solid var(--data-border)',
                    borderLeft: '3px solid var(--color-fail)',
                    borderRadius: 0,
                    padding: 'var(--space-3) var(--space-4)',
                    overflowX: 'auto',
                    margin: 0,
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}
                >
                  {failure.evidence.network.join('\n')}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

function StepsCard({ steps }: { steps: AttestationStep[] }) {
  return (
    <Card className="attest-enter" style={{ ['--stagger-index']: 2 } as React.CSSProperties}>
      <CardHeader>Steps ({steps.length})</CardHeader>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {steps.map((step) => (
          <div
            key={step.index}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 'var(--space-3)',
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: 'var(--data-surface)',
              border: '1px solid var(--data-border)',
              borderLeft: `3px solid ${step.status === 'passed' ? 'var(--color-pass)' : 'var(--color-fail)'}`,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-2xs)',
                color: 'var(--data-text-muted)',
                flexShrink: 0,
                paddingTop: 2,
                minWidth: 24,
              }}
            >
              {step.index + 1}.
            </span>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--data-text)',
                    fontWeight: 400,
                  }}
                >
                  {step.name}
                </span>
                <Badge status={step.status as BadgeStatus} />
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                {step.resolvedBy && (
                  <MetaTag label="resolved" value={step.resolvedBy} />
                )}
                {step.guardsTriggered && step.guardsTriggered.length > 0 && (
                  <MetaTag label="guards" value={step.guardsTriggered.join(', ')} />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function EvidenceSection({ items }: { items: EvidenceRefView[] }) {
  const screenshots = items.filter((e) => e.kind === 'screenshot');
  const snapshots = items.filter((e) => e.kind === 'dom_snapshot');
  const others = items.filter((e) => e.kind !== 'screenshot' && e.kind !== 'dom_snapshot');

  return (
    <Card className="attest-enter" style={{ ['--stagger-index']: 3 } as React.CSSProperties}>
      <CardHeader>Evidence ({items.length})</CardHeader>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        {screenshots.length > 0 && (
          <div>
            <SectionLabel>Screenshots</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {screenshots.map((item) => (
                <EvidenceScreenshot key={item.ref} item={item} />
              ))}
            </div>
          </div>
        )}

        {snapshots.length > 0 && (
          <div>
            <SectionLabel>DOM snapshots</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {snapshots.map((item) => (
                <EvidenceLink key={item.ref} item={item} />
              ))}
            </div>
          </div>
        )}

        {others.length > 0 && (
          <div>
            <SectionLabel>Other</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {others.map((item) => (
                <EvidenceLink key={item.ref} item={item} />
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function RunMetadata({ run }: { run: RunStatusView }) {
  return (
    <Card className="attest-enter" style={{ ['--stagger-index']: 4 } as React.CSSProperties}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        <MetaField label="Run ID" value={run.runId} mono />
        <MetaField label="App ID" value={run.appId} mono />
        <MetaField label="Source" value={run.source} mono />
        <MetaField label="Attempt" value={String(run.attempt + 1)} mono />
        {run.startedAt && (
          <MetaField
            label="Started"
            value={new Date(run.startedAt).toLocaleString(undefined, {
              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
            })}
            mono
          />
        )}
        {run.finishedAt && (
          <MetaField
            label="Finished"
            value={new Date(run.finishedAt).toLocaleString(undefined, {
              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
            })}
            mono
          />
        )}
        {run.durationMs != null && (
          <MetaField label="Duration" value={formatDuration(run.durationMs)} mono />
        )}
      </div>
    </Card>
  );
}

function EvidenceScreenshot({ item }: { item: EvidenceRefView }) {
  const src = `${BACKEND_URL}${item.url}`;
  const [failed, setFailed] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        {item.stepIndex != null && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-2xs)', color: 'var(--data-text-muted)' }}>
            step {item.stepIndex + 1}
          </span>
        )}
        {item.bytes != null && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-2xs)', color: 'var(--data-text-muted)' }}>
            {formatBytes(item.bytes)}
          </span>
        )}
      </div>
      {failed ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-6)',
            backgroundColor: 'var(--data-surface)',
            border: '1px solid var(--data-border)',
            borderRadius: 'var(--radius-xs)',
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-sm)',
            color: 'var(--text-muted)',
          }}
        >
          Screenshot unavailable: the file could not be loaded from the evidence store.
        </div>
      ) : (
        <img
          src={src}
          alt={`Screenshot${item.stepIndex != null ? ` from step ${item.stepIndex + 1}` : ''}`}
          crossOrigin="use-credentials"
          onError={() => setFailed(true)}
          style={{
            maxWidth: '100%',
            border: '1px solid var(--data-border)',
            borderRadius: 'var(--radius-xs)',
            display: 'block',
          }}
        />
      )}
    </div>
  );
}

function EvidenceLink({ item }: { item: EvidenceRefView }) {
  const href = `${BACKEND_URL}${item.url}`;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-4)',
        padding: 'var(--space-2) var(--space-3)',
        backgroundColor: 'var(--data-surface)',
        border: '1px solid var(--data-border)',
      }}
    >
      <code
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-xs)',
          color: 'var(--data-text-muted)',
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {item.kind}{item.stepIndex != null ? ` (step ${item.stepIndex + 1})` : ''}
      </code>
      {item.bytes != null && (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-2xs)', color: 'var(--data-text-muted)', flexShrink: 0 }}>
          {formatBytes(item.bytes)}
        </span>
      )}
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-muted)',
          textDecoration: 'none',
          flexShrink: 0,
        }}
      >
        View evidence
      </a>
    </div>
  );
}

function MetaField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--text-2xs)',
          fontWeight: 600,
          color: 'var(--text-muted)',
          letterSpacing: 'var(--tracking-wider)',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
          fontSize: mono ? 'var(--text-xs)' : 'var(--text-sm)',
          color: 'var(--data-text)',
          wordBreak: 'break-all',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function DossierField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--text-xs)',
          fontWeight: 600,
          color: 'var(--text-muted)',
          letterSpacing: 'var(--tracking-wider)',
          textTransform: 'uppercase',
          marginBottom: 'var(--space-2)',
        }}
      >
        {label}
      </div>
      <p
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--text-base)',
          color: 'var(--text-secondary)',
          lineHeight: 1.65,
          fontWeight: 400,
          margin: 0,
          maxWidth: 720,
        }}
      >
        {value}
      </p>
    </div>
  );
}

function MetaTag({ label, value }: { label: string; value: string }) {
  return (
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-2xs)', color: 'var(--data-text-muted)' }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}: </span>
      {value}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--text-xs)',
        fontWeight: 600,
        color: 'var(--text-muted)',
        letterSpacing: 'var(--tracking-wider)',
        textTransform: 'uppercase',
        marginBottom: 'var(--space-3)',
      }}
    >
      {children}
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b}B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)}KB`;
  return `${(b / (1024 * 1024)).toFixed(1)}MB`;
}
