'use client';

import { useState } from 'react';
import { SidebarNav } from './SidebarNav';
import { OrgSwitcher } from './OrgSwitcher';
import { UserMenu } from './UserMenu';
import { ThemeToggle } from './ThemeToggle';
import { AttestMark } from './AttestMark';
import { SidebarExpandedProvider } from './SidebarContext';

const COLLAPSED_WIDTH = 64;
const EXPANDED_WIDTH = 240;

export function Sidebar() {
  const [expanded, setExpanded] = useState(false);

  const sectionPad = expanded
    ? `var(--space-3) var(--space-4)`
    : `var(--space-3) var(--space-2)`;

  return (
    <aside
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      style={{
          position: 'fixed',
          left: 0,
          top: 0,
          width: expanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
          height: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--surface-raised)',
          boxShadow: expanded ? 'var(--clay-shadow-hover)' : 'var(--clay-shadow)',
          borderRight: '1px solid var(--surface-border)',
          overflow: 'hidden',
          zIndex: 40,
          transition:
            'width var(--dur-4) var(--ease-out), box-shadow var(--dur-4) var(--ease-out)',
        }}
    >
      <SidebarExpandedProvider value={{ expanded, collapse: () => setExpanded(false) }}>
          <div
            style={{
              padding: expanded
                ? `var(--space-5) var(--space-4) var(--space-4)`
                : `var(--space-5) var(--space-2) var(--space-4)`,
              borderBottom: '1px solid var(--surface-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: expanded ? 'space-between' : 'center',
              gap: expanded ? 'var(--space-2)' : 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: expanded ? 'var(--space-3)' : 0, minWidth: 0 }}>
              <AttestMark size={28} />
              <span
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--text-md)',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  letterSpacing: 'var(--tracking-tight)',
                  opacity: expanded ? 1 : 0,
                  maxWidth: expanded ? 120 : 0,
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  transition:
                    'opacity var(--dur-4) var(--ease-out), max-width var(--dur-4) var(--ease-out)',
                }}
              >
                attest
              </span>
            </div>
            <div
              style={{
                opacity: expanded ? 1 : 0,
                maxWidth: expanded ? 60 : 0,
                overflow: 'hidden',
                pointerEvents: expanded ? 'auto' : 'none',
                transition:
                  'opacity var(--dur-4) var(--ease-out), max-width var(--dur-4) var(--ease-out)',
              }}
            >
              <ThemeToggle />
            </div>
          </div>

          <div style={{ padding: sectionPad, borderBottom: '1px solid var(--surface-border)' }}>
            <OrgSwitcher />
          </div>

          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              padding: sectionPad,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <SidebarNav />
          </div>

          <div
            style={{
              padding: sectionPad,
              borderTop: '1px solid var(--surface-border)',
              backgroundColor: 'var(--surface-base)',
            }}
          >
            <UserMenu />
          </div>
      </SidebarExpandedProvider>
    </aside>
  );
}
