import { GraduationCap, Calculator, Lock, Gift } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { Reveal } from '@/components/ui/Reveal';
import { SOCIAL_PROOF_ITEMS } from '@/lib/content';

/**
 * Social Proof strip — four honest trust signals. No invented numbers or testimonials.
 *
 * There used to be a dashed empty box here reading "Early player ratings & reviews — coming soon".
 * Shipping a labelled placeholder is worse than shipping nothing: it advertises absence, and the
 * page already says "coming soon" often enough. Add real ratings when there are real ratings.
 */

// Icons keyed by index — presentation layer only, not content
const ICONS = [GraduationCap, Calculator, Lock, Gift];

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
      </Container>
    </section>
  );
}
