import { qualifyTripOutcomeV13 } from '@/reconstruction/outcome-v1-3';
import type { OwnerConfiguredHomeArea, TripDetectorEvidence } from '@/reconstruction/types';

const HOME = { lat: 10.776, lon: 106.700 };
const forever: OwnerConfiguredHomeArea[] = [{ id: 'home-1', latitude: HOME.lat, longitude: HOME.lon, radiusMeters: 20_000, effectiveStartDay: null, effectiveEndDay: null }];
let seq = 0;
function unit(day: string, hour: number, lat: number | null, lon: number | null, overrides: Partial<TripDetectorEvidence> = {}): TripDetectorEvidence {
  seq += 1;
  const capturedAtMillis = Date.parse(`${day}T${String(hour).padStart(2, '0')}:00:00Z`);
  return {
    id: `u${String(seq).padStart(4, '0')}`, capturedAtMillis, capturedDay: day, hasPreciseOffset: false,
    latitude: lat, longitude: lon, reportedAccuracyMeters: 10, availability: 'available',
    duplicateFamilyId: null, duplicateConflict: false, supportEligible: true, excluded: false,
    mediaType: 'image', supportPlaceId: lat === null ? null : `place:${lat.toFixed(3)},${lon!.toFixed(3)}`,
    sourceOrigin: null, origin: 'capture-like', timeConflict: false,
    ...overrides,
  };
}
function days(start: string, count: number) {
  const startMillis = Date.parse(`${start}T00:00:00Z`);
  return Array.from({ length: count }, (_, index) => new Date(startMillis + index * 86_400_000).toISOString().slice(0, 10));
}

beforeEach(() => { seq = 0; });

