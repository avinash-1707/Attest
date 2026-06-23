'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRun, useAttestation, useEvidence } from '@/lib/hooks';
import { BACKEND_URL } from '@/lib/env';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import type { BadgeStatus } from '@/components/ui/Badge';
import type { RunStatusView, Attestation, AttestationStep, Failure, EvidenceRefView } from '@attest/contracts';

interface RunDetailProps {
  id: string;
}

export function RunDetail({ id }: RunDetailProps) {
  const { data: run, isPending: runPending } = useRun(id, { live: true });
  const attestationEnabled = run?.lifecycle === 'completed';
  const { data: attestation, isPending: attPending, error: attError } = useAttestation(id, { enabled: attestationEnabled });
  const { data: evidenceData, error: evidenceError } = useEvidence(id, { enabled: attestationEnabled });

  if (runPending) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-16)' }}>
        <Spinner style={{ color: 'var(--text-muted)' }} />
      </div>
    );
  }

  if (!run) {
    return (
      <div style={{ padding: 'var(--space-8)' }}>
        <ErrorMessage message="Run not found or you do not have access to it." />
      </div>
    );
  }

  const evidenceItems = evidenceData?.evidence ?? [];
  const attErrorMsg = attError ? (attError as Error).message : null;
  const evidenceErrorMsg = evidenceError ? (evidenceError as Error).message : null;

  return (
    <div style={{ padding: 'var(--space-8)', maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
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

      <RunStatusCard run={run} />

      {attestationEnabled && (
        attPending ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-4)' }}>
            <Spinner size="sm" style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              Loading attestation...
            </span>
          </div>
        ) : attErrorMsg ? (
          <ErrorMessage message={`Could not load attestation: ${attErrorMsg}`} />
        ) : attestation ? (
          <>
            <AttestationCard attestation={attestation} />
            {attestation.status === 'failed' && attestation.failure && (
              <FailureDossier failure={attestation.failure} />
            )}
            {attestation.steps.length > 0 && (
              <StepsCard steps={attestation.steps} />
            )}
          </>
        ) : null
      )}

      {attestationEnabled && evidenceErrorMsg && (
        <ErrorMessage message={`Could not load evidence: ${evidenceErrorMsg}`} />
      )}

      {evidenceItems.length > 0 && (
        <EvidenceSection items={evidenceItems} />
      )}
    </div>
  );
}

function RunStatusCard({ run }: { run: RunStatusView }) {
  return (
    <Card>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-4)' }}>
          <div>
            <h1
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
            </h1>
            <a
              href={run.url}
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
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexShrink: 0 }}>
            <Badge status={run.lifecycle as BadgeStatus} />
            {run.status && <Badge status={run.status as BadgeStatus} />}
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 'var(--space-4)',
            borderTop: '1px solid var(--surface-border)',
            paddingTop: 'var(--space-4)',
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

        {run.lifecycle === 'queued' || run.lifecycle === 'running' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--text-muted)' }}>
            <Spinner size="sm" style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)' }}>
              {run.lifecycle === 'queued' ? 'Waiting in queue...' : 'Run in progress...'}
            </span>
          </div>
        ) : null}

        {run.error && (
          <ErrorMessage message={run.error} />
        )}
      </div>
    </Card>
  );
}

function AttestationCard({ attestation }: { attestation: Attestation }) {
  const verdictColors: Record<string, { bg: string; text: string }> = {
    passed: { bg: 'var(--color-pass)', text: 'var(--color-pass-text)' },
    failed: { bg: 'var(--color-fail)', text: 'var(--color-fail-text)' },
    inconclusive: { bg: 'var(--color-inconclusive)', text: 'var(--color-inconclusive-text)' },
  };
  const colors = verdictColors[attestation.status] ?? verdictColors['inconclusive'];

  return (
    <Card>
      <CardHeader>Attestation</CardHeader>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: (colors ?? { bg: 'var(--data-surface)' }).bg,
            borderRadius: 'var(--radius-xs)',
            border: '1px solid var(--data-border)',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              letterSpacing: 'var(--tracking-wider)',
              textTransform: 'uppercase',
              color: (colors ?? { text: 'var(--data-text)' }).text,
            }}
          >
            {attestation.status}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-2xs)',
              color: (colors ?? { text: 'var(--data-text-muted)' }).text,
              opacity: 0.7,
            }}
          >
            schema {attestation.schemaVersion}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 'var(--space-3)' }}>
          <MetaField label="Steps" value={String(attestation.steps.length)} mono />
          <MetaField label="Duration" value={formatDuration(attestation.durationMs)} mono />
          <MetaField label="Source" value={attestation.source} mono />
        </div>
      </div>
    </Card>
  );
}

function FailureDossier({ failure }: { failure: Failure }) {
  return (
    <Card>
      <CardHeader>
        <span style={{ color: 'var(--color-fail-text)' }}>Failure Analysis</span>
      </CardHeader>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        <DossierField label="Failed at step" value={failure.step} />
        <DossierField label="Reason" value={failure.reason} />
        <DossierField label="Root cause hypothesis" value={failure.rootCauseHypothesis} />
        <DossierField
          label="Suggested next action"
          value={failure.suggestedNextAction}
          highlight
        />

        {(failure.evidence.console.length > 0 || failure.evidence.network.length > 0) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {failure.evidence.console.length > 0 && (
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
                  Console
                </div>
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
                  Network
                </div>
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
    <Card>
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
    <Card>
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
            <SectionLabel>DOM Snapshots</SectionLabel>
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
          Screenshot could not be loaded.
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
        Open
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

function DossierField({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
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
          color: highlight ? 'var(--text-primary)' : 'var(--text-secondary)',
          lineHeight: 1.65,
          fontWeight: highlight ? 500 : 400,
          margin: 0,
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
