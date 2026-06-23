import type { Metadata } from 'next';
import { AppShell } from '@/components/shell/AppShell';
import { KeysView } from '@/components/management/keys/KeysView';

export const metadata: Metadata = {
  title: 'API Keys - Attest',
};

export default function KeysPage() {
  return (
    <AppShell>
      <KeysView />
    </AppShell>
  );
}
