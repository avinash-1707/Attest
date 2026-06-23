'use client';

import { useState } from 'react';
import { useApps } from '@/lib/hooks';
import { Button } from '@/components/ui/Button';
import { Input, Field } from '@/components/ui/Input';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { Spinner } from '@/components/ui/Spinner';
import type { AppKeyCreate } from '@attest/contracts';

interface CreateKeyFormProps {
  onSubmit: (data: AppKeyCreate) => void;
  onCancel: () => void;
  isPending: boolean;
  error: string | null;
}

export function CreateKeyForm({ onSubmit, onCancel, isPending, error }: CreateKeyFormProps) {
  const { data: apps, isPending: appsLoading } = useApps();
  const [name, setName] = useState('');
  const [selectedAppIds, setSelectedAppIds] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState('');

  const activeApps = (apps ?? []).filter((a) => !a.archivedAt);

  function toggleApp(id: string) {
    setSelectedAppIds((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id],
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input: AppKeyCreate = {
      name: name.trim(),
      appIds: selectedAppIds,
      ...(expiresAt ? { expiresAt: new Date(expiresAt).toISOString() } : {}),
    };
    onSubmit(input);
  }

  const canSubmit = name.trim().length > 0 && selectedAppIds.length > 0;

  return (
    <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <Field label="Key name" htmlFor="key-name" required>
        <Input
          id="key-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="CI pipeline key"
          required
          disabled={isPending}
          autoFocus
        />
      </Field>

      <Field
        label="Authorized apps"
        htmlFor="key-apps"
        help="This key may only submit runs against the selected apps."
        required
      >
        {appsLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) 0' }}>
            <Spinner size="sm" style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              Loading apps...
            </span>
          </div>
        ) : activeApps.length === 0 ? (
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-warn-text)' }}>
            No apps found. Create an app first.
          </p>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)',
              backgroundColor: 'var(--surface-elevated)',
              borderRadius: 'var(--radius-clay-sm)',
              border: '1px solid var(--surface-border)',
              padding: 'var(--space-3)',
              boxShadow: 'inset 1px 1px 3px rgba(0,0,0,0.3)',
            }}
          >
            {activeApps.map((app) => (
              <label
                key={app.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  cursor: 'pointer',
                  padding: 'var(--space-2)',
                  borderRadius: 'var(--radius-sm)',
                  transition: 'background-color 80ms ease-out',
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedAppIds.includes(app.id)}
                  onChange={() => toggleApp(app.id)}
                  disabled={isPending}
                  style={{ accentColor: 'var(--accent-primary)', flexShrink: 0 }}
                />
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
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
                    marginLeft: 'auto',
                  }}
                >
                  {app.id}
                </code>
              </label>
            ))}
          </div>
        )}
      </Field>

      <Field
        label="Expires at"
        htmlFor="key-expires"
        help="Optional. Leave blank for a key that never expires."
      >
        <Input
          id="key-expires"
          type="datetime-local"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          disabled={isPending}
        />
      </Field>

      {error && <ErrorMessage message={error} />}

      <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
        <Button variant="secondary" type="button" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" loading={isPending} disabled={!canSubmit}>
          Create key
        </Button>
      </div>
    </form>
  );
}
