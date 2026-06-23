'use client';

import { useState } from 'react';
import { useKeys, useCreateKey, useRevokeKey, useApps } from '@/lib/hooks';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { CreateKeyForm } from './CreateKeyForm';
import { NewKeyReveal } from './NewKeyReveal';
import type { AppKeyView, AppKeyCreated, AppKeyCreate } from '@attest/contracts';

export function KeysView() {
  const { data: keys, isPending } = useKeys();
  const { data: apps } = useApps();
  const createKey = useCreateKey();
  const revokeKey = useRevokeKey();

  const [showCreate, setShowCreate] = useState(false);
  const [newKey, setNewKey] = useState<AppKeyCreated | null>(null);
  const [revoking, setRevoking] = useState<AppKeyView | null>(null);

  function handleCreate(data: AppKeyCreate) {
    createKey.mutate(data, {
      onSuccess: (created) => {
        setShowCreate(false);
        setNewKey(created);
        createKey.reset();
      },
    });
  }

  function handleRevoke() {
    if (!revoking) return;
    revokeKey.mutate(revoking.id, { onSuccess: () => setRevoking(null) });
  }

  const appMap = new Map((apps ?? []).map((a) => [a.id, a.name]));

  return (
    <div style={{ padding: 'var(--space-8)', maxWidth: 820, display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <PageHeader
        title="API Keys"
        description="Service keys authenticate run submissions from CI and the MCP server. Each key is scoped to one or more apps."
        action={<Button onClick={() => setShowCreate(true)}>Create key</Button>}
      />

      {isPending ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
          <Spinner style={{ color: 'var(--text-muted)' }} />
        </div>
      ) : (keys ?? []).length === 0 ? (
        <EmptyState
          title="No API keys"
          description="Create a service key to authenticate run submissions from CI pipelines or the MCP server."
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
              <caption style={{ display: 'none' }}>API keys</caption>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--data-border)' }}>
                  <Th style={{ width: '22%' }}>Name</Th>
                  <Th style={{ width: '18%' }}>Prefix</Th>
                  <Th style={{ width: '28%' }}>Apps</Th>
                  <Th style={{ width: '18%' }}>Last used</Th>
                  <Th style={{ width: '14%' }} />
                </tr>
              </thead>
              <tbody>
                {(keys ?? []).map((key, i) => (
                  <KeyRow
                    key={key.id}
                    apiKey={key}
                    appMap={appMap}
                    even={i % 2 === 0}
                    onRevoke={() => setRevoking(key)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        open={showCreate}
        onClose={() => { setShowCreate(false); createKey.reset(); }}
        title="Create API key"
        width={520}
      >
        <CreateKeyForm
          onSubmit={handleCreate}
          onCancel={() => { setShowCreate(false); createKey.reset(); }}
          isPending={createKey.isPending}
          error={createKey.error ? (createKey.error as Error).message : null}
        />
      </Modal>

      <Modal
        open={!!newKey}
        onClose={() => setNewKey(null)}
        title="Save your API key"
        width={540}
      >
        {newKey && (
          <NewKeyReveal
            created={newKey}
            onDone={() => setNewKey(null)}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={!!revoking}
        onClose={() => setRevoking(null)}
        onConfirm={handleRevoke}
        title="Revoke key"
        description={`Revoke key "${revoking?.name ?? ''}"? Any service using it will immediately lose access. This cannot be undone.`}
        confirmLabel="Revoke key"
        loading={revokeKey.isPending}
      />
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

function KeyRow({
  apiKey,
  appMap,
  even,
  onRevoke,
}: {
  apiKey: AppKeyView;
  appMap: Map<string, string>;
  even: boolean;
  onRevoke: () => void;
}) {
  const isRevoked = !!apiKey.revokedAt;
  const baseBg = even ? 'var(--data-surface)' : 'var(--data-surface-alt)';

  return (
    <tr
      style={{ backgroundColor: baseBg, borderBottom: '1px solid var(--data-border)', transition: 'background-color var(--dur-2) var(--ease-out)' }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--surface-elevated)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = baseBg; }}
    >
      <td style={{ padding: 'var(--space-3) var(--space-4)', color: isRevoked ? 'var(--text-muted)' : 'var(--data-text)', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          {apiKey.name}
          {isRevoked && (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-2xs)',
                color: 'var(--color-fail-text)',
                backgroundColor: 'var(--color-fail)',
                borderRadius: 'var(--radius-xs)',
                padding: '0 4px',
                letterSpacing: 'var(--tracking-wide)',
                textTransform: 'uppercase',
              }}
            >
              REVOKED
            </span>
          )}
        </div>
      </td>
      <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--data-text-muted)' }}>
        {apiKey.keyPrefix}...
      </td>
      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {apiKey.appIds.map((id) => (
            <code
              key={id}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-2xs)',
                color: 'var(--data-text)',
                backgroundColor: 'var(--data-surface)',
                border: '1px solid var(--data-border)',
                borderRadius: 'var(--radius-xs)',
                padding: '1px 4px',
              }}
              title={id}
            >
              {appMap.get(id) ?? id}
            </code>
          ))}
        </div>
      </td>
      <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-2xs)', color: 'var(--data-text-muted)', whiteSpace: 'nowrap' }}>
        {apiKey.lastUsedAt
          ? new Date(apiKey.lastUsedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
          : 'Never'}
      </td>
      <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>
        {!isRevoked && (
          <Button variant="ghost" size="sm" onClick={onRevoke}
            style={{ color: 'var(--color-fail-text)' }}
          >
            Revoke
          </Button>
        )}
      </td>
    </tr>
  );
}
