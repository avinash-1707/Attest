'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Overview', icon: '▦' },
  { href: '/runs', label: 'Runs', icon: '▷' },
  { href: '/apps', label: 'Apps', icon: '⬡' },
  { href: '/keys', label: 'API Keys', icon: '⌗' },
  { href: '/model-keys', label: 'Model Keys', icon: '⊞' },
];

const BOTTOM_ITEMS: NavItem[] = [
  { href: '/settings', label: 'Settings', icon: '⊙' },
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
      <ul
        role="list"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-1)',
          listStyle: 'none',
          paddingTop: 'var(--space-4)',
          borderTop: '1px solid var(--surface-border)',
        }}
      >
        {BOTTOM_ITEMS.map((item) => (
          <li key={item.href}>
            <NavLink item={item} active={isActive(item.href)} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        padding: `var(--space-2) var(--space-3)`,
        borderRadius: 'var(--radius-clay-sm)',
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--text-md)',
        fontWeight: active ? 500 : 400,
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        textDecoration: 'none',
        backgroundColor: active ? 'var(--surface-elevated)' : 'transparent',
        boxShadow: active ? 'var(--clay-shadow)' : 'none',
        borderLeft: active ? '2px solid var(--accent-primary)' : '2px solid transparent',
        transition: 'background-color 120ms ease-out, color 120ms ease-out, box-shadow 120ms ease-out',
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
          width: 16,
          fontSize: 13,
          color: active ? 'var(--accent-primary)' : 'var(--text-muted)',
          flexShrink: 0,
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {item.icon}
      </span>
      {item.label}
    </Link>
  );
}
