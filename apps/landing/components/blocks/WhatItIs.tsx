import { GraduationCap, Calculator, Ban } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Reveal } from '@/components/ui/Reveal';
import { WHAT_IT_IS } from '@/lib/content';

/**
 * The plain-language positioning statement, high on the page and in full body text.
 *
 * This is the section a store reviewer, a payment processor, or a cautious visitor should be able
 * to land on and immediately understand what T Poker is. It is deliberately NOT an accordion item
 * and NOT fine print — no interaction is required to read it, and it renders at body size.
 */
const PILLARS = [
  {
    icon: GraduationCap,
    title: 'You study',
    body: 'Lessons, a daily quiz, and decision drills that teach you how to think about a hand — with an explanation after every answer.',
  },
  {
    icon: Calculator,
    title: 'You keep score',
    body: 'On game night, T Poker records who bought in for what and who cashed out, then works out the fewest transfers to settle up.',
  },
  {
    icon: Ban,
    title: 'You never wager',
    body: 'No betting, no chance mechanic, no money inside the app. Nothing is deposited, held, won, or paid out — friends settle in cash, in person.',
  },
] as const;

export function WhatItIs() {
  return (
    <Section aria-labelledby="what-it-is-heading">
      {/*
        The narrower measure comes from this inner div, NOT from a `max-w-*` on Container.
        Container's own `max-w-container` is a custom token that tailwind-merge does not know how to
        dedupe, so passing `max-w-4xl` leaves both classes on the element and the 1120px one wins —
        a silent no-op that rendered this paragraph at ~150 characters per line.
      */}
      <Container>
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <h2 id="what-it-is-heading" className="text-display text-center">
              {WHAT_IT_IS.heading}
            </h2>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="mt-10 grid gap-5 sm:grid-cols-3">
              {PILLARS.map(({ icon: Icon, title, body }) => (
                <div
                  key={title}
                  className="rounded-xl border border-border bg-surface/50 p-5"
                >
                  <Icon className="h-5 w-5 text-gold" aria-hidden="true" />
                  {/* font-sans: this h3 inherits font-display, and DM Serif Display ships weight
                      400 only — a `font-medium` on it renders as browser synthetic bold. */}
                  <h3 className="mt-3 font-sans font-semibold text-textHigh">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-textHigh">{body}</p>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.18}>
            <p className="mx-auto mt-8 max-w-[62ch] rounded-xl border border-border/60 bg-surface/40 px-6 py-5 text-sm leading-relaxed text-textHigh">
              {WHAT_IT_IS.body}
            </p>
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}
