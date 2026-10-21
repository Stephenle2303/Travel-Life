import { applyOwnerConfiguredHomeAreas, buildV11Episodes, deriveTemporalContextV11, reconstructV1, reconstructV11, type ReconstructionEvidence, type TripDetectorEvidence } from '@/reconstruction';

const e = (id: string, latitude: number | null, longitude: number | null, overrides: Partial<ReconstructionEvidence> = {}): ReconstructionEvidence => ({
  id, latitude, longitude, reportedAccuracyMeters: 10, capturedAtMillis: Date.UTC(2026, 0, 1), capturedDay: '2026-01-01', hasPreciseOffset: true,
  availability: 'available', duplicateFamilyId: null, duplicateConflict: false, excluded: false, ...overrides,
});

describe('reconstruction-v1 deterministic baseline', () => {
  it('is invariant to input enumeration and preserves an observed representative', () => {
    const input = [e('b', 0, 0.01), e('a', 0, 0)];
    expect(reconstructV1(input)).toEqual(reconstructV1([...input].reverse()));
    expect(reconstructV1(input).places[0]).toMatchObject({ memberIds: ['a', 'b'], representativeId: 'a' });
  });

  it('keeps the exact minimax representative and graph for a dense synthetic place', () => {
    const input = Array.from({ length: 80 }, (_, index) => e(
      `dense-${String(index).padStart(3, '0')}`,
      10 + (index % 10) * 0.00001,
      100 + Math.floor(index / 10) * 0.00001,
    ));
    const graph = reconstructV1(input);
    const distance = (a: ReconstructionEvidence, b: ReconstructionEvidence) => {
      const radians = Math.PI / 180;
      const latitudeDelta = ((b.latitude ?? 0) - (a.latitude ?? 0)) * radians;
      const longitudeDelta = (((((b.longitude ?? 0) - (a.longitude ?? 0) + 180) % 360) + 360) % 360 - 180) * radians;
      const haversine = Math.sin(latitudeDelta / 2) ** 2
        + Math.cos((a.latitude ?? 0) * radians) * Math.cos((b.latitude ?? 0) * radians) * Math.sin(longitudeDelta / 2) ** 2;
      return Math.round(2 * 6_371_000 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine)) * 1000) / 1000;
    };
    const representative = [...input].sort((a, b) =>
      Math.max(...input.map((item) => distance(a, item))) - Math.max(...input.map((item) => distance(b, item)))
      || a.id.localeCompare(b.id))[0].id;
    expect(graph.places).toEqual([expect.objectContaining({ representativeId: representative, memberIds: input.map((item) => item.id) })]);
    expect(reconstructV1([...input].reverse())).toEqual(graph);
  });

  it('uses complete-link clusters and normalizes the date line', () => {
    const graph = reconstructV1([e('west', 0, 179.99), e('east', 0, -179.99), e('far', 0, 179.94)]);
    expect(graph.places).toHaveLength(2);
    expect(graph.places.flatMap((place) => place.memberIds)).toEqual(['east', 'west', 'far']);
  });

  it('keeps excluded, unavailable, and inaccurate evidence from supporting places', () => {
    const graph = reconstructV1([
      e('excluded', 1, 1, { excluded: true }), e('unavailable', 1, 1, { availability: 'unavailable' }),
      e('inaccurate', 1, 1, { reportedAccuracyMeters: 5000.01 }), e('valid', 1, 1),
    ]);
    expect(graph.places).toHaveLength(1);
    expect(graph.places[0].memberIds).toEqual(['valid']);
    expect(graph.dispositions.find((item) => item.evidenceId === 'excluded')).toMatchObject({ state: 'unassigned', reasons: ['owner-excluded'] });
  });

  it('splits same-place visits beyond the precise 48-hour limit without claiming an order for weak timestamps', () => {
    const graph = reconstructV1([
      e('one', 1, 1, { capturedAtMillis: Date.UTC(2026, 0, 1, 12) }),
      e('two', 1, 1, { capturedAtMillis: Date.UTC(2026, 0, 3, 12) }),
      e('three', 1, 1, { capturedAtMillis: Date.UTC(2026, 0, 3, 13) }),
    ]);
    expect(graph.visits).toHaveLength(1);
    expect(graph.visits[0].evidenceIds).toEqual(['one', 'two', 'three']);
  });

  it('preserves an ordered A to B to A return as three visits', () => {
    const graph = reconstructV1([
      e('a-first', 0, 0, { capturedAtMillis: Date.UTC(2026, 0, 1) }),
      e('b', 2, 2, { capturedAtMillis: Date.UTC(2026, 0, 2) }),
      e('a-return', 0, 0, { capturedAtMillis: Date.UTC(2026, 0, 3) }),
    ]);
    expect(graph.visits.map((visit) => visit.evidenceIds)).toEqual([['a-first'], ['b'], ['a-return']]);
    expect(graph.visits.map((visit) => visit.placeId)).toEqual(['place:a-first|a-return', 'place:b', 'place:a-first|a-return']);
  });

  it('keeps every copy in a contradictory duplicate family unresolved', () => {
    const graph = reconstructV1([
      e('copy-a', 0, 0, { duplicateFamilyId: 'family', duplicateConflict: true }),
      e('copy-b', 0, 0.01, { duplicateFamilyId: 'family' }),
    ]);
    expect(graph.places).toEqual([]);
    expect(graph.dispositions).toEqual(expect.arrayContaining([
      expect.objectContaining({ evidenceId: 'copy-a', reasons: ['duplicate-family-conflict'] }),
      expect.objectContaining({ evidenceId: 'copy-b', reasons: ['duplicate-family-conflict'] }),
    ]));
  });

  it('adds a GPS-less memory only for one independently bracketed journey', () => {
    const graph = reconstructV1([
      e('start', 0, 0, { capturedAtMillis: Date.UTC(2026, 0, 1, 9) }),
      e('end', 2, 2, { capturedAtMillis: Date.UTC(2026, 0, 1, 11) }),
      e('memory', null, null, { capturedAtMillis: Date.UTC(2026, 0, 1, 10) }),
    ]);
    expect(graph.memberships).toEqual(expect.arrayContaining([expect.objectContaining({ evidenceId: 'memory', state: 'inferred', reason: 'ordered-24-hour-bracket' })]));
  });

  it('does not cross an owner boundary or let usual-area context prove a return', () => {
    const graph = reconstructV1([
      e('a', 0, 0, { capturedAtMillis: Date.UTC(2026, 0, 1), ownerBoundaryAfter: true }),
      e('b', 2, 2, { capturedAtMillis: Date.UTC(2026, 0, 2), usualAreaContext: true }),
    ]);
    expect(graph.journeys).toHaveLength(2);
    expect(graph.possibleMerges).toEqual([]);
  });

  it('applies durable rejection support before automatic journey grouping', () => {
    const input = [
      e('first', 0, 0, { capturedAtMillis: Date.UTC(2026, 0, 1) }),
      e('second', 2, 2, { capturedAtMillis: Date.UTC(2026, 0, 2), capturedDay: '2026-01-02' }),
    ];
    const baseline = reconstructV1(input);
    expect(baseline.journeys).toHaveLength(1);

    const separated = reconstructV1(input, {
      journeyGroupingConstraints: [{ kind: 'cannot-co-member', leftSupport: ['first'], rightSupport: ['second'] }],
    });
    expect(separated.visits).toHaveLength(2);
    expect(separated.journeys).toHaveLength(2);
    expect(separated.possibleMerges).toEqual([]);

    const withheld = reconstructV1(input, {
      journeyGroupingConstraints: [{ kind: 'forbid-automatic-journey-membership', support: ['first'] }],
    });
    expect(withheld.visits).toHaveLength(2);
    expect(withheld.journeys).toHaveLength(1);
    expect(withheld.memberships.some((membership) => membership.evidenceId === 'first')).toBe(false);
  });

  it('attaches bounded structural metadata to a possible merge only when its civil days are known', () => {
    const graph = reconstructV1([
      e('first', 0, 0, { capturedAtMillis: Date.UTC(2026, 0, 1), capturedDay: '2026-01-01' }),
      e('second', 2, 2, { capturedAtMillis: Date.UTC(2026, 0, 6), capturedDay: '2026-01-06' }),
    ]);
    expect(graph.possibleMerges).toEqual([expect.objectContaining({ aiCandidates: [expect.objectContaining({ relativeDayOffset: 0, evidenceCategory: 'geotagged' }), expect.objectContaining({ relativeDayOffset: 5, evidenceCategory: 'geotagged' })] })]);
    const missingDay = reconstructV1([
      e('third', 0, 0, { capturedAtMillis: Date.UTC(2026, 0, 1), capturedDay: null }),
      e('fourth', 2, 2, { capturedAtMillis: Date.UTC(2026, 0, 6), capturedDay: '2026-01-06' }),
    ]);
    expect(missingDay.possibleMerges).toEqual([]);
  });
});

