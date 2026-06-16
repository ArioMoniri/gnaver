import { boundsOf, centroid, estimateLeg, haversineMeters, padBounds } from '../src/core/geo';
import type { LatLng } from '../src/core/types';

const LISBON: LatLng = { lat: 38.7223, lng: -9.1393 };
const BELEM: LatLng = { lat: 38.6916, lng: -9.2160 };

describe('geo', () => {
  test('haversine matches a known distance (Lisbon centre → Belém ≈ 7.4 km)', () => {
    const d = haversineMeters(LISBON, BELEM);
    expect(d).toBeGreaterThan(6500);
    expect(d).toBeLessThan(8500);
  });

  test('haversine is zero for identical points', () => {
    expect(haversineMeters(LISBON, LISBON)).toBe(0);
  });

  test('estimateLeg: walking is slower than driving for the same hop', () => {
    const walk = estimateLeg(LISBON, BELEM, 'walk');
    const drive = estimateLeg(LISBON, BELEM, 'drive');
    expect(walk.durationMinutes).toBeGreaterThan(drive.durationMinutes);
    expect(walk.distanceMeters).toBe(drive.distanceMeters); // same path, different speed
  });

  test('estimateLeg: mixed mode walks short hops and rides long ones', () => {
    const near: LatLng = { lat: 38.7223, lng: -9.1380 };
    const short = estimateLeg(LISBON, near, 'mixed');
    const long = estimateLeg(LISBON, BELEM, 'mixed');
    expect(short.mode).toBe('walk');
    expect(long.mode).toBe('transit');
  });

  test('centroid and bounds', () => {
    const c = centroid([LISBON, BELEM])!;
    expect(c.lat).toBeCloseTo((LISBON.lat + BELEM.lat) / 2, 5);
    const b = boundsOf([LISBON, BELEM])!;
    expect(b.ne.lat).toBe(LISBON.lat);
    expect(b.sw.lng).toBe(BELEM.lng);
    const padded = padBounds(b, 0.2);
    expect(padded.ne.lat).toBeGreaterThan(b.ne.lat);
    expect(padded.sw.lat).toBeLessThan(b.sw.lat);
  });

  test('empty inputs are safe', () => {
    expect(centroid([])).toBeNull();
    expect(boundsOf([])).toBeNull();
  });
});
