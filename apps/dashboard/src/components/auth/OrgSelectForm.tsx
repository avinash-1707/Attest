'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { organization } from '@/lib/auth-client';
import { Button } from '@/components/ui/Button';
import { Input, Field } from '@/components/ui/Input';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { Spinner } from '@/components/ui/Spinner';

export function OrgSelectForm() {
  const router = useRouter();
  const [mode, setMode] = useState<'select' | 'create'>('select');
  const [orgName, setOrgName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { data: orgs, isPending: orgsLoading } = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      const result = await organization.list();
      return result.data ?? [];
    },
  });

  async function handleSelectOrg(orgId: string) {
    setError(null);
    setLoading(true);
    try {
      await organization.setActive({ organizationId: orgId });
      router.push('/');
    } catch {
      setError('Failed to switch organization. Try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!orgName.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const slug = orgName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const result = await organization.create({ name: orgName.trim(), slug });
      if (result.error) {
        setError(result.error.message ?? 'Failed to create organization. Try again.');
        return;
      }
      if (result.data) {
        await organization.setActive({ organizationId: result.data.id });
      }
      router.push('/');
    } catch {
      setError('Failed to create organization. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {mode === 'select' ? (
        <>
          {orgsLoading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-8)' }}>
              <Spinner />
            </div>
          )}

          {!orgsLoading && orgs && orgs.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {orgs.map((org) => (
                <button
                  key={org.id}
                  onClick={() => handleSelectOrg(org.id)}
                  disabled={loading}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-4)',
                    borderRadius: 'var(--radius-clay-sm)',
                    backgroundColor: 'var(--surface-elevated)',
                    boxShadow: 'var(--clay-shadow)',
                    border: 'none',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    width: '100%',
                    textAlign: 'left',
                    opacity: loading ? 0.6 : 1,
                    transition: 'box-shadow 80ms ease-out',
                  }}
                  onMouseEnter={(e) => { if (!loading) e.currentTarget.style.boxShadow = 'var(--clay-shadow-hover)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'var(--clay-shadow)'; }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 36,
                      height: 36,
                      borderRadius: 'var(--radius-clay-sm)',
                      backgroundColor: 'var(--accent-primary)',
                      boxShadow: 'var(--clay-shadow-accent)',
                      color: 'var(--text-on-accent)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: 'var(--text-lg)',
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {org.name.charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <p
                      style={{
                        fontFamily: 'var(--font-sans)',
                        fontSize: 'var(--text-md)',
                        fontWeight: 500,
                        color: 'var(--text-primary)',
                      }}
                    >
                      {org.name}
                    </p>
                    <p
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 'var(--text-xs)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {org.slug}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}

          <Button
            variant="secondary"
            onClick={() => setMode('create')}
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            Create new organization
          </Button>
        </>
      ) : (
        <form onSubmit={handleCreate} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Field label="Organization name" htmlFor="org-name" required>
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

          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <Button
              variant="secondary"
              type="button"
              onClick={() => { setMode('select'); setError(null); }}
              disabled={loading}
              style={{ flex: 1, justifyContent: 'center' }}
            >
              Back
            </Button>
            <Button
              type="submit"
              loading={loading}
              disabled={!orgName.trim()}
              style={{ flex: 2, justifyContent: 'center' }}
            >
              Create organization
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