describe('trip-detector-v1.1 qualification boundary', () => {
  const qualified = (id: string, index: number): TripDetectorEvidence => ({
    ...e(id, 1 + index, 1 + index, { capturedAtMillis: Date.UTC(2026, 0, 1, 9 + index), capturedDay: '2026-01-01' }),
    captureLike: true, reliableLocation: true, effectiveBaseDistanceMeters: 90_000,
    sessionId: `session-${index < 3 ? 'a' : 'b'}`, supportPlaceId: `place-${index < 3 ? 'a' : 'b'}`,
    originalLocalDay: index < 3 ? '2026-01-01' : '2026-01-02', origin: 'capture-like', mediaType: 'image', rareDestination: true,
  });

  it('publishes only a fully gated SCORE candidate and is permutation-stable', () => {
    const episode = { id: 'trip', evidence: Array.from({ length: 5 }, (_, index) => qualified(`photo-${index}`, index)), baseContext: true };
    const expected = reconstructV11([episode]);
    expect(expected.trips[0]).toMatchObject({ classification: 'AUTO_CONFIRMED', score: 75, path: 'SCORE' });
    expect(reconstructV11([{ ...episode, evidence: [...episode.evidence].reverse() }])).toEqual(expected);
  });

  it('keeps insufficient, routine, and missing-context candidates off the automatic path', () => {
    const evidence = Array.from({ length: 5 }, (_, index) => qualified(`photo-${index}`, index));
    expect(reconstructV11([{ id: 'near', evidence: evidence.map((item) => ({ ...item, effectiveBaseDistanceMeters: 49_999.999 })), baseContext: true }]).trips[0].classification).toBe('NOT_TRIP');
    expect(reconstructV11([{ id: 'routine', evidence: evidence.map((item) => ({ ...item, routine: true })), baseContext: true }]).trips[0].classification).toBe('NOT_TRIP');
    expect(reconstructV11([{ id: 'unknown', evidence, baseContext: false }]).trips[0].classification).toBe('UNCONFIRMED');
  });

  it('counts a duplicate family once and refuses to promote a far outlier over the supported main place', () => {
    const evidence = Array.from({ length: 5 }, (_, index) => qualified(`photo-${index}`, index));
    const duplicate = evidence.map((item, index) => ({ ...item, duplicateFamilyId: index < 2 ? 'same-capture' : null }));
    expect(reconstructV11([{ id: 'duplicates', evidence: duplicate, baseContext: true }]).trips[0]).toMatchObject({
      classification: 'NOT_TRIP', reasons: expect.arrayContaining(['photo-count-below-five']),
    });
    const nearMain = evidence.map((item, index) => ({ ...item, supportPlaceId: index === 4 ? 'far-outlier' : 'supported-main', effectiveBaseDistanceMeters: index === 4 ? 2_000_000 : 30_000 }));
    expect(reconstructV11([{ id: 'outlier', evidence: nearMain, baseContext: true }]).trips[0]).toMatchObject({
      classification: 'NOT_TRIP', reasons: expect.arrayContaining(['distance-below-50km']),
    });
  });

  it('requires trusted capture-like provenance and the canonical DAY/STAY spans', () => {
    const evidence = Array.from({ length: 5 }, (_, index) => qualified(`photo-${index}`, index));
    expect(reconstructV11([{ id: 'unknown-origin', evidence: evidence.map((item) => ({ ...item, captureLike: false, origin: 'unknown' })), baseContext: true }]).trips[0])
      .toMatchObject({ classification: 'UNCONFIRMED', reasons: expect.arrayContaining(['photo-count-below-five']) });
    const domestic = evidence.map((item) => ({ ...item, rareDestination: false, originalLocalDay: '2026-01-01', episodeSpanMillis: 3 * 60 * 60 * 1000 }));
    expect(reconstructV11([{ id: 'short-day', evidence: domestic, baseContext: true }]).trips[0]).toMatchObject({ classification: 'NOT_TRIP', score: 55 });
    expect(reconstructV11([{ id: 'day', evidence: domestic.map((item) => ({ ...item, episodeSpanMillis: 4 * 60 * 60 * 1000 })), baseContext: true }]).trips[0])
      .toMatchObject({ classification: 'AUTO_CONFIRMED', path: 'DAY', score: 55 });
  });

  it('fails closed for unresolved conflicts, owner vetoes, and suspected routine context', () => {
    const evidence = Array.from({ length: 5 }, (_, index) => qualified(`photo-${index}`, index));
    for (const options of [{ criticalConflict: true }, { ownerVeto: true }, { suspectedRoutine: true }]) {
      expect(reconstructV11([{ id: JSON.stringify(options), evidence, baseContext: true, ...options }]).trips[0]).toMatchObject({ classification: 'UNCONFIRMED' });
    }
  });

  it('keeps each date-scoped owner-configured home authoritative without averaging multiple homes', () => {
    const evidence = Array.from({ length: 5 }, (_, index) => qualified(`home-${index}`, index)).map((item) => ({ ...item, latitude: 10.0, longitude: 105.9, capturedDay: '2026-01-01' }));
    const configured = applyOwnerConfiguredHomeAreas(evidence, [
      { id: 'ho-chi-minh', latitude: 10.8231, longitude: 106.6297, effectiveStartDay: '2026-02-01' },
      { id: 'sa-dec', latitude: 10.2909, longitude: 105.7564, effectiveEndDay: '2026-01-31' },
    ]);
    expect(configured.every((item) => item.usualAreaContext && item.configuredHomeAreaId === 'sa-dec')).toBe(true);
    expect(reconstructV11([{ id: 'configured-home', evidence: configured, baseContext: true }]).trips[0]).toMatchObject({
      classification: 'NOT_TRIP', path: null, reasons: expect.arrayContaining(['configured-home-area']),
    });

    const afterMove = applyOwnerConfiguredHomeAreas([{ ...evidence[0], id: 'after-move', latitude: 10.8231, longitude: 106.6297, capturedDay: '2026-02-01' }], [
      { id: 'ho-chi-minh', latitude: 10.8231, longitude: 106.6297, effectiveStartDay: '2026-02-01' },
      { id: 'sa-dec', latitude: 10.2909, longitude: 105.7564, effectiveEndDay: '2026-01-31' },
    ]);
    expect(afterMove[0].configuredHomeAreaId).toBe('ho-chi-minh');

    const malformed = applyOwnerConfiguredHomeAreas([{ ...evidence[0], id: 'invalid-day', capturedDay: '2026-02-31' }], [
      { id: 'sa-dec', latitude: 10.2909, longitude: 105.7564 },
    ]);
    expect(malformed[0].configuredHomeAreaId).toBeUndefined();
  });

  it('keeps locationless evidence unconfirmed rather than asserting a negative trip', () => {
    const evidence = Array.from({ length: 5 }, (_, index) => ({ ...qualified(`no-location-${index}`, index), latitude: null, longitude: null }));
    expect(reconstructV11([{ id: 'no-location', evidence, baseContext: true }]).trips[0]).toMatchObject({
      classification: 'UNCONFIRMED', reasons: expect.arrayContaining(['distance-unknown']),
    });
  });

  it('uses active owner homes as local episode boundaries without inventing a return from silence', () => {
    const before = Array.from({ length: 5 }, (_, index) => ({ ...qualified(`before-${index}`, index), capturedAtMillis: Date.UTC(2026, 0, 1, index), capturedDay: '2026-01-01' }));
    const local = { ...qualified('home', 9), latitude: 10.2909, longitude: 105.7564, capturedAtMillis: Date.UTC(2026, 0, 2), capturedDay: '2026-01-02' };
    const laterLocal = { ...qualified('home-later', 10), latitude: 10.2909, longitude: 105.7564, capturedAtMillis: Date.UTC(2026, 0, 2, 2), capturedDay: '2026-01-02' };
    const after = Array.from({ length: 5 }, (_, index) => ({ ...qualified(`after-${index}`, index), capturedAtMillis: Date.UTC(2026, 0, 3, index), capturedDay: '2026-01-03' }));
    const result = buildV11Episodes([...after, laterLocal, local, ...before], { baseContext: true, ownerHomeAreas: [{ id: 'sa-dec', latitude: 10.2909, longitude: 105.7564 }] });
    expect(result.trips).toHaveLength(3);
    expect(result.trips.find((trip) => trip.supportIds.includes('home'))).toMatchObject({ classification: 'NOT_TRIP', reasons: expect.arrayContaining(['configured-home-area']) });
    expect(result.trips.filter((trip) => trip.classification === 'AUTO_CONFIRMED')).toHaveLength(2);
  });

  it('derives deterministic C0/C1-ready context without letting candidate evidence establish its own base', () => {
    const base = Array.from({ length: 12 }, (_, index) => ({
      ...qualified(`base-${index}`, index),
      supportPlaceId: 'base',
      capturedDay: `2025-${String(index + 1).padStart(2, '0')}-01`,
      originalLocalDay: `2025-${String(index + 1).padStart(2, '0')}-01`,
      latitude: 10.2909,
      longitude: 105.7564,
    }));
    const c0 = deriveTemporalContextV11([...base].reverse(), [], true);
    const c1 = deriveTemporalContextV11(base, [], true, new Set(base.map((item) => item.id)));
    expect(c0).toMatchObject({ version: 'temporal-context-v1.1', baseIds: ['base'], fullLibrary: true });
    expect(c1.baseIds).toEqual([]);
    expect(deriveTemporalContextV11(base, [], false).baseIds).toEqual([]);
  });
});

