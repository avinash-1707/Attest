'use client';

import type { IconType } from 'react-icons';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FiGrid, FiPlay, FiBox, FiCreditCard } from 'react-icons/fi';
import { useSidebarExpanded } from './SidebarContext';

interface NavItem {
  href: string;
  label: string;
  icon: IconType;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Overview', icon: FiGrid },
  { href: '/runs', label: 'Runs', icon: FiPlay },
  { href: '/apps', label: 'Apps', icon: FiBox },
  { href: '/billing', label: 'Billing', icon: FiCreditCard },
];

export function SidebarNav() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  return (
    <nav aria-label="Main navigation" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <ul
        role="list"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-1)',
          flex: 1,
          listStyle: 'none',
        }}
      >
        {NAV_ITEMS.map((item) => (
          <li key={item.href}>
            <NavLink item={item} active={isActive(item.href)} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const expanded = useSidebarExpanded();
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      title={expanded ? undefined : item.label}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: expanded ? 'var(--space-3)' : 0,
        padding: expanded ? `var(--space-2) var(--space-3)` : 0,
        width: expanded ? '100%' : 40,
        height: 40,
        margin: expanded ? 0 : '0 auto',
        justifyContent: expanded ? 'flex-start' : 'center',
        borderRadius: 'var(--radius-clay-sm)',
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--text-md)',
        fontWeight: active ? 500 : 400,
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        textDecoration: 'none',
        backgroundColor: active ? 'var(--surface-elevated)' : 'transparent',
        boxShadow: active ? 'var(--clay-shadow)' : 'none',
        overflow: 'hidden',
        transition:
          'background-color var(--dur-2) var(--ease-out), color var(--dur-2) var(--ease-out), box-shadow var(--dur-2) var(--ease-out), gap var(--dur-4) var(--ease-out), padding var(--dur-4) var(--ease-out)',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.backgroundColor = 'var(--surface-elevated)';
          e.currentTarget.style.color = 'var(--text-primary)';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.color = 'var(--text-secondary)';
        }
      }}
    >
      <span
        aria-hidden="true"
        style={{
          color: active ? 'var(--accent-primary)' : 'var(--text-muted)',
          flexShrink: 0,
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'color var(--dur-2) var(--ease-out)',
        }}
      >
        <item.icon size={17} strokeWidth={2} />
      </span>
      <span
        style={{
          opacity: expanded ? 1 : 0,
          maxWidth: expanded ? 180 : 0,
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          transition:
            'opacity var(--dur-4) var(--ease-out), max-width var(--dur-4) var(--ease-out)',
        }}
      >
        {item.label}
      </span>
    </Link>
  );
}
