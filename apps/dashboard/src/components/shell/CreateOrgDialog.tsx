'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { organization, authClient } from '@/lib/auth-client';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Field } from '@/components/ui/Input';
import { ErrorMessage } from '@/components/ui/ErrorMessage';

interface CreateOrgDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CreateOrgDialog({ open, onClose }: CreateOrgDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    setLoading(true);
    try {
      const slug = trimmed.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const result = await organization.create({ name: trimmed, slug });
      if (result.error) {
        setError(result.error.message ?? 'Failed to create workspace. Try again.');
        setLoading(false);
        return;
      }
      if (result.data) {
        await organization.setActive({ organizationId: result.data.id });
      }
      // Mirror OrgSwitcher.handleSwitch: force a fresh session read so the new active org is in the
      // store before org-scoped queries refetch, then invalidate caches and re-render server components.
      await authClient.getSession({ query: { disableCookieCache: true } });
      await queryClient.invalidateQueries();
      router.refresh();
      setName('');
      onClose();
    } catch {
      setError('Failed to create workspace. Try again.');
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={loading ? () => {} : onClose} title="Create workspace">
      <form
        onSubmit={handleCreate}
        noValidate
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
      >
        <Field label="Workspace name" htmlFor="new-org-name" required>
          <Input
            id="new-org-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
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
          disabled={!name.trim()}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          Create workspace
        </Button>
      </form>
    </Modal>
  );
}
