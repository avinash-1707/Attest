import type { Metadata } from 'next';
import { BillingView } from '@/components/billing/BillingView';

export const metadata: Metadata = {
  title: 'Billing - Attest',
};

export default function BillingPage() {
  return <BillingView />;
}
