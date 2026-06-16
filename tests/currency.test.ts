import {
  currencySymbol,
  formatCostSummary,
  formatEntry,
  formatPayments,
  formatPrice,
  sumEntryCost,
} from '../src/core/currency';
import type { Place } from '../src/core/types';

const place = (id: string, amount: number | null, free = false): Place => ({
  id,
  name: id,
  location: { lat: 0, lng: 0 },
  category: 'museum',
  interests: ['culture'],
  dwellMinutes: 60,
  weatherSensitivity: 'indoor',
  price: { amount, currency: 'EUR', free, acceptedPayments: ['card'] },
});

describe('currency', () => {
  test('symbols and formatting', () => {
    expect(currencySymbol('EUR')).toBe('€');
    expect(currencySymbol('JPY')).toBe('¥');
    expect(formatPrice(12, 'EUR')).toBe('€12');
    expect(formatPrice(1500, 'JPY')).toBe('¥1,500'); // zero-decimal currency
    expect(formatPrice(12.5, 'EUR')).toBe('€12.50');
  });

  test('formatEntry handles free / unknown', () => {
    expect(formatEntry({ amount: 0, currency: 'EUR', acceptedPayments: [] }, 'EUR')).toBe('Free');
    expect(formatEntry({ amount: null, currency: 'EUR', acceptedPayments: [] }, 'EUR')).toBe('—');
    expect(formatEntry(undefined, 'EUR')).toBe('—');
    expect(formatEntry({ amount: 15, currency: 'EUR', acceptedPayments: [] }, 'EUR')).toBe('€15');
  });

  test('formatPayments lists methods', () => {
    expect(formatPayments(['card', 'mobile'])).toBe('Card · Apple/Google Pay');
    expect(formatPayments([])).toBe('Unknown');
    expect(formatPayments(undefined)).toBe('Unknown');
  });

  test('sumEntryCost adds known prices and flags unknowns', () => {
    const known = sumEntryCost([place('a', 10), place('b', 15), place('c', 0, true)], 'EUR');
    expect(known.amount).toBe(25);
    expect(known.hasUnknown).toBe(false);
    expect(formatCostSummary(known)).toBe('€25');

    const withUnknown = sumEntryCost([place('a', 10), place('d', null)], 'EUR');
    expect(withUnknown.amount).toBe(10);
    expect(withUnknown.hasUnknown).toBe(true);
    expect(formatCostSummary(withUnknown)).toBe('€10+');
  });
});
