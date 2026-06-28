import { ArrowRight } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Button } from '@/components/ui/Button';
import { Reveal } from '@/components/ui/Reveal';
import { AuroraBackground } from '@/components/backgrounds/AuroraBackground';
import ShinyText from '@/components/ui/ShinyText';
import { FINAL_CTA } from '@/lib/content';
import { SITE } from '@/lib/site';

/**
 * Final call-to-action section.
 *
 * Background: radial gold glow (purely decorative, opacity/transform only — no
 * width/height animation, no layout shift). The glow is static CSS; it does not
 * animate, so no reduced-motion override is needed.
 */
export function FinalCta() {
  return (
    <Section
      className="relative overflow-hidden"
      aria-labelledby="final-cta-heading"
    >
      {/*
        Decorative radial glow — gold gradient centered below the copy.
        pointer-events: none, position: absolute → no layout impact.
        No animation, so no reduced-motion concern.
      */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(60% 70% at 50% 65%, rgba(201,168,76,0.13) 0%, transparent 72%)',
        }}
      />

      {/*
        Animated aurora layer — sits above the static glow, behind the content.
        Lazy + gated (desktop + motion-allowed + in-view); mobile / reduced-motion
        never fetch the OGL chunk and it renders empty as a no-op fallback.
      */}
      <AuroraBackground />

      <Container className="relative z-10">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 id="final-cta-heading" className="text-display">
            <ShinyText
              text={FINAL_CTA.heading}
              color="#E8EDF2"
              shineColor="#E8C97A"
              speed={5}
              className="text-display"
            />
          </h2>
          <p className="mt-4 text-lg text-textMuted">{FINAL_CTA.sub}</p>
          <div className="mt-8 flex justify-center">
            <Button href={SITE.appUrl} external size="lg">
              {FINAL_CTA.cta}
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </Button>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}
