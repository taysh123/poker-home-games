'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

/**
 * The OGL/WebGL aurora lives in a SEPARATE async chunk. `ssr: false` keeps it
 * out of the route's first-load JS and out of the static HTML — it is only
 * fetched once the desktop + motion-allowed + in-view gates below pass.
 */
const Aurora = dynamic(() => import('./Aurora'), { ssr: false });

/**
 * Decorative full-bleed aurora background. Renders nothing on the server and on
 * first client paint (so it is LCP-safe and needs no JS). On the client, it
 * mounts a lazy-loaded OGL/WebGL aurora ONLY when every gate holds:
 *   1. Desktop viewport  — `(min-width: 1024px)` (skip the WebGL cost on phones/tablets)
 *   2. Motion allowed    — `(prefers-reduced-motion: reduce)` is false
 *   3. In view           — IntersectionObserver fires once, then disconnects
 * The OGL/Aurora chunk is never even fetched until all three pass. When the gates
 * don't pass the root div stays empty (the FinalCta section keeps a static
 * radial-glow fallback behind it).
 */
export function AuroraBackground() {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Static export: only touch browser APIs on the client.
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!isDesktop || reduceMotion) return; // mobile / reduced-motion never load OGL/Aurora

    const el = ref.current;
    if (!el) return;

    // No IntersectionObserver support: gates 1 & 2 already passed, just upgrade.
    if (typeof IntersectionObserver === 'undefined') {
      setShow(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShow(true);
          observer.disconnect(); // load once, never again
        }
      },
      { rootMargin: '200px' }, // start loading just before it scrolls into view
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {show ? (
        <div className="h-full w-full opacity-70">
          <Aurora
            colorStops={['#1A4B43', '#C9A84C', '#1E2D3D']}
            amplitude={0.8}
            blend={0.4}
            speed={0.6}
          />
        </div>
      ) : null}
    </div>
  );
}
