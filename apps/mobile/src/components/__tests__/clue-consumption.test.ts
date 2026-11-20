import { applyPhotoSourceClues, namedPlaceForSubject, qualifyTripOutcomeWithClues } from '@/clues/consumption';
import type { ClueRecord } from '@/clues/types';
import { qualifyTripOutcomeV12 } from '@/reconstruction/outcome-v1-2';
import type { OwnerConfiguredHomeArea, TripDetectorEvidence } from '@/reconstruction/types';

const HOME = { lat: 10.776, lon: 106.700 };
const forever: OwnerConfiguredHomeArea[] = [{ id: 'home-1', latitude: HOME.lat, longitude: HOME.lon, radiusMeters: 20_000, effectiveStartDay: null, effectiveEndDay: null }];
let seq = 0;
function unit(day: string, hour: number, lat: number | null, lon: number | null, overrides: Partial<TripDetectorEvidence> = {}): TripDetectorEvidence {
  seq += 1;
  const capturedAtMillis = lat === null ? Date.parse(`${day}T${String(hour).padStart(2, '0')}:00:00Z`) : Date.parse(`${day}T${String(hour).padStart(2, '0')}:00:00Z`);
  return {
    id: `u${String(seq).padStart(4, '0')}`, capturedAtMillis, capturedDay: day, hasPreciseOffset: false,
    latitude: lat, longitude: lon, reportedAccuracyMeters: 10, availability: 'available',
    duplicateFamilyId: null, duplicateConflict: false, supportEligible: true, excluded: false,
    mediaType: 'image', supportPlaceId: lat === null ? null : `place:${lat.toFixed(3)},${lon!.toFixed(3)}`,
    sourceOrigin: null, origin: 'capture-like', timeConflict: false,
    ...overrides,
  };
}
let clueSeq = 0;
function clue(overrides: Partial<ClueRecord> & { kind: ClueRecord['kind']; value: ClueRecord['value']; subject: ClueRecord['subject'] }): ClueRecord {
  clueSeq += 1;
  return {
    clueId: `clue-${clueSeq}`, strength: 'strong', independenceKey: `producer-${clueSeq}`,
    producerId: 'test-producer', producerVersion: 'v1', inputsRevision: { evidenceRevision: 1, homeRevision: 1, correctionRevision: 1 },
    state: 'active', createdAtMillis: 0,
    ...overrides,
  } as ClueRecord;
}
const outingPlaces = [{ lat: 10.346, lon: 107.084 }, { lat: 10.370, lon: 107.070 }];
function outingUnits() {
  return Array.from({ length: 12 }, (_, i) => unit('2025-06-07', 1 + i, outingPlaces[i % 2].lat, outingPlaces[i % 2].lon));
}

beforeEach(() => { seq = 0; clueSeq = 0; });

describe('applyPhotoSourceClues', () => {
  test('a received/screenshot/download clue overrides sourceOrigin', () => {
    const units = outingUnits();
    const clues = [clue({ kind: 'photo-source', value: { source: 'screenshot' }, subject: { evidenceKeys: [`E:${units[0].id}`] } })];
    const result = applyPhotoSourceClues(units, clues);
    expect(result[0].sourceOrigin).toBe('screenshot');
    expect(result[1].sourceOrigin).toBe(units[1].sourceOrigin);
  });

  test('a camera/imported clue value changes nothing', () => {
    const units = outingUnits();
    const clues = [clue({ kind: 'photo-source', value: { source: 'camera' }, subject: { evidenceKeys: [`E:${units[0].id}`] } })];
    const result = applyPhotoSourceClues(units, clues);
    expect(result[0].sourceOrigin).toBe(units[0].sourceOrigin);
  });

  test('a duplicate-family subject key (F:) overrides every member sharing that family', () => {
    const a = unit('2025-06-07', 1, outingPlaces[0].lat, outingPlaces[0].lon, { duplicateFamilyId: 'fam-1' });
    const b = unit('2025-06-07', 1, outingPlaces[0].lat, outingPlaces[0].lon, { duplicateFamilyId: 'fam-1' });
    const clues = [clue({ kind: 'photo-source', value: { source: 'download' }, subject: { evidenceKeys: ['F:fam-1'] } })];
    const result = applyPhotoSourceClues([a, b], clues);
    expect(result[0].sourceOrigin).toBe('download');
    expect(result[1].sourceOrigin).toBe('download');
  });

  test('with no clues, evidence is returned unchanged (determinism floor)', () => {
    const units = outingUnits();
    expect(applyPhotoSourceClues(units, [])).toEqual(units);
  });
});

