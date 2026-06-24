import { SiteNav } from '@/components/marketing/SiteNav';
import { Hero } from '@/components/marketing/Hero';
import { Integrations } from '@/components/marketing/Integrations';
import { ProofCompare } from '@/components/marketing/ProofCompare';
import { HowItWorks } from '@/components/marketing/HowItWorks';
import { Metrics } from '@/components/marketing/Metrics';
import { Surfaces } from '@/components/marketing/Surfaces';
import { Guarantees } from '@/components/marketing/Guarantees';
import { OpenCore } from '@/components/marketing/OpenCore';
import { FinalCTA } from '@/components/marketing/FinalCTA';
import { SiteFooter } from '@/components/marketing/SiteFooter';

export default function HomePage() {
  return (
    <main
      className="attest-vignette attest-grain relative"
      style={{ overflowX: 'hidden' }}
    >
      <SiteNav />
      <Hero />
      <Integrations />
      <ProofCompare />
      <HowItWorks />
      <Metrics />
      <Surfaces />
      <Guarantees />
      <OpenCore />
      <FinalCTA />
      <SiteFooter />
    </main>
  );
}
