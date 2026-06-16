/**
 * Runtime "bring-your-own-key" store. Lets a user paste their own Google /
 * weather / LLM keys at runtime (Settings) instead of baking them in at build
 * time — the privacy-friendly, open-source monetization model (you pay your own
 * API costs). Keys live only on-device (AsyncStorage), never in the JS bundle
 * and never in git.
 *
 * `serviceConfig` (config.ts) reads these first, then falls back to EXPO_PUBLIC_*
 * env. Providers read `serviceConfig` per call, so setting a key takes effect
 * immediately without a restart.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type RuntimeKeyName =
  | 'googleApiKey'
  | 'weatherApiKey'
  | 'llmProvider'
  | 'llmApiKey'
  | 'llmModel';

const STORAGE_KEY = 'gnaver.keys.v1';

let store: Partial<Record<RuntimeKeyName, string>> = {};
let loaded = false;

async function persist(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* best-effort */
  }
}

export const runtimeKeys = {
  /** Read a single runtime key (undefined if unset). */
  get(name: RuntimeKeyName): string | undefined {
    const v = store[name];
    return v && v.length > 0 ? v : undefined;
  },
  /** Set or clear a runtime key (empty string clears it). Persists on-device. */
  set(name: RuntimeKeyName, value: string | undefined): void {
    if (value && value.trim().length > 0) store[name] = value.trim();
    else delete store[name];
    void persist();
  },
  /** Current snapshot (for the settings UI). */
  all(): Partial<Record<RuntimeKeyName, string>> {
    return { ...store };
  },
  /** Clear every runtime key. */
  clear(): void {
    store = {};
    void persist();
  },
  /** Hydrate from disk once, at app start. */
  async load(): Promise<void> {
    if (loaded) return;
    loaded = true;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) store = JSON.parse(raw) as Partial<Record<RuntimeKeyName, string>>;
    } catch {
      /* ignore corrupt cache */
    }
  },
};
