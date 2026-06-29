'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

/**
 * The three.js scene lives in a SEPARATE async chunk. `ssr: false` keeps it out
 * of the route's first-load JS and out of the static HTML — it is only fetched
 * once the desktop + motion-allowed + in-view gates below pass.
 */
const PokerChip3D = dynamic(() => import('./PokerChip3D'), { ssr: false });

/**
 * CSS poker-chip "poster" — the static fallback. This is the ONLY thing rendered
 * on the server and on first client paint, so it is LCP-safe and needs no JS.
 * Mirrors the original Hero placeholder markup; fills the parent box.
 */
function ChipPoster() {
  return (
    <div className="chip-face flex h-full w-full items-center justify-center rounded-full">
      <div className="flex h-[52%] w-[52%] items-center justify-center rounded-full border border-gold/40 bg-background/85">
        <span className="font-display text-lg leading-none text-goldLight">T</span>
      </div>
    </div>
  );
}

/**
 * Decorative hero chip. Always paints the CSS poster immediately (no layout
 * shift, no JS required). On the client, it upgrades to a lazy-loaded three.js
 * 3D chip ONLY when every gate holds:
 *   1. Desktop viewport  — `(min-width: 1024px)` (skip the WebGL cost on phones/tablets)
 *   2. Motion allowed    — `(prefers-reduced-motion: reduce)` is false
 *   3. In view           — IntersectionObserver fires once, then disconnects
 * The three.js chunk is never even fetched until all three pass.
 */
export function HeroChip() {
  const ref = useRef<HTMLDivElement>(null);
  const [show3D, setShow3D] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Static export: only touch browser APIs on the client.
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!isDesktop || reduceMotion) return; // mobile / reduced-motion never load three.js

    const el = ref.current;
    if (!el) return;

    // No IntersectionObserver support: gates 1 & 2 already passed, just upgrade.
    if (typeof IntersectionObserver === 'undefined') {
      setShow3D(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShow3D(true);
          observer.disconnect(); // load once, never again
        }
      },
      { rootMargin: '200px' }, // start loading just before it scrolls into view
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="pointer-events-none relative h-full w-full">
      {/* Poster: always in the DOM, paints first. Fades out once the 3D chip has drawn a frame. */}
      <div
        aria-hidden="true"
        className={`absolute inset-0 transition-opacity duration-500 ${ready ? 'opacity-0' : 'opacity-100'}`}
      >
        <ChipPoster />
      </div>

      {show3D ? (
        <div className="absolute inset-0">
          <PokerChip3D onReady={() => setReady(true)} />
        </div>
      ) : null}
    </div>
  );
}
