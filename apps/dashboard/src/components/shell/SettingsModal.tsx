'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { AccountSettings } from './AccountSettings';
import { KeysView } from '@/components/management/keys/KeysView';
import { ModelKeysView } from '@/components/management/model-keys/ModelKeysView';

type TabId = 'account' | 'keys' | 'model-keys';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'account', label: 'Account', icon: '◍' },
  { id: 'keys', label: 'API Keys', icon: '⌗' },
  { id: 'model-keys', label: 'Model Keys', icon: '⊞' },
];

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<TabId>('account');

  return (
    <Modal open={open} onClose={onClose} title="Settings" width={860}>
      <div style={{ display: 'flex', gap: 'var(--space-6)', minHeight: 420 }}>
        <nav
          aria-label="Settings sections"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-1)',
            width: 180,
            flexShrink: 0,
            borderRight: '1px solid var(--surface-border)',
            paddingRight: 'var(--space-4)',
          }}
        >
          {TABS.map((t) => {
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-current={active ? 'true' : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-clay-sm)',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: active ? 500 : 400,
                  color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                  backgroundColor: active ? 'var(--surface-elevated)' : 'transparent',
                  boxShadow: active ? 'var(--clay-shadow)' : 'none',
                  transition: 'background-color 80ms ease-out, color 80ms ease-out',
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.backgroundColor = 'var(--surface-elevated)';
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <span aria-hidden="true" style={{ width: 16, fontSize: 13, color: active ? 'var(--accent-primary)' : 'var(--text-muted)', flexShrink: 0 }}>
                  {t.icon}
                </span>
                {t.label}
              </button>
            );
          })}
        </nav>

        <div style={{ flex: 1, minWidth: 0 }}>
          {tab === 'account' && <AccountSettings />}
          {tab === 'keys' && <KeysView embedded />}
          {tab === 'model-keys' && <ModelKeysView embedded />}
        </div>
      </div>
    </Modal>
  );
}
