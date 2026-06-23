'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
import { Sidebar } from './Sidebar';
import { Spinner } from '@/components/ui/Spinner';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const activeOrgId = (session?.session as Record<string, unknown> | undefined)
    ?.activeOrganizationId as string | null | undefined;

  useEffect(() => {
    if (isPending) return;
    if (!session) {
      router.replace('/sign-in');
      return;
    }
    if (!activeOrgId) {
      router.replace('/org');
    }
  }, [isPending, session, activeOrgId, router]);

  if (isPending) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--surface-base)',
        }}
      >
        <Spinner size="lg" style={{ color: 'var(--text-muted)' }} />
      </div>
    );
  }

  if (!session || !activeOrgId) {
    return null;
  }

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100dvh',
        backgroundColor: 'var(--surface-base)',
      }}
    >
      <Sidebar />
      <main
        id="main-content"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          overflow: 'auto',
        }}
      >
        <div key={pathname} className="attest-enter">
          {children}
        </div>
      </main>
    </div>
  );
}
