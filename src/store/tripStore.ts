/**
 * The trip state machine that drives the whole flow:
 *   import (city or Google list) → edit selection → generate → view plan → re-route.
 *
 * Screens read slices of this store and call its actions; all heavy lifting
 * (routing, weather, food, optimization) happens in services.generateItinerary.
 */
import { create } from 'zustand';

import {
  centroid,
  dateRange,
  type CurrencyCode,
  type DayWindow,
  type ItineraryResult,
  type LatLng,
  type Place,
  type TripPreferences,
  type Trip,
} from '@/core';
import {
  cityIdForCenter,
  getCityPlaces,
  getSampleSharedList,
  listCities,
} from '@/data';
import { generateItinerary, placesProvider } from '@/services';

export type TripSource = 'city' | 'link';
export type TripStatus =
  | 'idle'
  | 'loadingCandidates'
  | 'candidates'
  | 'generating'
  | 'ready'
  | 'error';

/** Per-day overrides for custom start/end points and hours. */
export interface DayOverride {
  startMinutes?: number;
  endMinutes?: number;
  startLocation?: LatLng;
  startName?: string;
  endLocation?: LatLng;
  endName?: string;
}

function todayLocal(): { date: string; minutes: number } {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    minutes: d.getHours() * 60 + d.getMinutes(),
  };
}

const DEFAULT_PREFS: TripPreferences = {
  interests: ['culture', 'food', 'architecture'],
  transport: 'mixed',
  pace: 'balanced',
  includeFood: true,
  foodBudget: 'mid',
  weather: { avoidRain: true, avoidOutdoorAboveC: 34, avoidOutdoorBelowC: 2 },
};

interface TripState {
  status: TripStatus;
  error?: string;

  source?: TripSource;
  cityId?: string;
  sourceUrl?: string;
  title: string;
  currency: CurrencyCode;
  center?: LatLng;

  candidates: Place[];
  selectedIds: Record<string, boolean>;

  startDate: string;
  dayCount: number;
  startMinutes: number;
  endMinutes: number;
  perDay: Record<number, DayOverride>;

  preferences: TripPreferences;

  itinerary: ItineraryResult | null;
  activeDay: number;

  // selectors
  selectedPlaces: () => Place[];
  buildTrip: () => Trip;

  // mutations
  startFromCity: (cityId: string) => Promise<void>;
  startFromLink: (url: string) => Promise<void>;
  loadSampleList: () => void;
  toggleSelect: (id: string) => void;
  setAllSelected: (value: boolean) => void;
  addCustomPlace: (place: Place) => void;
  removeCandidate: (id: string) => void;
  setDayCount: (n: number) => void;
  setHours: (startMinutes: number, endMinutes: number) => void;
  setStartDate: (iso: string) => void;
  setDayOverride: (index: number, patch: DayOverride) => void;
  setPreferences: (patch: Partial<TripPreferences>) => void;
  setActiveDay: (index: number) => void;
  generate: () => Promise<void>;
  regenerate: () => Promise<void>;
  reset: () => void;
}

const initial = {
  status: 'idle' as TripStatus,
  error: undefined as string | undefined,
  source: undefined as TripSource | undefined,
  cityId: undefined as string | undefined,
  sourceUrl: undefined as string | undefined,
  title: 'My Trip',
  currency: 'EUR' as CurrencyCode,
  center: undefined as LatLng | undefined,
  candidates: [] as Place[],
  selectedIds: {} as Record<string, boolean>,
  startDate: todayLocal().date,
  dayCount: 3,
  startMinutes: 9 * 60,
  endMinutes: 21 * 60,
  perDay: {} as Record<number, DayOverride>,
  preferences: DEFAULT_PREFS,
  itinerary: null as ItineraryResult | null,
  activeDay: 0,
};

const allSelected = (places: Place[]): Record<string, boolean> =>
  Object.fromEntries(places.map((p) => [p.id, true]));

