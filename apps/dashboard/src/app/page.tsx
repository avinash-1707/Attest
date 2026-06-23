'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
import { AppShell } from '@/components/shell/AppShell';
import { Spinner } from '@/components/ui/Spinner';
import { HomePlaceholder } from '@/components/home/HomePlaceholder';

export default function RootPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  const activeOrgId = (session?.session as Record<string, unknown> | undefined)?.activeOrganizationId as
    | string
    | null
    | undefined;

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
    <AppShell>
      <HomePlaceholder />
    </AppShell>
  );
}
