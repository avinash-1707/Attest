import type { Metadata } from 'next';
import { AppShell } from '@/components/shell/AppShell';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';

export const metadata: Metadata = {
  title: 'Settings - Attest',
};

export default function SettingsPage() {
  return (
    <AppShell>
      <div style={{ padding: 'var(--space-8)', maxWidth: 820, display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <PageHeader
          title="Settings"
          description="Organization and workspace configuration."
        />
        <EmptyState
          title="Coming soon"
          description="Organization settings will be available here."
        />
      </div>
    </AppShell>
  );
}
