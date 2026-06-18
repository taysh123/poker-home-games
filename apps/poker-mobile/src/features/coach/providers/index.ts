/**
 * Provider registry — the vendor-agnostic seam. The app asks for a provider by id and
 * never imports a vendor SDK directly. Adding OpenAI / Anthropic / Gemini / self-hosted
 * = implement ICoachProvider + add a case here; nothing else changes.
 */
import type { ICoachProvider } from '../types';
import { COACH_CONFIG, type CoachProviderId } from '../config';
import { mockCoachProvider } from './mockCoachProvider';

export function getCoachProvider(id: CoachProviderId = COACH_CONFIG.provider): ICoachProvider {
  switch (id) {
    case 'mock':
      return mockCoachProvider;
    // case 'openai':    return openAiCoachProvider;     // TODO: implement ICoachProvider
    // case 'anthropic': return anthropicCoachProvider;  // TODO
    // case 'gemini':    return geminiCoachProvider;      // TODO
    // case 'self':      return selfHostedCoachProvider;  // TODO
    default:
      return mockCoachProvider; // safe fallback until the vendor is wired
  }
}
