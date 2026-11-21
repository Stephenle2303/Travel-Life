import { buildFrequentPlaceContext, homeCoversAllDays, partitionSessions, qualifyTripOutcomeV12, rebuildClassificationReasonCode, summarizeOutcomeDelta } from '@/reconstruction/outcome-v1-2';
import type { OwnerConfiguredHomeArea, TripDetectorEvidence, TripOutcomeReasonCode } from '@/reconstruction/types';

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

describe('qualifyTripOutcomeV12', () => {
  test('home life only, within the Home radius, is hidden with a closed reason', () => {
    const units = [unit('2025-06-01', 8, HOME.lat, HOME.lon), unit('2025-06-01', 20, HOME.lat + 0.001, HOME.lon)];
    const result = qualifyTripOutcomeV12(units, { homeAreas: forever });
    expect(result.classification).toBe('NOT_TRIP');
    expect(result.reasons).toEqual(['no-away-evidence']);
  });

  test('a single far photo is hidden, not a Possible card', () => {
    const units = [unit('2025-03-01', 9, 11.94, 108.44)];
    const result = qualifyTripOutcomeV12(units, { homeAreas: forever });
    expect(result.classification).toBe('NOT_TRIP');
    expect(result.reasons).toEqual(['no-away-evidence']);
  });

  test('screenshots/downloads with GPS never qualify or surface a card (fixes Finding F11)', () => {
    const units = days('2025-03-05', 1).flatMap((day) => Array.from({ length: 6 }, (_, i) => unit(day, 1 + i, 37.57, 126.98, { sourceOrigin: 'screenshot' })));
    const result = qualifyTripOutcomeV12(units, { homeAreas: forever });
    expect(result.classification).toBe('NOT_TRIP');
    expect(result.reasons).toEqual(['non-capture-source']);
  });

  test('a one-day outing 65 km away, 2 places 3 km apart, 12 photos, day-only: Atlas', () => {
    const places = [{ lat: 10.346, lon: 107.084 }, { lat: 10.370, lon: 107.070 }];
    const units = Array.from({ length: 12 }, (_, i) => unit('2025-06-07', 1 + i, places[i % 2].lat, places[i % 2].lon));
    const result = qualifyTripOutcomeV12(units, { homeAreas: forever });
    expect(result.classification).toBe('AUTO_CONFIRMED');
    expect(result.reasons).toEqual([]);
  });

  test('the same outing with no Home set at all: Possible, home-not-set', () => {
    const places = [{ lat: 10.346, lon: 107.084 }, { lat: 10.370, lon: 107.070 }];
    const units = Array.from({ length: 12 }, (_, i) => unit('2025-06-07', 1 + i, places[i % 2].lat, places[i % 2].lon));
    const result = qualifyTripOutcomeV12(units, { homeAreas: [] });
    expect(result.classification).toBe('SUGGESTED');
    expect(result.reasons[0]).toBe('home-not-set');
  });

  test('a trip on dates a dated Home area does not cover: Possible, home-not-set', () => {
    const dated: OwnerConfiguredHomeArea[] = [{ id: 'home-1', latitude: HOME.lat, longitude: HOME.lon, radiusMeters: 20_000, effectiveStartDay: '2026-01-01', effectiveEndDay: null }];
    const places = [{ lat: 10.346, lon: 107.084 }, { lat: 10.370, lon: 107.070 }];
    const units = Array.from({ length: 12 }, (_, i) => unit('2025-06-07', 1 + i, places[i % 2].lat, places[i % 2].lon));
    const result = qualifyTripOutcomeV12(units, { homeAreas: dated });
    expect(result.classification).toBe('SUGGESTED');
    expect(result.reasons[0]).toBe('home-not-set');
  });

  test('30 km away, outside a 20 km Home radius but under 50 km: Possible, near-home', () => {
    const units = days('2025-06-21', 1).flatMap(() => Array.from({ length: 6 }, (_, i) => unit('2025-06-21', 1 + i, 11.040, 106.700)));
    const result = qualifyTripOutcomeV12(units, { homeAreas: forever });
    expect(result.classification).toBe('SUGGESTED');
    expect(result.reasons[0]).toBe('near-home');
  });

  test('away photos with 4 km accuracy: Possible, weak-location before few-photos', () => {
    const places = [{ lat: 10.346, lon: 107.084 }, { lat: 10.370, lon: 107.070 }];
    const units = days('2025-04-20', 2).flatMap((day) => Array.from({ length: 6 }, (_, i) => unit(day, 1 + i, places[i % 2].lat, places[i % 2].lon, { reportedAccuracyMeters: 4_000 })));
    const result = qualifyTripOutcomeV12(units, { homeAreas: forever });
    expect(result.classification).toBe('SUGGESTED');
    expect(result.reasons[0]).toBe('weak-location');
  });

  test('3 reliable photos 150 km away: Possible, few-photos', () => {
    const units = [unit('2025-04-10', 9, 9.600, 105.970), unit('2025-04-10', 10, 9.601, 105.971), unit('2025-04-10', 11, 9.602, 105.972)];
    const result = qualifyTripOutcomeV12(units, { homeAreas: forever });
    expect(result.classification).toBe('SUGGESTED');
    expect(result.reasons).toContain('few-photos');
  });

  test('12 photos, one place, one 20-minute window, far away: Possible, single-moment', () => {
    const units = Array.from({ length: 12 }, (_, i) => unit('2025-06-09', 1, 10.346, 107.084, {
      hasPreciseOffset: true, capturedAtMillis: Date.parse('2025-06-09T01:00:00Z') + i * 90_000,
    }));
    const result = qualifyTripOutcomeV12(units, { homeAreas: forever });
    expect(result.classification).toBe('SUGGESTED');
    expect(result.reasons).toContain('single-moment');
  });

  test('a frequent macro place (>=8 prior episodes in 90 days) stays off Atlas even with clear evidence', () => {
    const places = [{ lat: 11.940, lon: 108.440 }, { lat: 11.942, lon: 108.442 }];
    const candidateUnits = Array.from({ length: 12 }, (_, i) => unit('2025-09-10', 1 + i, places[i % 2].lat, places[i % 2].lon));
    const placeId = candidateUnits[0].supportPlaceId!;
    const candidateStartMillis = candidateUnits[0].capturedAtMillis!;
    const priorStarts = Array.from({ length: 8 }, (_, i) => candidateStartMillis - (10 + i * 10) * 86_400_000);
    const context = buildFrequentPlaceContext(priorStarts.map((startMillis, i) => ({ journeyId: `prior-${i}`, placeId, startMillis })));
    const result = qualifyTripOutcomeV12(candidateUnits, { homeAreas: forever, frequentPlaceContext: context, candidateStartMillis });
    expect(result.classification).toBe('SUGGESTED');
    expect(result.reasons).toContain('frequent-place');
  });

  test('a candidate never counts as its own prior occurrence, even when the context recorded its own entry under the same place (code review finding, 2026-11-19)', () => {
    const places = [{ lat: 11.940, lon: 108.440 }, { lat: 11.942, lon: 108.442 }];
    const candidateUnits = Array.from({ length: 12 }, (_, i) => unit('2025-09-10', 1 + i, places[i % 2].lat, places[i % 2].lon));
    const placeId = candidateUnits[0].supportPlaceId!;
    const candidateStartMillis = candidateUnits[0].capturedAtMillis!;
    const currentJourneyId = 'journey-under-test';
    // Only 7 genuine prior occurrences (one below the threshold of 8) plus a
    // same-journey marker that a naive time-based self-exclusion would
    // wrongly count as an 8th. The marker's own startMillis may differ from
    // candidateStartMillis, exactly as it would in production (the graph
    // marker is built from a journey's full unfiltered evidence; the
    // candidate's own start is computed from eligible, non-Home evidence only).
    const priorStarts = Array.from({ length: 7 }, (_, i) => candidateStartMillis - (10 + i * 10) * 86_400_000);
    const markers = [
      ...priorStarts.map((startMillis, i) => ({ journeyId: `prior-${i}`, placeId, startMillis })),
      { journeyId: currentJourneyId, placeId, startMillis: candidateStartMillis - 60_000 },
    ];
    const context = buildFrequentPlaceContext(markers);
    const result = qualifyTripOutcomeV12(candidateUnits, { homeAreas: forever, frequentPlaceContext: context, candidateStartMillis, currentJourneyId });
    expect(result.classification).toBe('AUTO_CONFIRMED');
    expect(result.reasons).not.toContain('frequent-place');
  });

  test('photos with no coordinates at all: Possible, no-location (GPS-less window input)', () => {
    const units = Array.from({ length: 8 }, (_, i) => unit(`2025-10-0${1 + Math.floor(i / 2)}`, 9 + i, null, null, { supportPlaceId: null }));
    const result = qualifyTripOutcomeV12(units, { homeAreas: forever });
    expect(result.classification).toBe('SUGGESTED');
    expect(result.reasons[0]).toBe('no-location');
  });

  test('a time conflict always shows as the reason, overriding corroboration', () => {
    const places = [{ lat: 10.346, lon: 107.084 }, { lat: 10.370, lon: 107.070 }];
    const units = Array.from({ length: 12 }, (_, i) => unit('2025-06-07', 1 + i, places[i % 2].lat, places[i % 2].lon, { timeConflict: i === 0 }));
    const result = qualifyTripOutcomeV12(units, { homeAreas: forever });
    expect(result.classification).toBe('SUGGESTED');
    expect(result.reasons).toContain('time-conflict');
  });

  test('owner-confirmed and rejected shortcuts bypass the gates', () => {
    expect(qualifyTripOutcomeV12([], { homeAreas: forever, ownerConfirmed: true }).classification).toBe('USER_CONFIRMED');
    expect(qualifyTripOutcomeV12([], { homeAreas: forever, rejected: true }).classification).toBe('REJECTED');
  });

  test('Home photos grouped into the same episode are never trip support (H-3)', () => {
    const places = [{ lat: 37.57, lon: 126.98 }, { lat: 37.55, lon: 126.99 }];
    const away = Array.from({ length: 20 }, (_, i) => unit(`2025-09-${String(10 + Math.floor(i / 5)).padStart(2, '0')}`, 1 + (i % 5), places[i % 2].lat, places[i % 2].lon));
    const homeDayBefore = unit('2025-09-09', 8, HOME.lat, HOME.lon);
    const homeDayAfter = unit('2025-09-14', 20, HOME.lat, HOME.lon);
    const result = qualifyTripOutcomeV12([homeDayBefore, ...away, homeDayAfter], { homeAreas: forever });
    expect(result.classification).toBe('AUTO_CONFIRMED');
    expect(result.supportIds).not.toContain(homeDayBefore.id);
    expect(result.supportIds).not.toContain(homeDayAfter.id);
  });

  test('a Forever Home (no dates) covers a trip far in the past', () => {
    const places = [{ lat: 10.346, lon: 107.084 }, { lat: 10.370, lon: 107.070 }];
    const units = Array.from({ length: 12 }, (_, i) => unit('2015-01-01', 1 + i, places[i % 2].lat, places[i % 2].lon));
    const result = qualifyTripOutcomeV12(units, { homeAreas: forever });
    expect(result.classification).toBe('AUTO_CONFIRMED');
  });
});

