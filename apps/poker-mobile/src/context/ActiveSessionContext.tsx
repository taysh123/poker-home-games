import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import * as SecureStore from '../utils/storage';
import { getMyStats, RecentSessionDto } from '../api/statsApi';

type ActiveSessionContextType = {
  activeSession: RecentSessionDto | null;
  refresh: () => void;
  clear: () => void;
};

const ActiveSessionContext = createContext<ActiveSessionContextType>({
  activeSession: null,
  refresh: () => {},
  clear: () => {},
});

export function ActiveSessionProvider({ children }: { children: React.ReactNode }) {
  const [activeSession, setActiveSession] = useState<RecentSessionDto | null>(null);

  const refresh = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) { setActiveSession(null); return; }
      const stats = await getMyStats(token);
      const active = stats.recentSessions.find(s => s.status === 'Active') ?? null;
      setActiveSession(active);
    } catch {
      // Non-critical — banner degrades gracefully if stats fails
    }
  }, []);

  const clear = useCallback(() => setActiveSession(null), []);

  useEffect(() => {
    refresh();
    const appStateSub = AppState.addEventListener('change', state => {
      if (state === 'active') refresh();
    });
    const interval = setInterval(refresh, 30_000);
    return () => {
      appStateSub.remove();
      clearInterval(interval);
    };
  }, [refresh]);

  return (
    <ActiveSessionContext.Provider value={{ activeSession, refresh, clear }}>
      {children}
    </ActiveSessionContext.Provider>
  );
}

export function useActiveSession() {
  return useContext(ActiveSessionContext);
}
