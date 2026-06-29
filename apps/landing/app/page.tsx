import { Header } from '@/components/blocks/Header';
import { Hero } from '@/components/blocks/Hero';
import { SocialProof } from '@/components/blocks/SocialProof';
import { Benefits } from '@/components/blocks/Benefits';
import { HowItWorks } from '@/components/blocks/HowItWorks';
import { Pricing } from '@/components/blocks/Pricing';
import { Faq } from '@/components/blocks/Faq';
import { FinalCta } from '@/components/blocks/FinalCta';
import { Footer } from '@/components/blocks/Footer';

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
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
