'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageContainer } from '@/components/ui/PageContainer';
import { KeysView } from '@/components/management/keys/KeysView';
import { ModelKeysView } from '@/components/management/model-keys/ModelKeysView';
import { CredentialsView } from '@/components/management/credentials/CredentialsView';

type SettingsTab = 'keys' | 'model-keys' | 'credentials';

const TABS: { value: SettingsTab; label: string }[] = [
  { value: 'keys', label: 'API Keys' },
  { value: 'model-keys', label: 'Model Keys' },
  { value: 'credentials', label: 'Credentials' },
];

export function SettingsView() {
  const [tab, setTab] = useState<SettingsTab>('keys');

  return (
    <PageContainer>
      <PageHeader
        title="Settings"
        description="Manage API keys, model keys, and login credentials for your workspace."
      />

      <div
        style={{
          display: 'flex',
          gap: 'var(--space-2)',
          borderBottom: '1px solid var(--surface-border)',
        }}
      >
        {TABS.map((t) => {
          const active = tab === t.value;
          return (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              aria-current={active ? 'page' : undefined}
              style={{
                padding: 'var(--space-2) var(--space-4)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-sm)',
                fontWeight: active ? 500 : 400,
                color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                background: 'none',
                border: 'none',
                borderBottom: active ? '2px solid var(--accent-primary)' : '2px solid transparent',
                marginBottom: -1,
                cursor: 'pointer',
                transition:
                  'color var(--dur-2) var(--ease-out), border-bottom-color var(--dur-2) var(--ease-out)',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div key={tab} style={{ animation: 'attest-fade-up var(--dur-2) var(--ease-out) both' }}>
        {tab === 'keys' && <KeysView embedded />}
        {tab === 'model-keys' && <ModelKeysView embedded />}
        {tab === 'credentials' && <CredentialsView embedded />}
      </div>
    </PageContainer>
  );
}
