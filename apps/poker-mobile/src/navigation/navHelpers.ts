/**
 * Navigation helpers that respect the `nav5` IA flag. Under the 5-tab IA, Sessions + Stats
 * live inside the Track hub; otherwise they are standalone tabs. Cross-tab navigations
 * (currently only from HomeScreen) route through these so they resolve in BOTH IAs.
 */
import { isFeatureEnabled } from '../config/features';

type Navigator = { navigate: (name: any, params?: any) => void };

export function goToSessions(nav: Navigator) {
  if (isFeatureEnabled('nav5')) nav.navigate('Track', { segment: 'sessions' });
  else nav.navigate('AllSessions');
}

export function goToStats(nav: Navigator) {
  if (isFeatureEnabled('nav5')) nav.navigate('Track', { segment: 'stats' });
  else nav.navigate('Stats');
}
