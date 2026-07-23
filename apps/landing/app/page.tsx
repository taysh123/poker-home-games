import { TrustBanner } from '@/components/blocks/TrustBanner';
import { Header } from '@/components/blocks/Header';
import { Hero } from '@/components/blocks/Hero';
import { WhatItIs } from '@/components/blocks/WhatItIs';
import { SocialProof } from '@/components/blocks/SocialProof';
import { Benefits } from '@/components/blocks/Benefits';
import { Showcase } from '@/components/blocks/Showcase';
import { HowItWorks } from '@/components/blocks/HowItWorks';
import { Pricing } from '@/components/blocks/Pricing';
import { Faq } from '@/components/blocks/Faq';
import { FinalCta } from '@/components/blocks/FinalCta';
import { Footer } from '@/components/blocks/Footer';

export default function Home() {
  return (
    <>
      <TrustBanner />
      <Header />
      <main>
        <Hero />
        {/* Positioning statement sits directly under the fold — see WhatItIs.tsx. */}
        <WhatItIs />
        {/* Showcase breaks up what was otherwise three icon grids in a row (WhatItIs → SocialProof
            → Benefits) and gets the visual proof above the fold-and-a-half instead of below it. */}
        <Showcase />
        <SocialProof />
        <Benefits />
        <HowItWorks />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
