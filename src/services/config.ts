/**
 * Runtime service configuration. Reads API keys from EXPO_PUBLIC_* environment
 * variables (inlined by Expo at build time). When a key is absent, the matching
 * provider falls back to its realistic mock implementation, so the app always
 * runs — keys just upgrade it from sample data to live data.
 *
 * NEVER hardcode keys here. Put them in .env (git-ignored). See .env.example.
 */

const env = process.env;

export interface ServiceConfig {
  googleApiKey?: string;
  weatherApiKey?: string;
  llmProvider?: 'anthropic' | 'openai';
  llmApiKey?: string;
  llmModel: string;
}

export const serviceConfig: ServiceConfig = {
  googleApiKey: env.EXPO_PUBLIC_GOOGLE_API_KEY || undefined,
  weatherApiKey: env.EXPO_PUBLIC_WEATHER_API_KEY || undefined,
  llmProvider: (env.EXPO_PUBLIC_LLM_PROVIDER as 'anthropic' | 'openai') || 'anthropic',
  llmApiKey: env.EXPO_PUBLIC_LLM_API_KEY || undefined,
  llmModel: env.EXPO_PUBLIC_LLM_MODEL || 'claude-haiku-4-5-20251001',
};

/** Feature availability derived from which keys are present. */
export const features = {
  /** Live Google Places / Directions / Geocoding. */
  livePlaces: !!serviceConfig.googleApiKey,
  /** Live weather (Open-Meteo is free and used even without a key). */
  liveWeather: true,
  /** Conversational taste recommender via an LLM. */
  liveTaste: !!serviceConfig.llmApiKey,
} as const;

export function describeProviders(): string {
  return [
    `places: ${features.livePlaces ? 'google' : 'mock'}`,
    `weather: open-meteo`,
    `taste: ${features.liveTaste ? serviceConfig.llmProvider : 'heuristic'}`,
  ].join(' · ');
}
