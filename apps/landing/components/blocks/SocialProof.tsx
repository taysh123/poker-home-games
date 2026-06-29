import { Shield, Calculator, Lock, Gift, Star } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { Reveal } from '@/components/ui/Reveal';
import { SOCIAL_PROOF_ITEMS } from '@/lib/content';

/**
 * Social Proof strip — four honest trust signals.
 * No invented numbers or testimonials. A clearly-marked placeholder slot
 * will be swapped for real ratings once we have them.
 */

// Icons keyed by index — presentation layer only, not content
const ICONS = [Shield, Calculator, Lock, Gift];

export function SocialProof() {
  return (
    <section
      aria-label="Why T Poker"
      className="border-y border-border/40 py-14 sm:py-16"
    >
      <Container>
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {SOCIAL_PROOF_ITEMS.map((item, i) => {
            const Icon = ICONS[i];
            return (
              <Reveal key={item.title} delay={i * 0.08}>
                <div className="flex items-start gap-4">
                  <div
                    className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/10"
                    aria-hidden="true"
                  >
                    <Icon className="h-5 w-5 text-gold" />
                  </div>
                  <div>
                    <p className="font-semibold leading-snug text-textHigh">{item.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-textMuted">{item.sub}</p>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>

        {/*
          Placeholder slot — replaced with real ratings/reviews once collected.
          Explicitly labelled so visitors understand it is intentionally empty.
        */}
        <Reveal delay={0.35} className="mt-12">
          <div
            className="flex items-center justify-center gap-3 rounded-2xl border border-dashed border-border/60 px-8 py-5 text-sm text-textMuted"
            aria-label="Social proof placeholder — coming soon"
          >
            <Star
              className="h-4 w-4 shrink-0 text-gold/50"
              aria-hidden="true"
            />
            <span>Early player ratings &amp; reviews — coming soon</span>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
