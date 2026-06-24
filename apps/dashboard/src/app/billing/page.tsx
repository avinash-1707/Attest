import type { Metadata } from 'next';
import { AppShell } from '@/components/shell/AppShell';
import { BillingView } from '@/components/billing/BillingView';

export const metadata: Metadata = {
  title: 'Billing - Attest',
};

export default function BillingPage() {
  return (
    <AppShell>
      <BillingView />
    </AppShell>
  );
}
