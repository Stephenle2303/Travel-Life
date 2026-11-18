import { associateVisualAlbum, qualifyVisualTrip, validVisualCitySupport, visualTripDestination } from '@/visual-place/trip-recovery';
import type { DiscoveryPhoto } from '@/visual-place/discovery';
import type { VisualObservation } from '@/visual-place/recovery';

const start = Date.UTC(2025, 5, 1, 8);
const ewha = 'ewha-womans-university';
const namsan = 'namsan-seoul-tower';
const nami = 'nami-island';
const hanoi = 'locality-hanoi';
const vector = (index: number) => Array.from({ length: 384 }, (_, offset) => offset === index ? 1 : 0);
const scene = { global: vector(0), pooled: vector(0), regions: [vector(0)] };
const unrelated = { global: vector(1), pooled: vector(1), regions: [vector(1)] };
function photo(id: string, minute: number, origin = 'capture-like'): DiscoveryPhoto {
  const time = start + minute * 60_000;
  return { evidence_id: id, source_ref: 'private-' + id, family: id, captured_day: new Date(time).toISOString().slice(0, 10),
    captured_at_millis: time, source_origin: origin };
}
function clue(id: string, placeId: string | null, embedding = scene): VisualObservation {
  return { id, placeId, kind: placeId ? 'combined' : null, embedding };
}

it('recovers an excursion between supported city visits and excludes unrelated and screenshot media', () => {
  const rows = [photo('first', 0), photo('scene', 1), photo('meter', 1), photo('screen', 1, 'screenshot'),
    photo('second', 2), photo('island-1', 180), photo('island-2', 182), photo('tower-1', 360), photo('tower-2', 362)];
  const observations = [clue('first', ewha), clue('scene', null), clue('meter', null, unrelated), clue('screen', ewha),
    clue('second', ewha), clue('island-1', nami), clue('island-2', nami), clue('tower-1', namsan), clue('tower-2', namsan)];
  const trip = qualifyVisualTrip([...rows].reverse(), observations)!;
  const album = associateVisualAlbum(trip);
  expect(album?.placeId).toBe('locality-seoul');
  expect(album?.stops.map(({ placeId }) => placeId)).toEqual([ewha, nami, namsan]);
  expect(album?.membership.map(({ id }) => id)).toEqual(['first', 'scene', 'second', 'island-1', 'island-2', 'tower-1', 'tower-2']);
  expect(album?.membership[1]).toMatchObject({ id: 'scene', basis: 'scene' });
  expect(album?.coverIds).toEqual(['first', 'island-1', 'tower-1']);
  expect(qualifyVisualTrip(rows, observations.slice(0, 7))).toBeNull();
});

it('withholds unknown images whose matching neighbors only precede the photo', () => {
  const rows = [photo('before-1', 0), photo('before-2', 1), photo('candidate', 2), photo('after', 3),
    photo('next-1', 180), photo('next-2', 182)];
  const observations = [clue('before-1', ewha), clue('before-2', ewha), clue('candidate', null),
    clue('after', ewha, unrelated), clue('next-1', namsan), clue('next-2', namsan)];
  expect(associateVisualAlbum(qualifyVisualTrip(rows, observations)!)?.membership.map(({ id }) => id))
    .not.toContain('candidate');
});

