import { Container } from '@/components/ui/Container';

/**
 * Top-of-page trust bar. Makes the true nature of T Poker unmistakable to every visitor — and to
 * app-store reviewers — before anything else on the page: it is a poker-STUDY tool with a
 * SCOREKEEPING utility, NOT a gambling product, and it is 18+. Static, no JS, first in document flow.
 *
 * The long "no wagering, deposits, or payouts" clause is desktop-only. Spelled out in full it wrapped
 * to four lines on a 390px screen and ate a third of the first viewport — a disclaimer displacing the
 * headline it is meant to qualify. Phones get the short form; the full statement is one screen down
 * in `WhatItIs`, and again in the footer.
 */
export function TrustBanner() {
  return (
    <div className="border-b border-gold/15 bg-gold/[0.06]">
      <Container>
        <p className="flex flex-wrap items-center justify-center gap-x-2 py-2.5 text-center text-sm text-textHigh">
          <span className="font-semibold text-gold">Poker strategy training</span>
          <span aria-hidden="true" className="text-textMuted">·</span>
          <span className="sm:hidden">Not gambling</span>
          <span className="hidden sm:inline">
            Not a gambling product — no wagering, deposits, or payouts
          </span>
          <span aria-hidden="true" className="text-textMuted">·</span>
          <span className="font-semibold">18+</span>
        </p>
      </Container>
    </div>
  );
}
