'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input, Field } from '@/components/ui/Input';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import type { ModelKeyCreate } from '@attest/contracts';

interface CreateModelKeyFormProps {
  onSubmit: (data: ModelKeyCreate) => void;
  onCancel: () => void;
  isPending: boolean;
  error: string | null;
}

export function CreateModelKeyForm({ onSubmit, onCancel, isPending, error }: CreateModelKeyFormProps) {
  const [label, setLabel] = useState('');
  const [provider, setProvider] = useState('');
  const [key, setKey] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input: ModelKeyCreate = {
      label: label.trim(),
      key,
      ...(provider.trim() ? { provider: provider.trim() } : {}),
    };
    onSubmit(input);
  }

  const canSubmit = label.trim().length > 0 && key.length > 0;

  return (
    <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <Field label="Label" htmlFor="mk-label" help="A friendly name to identify this key." required>
        <Input
          id="mk-label"
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Production OpenRouter key"
          required
          disabled={isPending}
          autoFocus
        />
      </Field>

      <Field label="Provider" htmlFor="mk-provider" help='Optional. Defaults to "openrouter" if omitted.'>
        <Input
          id="mk-provider"
          type="text"
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          placeholder="openrouter"
          disabled={isPending}
        />
      </Field>

      <Field
        label="API key"
        htmlFor="mk-key"
        help="Write-only. Sealed server-side and never returned. The display prefix is derived on save."
        required
      >
        <Input
          id="mk-key"
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="sk-..."
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
          Add key
        </Button>
      </div>
    </form>
  );
}