export const useTrip = create<TripState>()((set, get) => ({
  ...initial,

  selectedPlaces: () => get().candidates.filter((p) => get().selectedIds[p.id]),

  buildTrip: () => {
    const s = get();
    const dates = dateRange(s.startDate, s.dayCount);
    const days: DayWindow[] = dates.map((date, i) => {
      const o = s.perDay[i] ?? {};
      return {
        date,
        startMinutes: o.startMinutes ?? s.startMinutes,
        endMinutes: o.endMinutes ?? s.endMinutes,
        startLocation: o.startLocation ?? s.center,
        startName: o.startName ?? (s.center ? 'Trip base' : undefined),
        endLocation: o.endLocation,
        endName: o.endName,
      };
    });
    return {
      id: 'trip-1',
      title: s.title,
      city: s.cityId,
      currency: s.currency,
      center: s.center,
      days,
      places: s.selectedPlaces(),
      preferences: s.preferences,
      sourceUrl: s.sourceUrl,
    };
  },

  startFromCity: async (cityId) => {
    const meta = listCities().find((c) => c.id === cityId);
    const places = getCityPlaces(cityId);
    set({
      ...initial,
      startDate: todayLocal().date,
      source: 'city',
      cityId,
      title: meta?.name ?? 'My Trip',
      currency: meta?.currency ?? 'EUR',
      center: meta?.center,
      candidates: places,
      selectedIds: allSelected(places),
      preferences: { ...get().preferences },
      status: 'candidates',
    });
  },

  startFromLink: async (url) => {
    set({ status: 'loadingCandidates', error: undefined });
    try {
      const parsed = await placesProvider.parseSharedList(url);
      const places = parsed.places;
      const center = centroid(places.map((p) => p.location)) ?? undefined;
      const cityId = center ? cityIdForCenter(center) : undefined;
      const meta = cityId ? listCities().find((c) => c.id === cityId) : undefined;
      set({
        ...initial,
        startDate: todayLocal().date,
        source: 'link',
        sourceUrl: url,
        cityId,
        title: parsed.title ?? meta?.name ?? 'My Trip',
        currency: meta?.currency ?? 'EUR',
        center: center ?? meta?.center,
        candidates: places,
        selectedIds: allSelected(places),
        preferences: { ...get().preferences },
        status: 'candidates',
      });
    } catch (e) {
      set({ status: 'error', error: e instanceof Error ? e.message : 'Could not read that link' });
    }
  },

  loadSampleList: () => {
    const sample = getSampleSharedList();
    const center = centroid(sample.places.map((p) => p.location)) ?? undefined;
    const cityId = center ? cityIdForCenter(center) : undefined;
    const meta = cityId ? listCities().find((c) => c.id === cityId) : undefined;
    set({
      ...initial,
      startDate: todayLocal().date,
      source: 'link',
      title: sample.title,
      cityId,
      currency: meta?.currency ?? 'EUR',
      center: center ?? meta?.center,
      candidates: sample.places,
      selectedIds: allSelected(sample.places),
      preferences: { ...get().preferences },
      status: 'candidates',
    });
  },

  toggleSelect: (id) =>
    set((s) => ({ selectedIds: { ...s.selectedIds, [id]: !s.selectedIds[id] } })),

  setAllSelected: (value) =>
    set((s) => ({ selectedIds: Object.fromEntries(s.candidates.map((p) => [p.id, value])) })),

  addCustomPlace: (place) =>
    set((s) => ({
      candidates: [...s.candidates, place],
      selectedIds: { ...s.selectedIds, [place.id]: true },
    })),

  removeCandidate: (id) =>
    set((s) => ({
      candidates: s.candidates.filter((p) => p.id !== id),
      selectedIds: Object.fromEntries(
        Object.entries(s.selectedIds).filter(([k]) => k !== id),
      ),
    })),

  setDayCount: (n) => set({ dayCount: Math.max(1, Math.min(14, Math.round(n))) }),
  setHours: (startMinutes, endMinutes) => set({ startMinutes, endMinutes }),
  setStartDate: (iso) => set({ startDate: iso }),
  setDayOverride: (index, patch) =>
    set((s) => ({ perDay: { ...s.perDay, [index]: { ...s.perDay[index], ...patch } } })),
  setPreferences: (patch) => set((s) => ({ preferences: { ...s.preferences, ...patch } })),
  setActiveDay: (index) => set({ activeDay: index }),

  generate: async () => {
    set({ status: 'generating', error: undefined });
    try {
      const trip = get().buildTrip();
      if (trip.places.length === 0) {
        set({ status: 'error', error: 'Select at least one place first.' });
        return;
      }
      const itinerary = await generateItinerary(trip, { now: todayLocal() });
      set({ itinerary, status: 'ready', activeDay: 0 });
    } catch (e) {
      set({ status: 'error', error: e instanceof Error ? e.message : 'Could not build your plan' });
    }
  },

  regenerate: async () => {
    await get().generate();
  },

  reset: () => set({ ...initial, startDate: todayLocal().date }),
}));
