import type { Metadata } from 'next';
import { AppShell } from '@/components/shell/AppShell';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageContainer } from '@/components/ui/PageContainer';

export const metadata: Metadata = {
  title: 'Profile - Attest',
};

export default function ProfilePage() {
  return (
    <AppShell>
      <PageContainer>
        <PageHeader
          title="Profile"
          description="Your account details and preferences."
        />
        <EmptyState
          title="Coming soon"
          description="Profile management will be available here."
        />
      </PageContainer>
    </AppShell>
  );
}
