import type { Metadata } from 'next';
import { RunsView } from '@/components/runs/RunsView';

export const metadata: Metadata = {
  title: 'Runs - Attest',
};

export default function RunsPage() {
  return <RunsView />;
}
