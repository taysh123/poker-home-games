'use client';

import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Reveal } from '@/components/ui/Reveal';

/**
 * Study leads, scorekeeping closes — sourced from the store screenshot set
 * (`apps/poker-mobile/store-assets/screenshots/ios-6.7/`).
 *
 * Every frame carries a visible caption. At the mobile strip size (200px wide) none of the on-screen
 * text is legible, so without one an unlabelled thumbnail is read purely as an image — and the Spot
 * Trainer's table diagram in particular must not be mistaken for a game being played. The caption is
 * the context. It also happens to be better marketing than five silent screens.
 *
 * NOTE: `05-settle-up.png` is a copy of `08-cash-summary.png`. When the queued in-app softening
 * slice re-captures that screen, refresh this copy too or the site goes stale.
 */
const SCREENS = [
  {
    src: '/screenshots/01-lessons.png',
    caption: 'Lessons',
    alt: 'T Poker lesson library — a list of strategy courses to work through',
  },
  {
    src: '/screenshots/02-daily-quiz.png',
    caption: 'Daily quiz',
    alt: "T Poker daily quiz — a multiple-choice strategy question with four lettered answers, showing progress through today's ten",
  },
  {
    src: '/screenshots/03-study-home.png',
    caption: 'Your progress',
    alt: 'T Poker study home — current streak, accuracy, questions answered, and the pack library',
  },
  {
    src: '/screenshots/04-settle-up.png',
    caption: 'Settle up',
    alt: 'T Poker settle-up summary — who owes whom in the fewest transfers, with a note that the app never moves or holds money',
  },
] as const;

/**
 * Screenshot showcase section: 4 real app screens in phone frames.
 *
 * Layout:
 *   Mobile  — horizontal scroll strip (snap to each frame).
 *   ≥ lg    — 4-column grid, all frames visible at once.
 *
 * Images are 1290 × 2796 px (iPhone 6.7"). width/height attributes carry the 1x display ratio to
 * reserve space and prevent CLS while CSS controls the rendered width.
 */
export function Showcase() {
  return (
    <Section aria-labelledby="showcase-heading">
      <Container>
        {/* Heading */}
        <Reveal className="text-center">
          <h2 id="showcase-heading" className="text-display">
            Study first. Scorekeeping when you need it.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-textMuted">
            Lessons, drills, and a daily quiz — plus a clean ledger for the nights your friends come
            over.
          </p>
        </Reveal>

        {/*
          Mobile: horizontal scroll strip, each frame snaps to center.
          Desktop (lg+): 4-column grid.
          Gap and padding chosen to match the site's 4pt-scale rhythm.
        */}
        <div className="mt-14 -mx-5 sm:-mx-8 lg:mx-0">
          {/* Scroll container — visible on mobile, becomes grid on lg */}
          <div
            // The horizontal-scroll strip (mobile) is a keyboard-focusable region so it can be
            // scrolled with the arrow keys; on lg+ it becomes a static grid (no scroll).
            role="group"
            aria-label="App screenshots — scroll horizontally to explore"
            tabIndex={0}
            className={[
              // Mobile: horizontal scroll
              'flex gap-4 overflow-x-auto scroll-smooth',
              'snap-x snap-mandatory',
              'px-5 sm:px-8 lg:px-0',
              'pb-4 lg:pb-0',
              // Keep the focus ring on-brand and only where it scrolls
              'rounded-lg outline-none focus-visible:ring-1 focus-visible:ring-gold/40 lg:focus-visible:ring-0',
              // Desktop: 4-col grid (override flex)
              'lg:grid lg:grid-cols-4 lg:overflow-visible',
            ].join(' ')}
          >
            {SCREENS.map(({ src, caption, alt }, i) => (
              <Reveal key={src} delay={0.08 + i * 0.1}>
                <figure className="snap-center min-w-[200px] w-[200px] lg:min-w-0 lg:w-full">
                  {/*
                    Phone frame: rounded corners + subtle gold hairline border.
                    min-w prevents flex children from collapsing on mobile.
                  */}
                  <div
                    className={[
                      // Frame chrome
                      'relative overflow-hidden rounded-[2rem]',
                      'border border-gold/20',
                      'bg-surface/50',
                      'shadow-[0_24px_56px_-16px_rgba(0,0,0,0.9)]',
                      // Ring accent
                      'ring-1 ring-white/[0.04]',
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
                  <figcaption className="mt-3 text-center text-sm font-medium text-textHigh">
                    {caption}
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>

        {/* Mobile scroll hint */}
        <p className="mt-5 text-center text-xs text-textMuted lg:hidden">
          Swipe to explore &rarr;
        </p>
      </Container>
    </Section>
  );
}
