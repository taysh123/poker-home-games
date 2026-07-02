import { Container } from '@/components/ui/Container';

/**
 * Top-of-page trust bar. Makes the true nature of T Poker unmistakable to every visitor — and to
 * payment-processor / app-store reviewers — before anything else on the page: it is a home-game
 * MANAGEMENT + poker-STUDY tool, NOT a gambling product, with no real-money wagering, and it is 18+.
 * Static, no JS, rendered first in the document flow.
 */
export function TrustBanner() {
  return (
    <div className="border-b border-gold/15 bg-gold/[0.06]">
      <Container>
        <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 py-2.5 text-center text-xs text-textHigh sm:text-sm">
          <span className="font-semibold text-gold">Home-game management &amp; poker study</span>
          <span aria-hidden="true" className="text-textMuted">·</span>
          <span>Not a gambling product — no real-money wagering, deposits, or payouts</span>
          <span aria-hidden="true" className="text-textMuted">·</span>
          <span className="font-semibold">18+</span>
        </p>
      </Container>
    </div>
  );
}
