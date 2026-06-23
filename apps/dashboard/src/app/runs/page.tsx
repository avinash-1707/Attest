import type { Metadata } from 'next';
import { AppShell } from '@/components/shell/AppShell';
import { RunsView } from '@/components/runs/RunsView';

export const metadata: Metadata = {
  title: 'Runs - Attest',
};

export default function RunsPage() {
  return (
    <AppShell>
      <RunsView />
    </AppShell>
  );
}