describe('summarizeOutcomeDelta', () => {
  test('counts gained, lost, changed and unchanged journeys (CAP-8 dry run)', () => {
    const before = new Map([['j1', 'NOT_TRIP'], ['j2', 'AUTO_CONFIRMED'], ['j3', 'NOT_TRIP'], ['j4', 'AUTO_CONFIRMED']]);
    const after = new Map([['j1', 'AUTO_CONFIRMED'], ['j2', 'NOT_TRIP'], ['j3', 'SUGGESTED'], ['j4', 'AUTO_CONFIRMED']]);
    const delta = summarizeOutcomeDelta(before, after);
    expect(delta.gainedCount).toBe(1); expect(delta.gained).toEqual(['j1']);
    expect(delta.lostCount).toBe(1); expect(delta.lost).toEqual(['j2']);
    expect(delta.changedCount).toBe(1); expect(delta.changed).toEqual(['j3']);
    expect(delta.unchangedCount).toBe(1);
  });

  test('a journey only in `after` is gained if shown, unchanged-absent otherwise', () => {
    const delta = summarizeOutcomeDelta(new Map(), new Map([['j1', 'AUTO_CONFIRMED'], ['j2', 'NOT_TRIP']]));
    expect(delta.gained).toEqual(['j1']);
    expect(delta.lost).toEqual([]);
    expect(delta.changed).toEqual([]);
  });
});

