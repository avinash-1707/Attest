import { AppShell } from '@/components/shell/AppShell';
import { HomePlaceholder } from '@/components/home/HomePlaceholder';

export default function RootPage() {
  return (
    <AppShell>
      <HomePlaceholder />
    </AppShell>
  );
}
