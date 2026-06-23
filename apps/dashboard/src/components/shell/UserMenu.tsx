'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from '@/lib/auth-client';

export function UserMenu() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const email = session?.user?.email ?? '';
  const name = session?.user?.name ?? email;
  const initial = name.charAt(0).toUpperCase();

  async function handleSignOut() {
    setLoading(true);
    try {
      await signOut();
    } catch {
      // sign-out errors are non-fatal; navigate to sign-in regardless
    } finally {
      setLoading(false);
    }
    router.push('/sign-in');
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          flex: 1,
          overflow: 'hidden',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--surface-elevated)',
            boxShadow: 'var(--clay-shadow)',
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          {initial}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={email}
        >
          {email}
        </span>
      </div>
      <button
        onClick={handleSignOut}
        disabled={loading}
        aria-label="Sign out"
        title="Sign out"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 28,
          borderRadius: 'var(--radius-clay-sm)',
          backgroundColor: 'transparent',
          border: 'none',
          cursor: loading ? 'not-allowed' : 'pointer',
          color: 'var(--text-muted)',
          fontSize: 13,
          flexShrink: 0,
          opacity: loading ? 0.5 : 1,
          transition: 'color 80ms ease-out',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
      >
        {loading ? '…' : '→'}
      </button>
    </div>
  );
}