describe('rebuildClassificationReasonCode', () => {
  test('maps every closed Possible-trip/hidden reason to its own diagnostic code, highest priority first', () => {
    const cases: [TripOutcomeReasonCode, string][] = [
      ['home-not-set', 'HOME_NOT_SET'], ['time-conflict', 'TIME_CONFLICT'], ['no-location', 'NO_LOCATION'],
      ['weak-location', 'WEAK_LOCATION'], ['near-home', 'NEAR_HOME'], ['frequent-place', 'FREQUENT_PLACE'],
      ['few-photos', 'FEW_PHOTOS'], ['single-moment', 'SINGLE_MOMENT'], ['owner-veto', 'OWNER_VETO'],
      ['no-away-evidence', 'NO_AWAY_EVIDENCE'], ['non-capture-source', 'NON_CAPTURE_SOURCE'],
    ];
    for (const [reason, code] of cases) expect(rebuildClassificationReasonCode([reason])).toBe(code);
  });

  test('reads only reasons[0] (the one sentence a Possible-trip card would show)', () => {
    expect(rebuildClassificationReasonCode(['single-moment', 'home-not-set'])).toBe('SINGLE_MOMENT');
  });

  test('empty reasons (AUTO_CONFIRMED/USER_CONFIRMED/REJECTED) and the owner-confirmed path both map to COMPLETE', () => {
    expect(rebuildClassificationReasonCode([])).toBe('COMPLETE');
    expect(rebuildClassificationReasonCode(['owner-confirmed'])).toBe('COMPLETE');
  });
});

