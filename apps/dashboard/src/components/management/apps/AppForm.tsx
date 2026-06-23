'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input, Field } from '@/components/ui/Input';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import type { AppView } from '@attest/contracts';

interface AppFormProps {
  initial?: Pick<AppView, 'name' | 'allowlist'>;
  onSubmit: (data: { name: string; allowlist: string[] }) => void;
  onCancel: () => void;
  isPending: boolean;
  error: string | null;
  submitLabel: string;
}

export function AppForm({ initial, onSubmit, onCancel, isPending, error, submitLabel }: AppFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [allowlistRaw, setAllowlistRaw] = useState((initial?.allowlist ?? []).join('\n'));

  function parseAllowlist(raw: string): string[] {
    return raw
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({ name: name.trim(), allowlist: parseAllowlist(allowlistRaw) });
  }

  return (
    <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <Field label="App name" htmlFor="app-name" required>
        <Input
          id="app-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My app"
          required
          disabled={isPending}
          autoFocus
        />
      </Field>

      <Field
        label="URL allowlist"
        htmlFor="app-allowlist"
        help="One URL or hostname per line. Runs are rejected if the target URL does not match. Leave empty to allow nothing."
      >
        <textarea
          id="app-allowlist"
          value={allowlistRaw}
          onChange={(e) => setAllowlistRaw(e.target.value)}
          placeholder={'https://example.com\nexample.com\n*.staging.example.com'}
          disabled={isPending}
          rows={5}
          style={{
            display: 'block',
            width: '100%',
            backgroundColor: 'var(--surface-elevated)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-xs)',
            borderRadius: 'var(--radius-clay-sm)',
            border: '1px solid var(--surface-border)',
            padding: 'var(--space-3) var(--space-4)',
            boxShadow: 'inset 1px 1px 3px rgba(0,0,0,0.3)',
            outline: 'none',
            resize: 'vertical',
            lineHeight: 1.6,
          }}
        />
      </Field>

      {error && <ErrorMessage message={error} />}

      <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
        <Button variant="secondary" type="button" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" loading={isPending} disabled={!name.trim()}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
