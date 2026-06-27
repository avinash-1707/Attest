'use client';

import { AttestMark } from './AttestMark';
import { ThemeToggle } from './ThemeToggle';

interface TopBarProps {
  onHamburger: () => void;
}

export function TopBar({ onHamburger }: TopBarProps) {
  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 'var(--topbar-height)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--space-3)',
        padding: '0 var(--space-4)',
        backgroundColor: 'var(--surface-raised)',
        borderBottom: '1px solid var(--surface-border)',
        zIndex: 50,
      }}
    >
      <button
        aria-label="Open navigation menu"
        onClick={onHamburger}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 36,
          height: 36,
          border: 'none',
          borderRadius: 'var(--radius-clay-sm)',
          backgroundColor: 'transparent',
          cursor: 'pointer',
          color: 'var(--text-secondary)',
          flexShrink: 0,
          transition: 'background-color var(--dur-2) var(--ease-out), color var(--dur-2) var(--ease-out)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--surface-elevated)';
          e.currentTarget.style.color = 'var(--text-primary)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.color = 'var(--text-secondary)';
        }}
      >
        <HamburgerIcon />
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flex: 1 }}>
        <AttestMark size={24} />
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

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <ThemeToggle />
      </div>
    </header>
  );
}

function HamburgerIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="2" y1="4.5" x2="16" y2="4.5" />
      <line x1="2" y1="9" x2="16" y2="9" />
      <line x1="2" y1="13.5" x2="16" y2="13.5" />
    </svg>
  );
}
