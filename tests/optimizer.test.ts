import { isOpenAt } from '../src/core/constraints';
import { optimizeItinerary } from '../src/core/optimizer';
import { parseMinutes } from '../src/core/time';
import type {
  DayWindow,
  OpeningHours,
  Place,
  TimeRange,
  Trip,
  TripPreferences,
} from '../src/core/types';

const everyDay = (ranges: TimeRange[]): OpeningHours => ({
  weekly: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, ranges])),
});

function makePlace(p: Partial<Place> & Pick<Place, 'id' | 'name' | 'location'>): Place {
  return {
    category: 'landmark',
    interests: ['culture'],
    dwellMinutes: 60,
    weatherSensitivity: 'mixed',
    rating: 4.5,
    userRatingsTotal: 4000,
    price: { amount: 10, currency: 'EUR', acceptedPayments: ['card'] },
    ...p,
  };
}

// A compact Lisbon dataset with realistic clustering (Belém vs centre vs Parque).
const jeronimos = makePlace({
  id: 'jeronimos',
  name: 'Jerónimos Monastery',
  location: { lat: 38.6979, lng: -9.2065 },
  category: 'historic',
  interests: ['history', 'architecture'],
  openingHours: everyDay([{ open: 600, close: 1080 }]),
  dwellMinutes: 90,
  weatherSensitivity: 'indoor',
  mustSee: true,
  rating: 4.7,
});
const belemTower = makePlace({
  id: 'belem',
  name: 'Belém Tower',
  location: { lat: 38.6916, lng: -9.216 },
  category: 'landmark',
  interests: ['history'],
  openingHours: everyDay([{ open: 600, close: 1050 }]),
  weatherSensitivity: 'outdoor',
});
const castle = makePlace({
  id: 'castle',
  name: 'São Jorge Castle',
  location: { lat: 38.7139, lng: -9.1335 },
  category: 'historic',
  openingHours: everyDay([{ open: 540, close: 1260 }]),
  dwellMinutes: 75,
  weatherSensitivity: 'outdoor',
});
const oceanario = makePlace({
  id: 'oceanario',
  name: 'Oceanário',
  location: { lat: 38.7635, lng: -9.0937 },
  category: 'museum',
  interests: ['nature'],
  openingHours: everyDay([{ open: 600, close: 1140 }]),
  dwellMinutes: 120,
  weatherSensitivity: 'indoor',
});
// Closed on the trip date via a ceremony exception — must never be scheduled.
const closedMuseum = makePlace({
  id: 'closed',
  name: 'Closed Museum',
  location: { lat: 38.72, lng: -9.14 },
  category: 'museum',
  openingHours: {
    weekly: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, [{ open: 600, close: 1080 }]])),
    exceptions: [{ date: '2026-06-17', closed: true, note: 'Ceremony' }],
  },
  weatherSensitivity: 'indoor',
});

const HOTEL = { lat: 38.7223, lng: -9.1393 };

const basePrefs: TripPreferences = {
  interests: ['history', 'architecture', 'nature'],
  transport: 'transit',
  pace: 'balanced',
  includeFood: false,
};

function makeTrip(over: Partial<Trip> = {}): Trip {
  const day: DayWindow = {
    date: '2026-06-17',
    startMinutes: 9 * 60,
    endMinutes: 19 * 60,
    startLocation: HOTEL,
    startName: 'Hotel',
  };
  return {
    id: 'trip',
    title: 'Lisbon',
    currency: 'EUR',
    days: [day],
    places: [jeronimos, belemTower, castle, oceanario, closedMuseum],
    preferences: basePrefs,
    ...over,
  };
}

