'use client';

import { useState } from 'react';
import { useApps } from '@/lib/hooks';
import { Button } from '@/components/ui/Button';
import { Input, Field } from '@/components/ui/Input';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { Spinner } from '@/components/ui/Spinner';
import type { RunCreate } from '@attest/contracts';

interface CreateRunFormProps {
  onSubmit: (data: RunCreate) => void;
  onCancel: () => void;
  isPending: boolean;
  error: string | null;
}

export function CreateRunForm({ onSubmit, onCancel, isPending, error }: CreateRunFormProps) {
  const { data: apps, isPending: appsLoading } = useApps();
  const [appId, setAppId] = useState('');
  const [goal, setGoal] = useState('');
  const [url, setUrl] = useState('');

  const activeApps = (apps ?? []).filter((a) => !a.archivedAt);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({ appId, goal: goal.trim(), url: url.trim() });
  }

  const canSubmit = appId.length > 0 && goal.trim().length > 0 && url.trim().length > 0;

  return (
    <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <Field label="App" htmlFor="run-app" required>
        {appsLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) 0' }}>
            <Spinner size="sm" style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              Loading apps...
            </span>
          </div>
        ) : (
          <select
            id="run-app"
            value={appId}
            onChange={(e) => setAppId(e.target.value)}
            required
            disabled={isPending}
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
              cursor: isPending ? 'not-allowed' : 'pointer',
              opacity: isPending ? 0.6 : 1,
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

      <Field label="URL" htmlFor="run-url" help="The page the worker will navigate to and attest against." required>
        <Input
          id="run-url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/checkout"
          required
          disabled={isPending}
        />
      </Field>

      <Field label="Goal" htmlFor="run-goal" help="What the run should verify. Be specific." required>
        <textarea
          id="run-goal"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          rows={3}
          required
          disabled={isPending}
          placeholder="The user can add a product to the cart and proceed to checkout successfully."
          style={{
            width: '100%',
            padding: 'var(--space-2) var(--space-3)',
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-sm)',
            color: 'var(--data-text)',
            backgroundColor: 'var(--surface-elevated)',
            border: '1px solid var(--surface-border)',
            borderRadius: 'var(--radius-sm)',
            boxSizing: 'border-box',
            outline: 'none',
            resize: 'vertical',
            lineHeight: 1.5,
            opacity: isPending ? 0.6 : 1,
          }}
        />
      </Field>

      {error && <ErrorMessage message={error} />}

      <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
        <Button variant="secondary" type="button" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" loading={isPending} disabled={!canSubmit}>
          Start run
        </Button>
      </div>
    </form>
  );
}