describe('qualifyTripOutcomeV13 (decision 0023)', () => {
  test('home life only, within the Home radius, is hidden with a closed reason', () => {
    const units = [unit('2025-06-01', 8, HOME.lat, HOME.lon), unit('2025-06-01', 20, HOME.lat + 0.001, HOME.lon)];
    const result = qualifyTripOutcomeV13(units, { homeAreas: forever });
    expect(result.classification).toBe('NOT_TRIP');
    expect(result.reasons).toEqual(['no-away-evidence']);
  });

  test('screenshots/downloads with GPS never qualify or surface a card', () => {
    const units = days('2025-03-05', 1).flatMap((day) => Array.from({ length: 6 }, (_, i) => unit(day, 1 + i, 37.57, 126.98, { sourceOrigin: 'screenshot' })));
    const result = qualifyTripOutcomeV13(units, { homeAreas: forever });
    expect(result.classification).toBe('NOT_TRIP');
    expect(result.reasons).toEqual(['non-capture-source']);
  });

  test('a repeat far destination (e.g. Dalat several times a year) reaches Atlas — frequent places never block it', () => {
    const places = [{ lat: 11.940, lon: 108.440 }, { lat: 11.942, lon: 108.442 }];
    const units = Array.from({ length: 12 }, (_, i) => unit('2025-09-10', 1 + i, places[i % 2].lat, places[i % 2].lon));
    const result = qualifyTripOutcomeV13(units, { homeAreas: forever });
    expect(result.classification).toBe('AUTO_CONFIRMED');
    expect(result.reasons).toEqual([]);
  });

  test('a one-day outing 65 km away, 2 places 3 km apart, 12 photos, day-only: Atlas', () => {
    const places = [{ lat: 10.346, lon: 107.084 }, { lat: 10.370, lon: 107.070 }];
    const units = Array.from({ length: 12 }, (_, i) => unit('2025-06-07', 1 + i, places[i % 2].lat, places[i % 2].lon));
    const result = qualifyTripOutcomeV13(units, { homeAreas: forever });
    expect(result.classification).toBe('AUTO_CONFIRMED');
    expect(result.reasons).toEqual([]);
  });

  test('an overnight outing just outside a 20 km Home radius (no 50 km floor any more): Possible, few-photos', () => {
    // 2 consecutive days, ~30 km from Home (outside the 20 km radius but
    // well under the old 50 km "away" floor — v1.2 would have called this
    // near-home), one place, day-only: not corroborated, but overnight.
    const units = days('2025-06-21', 2).flatMap((day) => [unit(day, 9, 11.045, 106.700), unit(day, 20, 11.045, 106.700)]);
    const result = qualifyTripOutcomeV13(units, { homeAreas: forever });
    expect(result.classification).toBe('SUGGESTED');
    expect(result.reasons).toContain('few-photos');
  });

  test('a one-day errand outside Home, no strong signal: hidden, brief-outing', () => {
    const units = Array.from({ length: 3 }, (_, i) => unit('2025-06-21', 9 + i, 11.045, 106.700));
    const result = qualifyTripOutcomeV13(units, { homeAreas: forever });
    expect(result.classification).toBe('NOT_TRIP');
    expect(result.reasons).toEqual(['brief-outing']);
  });

  test('two single-session errands a week apart, merged into one episode: still hidden (no consecutive-day run, no real corroboration)', () => {
    // Two single-day errands ~111 m apart from each other (under the 1 km
    // "separated place" threshold) and 7 days apart (not consecutive, and
    // day-only bucketing must not count distinct days as independent
    // sessions on its own — the exact noise decision 0023 targets).
    const units = [
      ...Array.from({ length: 2 }, (_, i) => unit('2025-06-07', 9 + i, 11.045, 106.700)),
      ...Array.from({ length: 2 }, (_, i) => unit('2025-06-14', 9 + i, 11.046, 106.701)),
    ];
    const result = qualifyTripOutcomeV13(units, { homeAreas: forever });
    expect(result.classification).toBe('NOT_TRIP');
    expect(result.reasons).toEqual(['brief-outing']);
  });

  test('the same outing with no Home set at all: Possible, home-not-set (owner-fixable)', () => {
    const places = [{ lat: 10.346, lon: 107.084 }, { lat: 10.370, lon: 107.070 }];
    const units = Array.from({ length: 12 }, (_, i) => unit('2025-06-07', 1 + i, places[i % 2].lat, places[i % 2].lon));
    const result = qualifyTripOutcomeV13(units, { homeAreas: [] });
    expect(result.classification).toBe('SUGGESTED');
    expect(result.reasons[0]).toBe('home-not-set');
  });

  test('a trip on dates a dated Home area does not cover: Possible, home-not-set', () => {
    const dated: OwnerConfiguredHomeArea[] = [{ id: 'home-1', latitude: HOME.lat, longitude: HOME.lon, radiusMeters: 20_000, effectiveStartDay: '2026-01-01', effectiveEndDay: null }];
    const places = [{ lat: 10.346, lon: 107.084 }, { lat: 10.370, lon: 107.070 }];
    const units = Array.from({ length: 12 }, (_, i) => unit('2025-06-07', 1 + i, places[i % 2].lat, places[i % 2].lon));
    const result = qualifyTripOutcomeV13(units, { homeAreas: dated });
    expect(result.classification).toBe('SUGGESTED');
    expect(result.reasons[0]).toBe('home-not-set');
  });

  test('a single owner-fixable (home-not-set) photo unit alone (<2) stays hidden, not Possible', () => {
    const units = [unit('2025-06-07', 9, 10.346, 107.084)];
    const result = qualifyTripOutcomeV13(units, { homeAreas: [] });
    expect(result.classification).toBe('NOT_TRIP');
    expect(result.reasons).toEqual(['no-away-evidence']);
  });

  test('away photos with 4 km accuracy, 2 consecutive days: Possible, weak-location before few-photos', () => {
    const places = [{ lat: 10.346, lon: 107.084 }, { lat: 10.370, lon: 107.070 }];
    const units = days('2025-04-20', 2).flatMap((day) => Array.from({ length: 6 }, (_, i) => unit(day, 1 + i, places[i % 2].lat, places[i % 2].lon, { reportedAccuracyMeters: 4_000 })));
    const result = qualifyTripOutcomeV13(units, { homeAreas: forever });
    expect(result.classification).toBe('SUGGESTED');
    expect(result.reasons[0]).toBe('weak-location');
  });

  test('3 reliable photos 150 km away on 2 consecutive days: Possible, few-photos', () => {
    const units = [unit('2025-04-10', 9, 9.600, 105.970), unit('2025-04-10', 22, 9.601, 105.971), unit('2025-04-11', 9, 9.602, 105.972)];
    const result = qualifyTripOutcomeV13(units, { homeAreas: forever });
    expect(result.classification).toBe('SUGGESTED');
    expect(result.reasons).toContain('few-photos');
  });

  test('12 photos, one place, one 20-minute window, far away, single day: Possible via photo volume alone, single-moment', () => {
    const units = Array.from({ length: 12 }, (_, i) => unit('2025-06-09', 1, 10.346, 107.084, {
      hasPreciseOffset: true, capturedAtMillis: Date.parse('2025-06-09T01:00:00Z') + i * 90_000,
    }));
    const result = qualifyTripOutcomeV13(units, { homeAreas: forever });
    expect(result.classification).toBe('SUGGESTED');
    expect(result.reasons).toContain('single-moment');
  });

  test('photos with no coordinates at all: hidden, no-location (left to GPS-less discovery, decision 0019)', () => {
    const units = Array.from({ length: 8 }, (_, i) => unit(`2025-10-0${1 + Math.floor(i / 2)}`, 9 + i, null, null, { supportPlaceId: null }));
    const result = qualifyTripOutcomeV13(units, { homeAreas: forever });
    expect(result.classification).toBe('NOT_TRIP');
    expect(result.reasons).toEqual(['no-location']);
  });

  test('a time conflict always shows as the reason, overriding corroboration', () => {
    const places = [{ lat: 10.346, lon: 107.084 }, { lat: 10.370, lon: 107.070 }];
    const units = Array.from({ length: 12 }, (_, i) => unit('2025-06-07', 1 + i, places[i % 2].lat, places[i % 2].lon, { timeConflict: i === 0 }));
    const result = qualifyTripOutcomeV13(units, { homeAreas: forever });
    expect(result.classification).toBe('SUGGESTED');
    expect(result.reasons).toContain('time-conflict');
  });

  test('owner-confirmed and rejected shortcuts bypass the gates', () => {
    expect(qualifyTripOutcomeV13([], { homeAreas: forever, ownerConfirmed: true }).classification).toBe('USER_CONFIRMED');
    expect(qualifyTripOutcomeV13([], { homeAreas: forever, rejected: true }).classification).toBe('REJECTED');
  });

  test('an owner veto blocks Atlas but still leaves a corroborated trip as a Possible trip, like v1.2', () => {
    const places = [{ lat: 10.346, lon: 107.084 }, { lat: 10.370, lon: 107.070 }];
    const units = Array.from({ length: 12 }, (_, i) => unit('2025-06-07', 1 + i, places[i % 2].lat, places[i % 2].lon));
    const result = qualifyTripOutcomeV13(units, { homeAreas: forever, ownerVeto: true });
    expect(result.classification).toBe('SUGGESTED');
    expect(result.reasons).toContain('owner-veto');
  });

  test('Home photos grouped into the same episode are never trip support (H-3)', () => {
    const places = [{ lat: 37.57, lon: 126.98 }, { lat: 37.55, lon: 126.99 }];
    const away = Array.from({ length: 20 }, (_, i) => unit(`2025-09-${String(10 + Math.floor(i / 5)).padStart(2, '0')}`, 1 + (i % 5), places[i % 2].lat, places[i % 2].lon));
    const homeDayBefore = unit('2025-09-09', 8, HOME.lat, HOME.lon);
    const homeDayAfter = unit('2025-09-14', 20, HOME.lat, HOME.lon);
    const result = qualifyTripOutcomeV13([homeDayBefore, ...away, homeDayAfter], { homeAreas: forever });
    expect(result.classification).toBe('AUTO_CONFIRMED');
    expect(result.supportIds).not.toContain(homeDayBefore.id);
    expect(result.supportIds).not.toContain(homeDayAfter.id);
  });

  test('a Forever Home (no dates) covers a trip far in the past', () => {
    const places = [{ lat: 10.346, lon: 107.084 }, { lat: 10.370, lon: 107.070 }];
    const units = Array.from({ length: 12 }, (_, i) => unit('2015-01-01', 1 + i, places[i % 2].lat, places[i % 2].lon));
    const result = qualifyTripOutcomeV13(units, { homeAreas: forever });
    expect(result.classification).toBe('AUTO_CONFIRMED');
  });

  test('2 unclustered units (no supportPlaceId) at the same single-day spot never count as 2 places (code-review finding, 2026-11-22)', () => {
    const units = [
      unit('2025-06-21', 9, 11.045, 106.700, { supportPlaceId: null }),
      unit('2025-06-21', 10, 11.045, 106.700, { supportPlaceId: null }),
    ];
    const result = qualifyTripOutcomeV13(units, { homeAreas: forever });
    expect(result.classification).toBe('NOT_TRIP');
    expect(result.reasons).toEqual(['brief-outing']);
  });

  test('a wide (300 km) owner-set Home radius hides what would be a trip under a smaller radius', () => {
    const wide: OwnerConfiguredHomeArea[] = [{ id: 'home-1', latitude: HOME.lat, longitude: HOME.lon, radiusMeters: 300_000, effectiveStartDay: null, effectiveEndDay: null }];
    const places = [{ lat: 10.346, lon: 107.084 }, { lat: 10.370, lon: 107.070 }]; // ~65 km from Home, inside a 300 km radius
    const units = Array.from({ length: 12 }, (_, i) => unit('2025-06-07', 1 + i, places[i % 2].lat, places[i % 2].lon));
    const result = qualifyTripOutcomeV13(units, { homeAreas: wide });
    expect(result.classification).toBe('NOT_TRIP');
    expect(result.reasons).toEqual(['no-away-evidence']);
  });
});
