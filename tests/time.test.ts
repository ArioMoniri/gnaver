import {
  addDays,
  clamp,
  dateRange,
  dayOfWeek,
  formatDateLabel,
  formatDistance,
  formatDuration,
  formatMinutes,
  parseMinutes,
} from '../src/core/time';

describe('time helpers', () => {
  test('formatMinutes renders minute-of-day', () => {
    expect(formatMinutes(570)).toBe('09:30');
    expect(formatMinutes(0)).toBe('00:00');
    expect(formatMinutes(1439)).toBe('23:59');
  });

  test('formatMinutes marks past-midnight days', () => {
    expect(formatMinutes(1530)).toBe('01:30 +1');
  });

  test('parseMinutes is the inverse and rejects junk', () => {
    expect(parseMinutes('09:30')).toBe(570);
    expect(parseMinutes('7:05')).toBe(425);
    expect(Number.isNaN(parseMinutes('25:00'))).toBe(true);
    expect(Number.isNaN(parseMinutes('noon'))).toBe(true);
  });

  test('dayOfWeek is timezone-safe', () => {
    // 2026-06-16 is a Tuesday.
    expect(dayOfWeek('2026-06-16')).toBe(2);
    // 2026-06-14 is a Sunday.
    expect(dayOfWeek('2026-06-14')).toBe(0);
  });

  test('addDays / dateRange roll months correctly', () => {
    expect(addDays('2026-06-30', 1)).toBe('2026-07-01');
    expect(dateRange('2026-12-30', 4)).toEqual([
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
    ]);
  });

  test('formatDuration / formatDistance humanise values', () => {
    expect(formatDuration(95)).toBe('1h 35m');
    expect(formatDuration(40)).toBe('40m');
    expect(formatDuration(120)).toBe('2h');
    expect(formatDistance(850)).toBe('850 m');
    expect(formatDistance(3200)).toBe('3.2 km');
  });

  test('formatDateLabel and clamp', () => {
    expect(formatDateLabel('2026-06-16')).toBe('Tue, Jun 16');
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
  });
});