describe('reconstruction-v1 regression decision table', () => {
  const at = (day: number, hour = 12) => Date.UTC(2026, 0, day, hour);
  const pointAtMeters = 5_000 / 6_371_000 * 180 / Math.PI;
  const onDay = (id: string, latitude: number | null, longitude: number | null, day: number, overrides: Partial<ReconstructionEvidence> = {}) => {
    const capturedAtMillis = at(day);
    return e(id, latitude, longitude, { capturedAtMillis, capturedDay: new Date(capturedAtMillis).toISOString().slice(0, 10), ...overrides });
  };

  it.each([
    ['place cutoff includes five kilometres', pointAtMeters, 1],
    ['place cutoff separates the nearby failing value', pointAtMeters + 0.000001, 2],
  ])('%s', (_label, longitude, expectedPlaces) => {
    const graph = reconstructV1([e('anchor', 0, 0), e('candidate', 0, longitude)]);
    expect(graph.places).toHaveLength(expectedPlaces);
    expect(graph.dispositions.every((item) => item.state === 'supported')).toBe(true);
  });

  it.each([
    ['known accuracy at five kilometres supports a place', 5_000, 'supported'],
    ['known accuracy just beyond five kilometres stays unresolved', 5_000.001, 'unresolved'],
  ])('%s', (_label, reportedAccuracyMeters, disposition) => {
    const graph = reconstructV1([e('accuracy', 0, 0, { reportedAccuracyMeters })]);
    expect(graph.dispositions).toEqual([expect.objectContaining({ evidenceId: 'accuracy', state: disposition })]);
  });

  it.each([
    ['precise 48-hour visit cutoff stays one visit', 48, 1],
    ['precise 48-hour visit nearby failing value splits visits', 48.001, 2],
  ])('%s', (_label, hours, expectedVisits) => {
    const graph = reconstructV1([
      e('first', 0, 0, { capturedAtMillis: at(1) }),
      e('second', 0, 0, { capturedAtMillis: at(1) + hours * 3_600_000, capturedDay: hours > 48 ? '2026-01-03' : '2026-01-03' }),
    ]);
    expect(graph.visits).toHaveLength(expectedVisits);
  });

  it('uses one civil-day visit grouping and never creates a false within-day order', () => {
    const graph = reconstructV1([
      e('day-only-a', 0, 0, { hasPreciseOffset: false, capturedAtMillis: null }),
      e('day-only-b', 0, 0, { hasPreciseOffset: false, capturedAtMillis: null }),
    ]);
    expect(graph.visits).toEqual([expect.objectContaining({ evidenceIds: ['day-only-a', 'day-only-b'], order: 'uncertain' })]);
    expect(graph.journeys).toEqual([expect.objectContaining({ visitIds: ['visit:day-only-a|day-only-b'] })]);
  });

  it.each([
    ['adjacent civil days stay one uncertain visit', 2, 1],
    ['a two-day civil gap starts another uncertain visit', 3, 2],
  ])('%s', (_label, secondDay, expectedVisits) => {
    const graph = reconstructV1([
      onDay('weak-first', 0, 0, 1, { hasPreciseOffset: false, capturedAtMillis: null }),
      onDay('weak-second', 0, 0, secondDay, { hasPreciseOffset: false, capturedAtMillis: null }),
    ]);
    expect(graph.visits).toHaveLength(expectedVisits);
    expect(graph.visits.every((visit) => visit.order === 'uncertain')).toBe(true);
    expect(graph.visits.flatMap((visit) => visit.evidenceIds)).toEqual(['weak-first', 'weak-second']);
  });

  it('keeps weak correction and precision boundaries conservative without asset-ID ordering', () => {
    const ownerBoundary = reconstructV1([
      onDay('later-id', 0, 0, 1, { hasPreciseOffset: false, capturedAtMillis: null, ownerBoundaryAfter: true }),
      onDay('earlier-id', 0, 0, 2, { hasPreciseOffset: false, capturedAtMillis: null }),
    ]);
    const usualArea = reconstructV1([
      onDay('usual', 0, 0, 1, { hasPreciseOffset: false, capturedAtMillis: null, usualAreaContext: true }),
      onDay('away', 2, 2, 2, { hasPreciseOffset: false, capturedAtMillis: null }),
    ]);
    const sameDayAlternatives = reconstructV1([
      onDay('place-a', 0, 0, 1, { hasPreciseOffset: false, capturedAtMillis: null }),
      onDay('place-b', 2, 2, 1, { hasPreciseOffset: false, capturedAtMillis: null }),
    ]);
    const mixedPrecision = reconstructV1([
      onDay('weak', 0, 0, 1, { hasPreciseOffset: false, capturedAtMillis: null }),
      onDay('ordered', 2, 2, 2),
    ]);
    expect(ownerBoundary.visits).toHaveLength(2);
    expect(ownerBoundary.possibleMerges).toEqual([]);
    expect(usualArea.journeys).toHaveLength(2);
    expect(usualArea.possibleMerges).toEqual([]);
    expect(sameDayAlternatives.journeys).toHaveLength(2);
    expect(sameDayAlternatives.possibleMerges).toEqual([]);
    expect(mixedPrecision.journeys).toHaveLength(2);
    expect(mixedPrecision.possibleMerges).toEqual([]);
  });

  it('leaves an invalid civil day unresolved instead of bypassing weak-date limits', () => {
    const graph = reconstructV1([
      e('invalid-day', 0, 0, { hasPreciseOffset: false, capturedAtMillis: null, capturedDay: '2026-02-31' }),
    ]);
    expect(graph.visits).toEqual([]);
    expect(graph.memberships).toEqual([]);
    expect(graph.dispositions).toEqual([expect.objectContaining({ evidenceId: 'invalid-day', state: 'unresolved', reasons: ['invalid-capture-day'] })]);
  });

  it.each([
    ['precise 72-hour journey cutoff joins adjacent nonlocal visits', at(4), 1, 0],
    ['precise 72-hour nearby failing value remains a possible merge', at(4) + 1, 2, 1],
    ['precise 240-hour merge cutoff remains reviewable', at(11), 2, 1],
    ['precise 240-hour nearby failing value has no merge claim', at(11) + 1, 2, 0],
  ])('%s', (_label, secondAt, expectedJourneys, expectedMerges) => {
    const graph = reconstructV1([e('first', 0, 0, { capturedAtMillis: at(1) }), e('second', 2, 2, { capturedAtMillis: secondAt, capturedDay: new Date(secondAt).toISOString().slice(0, 10) })]);
    expect(graph.journeys).toHaveLength(expectedJourneys);
    expect(graph.possibleMerges).toHaveLength(expectedMerges);
  });

  it('uses the two-day civil-day journey limit without fabricating an elapsed order', () => {
    const joined = reconstructV1([
      e('civil-first', 0, 0, { hasPreciseOffset: false, capturedAtMillis: null, capturedDay: '2026-01-01' }),
      e('civil-second', 2, 2, { hasPreciseOffset: false, capturedAtMillis: null, capturedDay: '2026-01-03' }),
    ]);
    const separate = reconstructV1([
      e('civil-first', 0, 0, { hasPreciseOffset: false, capturedAtMillis: null, capturedDay: '2026-01-01' }),
      e('civil-third', 2, 2, { hasPreciseOffset: false, capturedAtMillis: null, capturedDay: '2026-01-04' }),
    ]);
    expect(joined.journeys).toHaveLength(1);
    expect(joined.visits.every((visit) => visit.order === 'uncertain')).toBe(true);
    expect(separate.journeys).toHaveLength(2);
    expect(separate.possibleMerges).toHaveLength(1);
  });

  it('includes the 30-day visit and journey spans, then splits at the nearby failing day', () => {
    const visitDays = Array.from({ length: 16 }, (_, index) => 1 + index * 2);
    const exactVisit = reconstructV1(visitDays.map((day) => onDay(`visit-${day}`, 0, 0, day)));
    const justOverVisit = reconstructV1([...visitDays, 32].map((day) => onDay(`visit-${day}`, 0, 0, day)));
    const journeyDays = Array.from({ length: 11 }, (_, index) => 1 + index * 3);
    const exactJourney = reconstructV1(journeyDays.map((day, index) => onDay(`journey-${day}`, index * 2, index * 2, day)));
    const justOverJourney = reconstructV1([...journeyDays, 32].map((day, index) => onDay(`journey-${day}`, index * 2, index * 2, day)));
    expect(exactVisit.visits).toHaveLength(1);
    expect(justOverVisit.visits).toHaveLength(2);
    expect(exactJourney.journeys).toHaveLength(1);
    expect(justOverJourney.journeys).toHaveLength(2);
    expect(justOverJourney.possibleMerges).toHaveLength(1);
  });

  it.each([
    ['at the ten-day civil possible-merge cutoff', 11, 1],
    ['just beyond the ten-day civil possible-merge cutoff', 12, 0],
  ])('%s', (_label, secondDay, expectedMerges) => {
    const graph = reconstructV1([
      onDay('merge-first', 0, 0, 1, { hasPreciseOffset: false, capturedAtMillis: null }),
      onDay('merge-second', 2, 2, secondDay, { hasPreciseOffset: false, capturedAtMillis: null }),
    ]);
    expect(graph.journeys).toHaveLength(2);
    expect(graph.possibleMerges).toHaveLength(expectedMerges);
    expect(graph.visits.every((visit) => visit.order === 'uncertain')).toBe(true);
  });

  it('keeps a near-home context as a reviewable split instead of a return claim', () => {
    const graph = reconstructV1([
      e('away-first', 0, 0, { capturedAtMillis: at(1) }),
      e('usual-area', 2, 2, { capturedAtMillis: at(2), usualAreaContext: true }),
      e('away-later', 4, 4, { capturedAtMillis: at(3) }),
    ]);
    expect(graph.journeys).toHaveLength(3);
    expect(graph.possibleMerges).toHaveLength(2);
  });

  it.each([
    ['at the 24-hour bracket cutoff', at(2, 12), 'inferred'],
    ['just outside the 24-hour bracket', at(2, 12) + 1, 'suggested'],
  ])('adds GPS-less memory %s only with explicit bounded membership', (_label, memoryAt, state) => {
    const graph = reconstructV1([
      e('before', 0, 0, { capturedAtMillis: at(1, 12) }),
      e('after', 2, 2, { capturedAtMillis: at(3, 12) }),
      e('memory', null, null, { capturedAtMillis: memoryAt, capturedDay: '2026-01-02' }),
    ]);
    expect(graph.memberships).toEqual(expect.arrayContaining([expect.objectContaining({ evidenceId: 'memory', state })]));
    expect(graph.dispositions.find((item) => item.evidenceId === 'memory')).toMatchObject({ state: 'unresolved' });
  });

  it('suggests a day-only memory for exactly one candidate and keeps competing alternatives unresolved', () => {
    const single = reconstructV1([
      e('first', 0, 0, { capturedAtMillis: at(1) }), e('second', 2, 2, { capturedAtMillis: at(2) }),
      e('day-only', null, null, { capturedAtMillis: null, hasPreciseOffset: false, capturedDay: '2026-01-02' }),
    ]);
    const competing = reconstructV1([
      e('first-a', 0, 0, { capturedAtMillis: at(1) }), e('second-a', 2, 2, { capturedAtMillis: at(2), ownerBoundaryAfter: true }),
      e('first-b', 4, 4, { capturedAtMillis: at(1) }), e('second-b', 6, 6, { capturedAtMillis: at(2) }),
      e('day-only', null, null, { capturedAtMillis: null, hasPreciseOffset: false, capturedDay: '2026-01-02' }),
    ]);
    expect(single.memberships).toEqual(expect.arrayContaining([expect.objectContaining({ evidenceId: 'day-only', state: 'suggested' })]));
    expect(competing.memberships.find((item) => item.evidenceId === 'day-only')).toBeUndefined();
  });

  it('uses inclusive one-day suggestion padding and never turns day-only media into automatic membership', () => {
    const supports = [onDay('padding-first', 0, 0, 1), onDay('padding-last', 2, 2, 4)];
    const padded = reconstructV1([...supports, onDay('padding-edge', null, null, 5, { hasPreciseOffset: false, capturedAtMillis: null })]);
    const outside = reconstructV1([...supports, onDay('padding-outside', null, null, 6, { hasPreciseOffset: false, capturedAtMillis: null })]);
    const threeDaysAway = reconstructV1([...supports, onDay('nearest-three-days', null, null, 7, { hasPreciseOffset: false, capturedAtMillis: null })]);
    expect(padded.memberships).toEqual(expect.arrayContaining([expect.objectContaining({ evidenceId: 'padding-edge', state: 'suggested', reason: 'unique-three-day-suggestion' })]));
    expect(padded.memberships.find((item) => item.evidenceId === 'padding-edge')?.state).not.toBe('inferred');
    expect(outside.memberships.find((item) => item.evidenceId === 'padding-outside')).toBeUndefined();
    expect(threeDaysAway.memberships.find((item) => item.evidenceId === 'nearest-three-days')).toBeUndefined();
  });

  it('does not promote unsupported, missing-date, or duplicate-family evidence into visit support', () => {
    const graph = reconstructV1([
      e('supported', 0, 0),
      e('unavailable', 0, 0, { availability: 'unavailable' }),
      e('no-date', 1, 1, { capturedAtMillis: null, capturedDay: null }),
      e('copy-a', 2, 2, { duplicateFamilyId: 'conflict', duplicateConflict: true }),
      e('copy-b', 2, 2, { duplicateFamilyId: 'conflict' }),
    ]);
    expect(graph.visits.flatMap((visit) => visit.evidenceIds)).toEqual(['supported']);
    expect(graph.memberships.map((item) => item.evidenceId)).toEqual(['supported']);
    expect(graph.dispositions.filter((item) => item.evidenceId !== 'supported').every((item) => item.state !== 'supported')).toBe(true);
  });

  it('is stable across reversed, batched, and repeated final rebuilds', () => {
    const finalEvidence = [
      e('late-a', 0, 0, { capturedAtMillis: at(1) }),
      e('late-b', 2, 2, { capturedAtMillis: at(2) }),
      e('late-memory', null, null, { capturedAtMillis: at(1, 18) }),
    ];
    const expected = reconstructV1(finalEvidence);
    expect(reconstructV1([...finalEvidence].reverse())).toEqual(expected);
    expect(reconstructV1([...finalEvidence.slice(0, 1), ...finalEvidence.slice(1)])).toEqual(expected);
    expect(reconstructV1(finalEvidence)).toEqual(expected);
  });
});
