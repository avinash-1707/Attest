'use client';

import { useEffect, useRef, useState } from 'react';
import { FiChevronUp, FiChevronDown, FiUser, FiLogOut } from 'react-icons/fi';
import { useSession, signOut } from '@/lib/auth-client';
import { WEB_URL } from '@/lib/env';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Avatar } from '@/components/ui/Avatar';
import { ProfileModal } from './ProfileModal';
import { useSidebarExpanded, useSidebarCollapse } from './SidebarContext';

export function UserMenu() {
  const expanded = useSidebarExpanded();
  const collapseSidebar = useSidebarCollapse();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const email = session?.user?.email ?? '';
  const name = session?.user?.name || email;
  const image = session?.user?.image ?? null;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!expanded) setOpen(false);
  }, [expanded]);

  async function handleSignOut() {
    setLoading(true);
    try {
      await signOut();
    } catch {
      // sign-out errors are non-fatal; navigate to the auth surface regardless
    } finally {
      setLoading(false);
    }
    // The auth surface lives in apps/web (a different origin); a full navigation hands control off.
    window.location.assign(`${WEB_URL}/sign-in`);
  }

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
        title={expanded ? undefined : name}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: expanded ? 'var(--space-2)' : 0,
          width: expanded ? '100%' : 40,
          height: 40,
          margin: expanded ? 0 : '0 auto',
          padding: expanded ? `var(--space-2) var(--space-3)` : 0,
          justifyContent: expanded ? 'flex-start' : 'center',
          overflow: 'hidden',
          borderRadius: 'var(--radius-clay-sm)',
          backgroundColor: open ? 'var(--surface-elevated)' : 'transparent',
          boxShadow: open ? 'var(--clay-shadow)' : 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-primary)',
          textAlign: 'left',
          transition:
            'background-color 80ms ease-out, box-shadow 80ms ease-out, gap var(--dur-4) var(--ease-out), padding var(--dur-4) var(--ease-out)',
        }}
        onMouseEnter={(e) => {
          if (!open) e.currentTarget.style.backgroundColor = 'var(--surface-elevated)';
        }}
        onMouseLeave={(e) => {
          if (!open) e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <Avatar src={image} name={name} size={22} />
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-sm)',
            fontWeight: 500,
            color: 'var(--text-primary)',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            opacity: expanded ? 1 : 0,
            maxWidth: expanded ? 200 : 0,
            transition:
              'opacity var(--dur-4) var(--ease-out), max-width var(--dur-4) var(--ease-out)',
          }}
          title={email}
        >
          {name}
        </span>
        <span
          aria-hidden="true"
          style={{
            display: 'flex',
            alignItems: 'center',
            color: 'var(--text-muted)',
            opacity: expanded ? 1 : 0,
            maxWidth: expanded ? 14 : 0,
            overflow: 'hidden',
            transition:
              'opacity var(--dur-4) var(--ease-out), max-width var(--dur-4) var(--ease-out)',
          }}
        >
          {open ? <FiChevronDown size={14} strokeWidth={2} /> : <FiChevronUp size={14} strokeWidth={2} />}
        </span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Account"
          className="attest-dialog-in"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + var(--space-2))',
            left: 0,
            right: 0,
            backgroundColor: 'var(--surface-raised)',
            borderRadius: 'var(--radius-clay-md)',
            boxShadow: 'var(--clay-shadow-hover)',
            border: '1px solid var(--surface-border)',
            overflow: 'hidden',
            zIndex: 50,
          }}
        >
          <button
            role="menuitem"
            onClick={() => { setOpen(false); setProfileOpen(true); }}
            style={menuItemStyle('var(--text-primary)')}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--surface-elevated)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <span aria-hidden="true" style={menuIconStyle}><FiUser size={15} strokeWidth={2} /></span>
            <span style={{ flex: 1 }}>Profile</span>
          </button>
          <div style={{ height: 1, backgroundColor: 'var(--surface-border)' }} />
          <button
            role="menuitem"
            onClick={() => { setOpen(false); setConfirmOpen(true); }}
            style={menuItemStyle('var(--color-fail-text)')}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--surface-elevated)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <span aria-hidden="true" style={menuIconStyle}><FiLogOut size={15} strokeWidth={2} /></span>
            <span style={{ flex: 1 }}>Sign out</span>
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => { setConfirmOpen(false); collapseSidebar?.(); }}
        onConfirm={handleSignOut}
        title="Sign out"
        description="You will be returned to the sign-in page. Continue?"
        confirmLabel="Sign out"
        loading={loading}
      />

      <ProfileModal open={profileOpen} onClose={() => { setProfileOpen(false); collapseSidebar?.(); }} />
    </div>
  );
}

function menuItemStyle(color: string): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    width: '100%',
    padding: `var(--space-2) var(--space-3)`,
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    color,
    fontFamily: 'var(--font-sans)',
    fontSize: 'var(--text-sm)',
    textAlign: 'left',
    transition: 'background-color 80ms ease-out',
  };
}

const menuIconStyle: React.CSSProperties = {
  width: 16,
  fontSize: 13,
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  lineHeight: 1,
};
