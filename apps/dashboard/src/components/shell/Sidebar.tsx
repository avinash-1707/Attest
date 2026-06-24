import { SidebarNav } from './SidebarNav';
import { OrgSwitcher } from './OrgSwitcher';
import { UserMenu } from './UserMenu';
import { ThemeToggle } from './ThemeToggle';
import { AttestMark } from './AttestMark';

const SIDEBAR_WIDTH = 240;

export function Sidebar() {
  return (
    <aside
      style={{
        width: SIDEBAR_WIDTH,
        minWidth: SIDEBAR_WIDTH,
        height: '100dvh',
        position: 'sticky',
        top: 0,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--surface-raised)',
        boxShadow: 'var(--clay-shadow)',
        borderRight: '1px solid var(--surface-border)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: `var(--space-5) var(--space-4) var(--space-4)`,
          borderBottom: '1px solid var(--surface-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <AttestMark size={28} />
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--text-md)',
              fontWeight: 600,
              color: 'var(--text-primary)',
              letterSpacing: 'var(--tracking-tight)',
            }}
          >
            attest
          </span>
        </div>
        <ThemeToggle />
      </div>

      <div style={{ padding: `var(--space-3) var(--space-4)`, borderBottom: '1px solid var(--surface-border)' }}>
        <OrgSwitcher />
      </div>

      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: `var(--space-3) var(--space-3)`,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <SidebarNav />
      </div>

      <div
        style={{
          padding: `var(--space-3) var(--space-4)`,
          borderTop: '1px solid var(--surface-border)',
          backgroundColor: 'var(--surface-base)',
        }}
      >
        <UserMenu />
      </div>
    </aside>
  );
}