describe('optimizeItinerary', () => {
  test('produces one day plan with a feasible, time-ordered schedule', () => {
    const result = optimizeItinerary({ trip: makeTrip() });
    expect(result.days).toHaveLength(1);
    const day = result.days[0];
    expect(day.stops.length).toBeGreaterThan(0);

    // Timeline is strictly increasing.
    for (let i = 1; i < day.stops.length; i++) {
      expect(day.stops[i].arrivalMinutes).toBeGreaterThanOrEqual(day.stops[i - 1].departureMinutes);
    }
  });

  test('every scheduled stop is open and inside the day window', () => {
    const result = optimizeItinerary({ trip: makeTrip() });
    const day = result.days[0];
    for (const stop of day.stops) {
      expect(stop.arrivalMinutes).toBeGreaterThanOrEqual(9 * 60);
      expect(stop.departureMinutes).toBeLessThanOrEqual(19 * 60);
      expect(isOpenAt(stop.place.openingHours, day.date, stop.arrivalMinutes)).toBe(true);
    }
  });

  test('a place closed by a ceremony exception is never scheduled', () => {
    const result = optimizeItinerary({ trip: makeTrip() });
    const allIds = result.days.flatMap((d) => d.stops.map((s) => s.place.id));
    expect(allIds).not.toContain('closed');
  });

  test('ends the day at the chosen end point with an explicit return leg in the totals', () => {
    const END = { lat: 38.705, lng: -9.16 };
    const trip = makeTrip({
      days: [
        {
          date: '2026-06-17',
          startMinutes: 9 * 60,
          endMinutes: 19 * 60,
          startLocation: HOTEL,
          startName: 'Hotel',
          endLocation: END,
          endName: 'Apartment',
        },
      ],
    });
    const day = optimizeItinerary({ trip }).days[0];
    expect(day.stops.length).toBeGreaterThan(0);
    // The return-to-end leg is present and labelled for the UI.
    expect(day.endLeg).toBeDefined();
    expect(day.endLeg!.durationMinutes).toBeGreaterThan(0);
    expect(day.startName).toBe('Hotel');
    expect(day.endName).toBe('Apartment');
    // Day totals must account for the trip back to the end point.
    const stopTravel = day.stops.reduce((s, st) => s + (st.legToHere?.durationMinutes ?? 0), 0);
    expect(day.totalTravelMinutes).toBe(stopTravel + day.endLeg!.durationMinutes);
  });

  test('must-see places are prioritised', () => {
    const result = optimizeItinerary({ trip: makeTrip() });
    const allIds = result.days.flatMap((d) => d.stops.map((s) => s.place.id));
    expect(allIds).toContain('jeronimos');
  });

  test('a Google Maps directions link is produced per day', () => {
    const result = optimizeItinerary({ trip: makeTrip() });
    expect(result.days[0].googleMapsUrl).toMatch(/^https:\/\/www\.google\.com\/maps\/dir\//);
    expect(result.days[0].googleMapsUrl).toContain('travelmode=transit');
  });

  test('is deterministic for identical input', () => {
    const a = optimizeItinerary({ trip: makeTrip() });
    const b = optimizeItinerary({ trip: makeTrip() });
    expect(JSON.stringify(a.days)).toEqual(JSON.stringify(b.days));
  });

  test('overflowing the day window leaves places unscheduled', () => {
    // A 3-hour window can't absorb four long visits.
    const trip = makeTrip({
      days: [{ date: '2026-06-17', startMinutes: 9 * 60, endMinutes: 12 * 60, startLocation: HOTEL }],
    });
    const result = optimizeItinerary({ trip });
    expect(result.unscheduled.length).toBeGreaterThan(0);
  });

  test('inserts a meal when food is enabled and a window is crossed', () => {
    const restaurant = makePlace({
      id: 'rest',
      name: 'Taberna',
      location: { lat: 38.711, lng: -9.136 },
      category: 'restaurant',
      interests: ['food'],
      openingHours: everyDay([{ open: 720, close: 1380 }]),
      dwellMinutes: 60,
      isFood: true,
    });
    const trip = makeTrip({ preferences: { ...basePrefs, includeFood: true } });
    const result = optimizeItinerary({
      trip,
      foodByDate: { '2026-06-17': [restaurant] },
    });
    const foodStops = result.days[0].stops.filter((s) => s.isFood);
    expect(foodStops.length).toBeGreaterThanOrEqual(1);
    const lunch = foodStops[0];
    expect(lunch.arrivalMinutes).toBeGreaterThanOrEqual(parseMinutes('11:30'));
    expect(lunch.arrivalMinutes).toBeLessThanOrEqual(parseMinutes('15:00'));
  });

  test('respects a custom day start point (first leg departs from it)', () => {
    const result = optimizeItinerary({ trip: makeTrip() });
    const firstLeg = result.days[0].stops[0].legToHere;
    expect(firstLeg).toBeDefined();
    expect(firstLeg!.durationMinutes).toBeGreaterThan(0);
  });
});
