/**
 * ContentContext (PR #2 foundation) — exposes the bootstrapped ContentStore + query layer to the app.
 * Lazy, non-blocking bootstrap (never gates render). **NOT mounted in App.tsx in PR #2** — wiring is
 * deferred to the first-consumer PR so production stays byte-identical. When the `content` flag is OFF,
 * bootstrap returns disabled and this provider is inert.
 */
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { bootstrapContent } from '../content/bootstrap';
import { createQueries, type ContentQueries } from '../content/queries';
import type { ContentStore } from '../content/contentStore';

export interface ContentContextValue {
  enabled: boolean;
  isLoaded: boolean;
  store: ContentStore | null;
  query: ContentQueries | null;
}

const DISABLED: ContentContextValue = { enabled: false, isLoaded: false, store: null, query: null };
const Ctx = createContext<ContentContextValue | null>(null);

export function ContentProvider({ children }: { children: React.ReactNode }) {
  const [value, setValue] = useState<ContentContextValue>(DISABLED);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let cancelled = false;
    bootstrapContent()
      .then(({ enabled, store }) => {
        if (cancelled) return;
        setValue({ enabled, isLoaded: true, store, query: store ? createQueries(store) : null });
      })
      .catch(() => { if (!cancelled) setValue({ ...DISABLED, isLoaded: true }); });
    return () => { cancelled = true; };
  }, []);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useContent(): ContentContextValue {
  const v = useContext(Ctx);
  if (v === null) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn('useContent() used outside <ContentProvider> — returning disabled default.');
    }
    return DISABLED;
  }
  return v;
}
