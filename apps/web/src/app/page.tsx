import { SiteNav } from '@/components/marketing/SiteNav';
import { Hero } from '@/components/marketing/Hero';
import { Metrics } from '@/components/marketing/Metrics';
import { HowItWorks } from '@/components/marketing/HowItWorks';
import { Terminal } from '@/components/marketing/Terminal';
import { Surfaces } from '@/components/marketing/Surfaces';
import { OpenCore } from '@/components/marketing/OpenCore';
import { FinalCTA } from '@/components/marketing/FinalCTA';
import { SiteFooter } from '@/components/marketing/SiteFooter';

export default function HomePage() {
  return (
    <main style={{ backgroundColor: 'var(--surface-base)', overflowX: 'hidden' }}>
      <SiteNav />
      <Hero />
      <Metrics />
      <HowItWorks />
      <Terminal />
      <Surfaces />
      <OpenCore />
      <FinalCTA />
      <SiteFooter />
    </main>
  );
}
