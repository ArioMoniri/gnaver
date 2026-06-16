/**
 * Runtime service configuration. Keys are resolved dynamically, in priority:
 *   1. runtime "bring-your-own-key" store (set in Settings, on-device only)
 *   2. EXPO_PUBLIC_* environment variables (build-time)
 * When none is present the matching provider falls back to its realistic mock,
 * so the app always runs — keys just upgrade it from sample to live data.
 *
 * `serviceConfig`/`features` use getters so providers (which read them per call)
 * pick up a freshly-entered key immediately, no restart needed.
 *
 * NEVER hardcode real keys here.
 */

import { runtimeKeys } from './runtimeKeys';

const env = process.env;

export interface ServiceConfig {
  googleApiKey?: string;
  weatherApiKey?: string;
  llmProvider?: 'anthropic' | 'openai';
  llmApiKey?: string;
  llmModel: string;
}

export const serviceConfig: ServiceConfig = {
  get googleApiKey() {
    return runtimeKeys.get('googleApiKey') || env.EXPO_PUBLIC_GOOGLE_API_KEY || undefined;
  },
  get weatherApiKey() {
    return runtimeKeys.get('weatherApiKey') || env.EXPO_PUBLIC_WEATHER_API_KEY || undefined;
  },
  get llmProvider() {
    return (
      (runtimeKeys.get('llmProvider') as 'anthropic' | 'openai' | undefined) ||
      (env.EXPO_PUBLIC_LLM_PROVIDER as 'anthropic' | 'openai' | undefined) ||
      'anthropic'
    );
  },
  get llmApiKey() {
    return runtimeKeys.get('llmApiKey') || env.EXPO_PUBLIC_LLM_API_KEY || undefined;
  },
  get llmModel() {
    return (
      runtimeKeys.get('llmModel') || env.EXPO_PUBLIC_LLM_MODEL || 'claude-haiku-4-5-20251001'
    );
  },
};

/** Feature availability derived from which keys are present (live, per-call). */
export const features = {
  /** Live Google Places / Directions / Geocoding. */
  get livePlaces() {
    return !!serviceConfig.googleApiKey;
  },
  /** Live weather (Open-Meteo is free and used even without a key). */
  get liveWeather() {
    return true;
  },
  /** Conversational taste recommender via an LLM. */
  get liveTaste() {
    return !!serviceConfig.llmApiKey;
  },
};

export function describeProviders(): string {
  return [
    `places: ${features.livePlaces ? 'google' : 'mock'}`,
    `weather: open-meteo`,
    `taste: ${features.liveTaste ? serviceConfig.llmProvider : 'heuristic'}`,
  ].join(' · ');
}
