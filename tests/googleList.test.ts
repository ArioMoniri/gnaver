import {
  classifyGoogleUrl,
  isGoogleMapsUrl,
  parseCoordsFromUrl,
  parsePlaceNameFromUrl,
} from '../src/core/googleList';

describe('google maps url parsing', () => {
  test('classifies short links and place links', () => {
    expect(classifyGoogleUrl('https://maps.app.goo.gl/AbCdEf123')).toBe('short');
    expect(
      classifyGoogleUrl('https://www.google.com/maps/place/Bel%C3%A9m+Tower/@38.6916,-9.216,17z'),
    ).toBe('place');
    expect(classifyGoogleUrl('https://www.google.com/maps/dir/A/B')).toBe('directions');
    expect(classifyGoogleUrl('https://example.com/foo')).toBe('unknown');
    expect(classifyGoogleUrl('not a url')).toBe('unknown');
  });

  test('isGoogleMapsUrl', () => {
    expect(isGoogleMapsUrl('https://maps.app.goo.gl/x')).toBe(true);
    expect(isGoogleMapsUrl('https://news.ycombinator.com')).toBe(false);
  });

  test('extracts the precise pin coordinate (!3d!4d wins over @)', () => {
    const url =
      'https://www.google.com/maps/place/X/@38.7000,-9.1000,17z/data=!3d38.6916!4d-9.2160';
    expect(parseCoordsFromUrl(url)).toEqual({ lat: 38.6916, lng: -9.216 });
  });

  test('falls back to @lat,lng and ?q=', () => {
    expect(parseCoordsFromUrl('https://maps.google.com/?q=38.7223,-9.1393')).toEqual({
      lat: 38.7223,
      lng: -9.1393,
    });
    expect(parseCoordsFromUrl('https://www.google.com/maps/@38.72,-9.14,15z')).toEqual({
      lat: 38.72,
      lng: -9.14,
    });
  });

  test('parses a human place name', () => {
    expect(
      parsePlaceNameFromUrl('https://www.google.com/maps/place/Jer%C3%B3nimos+Monastery/@38,-9'),
    ).toBe('Jerónimos Monastery');
  });
});
