import React, { createContext, useContext } from 'react';

/**
 * Tells entry screens whether the BrandSplash overlay has resolved, so their
 * entrance choreography starts when it can actually be SEEN — not invisibly
 * underneath the opaque splash (which fully covers the app until ~1.2s).
 *
 * Defaults to true: outside the provider (tests, storybook-style renders) and
 * with the `v2Splash` kill-switch off, entrances play immediately on mount —
 * exactly the pre-splash behavior.
 */
const SplashGateContext = createContext(true);

export function SplashGateProvider({ done, children }: { done: boolean; children: React.ReactNode }) {
  return <SplashGateContext.Provider value={done}>{children}</SplashGateContext.Provider>;
}

export function useSplashDone(): boolean {
  return useContext(SplashGateContext);
}
