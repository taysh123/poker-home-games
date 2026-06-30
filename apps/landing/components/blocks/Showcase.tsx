'use client';

import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Reveal } from '@/components/ui/Reveal';

const SCREENS = [
  {
    src: '/screenshots/01-home.png',
    alt: 'T Poker guest home — Cash Game and Tournament entry cards',
  },
  {
    src: '/screenshots/02-tournament-live.png',
    alt: 'T Poker live tournament dashboard with prize pool, blinds, and countdown clock',
  },
  {
    src: '/screenshots/03-tournament-podium.png',
    alt: 'T Poker tournament complete podium — first, second, and third place with payouts',
  },
  {
    src: '/screenshots/04-cash-summary.png',
    alt: 'T Poker cash game results — player settlements and net profit/loss breakdown',
  },
  {
    src: '/screenshots/05-stats.png',
    alt: 'T Poker bankroll and stats tracking — games played, biggest win, and recent results',
  },
] as const;

/**
 * Screenshot showcase section: 5 real app screens in phone frames.
 *
 * Layout:
 *   Mobile  — horizontal scroll strip (snap to each frame).
 *   ≥ lg    — 5-column grid, all frames visible at once.
 *
 * Images are 780 × 1688 px (390 × 844 @ 2x) — crisp on Retina.
 * width/height attributes set to the 1x display size to prevent CLS
 * while letting CSS control the rendered width.
 */
export function Showcase() {
  return (
    <Section aria-labelledby="showcase-heading">
      <Container>
        {/* Heading */}
        <Reveal className="text-center">
          <h2 id="showcase-heading" className="text-display">
            See it in action.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-textMuted">
            Every screen refined for a premium game-night feel.
          </p>
        </Reveal>

        {/*
          Mobile: horizontal scroll strip, each frame snaps to center.
          Desktop (lg+): 5-column grid.
          Gap and padding chosen to match the site's 4pt-scale rhythm.
        */}
        <div className="mt-14 -mx-5 sm:-mx-8 lg:mx-0">
          {/* Scroll container — visible on mobile, becomes grid on lg */}
          <div
            className={[
              // Mobile: horizontal scroll
              'flex gap-4 overflow-x-auto scroll-smooth',
              'snap-x snap-mandatory',
              'px-5 sm:px-8 lg:px-0',
              'pb-4 lg:pb-0',
              // Desktop: 5-col grid (override flex)
              'lg:grid lg:grid-cols-5 lg:overflow-visible',
            ].join(' ')}
          >
            {SCREENS.map(({ src, alt }, i) => (
              <Reveal key={src} delay={0.08 + i * 0.1}>
                {/*
                  Phone frame: rounded corners + subtle gold hairline border.
                  min-w prevents flex children from collapsing on mobile.
                */}
                <div
                  className={[
                    'snap-center',
                    // Frame chrome
                    'relative overflow-hidden rounded-[2rem]',
                    'border border-gold/20',
                    'bg-surface/50',
                    'shadow-[0_24px_56px_-16px_rgba(0,0,0,0.9)]',
                    // Ring accent
                    'ring-1 ring-white/[0.04]',
                    // Sizing: fixed width on mobile, fluid on desktop
                    'min-w-[200px] w-[200px]',
                    'lg:min-w-0 lg:w-full',
                  ].join(' ')}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- static export; next/image unoptimized anyway; explicit dims prevent CLS */}
                  <img
                    src={src}
                    alt={alt}
                    width={390}
                    height={844}
                    loading="lazy"
                    className="block w-full"
                    draggable={false}
                  />
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        {/* Mobile scroll hint */}
        <p className="mt-5 text-center text-xs text-textMuted/60 lg:hidden">
          Swipe to explore &rarr;
        </p>
      </Container>
    </Section>
  );
}
