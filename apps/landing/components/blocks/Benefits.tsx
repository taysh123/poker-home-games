import { Scale, BarChart2, BookOpen } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Reveal } from '@/components/ui/Reveal';
import { TiltCard } from '@/components/ui/TiltCard';
import { BENEFITS, BENEFITS_INTRO } from '@/lib/content';

/**
 * Three outcome-focused benefit cards.
 * Staggered Reveal entrance + subtle TiltCard hover on desktop.
 * TiltCard is a no-op on touch (no hover) and on reduced-motion.
 */

// Named lookup, NOT an index-keyed array: each BENEFITS entry names its own icon, so reordering
// the cards can no longer silently shuffle the icons out from under them.
const ICONS = { Scale, BarChart2, BookOpen } as const;

export function Benefits() {
  return (
    <Section aria-labelledby="benefits-heading">
      <Container>
        <Reveal className="max-w-xl">
          <h2 id="benefits-heading" className="text-display">
            {BENEFITS_INTRO.heading}
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-textMuted">
            {BENEFITS_INTRO.subhead}
          </p>
        </Reveal>

        <div className="mt-14 grid gap-6 sm:grid-cols-3">
          {BENEFITS.map((b, i) => {
            const Icon = ICONS[b.icon];
            return (
              <Reveal key={b.title} delay={0.1 + i * 0.12}>
                <TiltCard max={4} className="h-full">
                  <Card className="flex h-full flex-col gap-5 p-7">
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold/10"
                      aria-hidden="true"
                    >
                      <Icon className="h-6 w-6 text-gold" />
                    </div>
                    <h3 className="text-xl leading-snug text-text">{b.title}</h3>
                    <p className="flex-1 leading-relaxed text-textMuted">{b.body}</p>
                    <span className="text-xs font-semibold uppercase tracking-wider text-gold">
                      {b.tag}
                    </span>
                  </Card>
                </TiltCard>
              </Reveal>
            );
          })}
        </div>
      </Container>
    </Section>
  );
}
