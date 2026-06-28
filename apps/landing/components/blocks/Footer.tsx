import { Container } from '@/components/ui/Container';
import { SITE } from '@/lib/site';

const linkClass =
  'text-textMuted transition-colors hover:text-textHigh focus-visible:outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded';

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-10 border-t border-border/60">
      <Container className="py-12">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="font-display text-2xl text-text">
              T<span className="text-gold">.</span>Poker
            </div>
            <p className="mt-2 max-w-xs text-sm text-textMuted">
              The home-game manager with a coach built in.
            </p>
          </div>

          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
            <a href={SITE.privacyUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
              Privacy
            </a>
            <a href={SITE.termsUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
              Terms
            </a>
            <a href={`mailto:${SITE.contact}`} className={linkClass}>
              {SITE.contact}
            </a>
          </nav>
        </div>

        <div className="mt-10 border-t border-border/40 pt-6 text-xs text-textMuted">
          © {year} {SITE.company}. All rights reserved.
        </div>
      </Container>
    </footer>
  );
}
