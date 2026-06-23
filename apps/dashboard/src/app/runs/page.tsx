import type { Metadata } from 'next';
import { AppShell } from '@/components/shell/AppShell';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';

export const metadata: Metadata = {
  title: 'Runs - Attest',
};

export default function RunsPage() {
  return (
    <AppShell>
      <div style={{ padding: 'var(--space-8)', maxWidth: 820, display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <PageHeader
          title="Runs"
          description="Browse and inspect attestation runs submitted via the MCP server or dashboard."
        />
        <EmptyState
          title="Coming in Pass 3"
          description="The runs list and detail view will be built in the next pass."
        />
      </div>
    </AppShell>
  );
}
