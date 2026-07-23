import { ArrowRight, Check, GraduationCap } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { AnimatedText } from '@/components/ui/AnimatedText';
import { TiltCard } from '@/components/ui/TiltCard';
import { StoreBadges } from '@/components/ui/StoreBadges';
import { HERO } from '@/lib/content';
import { SITE } from '@/lib/site';

/**
 * Drill answers — a quiz question, not a hand being played.
 *
 * The real Spot Trainer offers exactly two actions and runs ten spots
 * (`features/study/ui/SpotTrainerScreen.tsx`, `QUIZ_LENGTH = 10`). Keep this mock in step with it:
 * an earlier draft advertised a 20-question run with three options, on the same page whose FAQ says
 * the daily practice allowance is ten.
 */
const ANSWERS = [
  { label: 'Fold', correct: false },
  { label: 'Raise (open)', correct: true },
];

/**
 * Settlement rows — the ledger half. These are the real output for the demo game shown in
 * `/screenshots/04-settle-up.png`: all three transfers, same names, same amounts, same currency.
 * Do not trim a row for layout — "the fewest transfers" is the product claim, so a hero showing
 * two where the screenshot below shows three makes the settlement engine look inconsistent.
 */
const TRANSFERS = [
  { from: 'Dana', to: 'Jordan', amount: '₪23' },
  { from: 'Dana', to: 'Alex', amount: '₪2' },
  { from: 'Sam', to: 'Alex', amount: '₪10' },
];

/**
 * The hero mock: a study drill, with the settle-up ledger as an overlapping satellite card.
 *
 * Deliberately NOT a poker table. The previous version rendered green felt, a live pot, per-seat
 * money stacks and a spinning casino chip, which read as a real-money poker client above the fold
 * (see the 2026-07-23 classification audit). Nothing here depicts play for money.
 *
 * Shape notes: the drill is the primary card and uses the same phone-frame chrome as the Showcase
 * strip below (`rounded-[2rem]`, gold hairline, white ring) so the page speaks one language. The
 * ledger is a smaller card that overlaps the corner — it gives `TiltCard` a second depth plane to
 * parallax against and breaks the rectangle's silhouette, which is the compositional job the
 * deleted chip used to do. Answer rows are 44px so the mock reads at real touch scale.
 */
function StudyAndLedgerMock() {
  return (
    // Decorative: this is a picture of the product, not content. Without aria-hidden a screen
    // reader announces the whole fake UI ("Fold. Raise (open). Dana right-arrow Jordan…") as if it
    // were real page copy.
    <div className="relative" aria-hidden="true">
      {/* Primary — the drill. The deep bottom padding is deliberate: it reserves the strip the
          satellite card below overlaps into, so the ledger never covers an answer row. */}
      <div className="rounded-[2rem] border border-gold/20 bg-surface/80 p-5 pb-28 shadow-[0_40px_90px_-40px_rgba(0,0,0,0.9)] ring-1 ring-white/[0.04] backdrop-blur-sm sm:p-6 sm:pb-32">
        <div className="mb-5 flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-gold" />
          <span className="text-xs font-medium uppercase tracking-wider text-textMuted">
            Spot Trainer
          </span>
          <span className="nums ml-auto text-xs text-textMuted">Spot 4 of 10</span>
        </div>

        <p className="text-base leading-snug text-text sm:text-lg">
          Button, 100bb, folded to you — what&apos;s the play?
        </p>

        <div className="mt-5 flex flex-col gap-2.5">
          {ANSWERS.map((a) => (
            <span
              key={a.label}
              className={[
                'flex min-h-[44px] items-center justify-between rounded-lg border px-4 text-sm font-medium',
                a.correct
                  ? 'border-gold/40 bg-gold/10 text-goldLight'
                  // textHigh, not textMuted: #7A8A99 on surfaceHigh is 3.95:1, under the AA floor.
                  : 'border-border bg-surfaceHigh text-textHigh',
              ].join(' ')}
            >
              {a.label}
              {a.correct && <Check className="h-4 w-4" />}
            </span>
          ))}
        </div>

        <p className="mt-4 text-sm leading-relaxed text-textMuted">
          Correct — position lets you open wider here.
        </p>
      </div>

      {/* Satellite — the ledger half, hanging off the bottom-right corner */}
      <div className="absolute -bottom-8 -right-3 z-10 w-[12.5rem] rounded-xl border border-border bg-surface/95 p-3 shadow-[0_20px_40px_-12px_rgba(0,0,0,0.9)] backdrop-blur sm:-right-8 sm:w-[14rem]">
        <p className="text-xs uppercase tracking-wider text-textMuted">Settle up</p>
        {TRANSFERS.map((t) => (
          <p key={`${t.from}-${t.to}`} className="mt-1.5 flex justify-between text-sm text-textHigh">
            <span>
              {t.from} <span className="text-gold">&rarr;</span> {t.to}
            </span>
            <span className="nums">{t.amount}</span>
          </p>
        ))}
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
              <StudyAndLedgerMock />
            </TiltCard>
          </div>
        </div>
      </Container>
    </section>
  );
}
