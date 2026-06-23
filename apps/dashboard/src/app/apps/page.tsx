import type { Metadata } from 'next';
import { AppShell } from '@/components/shell/AppShell';
import { AppsView } from '@/components/management/apps/AppsView';

export const metadata: Metadata = {
  title: 'Apps - Attest',
};

export default function AppsPage() {
  return (
    <AppShell>
      <AppsView />
    </AppShell>
  );
}
