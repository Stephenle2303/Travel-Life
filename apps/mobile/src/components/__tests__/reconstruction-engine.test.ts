import { reconstructV1, type ReconstructionEvidence } from '@/reconstruction';

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
