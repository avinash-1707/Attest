'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SidebarNav } from './SidebarNav';
import { OrgSwitcher } from './OrgSwitcher';
import { UserMenu } from './UserMenu';
import { SidebarExpandedProvider } from './SidebarContext';

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function MobileDrawer({ open, onClose }: MobileDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const [rendered, setRendered] = useState(open);

  useEffect(() => {
    if (open) setRendered(true);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    drawerRef.current?.focus();
    return () => { prev?.focus(); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!rendered || typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="presentation"
      className={open ? 'attest-overlay-in' : 'attest-overlay-out'}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget && !open) setRendered(false);
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        backgroundColor: 'rgba(17, 13, 11, 0.6)',
        backdropFilter: 'blur(2px)',
        WebkitBackdropFilter: 'blur(2px)',
      }}
    >
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        tabIndex={-1}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          width: 280,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--surface-raised)',
          borderRight: '1px solid var(--surface-border)',
          boxShadow: 'var(--clay-shadow-hover)',
          outline: 'none',
          animation: open
            ? 'attest-drawer-in var(--dur-4) var(--ease-out) both'
            : 'attest-drawer-out var(--dur-3) var(--ease-in) both',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        <SidebarExpandedProvider value={true}>
          <DrawerContents onClose={onClose} />
        </SidebarExpandedProvider>
      </div>
    </div>,
    document.body,
  );
}

function DrawerContents({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div
        style={{
          padding: 'var(--space-5) var(--space-4) var(--space-4)',
          borderBottom: '1px solid var(--surface-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close navigation menu"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            border: 'none',
            borderRadius: 'var(--radius-clay-sm)',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            fontSize: 'var(--text-lg)',
            lineHeight: 1,
            transition: 'background-color var(--dur-2) var(--ease-out), color var(--dur-2) var(--ease-out)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--surface-elevated)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--text-muted)';
          }}
        >
          &times;
        </button>
      </div>

      <div style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--surface-border)' }}>
        <OrgSwitcher />
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--space-3) var(--space-4)',
        }}
        onClick={onClose}
      >
        <SidebarNav />
      </div>

      <div
        style={{
          padding: 'var(--space-3) var(--space-4)',
          borderTop: '1px solid var(--surface-border)',
          backgroundColor: 'var(--surface-base)',
        }}
      >
        <UserMenu />
      </div>
    </>
  );
}