it('keeps a pending Nami match out of the stops, scene anchors, observed dates and album', () => {
  const rows = [photo('nami-early', -540), photo('first', 0), photo('scene', 1), photo('second', 2),
    photo('island-scene', 181), photo('island-1', 180), photo('island-2', 182), photo('tower-1', 360), photo('tower-2', 362)];
  const observations = [clue('nami-early', nami), clue('first', ewha), clue('scene', null), clue('second', ewha),
    clue('island-scene', null), clue('island-1', nami), clue('island-2', nami), clue('tower-1', namsan), clue('tower-2', namsan)];
  const album = associateVisualAlbum(qualifyVisualTrip(rows, observations, true)!);
  expect(album).toMatchObject({ placeId: 'locality-seoul', start: '2025-06-01', end: '2025-06-01',
    stops: [{ placeId: ewha, supportIds: ['first', 'second'] }, { placeId: namsan, supportIds: ['tower-1', 'tower-2'] }],
    coverIds: ['first', 'tower-1'], pendingPlaceIds: [nami],
  });
  expect(album?.membership.map(({ id }) => id)).toEqual(['first', 'scene', 'second', 'tower-1', 'tower-2']);
  expect(album?.membership[1]).toEqual({ id: 'scene', placeId: ewha, basis: 'scene' });
  const outlier = observations.filter(({ id }) => id !== 'island-1' && id !== 'island-2');
  expect(associateVisualAlbum(qualifyVisualTrip(rows, outlier, true)!)).not.toHaveProperty('pendingPlaceIds');
  expect(qualifyVisualTrip(rows, observations.filter(({ placeId }) => placeId === nami), true)).toBeNull();
  expect(qualifyVisualTrip(rows, observations.filter(({ placeId }) => placeId !== namsan), true)).toBeNull();
  expect(() => qualifyVisualTrip(rows, [...observations, clue('outside-sampled-episode', nami)], true))
    .toThrow(expect.objectContaining({ reason: 'MEDIA_SCHEMA' }));
  expect(() => qualifyVisualTrip(rows, [...observations, clue('nami-early', nami)], true))
    .toThrow(expect.objectContaining({ reason: 'MEDIA_SCHEMA' }));
});

it('cannot infer a pending place from excluded origins or duplicate families', () => {
  const rows = [photo('first', 0), photo('second', 2), photo('screen', 180, 'screenshot'),
    { ...photo('duplicate', 182), family: 'first' }, photo('tower-1', 360), photo('tower-2', 362)];
  const observations = [clue('first', ewha), clue('second', ewha), clue('screen', nami), clue('duplicate', nami),
    clue('tower-1', namsan), clue('tower-2', namsan)];
  const album = associateVisualAlbum(qualifyVisualTrip(rows, observations, true)!);
  expect(album?.membership.map(({ id }) => id)).toEqual(['first', 'second', 'tower-1', 'tower-2']);
  expect(album).not.toHaveProperty('pendingPlaceIds');
});

it('keeps an unnamed duplicate of a pending clue out of the scene album', () => {
  const rows = [photo('first', 0), { ...photo('duplicate', 1), family: 'island' }, photo('second', 2),
    photo('island', 180), photo('tower-1', 360), photo('tower-2', 362)];
  const observations = [clue('first', ewha), clue('duplicate', null), clue('second', ewha),
    clue('island', nami), clue('tower-1', namsan), clue('tower-2', namsan)];
  const album = associateVisualAlbum(qualifyVisualTrip(rows, observations, true)!);
  expect(album?.pendingPlaceIds).toEqual([nami]);
  expect(album?.membership.map(({ id }) => id)).toEqual(['first', 'second', 'tower-1', 'tower-2']);
});

it('preserves a qualified Taipei album when another observation matches Nami', () => {
  const taipei = 'taipei-101';
  const ids = ['first', 'second', 'third', 'fourth'];
  const rows = [...ids.map((id, index) => photo(id, [0, 2, 360, 362][index])), photo('island', 180)];
  const observations = [...ids.map((id) => clue(id, taipei)), clue('island', nami)];
  const album = associateVisualAlbum(qualifyVisualTrip(rows, observations, true)!);
  expect(album?.placeId).toBe(taipei);
  expect(album?.membership.map(({ id }) => id)).toEqual(ids);
  expect(album).not.toHaveProperty('pendingPlaceIds');
});

it.each([[hanoi, 'khue-van-cac'], ['locality-seoul', ewha]])('qualifies %s from named and coarse evidence in distinct sessions', (city, landmark) => {
  const rows = [photo('named-1', 0), photo('scene', 1), photo('named-2', 2), photo('civic-1', 180),
    photo('unrelated', 181), photo('duplicate', 181), photo('screen', 181, 'screenshot'), photo('civic-2', 182)];
  rows[5] = { ...rows[5], family: 'civic-1' };
  const observations = [clue('named-1', landmark), clue('scene', null), clue('named-2', landmark),
    { ...clue('civic-1', city), kind: 'signage' as const }, clue('unrelated', null, unrelated), clue('duplicate', null),
    clue('screen', city), { ...clue('civic-2', city), kind: 'combined' as const }];
  const result = associateVisualAlbum(qualifyVisualTrip(rows, observations)!);
  expect(result).toMatchObject({ placeId: city, stops: [
    { placeId: landmark, supportIds: ['named-1', 'named-2'] }, { placeId: city, supportIds: ['civic-1', 'civic-2'] },
  ] });
  expect(result?.membership.map(({ id }) => id)).toEqual(['named-1', 'scene', 'named-2', 'civic-1', 'civic-2']);
});

