'use client';

import { useState } from 'react';
import { useModelKeys, useCreateModelKey, useDeleteModelKey } from '@/lib/hooks';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { CreateModelKeyForm } from './CreateModelKeyForm';
import type { ModelKeyView, ModelKeyCreate } from '@attest/contracts';

export function ModelKeysView({ embedded = false }: { embedded?: boolean } = {}) {
  const { data: modelKeys, isPending, error } = useModelKeys();
  const createModelKey = useCreateModelKey();
  const deleteModelKey = useDeleteModelKey();

  const [showCreate, setShowCreate] = useState(false);
  const [deleting, setDeleting] = useState<ModelKeyView | null>(null);

  function handleCreate(data: ModelKeyCreate) {
    createModelKey.mutate(data, {
      onSuccess: () => {
        setShowCreate(false);
        createModelKey.reset();
      },
    });
  }

  function handleDelete() {
    if (!deleting) return;
    deleteModelKey.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
  }

  return (
    <div
      style={
        embedded
          ? { display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }
          : { padding: 'var(--space-8)', maxWidth: 820, display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }
      }
    >
      {embedded ? (
        <SectionHeader
          description="BYOK model keys let the worker call LLM providers using your own credentials. Keys are sealed server-side and never returned."
          action={<Button onClick={() => setShowCreate(true)}>Add key</Button>}
        />
      ) : (
        <PageHeader
          title="Model Keys"
          description="BYOK model keys let the worker call LLM providers using your own credentials. Keys are sealed server-side and never returned."
          action={<Button onClick={() => setShowCreate(true)}>Add key</Button>}
        />
      )}

      {error && (
        <ErrorMessage
          message={`Model keys failed to load: ${(error as Error).message}. Check your connection and reload.`}
        />
      )}

      {isPending ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-4) 0' }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height={36} />
          ))}
        </div>
      ) : (modelKeys ?? []).length === 0 && !error ? (
        <EmptyState
          title="No model keys"
          description="Add a BYOK key to route LLM calls through your own provider account."
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
              <caption style={{ display: 'none' }}>Model keys</caption>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--data-border)' }}>
                  <Th style={{ width: '30%' }}>Label</Th>
                  <Th style={{ width: '22%' }}>Provider</Th>
                  <Th style={{ width: '22%' }}>Prefix</Th>
                  <Th style={{ width: '18%' }}>Added</Th>
                  <Th style={{ width: '8%' }} />
                </tr>
              </thead>
              <tbody>
                {(modelKeys ?? []).map((mk, i) => (
                  <ModelKeyRow
                    key={mk.id}
                    modelKey={mk}
                    even={i % 2 === 0}
                    onDelete={() => setDeleting(mk)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        open={showCreate}
        onClose={() => { setShowCreate(false); createModelKey.reset(); }}
        title="Add model key"
        width={480}
      >
        <CreateModelKeyForm
          onSubmit={handleCreate}
          onCancel={() => { setShowCreate(false); createModelKey.reset(); }}
          isPending={createModelKey.isPending}
          error={createModelKey.error ? (createModelKey.error as Error).message : null}
        />
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Delete model key"
        description={`Delete "${deleting?.label ?? ''}"? Runs that depend on this key will fail. This cannot be undone.`}
        confirmLabel="Delete key"
        loading={deleteModelKey.isPending}
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

function ModelKeyRow({
  modelKey,
  even,
  onDelete,
}: {
  modelKey: ModelKeyView;
  even: boolean;
  onDelete: () => void;
}) {
  const baseBg = even ? 'var(--data-surface)' : 'var(--data-surface-alt)';
  return (
    <tr
      style={{ backgroundColor: baseBg, borderBottom: '1px solid var(--data-border)', transition: 'background-color var(--dur-2) var(--ease-out)' }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--surface-elevated)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = baseBg; }}
    >
      <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--data-text)' }}>
        {modelKey.label}
      </td>
      <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--data-text-muted)' }}>
        {modelKey.provider}
      </td>
      <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--data-text-muted)' }}>
        {modelKey.keyPrefix}...
      </td>
      <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-2xs)', color: 'var(--data-text-muted)', whiteSpace: 'nowrap' }}>
        {new Date(modelKey.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
      </td>
      <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>
        <Button variant="ghost" size="sm" onClick={onDelete} style={{ color: 'var(--color-fail-text)' }}>
          Delete
        </Button>
      </td>
    </tr>
  );
}
