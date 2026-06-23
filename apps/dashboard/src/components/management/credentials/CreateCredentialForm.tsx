'use client';

import { useState } from 'react';
import { useApps } from '@/lib/hooks';
import { Button } from '@/components/ui/Button';
import { Input, Field } from '@/components/ui/Input';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { Spinner } from '@/components/ui/Spinner';
import type { AppCredentialCreate } from '@attest/contracts';

interface CreateCredentialFormProps {
  initialAppId?: string;
  onSubmit: (data: AppCredentialCreate) => void;
  onCancel: () => void;
  isPending: boolean;
  error: string | null;
}

export function CreateCredentialForm({
  initialAppId,
  onSubmit,
  onCancel,
  isPending,
  error,
}: CreateCredentialFormProps) {
  const { data: apps, isPending: appsLoading } = useApps();
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [appId, setAppId] = useState(initialAppId ?? '');

  const activeApps = (apps ?? []).filter((a) => !a.archivedAt);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({ appId, name: name.trim(), value });
  }

  const canSubmit = appId.length > 0 && name.trim().length > 0 && value.length > 0;

  return (
    <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <Field label="App" htmlFor="cred-app" required>
        {appsLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) 0' }}>
            <Spinner size="sm" style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              Loading apps...
            </span>
          </div>
        ) : (
          <select
            id="cred-app"
            value={appId}
            onChange={(e) => setAppId(e.target.value)}
            required
            disabled={isPending || !!initialAppId}
            style={{
              width: '100%',
              padding: 'var(--space-2) var(--space-3)',
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--text-sm)',
              color: 'var(--data-text)',
              backgroundColor: 'var(--surface-elevated)',
              border: '1px solid var(--surface-border)',
              borderRadius: 'var(--radius-sm)',
              outline: 'none',
              cursor: isPending || !!initialAppId ? 'not-allowed' : 'pointer',
              opacity: isPending || !!initialAppId ? 0.6 : 1,
            }}
          >
            <option value="">Select an app...</option>
            {activeApps.map((app) => (
              <option key={app.id} value={app.id}>
                {app.name}
              </option>
            ))}
          </select>
        )}
      </Field>

      <Field
        label="Credential name"
        htmlFor="cred-name"
        help="Used by the worker to look up this secret at run time."
        required
      >
        <Input
          id="cred-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="LOGIN_PASSWORD"
          required
          disabled={isPending}
          autoFocus={!initialAppId}
        />
      </Field>

      <Field
        label="Value"
        htmlFor="cred-value"
        help="Write-only. Sealed server-side and never returned."
        required
      >
        <Input
          id="cred-value"
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="secret value"
          required
          disabled={isPending}
          autoComplete="off"
        />
      </Field>

      {error && <ErrorMessage message={error} />}

      <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
        <Button variant="secondary" type="button" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" loading={isPending} disabled={!canSubmit}>
          Add credential
        </Button>
      </div>
    </form>
  );
}
