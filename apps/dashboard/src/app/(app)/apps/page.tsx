import type { Metadata } from 'next';
import { AppsView } from '@/components/management/apps/AppsView';

export const metadata: Metadata = {
  title: 'Apps - Attest',
};

export default function AppsPage() {
  return <AppsView />;
}
