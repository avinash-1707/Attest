'use client';

import { useState } from 'react';
import { useApps, useCreateApp, useUpdateApp, useDeleteApp } from '@/lib/hooks';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { AppForm } from './AppForm';
import type { AppView } from '@attest/contracts';
import Link from 'next/link';

export function AppsView() {
  const { data: apps, isPending, error } = useApps();
  const createApp = useCreateApp();
  const updateApp = useUpdateApp();
  const deleteApp = useDeleteApp();

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<AppView | null>(null);
  const [deleting, setDeleting] = useState<AppView | null>(null);

  function handleCreate(data: { name: string; allowlist: string[] }) {
    createApp.mutate(data, { onSuccess: () => { setShowCreate(false); createApp.reset(); } });
  }

  function handleUpdate(data: { name: string; allowlist: string[] }) {
    if (!editing) return;
    updateApp.mutate({ id: editing.id, input: data }, { onSuccess: () => { setEditing(null); updateApp.reset(); } });
  }

  function handleDelete() {
    if (!deleting) return;
    deleteApp.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
  }

  const activeApps = (apps ?? []).filter((a) => !a.archivedAt);

  return (
    <div style={{ padding: 'var(--space-8)', maxWidth: 820, display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <PageHeader
        title="Apps"
        description="Apps scope which URLs a run may target. The allowlist gates every submitted run."
        action={
          <Button onClick={() => setShowCreate(true)}>
            Create app
          </Button>
        }
      />

      {error && (
        <ErrorMessage
          message={`Apps failed to load: ${(error as Error).message}. Check your connection and reload.`}
        />
      )}

      {isPending ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height={72} style={{ borderRadius: 'var(--radius-clay-md)' }} />
          ))}
        </div>
      ) : activeApps.length === 0 && !error ? (
        <EmptyState
          title="No apps yet"
          description="Create an app to define a URL allowlist before submitting runs."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {activeApps.map((app) => (
            <AppRow
              key={app.id}
              app={app}
              onEdit={() => setEditing(app)}
              onDelete={() => setDeleting(app)}
            />
          ))}
        </div>
      )}

      <Modal
        open={showCreate}
        onClose={() => { setShowCreate(false); createApp.reset(); }}
        title="Create app"
      >
        <AppForm
          onSubmit={handleCreate}
          onCancel={() => { setShowCreate(false); createApp.reset(); }}
          isPending={createApp.isPending}
          error={createApp.error ? (createApp.error as Error).message : null}
          submitLabel="Create app"
        />
      </Modal>

      <Modal
        open={!!editing}
        onClose={() => { setEditing(null); updateApp.reset(); }}
        title="Edit app"
      >
        {editing && (
          <AppForm
            initial={editing}
            onSubmit={handleUpdate}
            onCancel={() => { setEditing(null); updateApp.reset(); }}
            isPending={updateApp.isPending}
            error={updateApp.error ? (updateApp.error as Error).message : null}
            submitLabel="Save changes"
          />
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Archive app"
        description={`Archive "${deleting?.name ?? ''}"? Existing runs are preserved but no new runs can target this app.`}
        confirmLabel="Archive app"
        loading={deleteApp.isPending}
      />
    </div>
  );
}

function AppRow({ app, onEdit, onDelete }: { app: AppView; onEdit: () => void; onDelete: () => void }) {
  return (
    <Card padding="none" className="attest-lift">
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 'var(--space-4)',
          padding: 'var(--space-4) var(--space-5)',
        }}
      >
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <span
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-md)',
                fontWeight: 500,
                color: 'var(--text-primary)',
              }}
            >
              {app.name}
            </span>
            <code
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-2xs)',
                color: 'var(--data-text-muted)',
                backgroundColor: 'var(--data-surface)',
                border: '1px solid var(--data-border)',
                borderRadius: 'var(--radius-xs)',
                padding: '1px 4px',
              }}
            >
              {app.id}
            </code>
          </div>

          <AllowlistDisplay allowlist={app.allowlist} />
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-2)', flexShrink: 0, alignItems: 'center' }}>
          <Link
            href={`/credentials?appId=${encodeURIComponent(app.id)}`}
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--text-sm)',
              color: 'var(--text-muted)',
              textDecoration: 'none',
              padding: '6px 12px',
              borderRadius: 'var(--radius-clay-sm)',
              backgroundColor: 'var(--surface-elevated)',
              boxShadow: 'var(--clay-shadow)',
              whiteSpace: 'nowrap',
              transition: 'box-shadow var(--dur-2) var(--ease-out), color var(--dur-2) var(--ease-out)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = 'var(--clay-shadow-hover)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = 'var(--clay-shadow)';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            Credentials
          </Link>
          <Button variant="secondary" size="sm" onClick={onEdit}>Edit</Button>
          <Button variant="ghost" size="sm" onClick={onDelete}>Archive</Button>
        </div>
      </div>
    </Card>
  );
}

function AllowlistDisplay({ allowlist }: { allowlist: string[] }) {
  if (allowlist.length === 0) {
    return (
      <span
        style={{
          display: 'inline-block',
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-xs)',
          color: 'var(--color-warn-text)',
          backgroundColor: 'var(--color-warn)',
          borderRadius: 'var(--radius-xs)',
          padding: '1px 6px',
          letterSpacing: 'var(--tracking-wide)',
        }}
      >
        NO URLS ALLOWED - runs will be rejected
      </span>
    );
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', alignItems: 'center' }}>
      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', flexShrink: 0 }}>
        Allowed:
      </span>
      {allowlist.map((url) => (
        <code
          key={url}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-xs)',
            color: 'var(--data-text)',
            backgroundColor: 'var(--data-surface)',
            border: '1px solid var(--data-border)',
            borderRadius: 'var(--radius-xs)',
            padding: '1px 5px',
          }}
        >
          {url}
        </code>
      ))}
    </div>
  );
}
