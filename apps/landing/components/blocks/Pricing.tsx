'use client';

import { useState } from 'react';
import { Check, Clock, ArrowRight } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Reveal } from '@/components/ui/Reveal';
import { PRICING } from '@/lib/content';
import { PREMIUM_FEATURES } from '@/lib/features';
import { SITE } from '@/lib/site';
import { cn } from '@/lib/utils';

/**
 * Pricing section — two cards: Free (hero) and Premium.
 *
 * HONESTY GUARANTEE:
 * - A buy CTA is rendered ONLY when `feature.live && feature.buyHref`.
 *   Coming-soon features are structurally unable to show a CTA.
 * - All prices come from `lib/content.ts` (PRICING.monthly / PRICING.yearly).
 * - All feature data comes from `lib/features.ts` (PREMIUM_FEATURES).
 *   This file is pinned by `__tests__/honesty.test.ts`.
 */

type Period = 'monthly' | 'yearly';

export function Pricing() {
  const [period, setPeriod] = useState<Period>('yearly');

  /* Derived pricing values */
  const yearlyMonthly = PRICING.yearly / 12;
  const displayMonthly = period === 'yearly' ? yearlyMonthly : PRICING.monthly;
  // Floor (not round) so the advertised saving never exceeds the real saving, and so this badge
  // matches the in-app paywall, which floors too (apps/poker-mobile .../premium/config.ts savePct).
  const savingsPct = Math.floor(
    100 * (1 - PRICING.yearly / (PRICING.monthly * 12)),
  );

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

        {/* Billing period toggle */}
        <Reveal delay={0.1} className="mt-10 flex justify-center">
          <div
            className="flex gap-1 rounded-xl border border-border/80 bg-surface/50 p-1"
            role="group"
            aria-label="Billing period"
          >
            {(['monthly', 'yearly'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                aria-pressed={period === p}
                className={cn(
                  'relative inline-flex min-h-[44px] items-center gap-2 rounded-lg px-5 text-sm font-medium transition-colors duration-200',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  period === p
                    ? 'bg-gold text-background shadow-sm'
                    : 'text-textMuted hover:text-textHigh',
                )}
              >
                {p === 'monthly' ? 'Monthly' : 'Yearly'}
                {p === 'yearly' && (
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-xs font-semibold',
                      period === 'yearly'
                        ? 'bg-background/20 text-background'
                        : 'bg-gold/15 text-gold',
                    )}
                  >
                    Save {savingsPct}%
                  </span>
                )}
              </button>
            ))}
          </div>
        </Reveal>

        {/* Cards */}
        <div className="mt-10 grid gap-6 lg:grid-cols-2 lg:items-start">

          {/* ── FREE card (the hero) ── */}
          <Reveal delay={0.15}>
            <Card className="relative overflow-hidden border-gold/25 p-8">
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

          {/* ── PREMIUM card ── */}
          <Reveal delay={0.25}>
            <Card className="p-8">
              {/* Badge */}
              <span className="inline-flex items-center rounded-full border border-border bg-surfaceHigh px-3 py-1 text-xs font-semibold uppercase tracking-wider text-textHigh">
                Premium
              </span>

              {/* Price */}
              <div className="mt-5">
                <h3 className="text-2xl text-text">{PRICING.premium.name}</h3>
                <div className="mt-2 flex items-end gap-1.5">
                  <span className="nums font-display text-5xl text-text">
                    ${displayMonthly.toFixed(2)}
                  </span>
                  <span className="mb-1.5 text-textMuted">/mo</span>
                </div>
                {period === 'yearly' && (
                  <p className="mt-1 text-sm text-textMuted">
                    Billed{' '}
                    <span className="nums text-textHigh">${PRICING.yearly}</span>
                    /year
                  </p>
                )}
                <p className="mt-2 text-sm text-textMuted">{PRICING.premium.tagline}</p>
              </div>

              {/*
                Feature list — sourced entirely from lib/features.ts.
                CTA is rendered ONLY when feature.live && feature.buyHref.
                Coming-soon features show a muted chip, no CTA. This is enforced
                structurally: the JSX condition `f.live && f.buyHref` gates the
                Button; a feature without buyHref can never render one.
              */}
              <ul className="mt-8 space-y-5" aria-label="Premium plan features">
                {PREMIUM_FEATURES.map((f) => {
                  const live = f.live && !!f.buyHref;
                  return (
                    <li
                      key={f.key}
                      className="flex items-start gap-3"
                    >
                      {live ? (
                        <Check
                          className="mt-0.5 h-4 w-4 shrink-0 text-gold"
                          aria-hidden="true"
                        />
                      ) : (
                        <Clock
                          className="mt-0.5 h-4 w-4 shrink-0 text-textMuted"
                          aria-hidden="true"
                        />
                      )}
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              'font-medium',
                              live ? 'text-textHigh' : 'text-textMuted',
                            )}
                          >
                            {f.title}
                          </span>
                          {!live && (
                            <span className="rounded-full border border-border/80 bg-surface px-2 py-0.5 text-xs text-textHigh">
                              Coming soon
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-sm leading-relaxed text-textMuted">
                          {f.desc}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {/*
                CTA block — only rendered when there is at least one live purchasable feature.
                The filter(f => f.live && !!f.buyHref).map(...) pattern means:
                  • if no feature is live → renders nothing (no orphan CTA)
                  • if a feature is coming-soon only → still renders nothing
                  • only a feature with live=true AND buyHref gets a Button
              */}
              {PREMIUM_FEATURES.filter((f) => f.live && !!f.buyHref).map((f) => (
                <div key={f.key} className="mt-8">
                  <Button
                    href={f.buyHref!}
                    external
                    variant="secondary"
                    className="w-full justify-center"
                    size="lg"
                  >
                    {PRICING.premium.cta}
                    <ArrowRight className="h-5 w-5" aria-hidden="true" />
                  </Button>
                </div>
              ))}
            </Card>
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}