describe('partitionSessions', () => {
  test('day-only units bucket one session per day and support place', () => {
    const a = unit('2025-06-07', 1, 10.346, 107.084);
    const b = unit('2025-06-07', 2, 10.346, 107.084);
    const c = unit('2025-06-07', 3, 10.370, 107.070);
    const sessions = partitionSessions([a, b, c]);
    expect(sessions.get(a.id)).toBe(sessions.get(b.id));
    expect(sessions.get(a.id)).not.toBe(sessions.get(c.id));
  });

  test('trusted instants split on a >60 minute gap', () => {
    const a = unit('2025-06-07', 1, 10.346, 107.084, { hasPreciseOffset: true });
    const b = unit('2025-06-07', 3, 10.346, 107.084, { hasPreciseOffset: true });
    const sessions = partitionSessions([a, b]);
    expect(sessions.get(a.id)).not.toBe(sessions.get(b.id));
  });

  test('trusted instants split on a >4 hour span even with small gaps', () => {
    const units = Array.from({ length: 6 }, (_, i) => unit('2025-06-07', 0, 10.346, 107.084, {
      hasPreciseOffset: true, capturedAtMillis: Date.parse('2025-06-07T00:00:00Z') + i * 55 * 60_000,
    }));
    const sessions = partitionSessions(units);
    expect(sessions.get(units[0].id)).not.toBe(sessions.get(units.at(-1)!.id));
  });
});

describe('homeCoversAllDays', () => {
  test('units with no valid captured day are uncovered, not vacuously covered (code review finding, 2026-11-19)', () => {
    const units = [{ capturedDay: null }, { capturedDay: 'not-a-date' }];
    expect(homeCoversAllDays(units, forever)).toBe(false);
  });

  test('a real covered day with a Forever Home is covered', () => {
    expect(homeCoversAllDays([{ capturedDay: '2025-06-07' }], forever)).toBe(true);
  });

  test('no evidence at all is uncovered', () => {
    expect(homeCoversAllDays([], forever)).toBe(false);
  });
});
