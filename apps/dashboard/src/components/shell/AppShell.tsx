'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
import { WEB_URL } from '@/lib/env';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { MobileDrawer } from './MobileDrawer';
import { Spinner } from '@/components/ui/Spinner';
import { useIsMobile } from '@/lib/useMediaQuery';

const COLLAPSED_WIDTH = 64;

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const activeOrgId = session?.session.activeOrganizationId;

  useEffect(() => {
    if (isPending) return;
    if (!session) {
      window.location.assign(`${WEB_URL}/sign-in`);
      return;
    }
    if (!activeOrgId) {
      router.replace('/org');
    }
  }, [isPending, session, activeOrgId, router]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

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

  if (isMobile) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100dvh',
          backgroundColor: 'var(--surface-base)',
        }}
      >
        <TopBar onHamburger={() => setDrawerOpen(true)} />
        <main
          id="main-content"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            paddingTop: 'var(--topbar-height)',
            overflow: 'auto',
          }}
        >
          <div key={pathname} className="attest-enter" style={{ minHeight: '100%' }}>
            {children}
          </div>
        </main>
        <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100dvh',
        backgroundColor: 'var(--surface-base)',
      }}
    >
      <div aria-hidden style={{ width: COLLAPSED_WIDTH, flexShrink: 0 }} />
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
        <div key={pathname} className="attest-enter" style={{ minHeight: '100%' }}>
          {children}
        </div>
      </main>
    </div>
  );
}
