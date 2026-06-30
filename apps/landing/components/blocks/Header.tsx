import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { SITE } from '@/lib/site';

/** Minimal sticky top bar — wordmark + a single Start Free CTA. */
export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-background/70 backdrop-blur-md">
      <Container className="flex h-16 items-center justify-between">
        <span className="flex items-center gap-2.5">
          {/* Canonical brand mark — the real app-store icon (downscaled, crisp). */}
          {/* eslint-disable-next-line @next/next/no-img-element -- static export (images unoptimized); a 34px logo needs no next/image */}
          <img
            src="/brand/app-icon-128.png"
            width={34}
            height={34}
            alt=""
            aria-hidden="true"
            className="rounded-lg"
          />
          <span className="font-display text-xl tracking-tight text-text">
            T<span className="text-gold">.</span>Poker
          </span>
        </span>
        <Button href={SITE.appUrl} external size="md" aria-label="Start free — opens the T Poker web app">
          Start Free
        </Button>
      </Container>
    </header>
  );
}