describe('namedPlaceForSubject', () => {
  test('finds a strong place clue matching the subject', () => {
    const clues = [clue({ kind: 'place', value: { countryCode: 'KR', cityId: 'seoul' }, subject: { evidenceKeys: ['E:u1'] } })];
    expect(namedPlaceForSubject(['E:u1'], clues)).toEqual({ countryCode: 'KR', cityId: 'seoul', clueId: clues[0].clueId });
  });

  test('ignores a weak place clue', () => {
    const clues = [clue({ kind: 'place', value: { countryCode: 'KR' }, strength: 'weak', subject: { evidenceKeys: ['E:u1'] } })];
    expect(namedPlaceForSubject(['E:u1'], clues)).toBeNull();
  });

  test('ignores a non-place clue and a non-matching subject', () => {
    const clues = [clue({ kind: 'landmark', value: { placeId: 'p1' }, subject: { evidenceKeys: ['E:u1'] } })];
    expect(namedPlaceForSubject(['E:u1'], clues)).toBeNull();
    const placeClue = [clue({ kind: 'place', value: { countryCode: 'KR' }, subject: { evidenceKeys: ['E:other'] } })];
    expect(namedPlaceForSubject(['E:u1'], placeClue)).toBeNull();
  });
});

describe('qualifyTripOutcomeWithClues', () => {
  test('with zero clues, the result equals the clue-free rule plus namedPlace: null', () => {
    const units = outingUnits();
    const bare = qualifyTripOutcomeV12(units, { homeAreas: forever });
    const withClues = qualifyTripOutcomeWithClues(units, [], new Set(), { homeAreas: forever });
    expect(withClues).toEqual({ ...bare, namedPlace: null });
  });

  test('a photo-source clue can lower a trip from Atlas (removes enough support)', () => {
    const units = outingUnits();
    const bare = qualifyTripOutcomeV12(units, { homeAreas: forever });
    expect(bare.classification).toBe('AUTO_CONFIRMED');
    // Reclassify 8 of the 12 units as screenshots, leaving only 4 own-capture units: below the 5-photo floor.
    const clues = units.slice(0, 8).map((item) => clue({ kind: 'photo-source', value: { source: 'screenshot' }, subject: { evidenceKeys: [`E:${item.id}`] } }));
    const result = qualifyTripOutcomeWithClues(units, clues, new Set(), { homeAreas: forever });
    expect(result.classification).not.toBe('AUTO_CONFIRMED');
  });

  test('a strong place clue on a no-location trip attaches namedPlace without promoting it to Atlas', () => {
    const units = Array.from({ length: 8 }, (_, i) => unit(`2025-10-0${1 + Math.floor(i / 2)}`, 9 + i, null, null, { supportPlaceId: null }));
    const bare = qualifyTripOutcomeV12(units, { homeAreas: forever });
    expect(bare.classification).toBe('SUGGESTED');
    expect(bare.reasons[0]).toBe('no-location');
    const clues = [clue({ kind: 'place', value: { countryCode: 'KR', cityId: 'seoul' }, subject: { evidenceKeys: units.map((u) => `E:${u.id}`) } })];
    const result = qualifyTripOutcomeWithClues(units, clues, new Set(), { homeAreas: forever });
    expect(result.classification).toBe('SUGGESTED');
    expect(result.namedPlace).toEqual({ countryCode: 'KR', cityId: 'seoul', clueId: clues[0].clueId });
  });

  test('a strong place clue never promotes an otherwise-failing trip to Atlas (promotion classes are off by default)', () => {
    const units = outingUnits().slice(0, 3); // few-photos, SUGGESTED at best
    const bare = qualifyTripOutcomeV12(units, { homeAreas: forever });
    expect(bare.classification).toBe('SUGGESTED');
    const clues = [clue({ kind: 'place', value: { countryCode: 'VN' }, subject: { evidenceKeys: units.map((u) => `E:${u.id}`) } })];
    const result = qualifyTripOutcomeWithClues(units, clues, new Set(), { homeAreas: forever });
    expect(result.classification).toBe('SUGGESTED');
  });

  test('a clue on an owner-corrected subject is ignored by the rules', () => {
    const units = outingUnits();
    const correctedKeys = new Set([`E:${units[0].id}`]);
    const clues = [clue({ kind: 'photo-source', value: { source: 'screenshot' }, subject: { evidenceKeys: [`E:${units[0].id}`] } })];
    const result = qualifyTripOutcomeWithClues(units, clues, correctedKeys, { homeAreas: forever });
    expect(result.classification).toBe('AUTO_CONFIRMED');
  });

  test('a retracted clue is never applied', () => {
    const units = outingUnits();
    const clues = [clue({ kind: 'photo-source', value: { source: 'screenshot' }, state: 'retracted', subject: { evidenceKeys: [`E:${units[0].id}`] } })];
    const result = qualifyTripOutcomeWithClues(units, clues, new Set(), { homeAreas: forever });
    expect(result.classification).toBe('AUTO_CONFIRMED');
  });
});
