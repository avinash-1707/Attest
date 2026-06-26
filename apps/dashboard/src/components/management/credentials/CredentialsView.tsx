'use client';

import { useState } from 'react';
import { useCredentials, useCreateCredential, useDeleteCredential, useApps } from '@/lib/hooks';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { CreateCredentialForm } from './CreateCredentialForm';
import type { AppCredentialView, AppCredentialCreate } from '@attest/contracts';

interface CredentialsViewProps {
  initialAppId?: string;
  embedded?: boolean;
}

export function CredentialsView({ initialAppId, embedded = false }: CredentialsViewProps) {
  const { data: credentials, isPending, error } = useCredentials(initialAppId);
  const { data: apps } = useApps();
  const createCredential = useCreateCredential();
  const deleteCredential = useDeleteCredential();

  const [showCreate, setShowCreate] = useState(false);
  const [deleting, setDeleting] = useState<AppCredentialView | null>(null);

  const appMap = new Map((apps ?? []).map((a) => [a.id, a.name]));

  const filteredApp = initialAppId ? appMap.get(initialAppId) : undefined;

  function handleCreate(data: AppCredentialCreate) {
    createCredential.mutate(data, {
      onSuccess: () => {
        setShowCreate(false);
        createCredential.reset();
      },
    });
  }

  function handleDelete() {
    if (!deleting) return;
    deleteCredential.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
  }

  const description = filteredApp
    ? `Login credentials for ${filteredApp}. Values are sealed server-side and never returned.`
    : 'Login credentials injected at run time. Values are sealed server-side and never returned.';

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
          description={description}
          action={<Button onClick={() => setShowCreate(true)}>Add credential</Button>}
        />
      ) : (
        <PageHeader
          title={filteredApp ? `Credentials - ${filteredApp}` : 'Credentials'}
          description={description}
          action={<Button onClick={() => setShowCreate(true)}>Add credential</Button>}
        />
      )}

      {filteredApp && (
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-xs)',
            color: 'var(--data-text-muted)',
            backgroundColor: 'var(--data-surface)',
            border: '1px solid var(--data-border)',
            borderRadius: 'var(--radius-xs)',
            padding: 'var(--space-2) var(--space-3)',
            display: 'inline-block',
            alignSelf: 'flex-start',
          }}
        >
          app: {initialAppId}
        </div>
      )}

      {error && (
        <ErrorMessage
          message={`Credentials failed to load: ${(error as Error).message}. Check your connection and reload.`}
        />
      )}

      {isPending ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-4) 0' }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height={36} />
          ))}
        </div>
      ) : (credentials ?? []).length === 0 && !error ? (
        <EmptyState
          title="No credentials"
          description="Add login credentials to let the worker authenticate on behalf of a user during runs."
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
              <caption style={{ display: 'none' }}>Credentials</caption>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--data-border)' }}>
                  <Th style={{ width: '30%' }}>Name</Th>
                  {!initialAppId && <Th style={{ width: '25%' }}>App</Th>}
                  <Th>Value</Th>
                  <Th style={{ width: '18%' }}>Added</Th>
                  <Th style={{ width: '8%' }} />
                </tr>
              </thead>
              <tbody>
                {(credentials ?? []).map((cred, i) => (
                  <CredentialRow
                    key={cred.id}
                    credential={cred}
                    appName={appMap.get(cred.appId)}
                    showApp={!initialAppId}
                    even={i % 2 === 0}
                    onDelete={() => setDeleting(cred)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        open={showCreate}
        onClose={() => { setShowCreate(false); createCredential.reset(); }}
        title="Add credential"
        width={480}
      >
        <CreateCredentialForm
          initialAppId={initialAppId}
          onSubmit={handleCreate}
          onCancel={() => { setShowCreate(false); createCredential.reset(); }}
          isPending={createCredential.isPending}
          error={createCredential.error ? (createCredential.error as Error).message : null}
        />
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Delete credential"
        description={`Delete "${deleting?.name ?? ''}"? Runs that depend on this credential will fail. This cannot be undone.`}
        confirmLabel="Delete credential"
        loading={deleteCredential.isPending}
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

function CredentialRow({
  credential,
  appName,
  showApp,
  even,
  onDelete,
}: {
  credential: AppCredentialView;
  appName: string | undefined;
  showApp: boolean;
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
      <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--data-text)' }}>
        {credential.name}
      </td>
      {showApp && (
        <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--data-text-muted)' }}>
          {appName ?? (
            <code
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-2xs)',
                color: 'var(--data-text-muted)',
              }}
            >
              {credential.appId}
            </code>
          )}
        </td>
      )}
      <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--data-text-muted)', letterSpacing: 1 }}>
        ••••••••
      </td>
      <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-2xs)', color: 'var(--data-text-muted)', whiteSpace: 'nowrap' }}>
        {new Date(credential.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
      </td>
      <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>
        <Button variant="ghost" size="sm" onClick={onDelete} style={{ color: 'var(--color-fail-text)' }}>
          Delete
        </Button>
      </td>
    </tr>
  );
}
