import { Container } from '@/components/ui/Container';
import { SITE } from '@/lib/site';

// min-h-[44px] + inline-flex: these were bare `text-sm` links in a gap-3 column, giving each a
// ~20px tap target. The columns use gap-1 now so the taller links don't stretch the layout.
const linkClass =
  'inline-flex min-h-[44px] items-center text-sm text-textMuted transition-colors hover:text-textHigh ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm';

/**
 * Full site footer — brand column + product/legal columns + copyright.
 * All links use design-token colours and visible focus rings (AA-compliant).
 */
export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border/50">
      <Container className="py-14 sm:py-16">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">

          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-2">
            <div className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element -- static export (images unoptimized); a 40px logo needs no next/image */}
              <img
                src="/brand/app-icon-128.png"
                width={40}
                height={40}
                alt=""
                aria-hidden="true"
                className="rounded-lg"
              />
              <span className="font-display text-2xl text-text">
                T<span className="text-gold">.</span>Poker
              </span>
            </div>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-textMuted">
              Learn poker properly. Keep the score straight on game night.
            </p>
            <a
              href={SITE.appUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-gold transition-colors hover:text-goldLight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm"
            >
              Start for free &rarr;
            </a>
          </div>

          {/* Product column */}
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-textMuted">
              Product
            </p>
            <nav aria-label="Product links" className="flex flex-col gap-1">
              <a
                href={SITE.appUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                Cash Games
              </a>
              <a
                href={SITE.appUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                Tournaments
              </a>
              <a
                href={SITE.appUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                Strategy Study
              </a>
              <a
                href={SITE.appUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                Group Stats
              </a>
            </nav>
          </div>

          {/* Legal / contact column */}
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-textMuted">
              Company
            </p>
            <nav aria-label="Legal and contact links" className="flex flex-col gap-1">
              <a
                href={SITE.privacyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                Privacy Policy
              </a>
              <a
                href={SITE.termsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                Terms of Service
              </a>
              <a href={`mailto:${SITE.contact}`} className={linkClass}>
                {SITE.contact}
              </a>
            </nav>
          </div>
        </div>

        {/* Disclaimer + copyright bar */}
        <div className="mt-12 border-t border-border/40 pt-6 text-xs text-textMuted">
          {/* The responsible-play boilerplate that used to close this paragraph is an operator's
              phrase: it implies we run something to play. We don't. See __tests__/positioning.test.ts.
              text-sm, not the surrounding text-xs — this is the paragraph a store reviewer is meant
              to actually read, and it was set two steps smaller than the copyright line. */}
          <p className="mb-3 max-w-3xl text-sm leading-relaxed text-textHigh">
            T Poker is a poker strategy training app with a scorekeeping tool for private home games,
            intended for adults 18+. It is not a gambling product: there is no wagering, no chance
            mechanic, and no money inside the app &mdash; nothing is deposited, held, won, or paid
            out. Any cash is exchanged between friends in person. Check your local laws before
            organising a home game.
          </p>
          &copy; {year} {SITE.company}. All rights reserved.
        </div>
      </Container>
    </footer>
  );
}
