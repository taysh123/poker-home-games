import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as storage from '../utils/storage';
import { isFeatureEnabled } from '../config/features';
import {
  getActiveCurrency, setActiveCurrency, detectDefaultCurrency, currencySymbol, isSupported,
  type CurrencyCode,
} from '../utils/currency';
import { formatCents, formatCentsSigned } from '../utils/money';
import { formatMoney as fmtMoney, formatPL as fmtPL } from '../utils/formatters';

/**
 * App-wide preferred currency (V2.1 STEP 3.5). Sets the module-level active currency so ALL formatters
 * become currency-aware with no call-site churn; exposes a reactive `useMoney()` for surfaces that must
 * update live (e.g. input symbols). When `currencyPrefs` is off, the active currency stays ILS (prod
 * unchanged). Display only — no conversion.
 */
const STORAGE_KEY = 'tpoker.currency.v1';

type CurrencyContextType = {
  code: CurrencyCode;
  symbol: string;
  setCurrency: (code: CurrencyCode) => void;
};

const CurrencyContext = createContext<CurrencyContextType>({
  code: 'ILS', symbol: '₪', setCurrency: () => {},
});

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const enabled = isFeatureEnabled('currencyPrefs');
  const [code, setCode] = useState<CurrencyCode>(getActiveCurrency());

  useEffect(() => {
    if (!enabled) return; // flag off ⇒ stay ILS, exactly as today
    let cancelled = false;
    (async () => {
      let resolved: CurrencyCode | null = null;
      try {
        const saved = await storage.getItemAsync(STORAGE_KEY);
        if (isSupported(saved)) resolved = saved;
      } catch { /* ignore */ }
      const next = resolved ?? detectDefaultCurrency();
      setActiveCurrency(next);
      if (!cancelled) setCode(next);
    })();
    return () => { cancelled = true; };
  }, [enabled]);

  const setCurrency = useCallback((next: CurrencyCode) => {
    setActiveCurrency(next);
    setCode(next);
    storage.setItemAsync(STORAGE_KEY, next).catch(() => {});
  }, []);

  return (
    <CurrencyContext.Provider value={{ code, symbol: currencySymbol(code), setCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyContextType {
  return useContext(CurrencyContext);
}

/** Reactive money formatters bound to the active currency (re-render on change). */
export function useMoney() {
  const { code, symbol } = useCurrency();
  return {
    code,
    symbol,
    format: (cents: number) => formatCents(cents, code),
    formatSigned: (cents: number) => formatCentsSigned(cents, code),
    formatMoney: (value: number) => fmtMoney(value, code),
    formatPL: (value: number) => fmtPL(value, code),
  };
}
