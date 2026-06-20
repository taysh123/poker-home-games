/** Reliable offline awareness (V2.1 STEP 4.1) via @react-native-community/netinfo (web + native). */
import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

export function useNetwork(): { offline: boolean } {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const unsub = NetInfo.addEventListener(state => {
      // Treat an explicit false as offline; unknown/null stays "online" to avoid false alarms.
      setOffline(state.isConnected === false);
    });
    return () => unsub();
  }, []);
  return { offline };
}
