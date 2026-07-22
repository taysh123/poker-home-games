import { Check, Clock, ArrowRight } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Reveal } from '@/components/ui/Reveal';
import { PRICING } from '@/lib/content';
import { PREMIUM_FEATURES } from '@/lib/features';
import { SITE } from '@/lib/site';

/**
 * Pricing section — one Free card, plus a roadmap strip for what is planned.
 *
 * HONESTY GUARANTEE:
 * - A buy CTA is rendered ONLY when `feature.live && feature.buyHref`.
 *   Coming-soon features are structurally unable to show a CTA.
 * - NO price is rendered for Premium. Nothing is purchasable — in the app or on the web — so
 *   quoting a monthly/yearly figure (with a "Save X%" toggle, no less) advertised a product that
 *   does not exist. The card shows `PRICING.premium.priceNote` instead. Pinned by
 *   `__tests__/honesty.test.ts`.
 * - All feature data comes from `lib/features.ts` (PREMIUM_FEATURES).
 */
export function Pricing() {
  return (
    <Section aria-labelledby="pricing-heading">
      <Container>
        {/* Heading */}
        <Reveal className="text-center">
          <h2 id="pricing-heading" className="text-display">
            {PRICING.heading}
          </h2>
          <p className="mt-4 text-lg text-textMuted">{PRICING.subhead}</p>
        </Reveal>

        {/*
          ONE card, not two.
          A side-by-side layout gives equal billing to a column that has no price, no CTA and
          nothing to sell — and it rendered taller and denser than the card that actually converts.
          Free gets the card; what's planned gets a slim strip underneath.
        */}
        <div className="mt-12 grid gap-6">

          {/* ── FREE card (the hero) ── */}
          <Reveal delay={0.15}>
            <Card className="relative mx-auto w-full max-w-2xl overflow-hidden border-gold/25 p-8">
              {/*
                Top-edge shimmer hairline — static gradient accent.
                Opacity-only → no layout shift.
              */}
              <div
                className="pointer-events-none absolute left-0 right-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-gold/70 to-transparent"
                aria-hidden="true"
              />

              {/* Badge */}
              <span className="inline-flex items-center rounded-full bg-gold/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-gold">
                {PRICING.free.badge}
              </span>

              {/* Price */}
              <div className="mt-5">
                <h3 className="text-2xl text-text">{PRICING.free.name}</h3>
                <div className="mt-2 flex items-end gap-1.5">
                  <span className="nums font-display text-5xl text-text">$0</span>
                </div>
                <p className="mt-2 text-sm text-textMuted">{PRICING.free.tagline}</p>
              </div>

              {/* Feature list */}
              <ul className="mt-8 space-y-3" aria-label="Free plan features">
                {PRICING.free.items.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-textHigh">
                    <Check
                      className="mt-0.5 h-4 w-4 shrink-0 text-success"
                      aria-hidden="true"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <div className="mt-8">
                <Button
                  href={SITE.appUrl}
                  external
                  className="w-full justify-center"
                  size="lg"
                >
                  {PRICING.free.cta}
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </Button>
              </div>
            </Card>
          </Reveal>

          {/* ── PREMIUM: a roadmap strip, not a plan you can pick ── */}
          <Reveal delay={0.25}>
            <div className="mx-auto w-full max-w-2xl rounded-2xl border border-border bg-surface/40 p-6">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-textMuted" aria-hidden="true" />
                {/* font-sans: `Card`-scale headings inherit the display serif, and a price slot is
                    the wrong place for it when the "price" is the words "Coming soon". */}
                <h3 className="font-sans text-sm font-semibold uppercase tracking-wider text-textHigh">
                  {PRICING.premium.name} — {PRICING.premium.priceNote}
                </h3>
              </div>

              <p className="mt-2 text-sm text-textHigh">{PRICING.premium.tagline}</p>

              {/*
                Titles only. The per-feature "Coming soon" chips are gone — the heading above says
                it once for all of them, and four repetitions of the same chip made the section
                read as a list of things that don't work.

                The buy CTA below is rendered ONLY when `feature.live && feature.buyHref`. Keep that
                filter: it is what makes a purchase link structurally impossible to ship by accident
                while every feature is coming-soon. Pinned by `__tests__/honesty.test.ts`.
              */}
              <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2" aria-label="Planned premium features">
                {PREMIUM_FEATURES.map((f) => (
                  <li key={f.key} className="text-sm text-textHigh">
                    {f.title}
                  </li>
                ))}
              </ul>

              {PREMIUM_FEATURES.filter((f) => f.live && !!f.buyHref).map((f) => (
                <div key={f.key} className="mt-6">
                  <Button href={f.buyHref!} external variant="secondary" size="lg">
                    {PRICING.premium.cta}
                    <ArrowRight className="h-5 w-5" aria-hidden="true" />
                  </Button>
                </div>
              ))}

              {/* Says plainly why there is no button here. */}
              <p className="mt-4 text-sm leading-relaxed text-textMuted">
                {PRICING.premium.note}
              </p>
            </div>
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}
