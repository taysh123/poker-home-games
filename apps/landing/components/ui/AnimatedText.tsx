import { Fragment } from 'react';

type AnimatedTextProps = {
  text: string;
  className?: string;
  /** Seconds before the first word starts rising (the stagger compounds from here). */
  delay?: number;
};

/**
 * Word-by-word rise on first paint. PURE CSS (see `.anim-word` + `wordRise` in globals.css) — no JS,
 * no hydration gate — so the text is rendered into the static HTML and PAINTED immediately, which is
 * what keeps it LCP- and SEO-safe (and visible with JS disabled). It is transform-only (opacity stays
 * 1), so a word is never invisible, and it honors `prefers-reduced-motion` (animation removed).
 *
 * Renders an inline <span>; callers wrap it in the semantic element they need (e.g. <h1>).
 */
export function AnimatedText({ text, className, delay = 0 }: AnimatedTextProps) {
  const words = text.split(' ');

  return (
    <span className={className}>
      {words.map((w, i) => (
        <Fragment key={`${w}-${i}`}>
          <span className="anim-word" style={{ animationDelay: `${(delay + i * 0.06).toFixed(2)}s` }}>
            {w}
          </span>
          {i < words.length - 1 ? ' ' : ''}
        </Fragment>
      ))}
    </span>
  );
}
