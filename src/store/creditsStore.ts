/**
 * Pay-as-you-go credit balance (on-device, persisted). The model:
 *   - Bring your own API keys  → unlimited, free (you pay your own provider costs)
 *   - Or spend CREDITS         → we run the AI for you (hosted). Each plan is
 *     billed at its estimated live-API cost via `creditsForPlan(trip)` in
 *     `@/core` (min `CREDITS_PER_PLAN`), so big trips cost more than small ones.
 *
 * Credits are bought as consumable in-app purchases (credit packs). The purchase
 * itself needs App Store Connect consumable products + a hosted AI backend to
 * fulfil (see docs/MONETIZATION.md); this store is the on-device ledger.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Minimum credits charged for any single managed plan (cost-scaled above this). */
export const CREDITS_PER_PLAN = 1;

/** Consumable credit packs offered on the paywall (id must match an ASC product). */
export interface CreditPack {
  id: string;
  credits: number;
  price: string;
  /** Marketing tag, e.g. "Best value". */
  tag?: string;
}

export const CREDIT_PACKS: CreditPack[] = [
  { id: 'gnaver.credits.10', credits: 10, price: '$2.99' },
  { id: 'gnaver.credits.50', credits: 50, price: '$9.99', tag: 'Popular' },
  { id: 'gnaver.credits.200', credits: 200, price: '$29.99', tag: 'Best value' },
];

export interface CreditsState {
  balance: number;
  hasHydrated: boolean;
  add: (n: number) => void;
  /** Spend `n` credits; returns false (and changes nothing) if the balance is too low. */
  spend: (n: number) => boolean;
  canAfford: (n: number) => boolean;
  set: (patch: Partial<CreditsState>) => void;
}

export const useCredits = create<CreditsState>()(
  persist(
    (set, get) => ({
      // Enough credits so a new user can build a full plan or two before buying.
      balance: 5,
      hasHydrated: false,
      add: (n) => set({ balance: Math.max(0, get().balance + n) }),
      spend: (n) => {
        if (get().balance < n) return false;
        set({ balance: get().balance - n });
        return true;
      },
      canAfford: (n) => get().balance >= n,
      set: (patch) => set(patch),
    }),
    {
      name: 'gnaver.credits.v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ balance }) => ({ balance }),
      onRehydrateStorage: () => (state) => state?.set({ hasHydrated: true }),
    },
  ),
);
