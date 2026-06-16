import { rankFoodHeuristic, scoreFood } from '../src/core/recommender';
import type { Place, TripPreferences } from '../src/core/types';

function food(over: Partial<Place> & Pick<Place, 'id' | 'name'>): Place {
  return {
    location: { lat: 0, lng: 0 },
    category: 'restaurant',
    interests: ['food'],
    dwellMinutes: 60,
    weatherSensitivity: 'indoor',
    rating: 4.2,
    userRatingsTotal: 800,
    isFood: true,
    ...over,
  };
}

const prefs: TripPreferences = {
  interests: ['food'],
  transport: 'walk',
  pace: 'balanced',
  includeFood: true,
  foodBudget: 'cheap',
  cuisinePrefs: ['seafood'],
  dietary: ['vegetarian'],
};

describe('food recommender', () => {
  test('cuisine matches score higher', () => {
    const seafood = food({ id: 's', name: 'Seafood Spot', tags: ['seafood', 'fish'] });
    const generic = food({ id: 'g', name: 'Diner', tags: ['american'] });
    expect(scoreFood(seafood, prefs)).toBeGreaterThan(scoreFood(generic, prefs));
  });

  test('budget mismatch is penalised', () => {
    const cheap = food({ id: 'c', name: 'Tasca', price: { amount: 9, currency: 'EUR', acceptedPayments: ['cash'] } });
    const fine = food({ id: 'f', name: 'Fine Dining', price: { amount: 80, currency: 'EUR', acceptedPayments: ['card'] } });
    // Traveller wants 'cheap', so the tasca should win on budget alignment.
    expect(scoreFood(cheap, prefs)).toBeGreaterThan(scoreFood(fine, prefs));
  });

  test('rankFoodHeuristic is deterministic and best-first', () => {
    const list = [
      food({ id: 'a', name: 'A', rating: 3.5, tags: [] }),
      food({ id: 'b', name: 'Seafood B', rating: 4.8, tags: ['seafood'] }),
      food({ id: 'c', name: 'C', rating: 4.0, tags: [] }),
    ];
    const ranked = rankFoodHeuristic(list, prefs);
    expect(ranked[0].id).toBe('b');
    expect(rankFoodHeuristic(list, prefs).map((p) => p.id)).toEqual(ranked.map((p) => p.id));
  });
});
