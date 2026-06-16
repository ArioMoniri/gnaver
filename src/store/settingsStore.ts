/**
 * Persisted user defaults. These pre-fill the New Trip screen so the common
 * case is one tap, and are editable in Settings.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { FoodBudget, Interest, MealKind, Pace, TransportMode } from '@/core';

export interface SettingsState {
  /** Default sightseeing window (minutes from midnight). */
  defaultStartMinutes: number;
  defaultEndMinutes: number;
  defaultDays: number;
  interests: Interest[];
  transport: TransportMode;
  pace: Pace;
  includeFood: boolean;
  meals: MealKind[];
  foodBudget: FoodBudget;
  cuisinePrefs: string[];
  dietary: string[];
  avoidRain: boolean;
  avoidOutdoorAboveC: number;
  avoidOutdoorBelowC: number;
  hasHydrated: boolean;
  set: (patch: Partial<SettingsState>) => void;
  toggleInterest: (interest: Interest) => void;
  reset: () => void;
}

const DEFAULTS = {
  defaultStartMinutes: 9 * 60,
  defaultEndMinutes: 21 * 60,
  defaultDays: 3,
  interests: ['culture', 'food', 'architecture'] as Interest[],
  transport: 'mixed' as TransportMode,
  pace: 'balanced' as Pace,
  includeFood: true,
  meals: ['lunch', 'dinner'] as MealKind[],
  foodBudget: 'mid' as FoodBudget,
  cuisinePrefs: [] as string[],
  dietary: [] as string[],
  avoidRain: true,
  avoidOutdoorAboveC: 34,
  avoidOutdoorBelowC: 2,
};

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...DEFAULTS,
      hasHydrated: false,
      set: (patch) => set(patch),
      toggleInterest: (interest) => {
        const has = get().interests.includes(interest);
        set({
          interests: has
            ? get().interests.filter((i) => i !== interest)
            : [...get().interests, interest],
        });
      },
      reset: () => set({ ...DEFAULTS }),
    }),
    {
      name: 'gnaver.settings.v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ set: _s, toggleInterest: _t, reset: _r, hasHydrated: _h, ...rest }) => rest,
      onRehydrateStorage: () => (state) => state?.set({ hasHydrated: true }),
    },
  ),
);
