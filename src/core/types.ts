/**
 * Gnaver core domain model.
 *
 * This module is PURE TypeScript — it must never import React Native or Expo.
 * Everything here is unit-testable in plain Node, and is the shared contract
 * that the services, store and UI layers build against.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Geography
// ─────────────────────────────────────────────────────────────────────────────

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Bounds {
  ne: LatLng;
  sw: LatLng;
}

// ─────────────────────────────────────────────────────────────────────────────
// Money
// ─────────────────────────────────────────────────────────────────────────────

/** ISO 4217 code, e.g. "EUR", "JPY", "USD". */
export type CurrencyCode = string;

export type PaymentMethod =
  | 'cash'
  | 'card'
  | 'contactless'
  | 'mobile' // Apple Pay / Google Pay
  | 'amex'
  | 'unknown';

export interface PriceInfo {
  /** Entry price in `currency`. `null` means unknown. Use `free` for confirmed-free. */
  amount: number | null;
  currency: CurrencyCode;
  free?: boolean;
  acceptedPayments: PaymentMethod[];
  /** e.g. "Free on first Sunday", "Cash only under €10". */
  notes?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Time
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A range within a single day expressed in minutes from local midnight.
 * `close` may exceed 1440 to express ranges that run past midnight
 * (e.g. a bar open 20:00–02:00 → { open: 1200, close: 1560 }).
 */
export interface TimeRange {
  open: number;
  close: number;
}

export interface OpeningHours {
  /** Keyed by JS day-of-week: 0 = Sunday … 6 = Saturday. Multiple ranges allowed. */
  weekly: Partial<Record<number, TimeRange[]>>;
  /** Date-specific overrides (holidays, ceremonies, special closures). ISO yyyy-mm-dd. */
  exceptions?: OpeningException[];
  alwaysOpen?: boolean;
}

export interface OpeningException {
  date: string; // yyyy-mm-dd
  ranges?: TimeRange[];
  closed?: boolean;
  note?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Places, interests, categories
// ─────────────────────────────────────────────────────────────────────────────

export type PlaceCategory =
  | 'landmark'
  | 'museum'
  | 'gallery'
  | 'park'
  | 'beach'
  | 'viewpoint'
  | 'religious'
  | 'historic'
  | 'market'
  | 'shopping'
  | 'nightlife'
  | 'restaurant'
  | 'cafe'
  | 'bar'
  | 'street-food'
  | 'nature'
  | 'experience'
  | 'other';

export type Interest =
  | 'culture'
  | 'history'
  | 'art'
  | 'food'
  | 'nature'
  | 'beach'
  | 'nightlife'
  | 'shopping'
  | 'architecture'
  | 'religion'
  | 'photography'
  | 'relaxation'
  | 'adventure';

/** How exposed a place is to weather, used by the re-routing logic. */
export type WeatherSensitivity = 'indoor' | 'outdoor' | 'mixed';

export interface Place {
  id: string;
  name: string;
  location: LatLng;
  category: PlaceCategory;
  interests: Interest[];
  /** 0–5. */
  rating?: number;
  userRatingsTotal?: number;
  price?: PriceInfo;
  openingHours?: OpeningHours;
  /** Suggested visit duration in minutes. */
  dwellMinutes: number;
  weatherSensitivity: WeatherSensitivity;
  photoUrl?: string;
  address?: string;
  googlePlaceId?: string;
  description?: string;
  tags?: string[];
  /** Signature / must-try dishes at this place (food stops). */
  dishes?: string[];
  /** User flagged "really nice — I should go". Strongly prioritised. */
  mustSee?: boolean;
  /** True for food candidates injected by the recommender. */
  isFood?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Transport & trip definition
// ─────────────────────────────────────────────────────────────────────────────

export type TransportMode = 'walk' | 'transit' | 'drive' | 'bike' | 'mixed';

export interface DayWindow {
  /** ISO yyyy-mm-dd, local to the destination. */
  date: string;
  /** Minutes from midnight the user wants to start sightseeing, e.g. 9*60. */
  startMinutes: number;
  /** Minutes from midnight to stop, e.g. 21*60. */
  endMinutes: number;
  /** Where the day begins (hotel or a custom point). Falls back to first stop. */
  startLocation?: LatLng;
  startName?: string;
  /** Where the day should end (may differ from start). */
  endLocation?: LatLng;
  endName?: string;
}

export type Pace = 'relaxed' | 'balanced' | 'packed';
export type FoodBudget = 'cheap' | 'mid' | 'fine';

export interface WeatherPrefs {
  /** Avoid outdoor stops when the day max exceeds this (°C). */
  avoidOutdoorAboveC?: number;
  /** Avoid outdoor stops when the day min drops below this (°C). */
  avoidOutdoorBelowC?: number;
  avoidRain?: boolean;
}

/** Which meals to weave into the day. */
export type MealKind = 'breakfast' | 'lunch' | 'dinner';

export interface TripPreferences {
  interests: Interest[];
  transport: TransportMode;
  pace: Pace;
  maxWalkMinutes?: number;
  includeFood: boolean;
  /** Meals to insert (default lunch + dinner). Empty/undefined → none. */
  meals?: MealKind[];
  foodBudget?: FoodBudget;
  /** Also surface quick/fast options (e.g. a 15-min bite) alongside sit-downs. */
  includeQuick?: boolean;
  cuisinePrefs?: string[];
  dietary?: string[];
  weather?: WeatherPrefs;
}

export interface Trip {
  id: string;
  title: string;
  city?: string;
  country?: string;
  currency: CurrencyCode;
  timezone?: string;
  center?: LatLng;
  days: DayWindow[];
  /** Candidate pool the user has selected for routing. */
  places: Place[];
  preferences: TripPreferences;
  /** Original Google Maps list link, if the trip was imported. */
  sourceUrl?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Weather
// ─────────────────────────────────────────────────────────────────────────────

export type WeatherCondition =
  | 'clear'
  | 'clouds'
  | 'rain'
  | 'snow'
  | 'storm'
  | 'fog'
  | 'unknown';

export interface DayWeather {
  date: string;
  tempMinC: number;
  tempMaxC: number;
  /** 0–100. */
  precipitationProbability: number;
  condition: WeatherCondition;
  /** 24 entries, index = hour of day. */
  hourlyTempC?: number[];
  hourlyPrecipProb?: number[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Optimizer output
// ─────────────────────────────────────────────────────────────────────────────

export interface RouteLeg {
  mode: TransportMode;
  distanceMeters: number;
  durationMinutes: number;
  /** Optional decoded path for drawing on the map. */
  polyline?: LatLng[];
}

export interface ScheduledStop {
  place: Place;
  /** Minutes from midnight on the stop's day. */
  arrivalMinutes: number;
  departureMinutes: number;
  /** "09:30" convenience strings. */
  arrival: string;
  departure: string;
  /** Travel from the previous stop (or the day's start point) to this stop. */
  legToHere?: RouteLeg;
  /** Minutes spent waiting for the place to open before entering. */
  waitMinutes?: number;
  warnings?: string[];
  isFood?: boolean;
}

export interface DayPlan {
  date: string;
  window: DayWindow;
  stops: ScheduledStop[];
  startLocation?: LatLng;
  endLocation?: LatLng;
  totalDistanceMeters: number;
  totalTravelMinutes: number;
  totalCost: { amount: number; currency: CurrencyCode; hasUnknown: boolean };
  /** Selected for the day but couldn't be fit in the window. */
  unscheduled: Place[];
  weather?: DayWeather;
  /** Google Maps directions deep link for the whole day. */
  googleMapsUrl: string;
  warnings?: string[];
}

export interface ItineraryResult {
  trip: Trip;
  days: DayPlan[];
  /** Places that never fit across the whole trip. */
  unscheduled: Place[];
  generatedAt: string;
  /** Higher is better — total realised value across the trip. */
  score: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Service contracts (implemented in src/services with real + mock providers)
// ─────────────────────────────────────────────────────────────────────────────

export interface ResolvedCity {
  city: string;
  country: string;
  center: LatLng;
  currency: CurrencyCode;
  timezone: string;
  countryCode?: string;
}

export interface PlaceSearchParams {
  center: LatLng;
  interests: Interest[];
  radiusMeters?: number;
  limit?: number;
  /** Destination currency so live price levels render correctly (not USD). */
  currency?: CurrencyCode;
}

export interface FoodSearchParams {
  near: LatLng;
  budget?: FoodBudget;
  cuisine?: string[];
  dietary?: string[];
  /** Include quick / fast-food options (e.g. a 15-min break) alongside sit-downs. */
  includeQuick?: boolean;
  /** Minutes from midnight the stop is needed (for open-now filtering). */
  atMinutes?: number;
  date?: string;
  limit?: number;
  /** Destination currency so food price levels render correctly. */
  currency?: CurrencyCode;
}

export interface ParsedList {
  title?: string;
  places: Place[];
  /** True when we couldn't read the real list and returned sample data (so the
   *  UI can be honest about it rather than pretending the import worked). */
  fromSample?: boolean;
}

export interface PlacesProvider {
  readonly name: string;
  resolveCity(query: string): Promise<ResolvedCity | null>;
  search(params: PlaceSearchParams): Promise<Place[]>;
  details(googlePlaceId: string): Promise<Partial<Place> | null>;
  /** Resolve a shared Google Maps list / saved-places link into Places. */
  parseSharedList(url: string): Promise<ParsedList>;
  suggestFood(params: FoodSearchParams): Promise<Place[]>;
}

export interface RoutingProvider {
  readonly name: string;
  leg(from: LatLng, to: LatLng, mode: TransportMode, departMinutes?: number): Promise<RouteLeg>;
  /** Full pairwise travel matrix for `points` (row = origin, col = destination). */
  matrix(points: LatLng[], mode: TransportMode): Promise<RouteLeg[][]>;
}

export interface WeatherProvider {
  readonly name: string;
  forecast(center: LatLng, dates: string[]): Promise<DayWeather[]>;
}

export interface TasteProvider {
  readonly name: string;
  /** Rank/curate food candidates against the traveller's taste. */
  rankFood(candidates: Place[], prefs: TripPreferences, context?: string): Promise<Place[]>;
  /**
   * Suggest 1–3 signature dishes for each given food place in a city.
   * Returns a map keyed by place id. Live LLM when keyed; otherwise echoes any
   * curated `dishes` already on the place (or {}).
   */
  suggestDishes(places: Place[], city: string): Promise<Record<string, string[]>>;
  /** Must-try local dishes for a city (general, not place-specific). */
  localDishes(city: string): Promise<string[]>;
  /** Free-form conversational ask (used by the "ask about my taste" flow). */
  ask(prompt: string): Promise<string>;
}
