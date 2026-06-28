import { Header } from '@/components/blocks/Header';
import { Hero } from '@/components/blocks/Hero';
import { Footer } from '@/components/blocks/Footer';

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        {/* Slice 2 adds: Social Proof · Benefits · How It Works · Pricing · FAQ · Final CTA */}
      </main>
      <Footer />
    </>
  );
}
