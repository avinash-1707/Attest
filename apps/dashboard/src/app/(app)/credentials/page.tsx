import type { Metadata } from 'next';
import { CredentialsView } from '@/components/management/credentials/CredentialsView';

export const metadata: Metadata = {
  title: 'Credentials - Attest',
};

interface Props {
  searchParams: Promise<{ appId?: string }>;
}

export default async function CredentialsPage({ searchParams }: Props) {
  const params = await searchParams;
  return <CredentialsView initialAppId={params.appId} />;
}
