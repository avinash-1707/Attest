import type { Metadata } from 'next';
import { RunDetail } from '@/components/runs/RunDetail';

export const metadata: Metadata = {
  title: 'Run - Attest',
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function RunDetailPage({ params }: Props) {
  const { id } = await params;
  return <RunDetail id={id} />;
}
