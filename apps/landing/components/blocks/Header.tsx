import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { SITE } from '@/lib/site';

/** Minimal sticky top bar — wordmark + a single Start Free CTA. */
export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-background/70 backdrop-blur-md">
      <Container className="flex h-16 items-center justify-between">
        <span className="font-display text-xl tracking-tight text-text">
          T<span className="text-gold">.</span>Poker
        </span>
        <Button href={SITE.appUrl} external size="md" aria-label="Start free — opens the T Poker web app">
          Start Free
        </Button>
      </Container>
    </header>
  );
}
