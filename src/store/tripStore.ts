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
  creditsForPlan,
  dateRange,
  resequenceDay,
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
import { features, generateItinerary, placesProvider } from '@/services';
import { useCredits } from './creditsStore';

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

/**
 * Default trip start date. After ~3pm "today" can't fit a real day of sightseeing
 * (the optimizer won't schedule in the past), so we default to TOMORROW — the
 * user can always pick an earlier date with the date picker.
 */
function defaultStartDate(): string {
  const d = new Date();
  if (d.getHours() >= 15) d.setDate(d.getDate() + 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const DEFAULT_PREFS: TripPreferences = {
  interests: ['culture', 'food', 'architecture'],
  transport: 'mixed',
  pace: 'balanced',
  includeFood: true,
  meals: ['lunch', 'dinner'],
  foodBudget: 'mid',
  weather: { avoidRain: true, avoidOutdoorAboveC: 34, avoidOutdoorBelowC: 2 },
};

interface TripState {
  status: TripStatus;
  error?: string;

  source?: TripSource;
  cityId?: string;
  sourceUrl?: string;
  /** True when the imported "list" is actually sample data (couldn't read it). */
  importedSample: boolean;
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
  /** Resolve and load ANY city by free-text name (live geocode + places when keyed). */
  startFromCityQuery: (query: string) => Promise<void>;
  startFromLink: (url: string) => Promise<void>;
  loadSampleList: () => void;
  toggleSelect: (id: string) => void;
  setAllSelected: (value: boolean) => void;
  setMustSee: (id: string, value: boolean) => void;
  addCustomPlace: (place: Place) => void;
  removeCandidate: (id: string) => void;
  /** Manually move a stop within a day; re-times the day without re-optimizing. */
  reorderStops: (dayIndex: number, fromIndex: number, toIndex: number) => void;
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
  importedSample: false,
  title: 'My Trip',
  currency: 'EUR' as CurrencyCode,
  center: undefined as LatLng | undefined,
  candidates: [] as Place[],
  selectedIds: {} as Record<string, boolean>,
  startDate: defaultStartDate(),
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
    if (!meta) return;
    // With a live key, route even the suggested cities through live data so the
    // app is never limited to the bundled datasets ("nothing hardcoded").
    if (features.livePlaces) {
      await get().startFromCityQuery(meta.name);
      return;
    }
    const places = getCityPlaces(cityId);
    set({
      ...initial,
      startDate: defaultStartDate(),
      source: 'city',
      cityId,
      title: meta.name,
      currency: meta.currency,
      center: meta.center,
      candidates: places,
      selectedIds: allSelected(places),
      preferences: { ...get().preferences },
      status: 'candidates',
    });
  },

  startFromCityQuery: async (query) => {
    const q = query.trim();
    if (!q) return;
    set({ status: 'loadingCandidates', error: undefined });
    try {
      let resolved = await placesProvider.resolveCity(q);
      // "Paris, France" → retry on just the city part so suggestion labels resolve.
      if (!resolved && q.includes(',')) {
        resolved = await placesProvider.resolveCity(q.split(',')[0].trim());
      }
      if (!resolved) {
        set({
          status: 'error',
          error: `Couldn't find "${q}". Check the spelling, or try the city's English name.`,
        });
        return;
      }
      let candidates = await placesProvider.search({
        center: resolved.center,
        interests: get().preferences.interests,
        currency: resolved.currency,
        limit: 30,
      });
      // Offline fallback to curated data when the city is one we ship.
      if (candidates.length === 0) {
        const cid = cityIdForCenter(resolved.center);
        if (cid) candidates = getCityPlaces(cid);
      }
      if (candidates.length === 0) {
        set({
          status: 'error',
          error: `No points of interest found near ${resolved.city}. Try a larger nearby city, or add a Google Maps key for richer data.`,
        });
        return;
      }
      set({
        ...initial,
        startDate: defaultStartDate(),
        source: 'city',
        cityId: cityIdForCenter(resolved.center),
        title: resolved.city,
        currency: resolved.currency || 'EUR',
        center: resolved.center,
        candidates,
        selectedIds: allSelected(candidates),
        preferences: { ...get().preferences },
        status: 'candidates',
      });
    } catch (e) {
      set({ status: 'error', error: e instanceof Error ? e.message : 'City search failed' });
    }
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
        startDate: defaultStartDate(),
        source: 'link',
        sourceUrl: url,
        cityId,
        title: parsed.title ?? meta?.name ?? 'My Trip',
        currency: meta?.currency ?? 'EUR',
        center: center ?? meta?.center,
        candidates: places,
        selectedIds: allSelected(places),
        importedSample: !!parsed.fromSample,
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
      startDate: defaultStartDate(),
      source: 'link',
      title: sample.title,
      cityId,
      currency: meta?.currency ?? 'EUR',
      center: center ?? meta?.center,
      candidates: sample.places,
      selectedIds: allSelected(sample.places),
      importedSample: true,
      preferences: { ...get().preferences },
      status: 'candidates',
    });
  },

  toggleSelect: (id) =>
    set((s) => ({ selectedIds: { ...s.selectedIds, [id]: !s.selectedIds[id] } })),

  setAllSelected: (value) =>
    set((s) => ({ selectedIds: Object.fromEntries(s.candidates.map((p) => [p.id, value])) })),

  setMustSee: (id, value) =>
    set((s) => ({
      candidates: s.candidates.map((p) => (p.id === id ? { ...p, mustSee: value } : p)),
    })),

  reorderStops: (dayIndex, fromIndex, toIndex) => {
    const s = get();
    const itin = s.itinerary;
    const day = itin?.days[dayIndex];
    if (!itin || !day) return;
    const order = day.stops.map((st) => st.place);
    if (
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= order.length ||
      toIndex >= order.length ||
      fromIndex === toIndex
    ) {
      return;
    }
    const [moved] = order.splice(fromIndex, 1);
    order.splice(toIndex, 0, moved);
    const newDay = resequenceDay(order, day.window, s.preferences, {
      weather: day.weather,
      currency: s.currency,
    });
    set({
      itinerary: {
        ...itin,
        days: itin.days.map((d, i) => (i === dayIndex ? newDay : d)),
      },
    });
  },

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

      // Billing: free with your own keys; on the managed (hosted) tier each plan
      // costs credits scaled to its estimated live-API spend. Charged only after
      // a successful generation, and never when we ran no paid APIs.
      const managed = features.managedBilling;
      const cost = managed ? creditsForPlan(trip) : 0;
      if (managed && !useCredits.getState().canAfford(cost)) {
        set({
          status: 'error',
          error: `This plan needs ${cost} credit${cost === 1 ? '' : 's'}. Add credits or your own API keys in Settings.`,
        });
        return;
      }

      const itinerary = await generateItinerary(trip, { now: todayLocal() });
      if (managed) useCredits.getState().spend(cost);
      set({ itinerary, status: 'ready', activeDay: 0 });
    } catch (e) {
      set({ status: 'error', error: e instanceof Error ? e.message : 'Could not build your plan' });
    }
  },

  regenerate: async () => {
    await get().generate();
  },

  reset: () => set({ ...initial, startDate: defaultStartDate() }),
}));
