import type { Metadata } from 'next';
import { AppShell } from '@/components/shell/AppShell';
import { SettingsView } from '@/components/settings/SettingsView';

export const metadata: Metadata = {
  title: 'Settings - Attest',
};

export default function SettingsPage() {
  return (
    <AppShell>
      <SettingsView />
    </AppShell>
  );
}
