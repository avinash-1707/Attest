'use client';

import { useState } from 'react';
import { organization } from '@/lib/auth-client';
import { Button } from '@/components/ui/Button';
import { Input, Field } from '@/components/ui/Input';
import { ErrorMessage } from '@/components/ui/ErrorMessage';

export function OrgSelectForm() {
  const [orgName, setOrgName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!orgName.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const slug = orgName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const result = await organization.create({ name: orgName.trim(), slug });
      if (result.error) {
        setError(result.error.message ?? 'Failed to create workspace. Try again.');
        return;
      }
      if (result.data) {
        await organization.setActive({ organizationId: result.data.id });
      }
      // Hard navigation (not router.push) so the dashboard mounts from the freshly cookie-backed
      // session that now carries the active org. A client nav would let AppShell read a stale
      // useSession (active org not yet propagated) and bounce straight back to this create screen.
      window.location.assign('/');
    } catch {
      setError('Failed to create workspace. Try again.');
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleCreate} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <Field label="Workspace name" htmlFor="org-name" required>
        <Input
          id="org-name"
          type="text"
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          placeholder="Acme Corp"
          required
          disabled={loading}
          autoFocus
        />
      </Field>

      {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}

      <Button
        type="submit"
        loading={loading}
        disabled={!orgName.trim()}
        style={{ width: '100%', justifyContent: 'center' }}
      >
        Create workspace
      </Button>
    </form>
  );
}
