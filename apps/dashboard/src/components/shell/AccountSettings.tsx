'use client';

import { useSession } from '@/lib/auth-client';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Card } from '@/components/ui/Card';

export function AccountSettings() {
  const { data: session } = useSession();
  const name = session?.user?.name ?? '';
  const email = session?.user?.email ?? '';
  const initial = (name || email || '?').charAt(0).toUpperCase();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <SectionHeader description="Your personal account details. These identify you across every workspace you belong to." />

      <Card style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
        <span
          aria-hidden="true"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 48,
            height: 48,
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--surface-elevated)',
            boxShadow: 'var(--clay-shadow)',
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-lg)',
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {initial}
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' }}>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--text-primary)' }}>
            {name || 'Unnamed'}
          </span>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
            {email}
          </span>
        </div>
      </Card>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <Field label="Display name" value={name || 'Not set'} />
        <Field label="Email" value={email} />
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--space-4)',
        padding: 'var(--space-3) var(--space-4)',
        borderRadius: 'var(--radius-clay-sm)',
        backgroundColor: 'var(--data-surface)',
        border: '1px solid var(--data-border)',
      }}
    >
      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {value}
      </span>
    </div>
  );
}
