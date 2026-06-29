import { ArrowRight } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { AnimatedText } from '@/components/ui/AnimatedText';
import { TiltCard } from '@/components/ui/TiltCard';
import { StoreBadges } from '@/components/ui/StoreBadges';
import { HeroChip } from '@/components/three/HeroChip';
import { HERO } from '@/lib/content';
import { SITE } from '@/lib/site';

/** Five stylized seats around the felt — purely a visual mock, no real data. */
const SEATS = [
  { initials: 'TA', stack: '₪240', color: '#C9A84C', pos: 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2' },
  { initials: 'MK', stack: '₪180', color: '#4EAADC', pos: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2' },
  { initials: 'JD', stack: '₪90', color: '#27AE60', pos: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2' },
  { initials: 'AL', stack: '₪310', color: '#E8C97A', pos: 'bottom-0 left-[22%] -translate-x-1/2 translate-y-1/2' },
  { initials: 'RS', stack: '₪50', color: '#E74C3C', pos: 'bottom-0 right-[22%] translate-x-1/2 translate-y-1/2' },
];

/**
 * A lightweight, on-brand CSS mock of the live cash table inside an app-window
 * frame. No image asset. Includes the `data-chip-slot` placeholder where the
 * real three.js chip mounts in slice 3.
 */
function AppWindowMock() {
  return (
    <div className="relative">
      <div className="rounded-2xl border border-gold/15 bg-surface/80 p-4 shadow-[0_40px_90px_-40px_rgba(0,0,0,0.9)] backdrop-blur-sm sm:p-5">
        {/* Window title bar */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-error/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-gold/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
          </div>
          <div className="flex items-center gap-1.5 text-[0.65rem] font-medium uppercase tracking-wider text-textMuted">
            <span className="h-1.5 w-1.5 rounded-full bg-gold animate-pulse" />
            Live · Cash Game
          </div>
          <span className="w-10" aria-hidden="true" />
        </div>

        {/* Felt table */}
        <div className="relative mx-auto aspect-[16/10] w-full">
          <div className="absolute inset-0 rounded-[44%] border border-gold/25 bg-[radial-gradient(ellipse_at_center,#1A4B43_0%,#15413A_46%,#0C2A26_100%)] shadow-[inset_0_2px_36px_rgba(0,0,0,0.5)]">
            <div className="absolute inset-3 rounded-[44%] border border-white/5" />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[0.6rem] uppercase tracking-[0.25em] text-white/45">Pot</span>
              <span className="nums font-display text-2xl text-goldLight sm:text-3xl">₪200</span>
            </div>
          </div>

          {SEATS.map((seat) => (
            <div key={seat.initials} className={`absolute ${seat.pos} flex flex-col items-center gap-1`}>
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full text-[0.7rem] font-semibold text-background ring-2 ring-background"
                style={{ backgroundColor: seat.color }}
              >
                {seat.initials}
              </span>
              <span className="nums rounded-full bg-background/75 px-1.5 py-0.5 text-[0.6rem] text-textHigh">
                {seat.stack}
              </span>
            </div>
          ))}
        </div>

        {/* Action row */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <span className="rounded-lg border border-gold/30 bg-gold/10 py-2 text-center text-xs font-medium text-goldLight">
            Buy-in
          </span>
          <span className="rounded-lg border border-border bg-surfaceHigh py-2 text-center text-xs font-medium text-textHigh">
            Cash-out
          </span>
        </div>
      </div>

      {/*
        Chip slot — placeholder for the three.js poker chip (slice 3 swaps the
        inner CSS chip for a <canvas>). Fixed size so the swap causes no layout shift.
      */}
      <div
        data-chip-slot
        data-three-chip-mount
        aria-hidden="true"
        className="animate-floaty pointer-events-none absolute -bottom-7 -left-6 z-10 h-20 w-20 sm:-left-8 sm:h-24 sm:w-24"
      >
        <HeroChip />
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden pb-20 pt-16 sm:pb-28 sm:pt-24">
      <Container>
        <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-16">
          {/* Copy column */}
          <div className="max-w-xl">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">
              {HERO.eyebrow}
            </span>
            <h1 className="mt-4 text-hero">
              <AnimatedText text={HERO.title} delay={0.05} />
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-textMuted">{HERO.subhead}</p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button href={SITE.appUrl} external size="lg">
                {HERO.primaryCta}
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </Button>
              <span className="text-sm text-textMuted">{HERO.primaryNote}</span>
            </div>

            <div className="mt-9">
              <StoreBadges note={HERO.storeNote} />
            </div>
          </div>

          {/* Visual column — PAINTED on first paint (no opacity gate above the fold). Stacks BELOW the copy
              on mobile (CTA stays high) and is de-emphasized (smaller) on phones so the headline + CTA own the
              first screen; full size from lg up. */}
          <div className="order-last lg:pl-6">
            <TiltCard className="mx-auto max-w-[17rem] sm:max-w-sm lg:max-w-none">
              <AppWindowMock />
            </TiltCard>
          </div>
        </div>
      </Container>
    </section>
  );
}
