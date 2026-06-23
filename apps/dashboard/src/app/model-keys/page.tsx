import type { Metadata } from 'next';
import { AppShell } from '@/components/shell/AppShell';
import { ModelKeysView } from '@/components/management/model-keys/ModelKeysView';

export const metadata: Metadata = {
  title: 'Model Keys - Attest',
};

export default function ModelKeysPage() {
  return (
    <AppShell>
      <ModelKeysView />
    </AppShell>
  );
}
