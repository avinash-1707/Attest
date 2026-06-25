import type { Metadata } from 'next';
import { AppShell } from '@/components/shell/AppShell';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';

export const metadata: Metadata = {
  title: 'Profile - Attest',
};

export default function ProfilePage() {
  return (
    <AppShell>
      <div style={{ padding: 'var(--space-8)', maxWidth: 800, display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <PageHeader
          title="Profile"
          description="Your account details and preferences."
        />
        <EmptyState
          title="Coming soon"
          description="Profile management will be available here."
        />
      </div>
    </AppShell>
  );
}