it('checks independence against unrecognized representative timing and rejects conflicting evidence', () => {
  const rows = [photo('first', 0), photo('second', 2), photo('third', 180), photo('fourth', 182)];
  const observations = rows.map(({ evidence_id }) => clue(evidence_id, 'khue-van-cac'));
  expect(associateVisualAlbum(qualifyVisualTrip(rows, observations)!)?.placeId).toBe(hanoi);
  expect(qualifyVisualTrip([...rows, photo('unresolved-1', 68), photo('unresolved-2', 135)], observations)).toBeNull();
  expect(qualifyVisualTrip(rows, observations.slice(0, 2))).toBeNull();
  expect(qualifyVisualTrip([...rows, photo('conflict', 90)], [...observations, clue('conflict', namsan)])).toBeNull();
  expect(qualifyVisualTrip(rows.map((row, index) => index === 3 ? { ...row, family: 'first' } : row), observations)).toBeNull();
  expect(qualifyVisualTrip(rows, rows.map(({ evidence_id }) => ({ ...clue(evidence_id, hanoi), kind: 'signage' })))).toBeNull();
});

it('keeps positive support self-contained when an unresolved photo joins capture timing', () => {
  const rows = [photo('named-1', 0), photo('unresolved', 65), photo('named-2', 130), photo('city-1', 250), photo('city-2', 252)];
  const observations = [clue('named-1', 'khue-van-cac'), clue('named-2', 'khue-van-cac'),
    { ...clue('city-1', hanoi), kind: 'signage' as const }, { ...clue('city-2', hanoi), kind: 'signage' as const }];
  expect(qualifyVisualTrip(rows.filter(({ evidence_id }) => evidence_id !== 'unresolved'), observations, false, rows)).toBeNull();
});

it.each([[980, 'city-1'], [900, 'late-1']])('chooses a compatible group and prefers a named group when it fits at %s minutes', (late, eligible) => {
  const rows = [photo('named-1', 0), photo('named-2', 2), photo('city-1', 890), photo('city-2', 892),
    photo('unresolved', 935), photo('late-1', Number(late)), photo('late-2', Number(late) + 2)];
  const observations = [clue('named-1', ewha), clue('named-2', ewha),
    { ...clue('city-1', 'locality-seoul'), kind: 'signage' as const }, { ...clue('city-2', 'locality-seoul'), kind: 'signage' as const },
    clue('late-1', ewha), clue('late-2', ewha)];
  const trip = qualifyVisualTrip(rows, observations);
  expect(trip && associateVisualAlbum(trip)?.stops.map(({ supportIds }) => supportIds[0])).toEqual(['named-1', eligible]);
});

it('applies the same unknown-origin capture support during persisted city validation', () => {
  const rows = [photo('first', 0), photo('second', 2), photo('third', 180), photo('fourth', 182)];
  const observations = rows.map(({ evidence_id }) => ({ ...clue(evidence_id, 'khue-van-cac'), kind: 'image' as const }));
  const album = associateVisualAlbum(qualifyVisualTrip(rows, observations)!)!;
  const validate = (chronology: DiscoveryPhoto[]) => validVisualCitySupport(album.placeId, album.start, album.end, album.stops, album.membership, chronology);
  expect(validate(rows)).toBe(true);
  expect(validate(rows.map((photo) => ({ ...photo, source_origin: null })))).toBe(false);
  expect(validate(rows.map((photo, index) => index < 2 ? { ...photo, source_origin: null } : photo))).toBe(false);
});

it('derives the claimed proposal destination from the supported stops', () => {
  expect(visualTripDestination([ewha, nami, namsan].map((placeId) => ({ placeId })))).toBe('locality-seoul');
  expect(visualTripDestination(['khue-van-cac', 'turtle-tower'].map((placeId) => ({ placeId })))).toBe(hanoi);
  expect(visualTripDestination([{ placeId: ewha }, { placeId: 'locality-seoul' }])).toBe('locality-seoul');
  expect(visualTripDestination([{ placeId: 'taipei-101' }, { placeId: 'taipei-101' }])).toBe('taipei-101');
});
