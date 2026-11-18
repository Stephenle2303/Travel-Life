import { candidateTripPolicy, recoveryTripPolicy, projectCandidateTrips, projectCanonicalCandidateHistory } from '@/reconstruction/candidate-projection';
import { qualifyGraphJourneyV11 } from '@/reconstruction/canonical-core';
import { reconstructV1 } from '@/reconstruction/engine';
import { LOCAL_RECOVERY_PROJECTION_VERSION, projectLocalRecoveryGraph } from '@/reconstruction/local-recovery-projection';
import type { OwnerConfiguredHomeArea, TripDetectorEvidence } from '@/reconstruction/types';

const home: OwnerConfiguredHomeArea = { id: 'home', latitude: 10, longitude: 30, radiusMeters: 2_000 };
const evidence = (id: string, day: number, latitude = 10.15, hour: number | null = 9, extra: Partial<TripDetectorEvidence> = {}): TripDetectorEvidence => ({
  id, capturedDay: new Date(Date.UTC(2025, 0, day)).toISOString().slice(0, 10),
  capturedAtMillis: hour === null ? null : Date.UTC(2025, 0, day, hour), hasPreciseOffset: hour !== null,
  latitude, longitude: 30, reportedAccuracyMeters: 10, availability: 'available', duplicateFamilyId: null,
  duplicateConflict: false, excluded: false, captureLike: true, ...extra,
});

describe('Atlas recovery shadow continuity', () => {
  const projectRecovery = (rows: TripDetectorEvidence[]) => projectCandidateTrips({ graph: reconstructV1(rows), evidence: rows, homeAreas: [home], mode: 'recovery' });
  const vietnam = [10.82, 106.63] as const;
  const taiwan = [25.04, 121.56] as const;
  const thailand = [13.75, 100.50] as const;
  const at = (id: string, day: number, hour: number, [latitude, longitude]: readonly [number, number], extra: Partial<TripDetectorEvidence> = {}) =>
    evidence(id, day, latitude, hour, { longitude, ...extra });
  const outing = (name: string, day: number, point: readonly [number, number]) =>
    [at(`${name}-start`, day, 9, point), at(`${name}-end`, day, 16, point)];

  it.each([taiwan, thailand, vietnam].map((destination) => ({ destination })))('keeps nearby independently supported outings separate at $destination', ({ destination }) => {
    const rows = [...outing('first', 2, vietnam), ...outing('second', 4, destination), evidence('unrelated-home', 29, 10)];
    const result = projectRecovery(rows);
    expect(result.policyVersion).toBe(recoveryTripPolicy.version);
    expect(result.trips).toHaveLength(2);
    expect(result.trips.every(({ state }) => state === 'reliable')).toBe(true);
    expect(result.mergeSuggestions).toEqual([{
      left: expect.objectContaining({ supportIds: ['first-end', 'first-start'], visitIds: expect.any(Array) }),
      right: expect.objectContaining({ supportIds: ['second-end', 'second-start'], visitIds: expect.any(Array) }),
    }]);
    expect(projectRecovery([...rows].reverse())).toEqual(result);
  });

  it('keeps precise same-day changes separate without intermediate support', () => {
    const result = projectRecovery([at('left-a', 3, 1, vietnam), at('left-b', 3, 4, vietnam),
      at('right-a', 3, 12, taiwan), at('right-b', 3, 16, taiwan)]);
    expect(result.trips.every(({ state }) => state === 'reliable')).toBe(true);
    expect(result.mergeSuggestions).toHaveLength(1);
  });

  it.each([
    { start: vietnam, middle: [22.32, 114.17] as const, end: taiwan },
    { start: [22.63, 120.3] as const, middle: [24.15, 120.67] as const, end: taiwan },
  ])('retains travel corroborated by an independently timed intermediate place', ({ start, middle, end }) => {
    const rows = [...outing('start', 2, start), at('via', 2, 21, middle), ...outing('end', 3, end)];
    const result = projectRecovery(rows);
    expect(result.trips).toEqual([expect.objectContaining({ state: 'reliable', supportIds: ['end-end', 'end-start', 'start-end', 'start-start', 'via'] })]);
    expect(result.mergeSuggestions).toEqual([]);
  });

  it('suppresses pairs for a dated Home return, owner boundary, or contradictory movement', () => {
    const rows = [...outing('left', 2, vietnam), ...outing('right', 4, taiwan)];
    const returning = projectRecovery([...rows, evidence('home-a', 3, 10, 9), evidence('home-b', 3, 10, 16)]);
    expect(returning.boundaries['home-return']).toBe(1);
    expect(returning.trips.every(({ state }) => state === 'reliable')).toBe(true);
    expect(returning.mergeSuggestions).toEqual([]);
    const split = projectRecovery(rows.map((row) => row.id === 'left-end' ? { ...row, ownerBoundaryAfter: true } : row));
    expect(split.boundaries['owner-boundary']).toBe(1);
    expect(split.mergeSuggestions).toEqual([]);
    const incompatible = projectRecovery([at('left-a', 3, 1, vietnam), at('left-b', 3, 4, vietnam),
      at('right-a', 3, 4, taiwan), at('right-b', 3, 16, taiwan)]);
    expect(incompatible.boundaries['uncertain-gap']).toBe(1);
    expect(incompatible.mergeSuggestions).toEqual([]);
  });

  it('requires independently reliable groups and withholds competing links', () => {
    const left = outing('left', 2, vietnam);
    const right = outing('right', 4, taiwan);
    const sparse = projectRecovery([...left, right[0]]);
    expect(sparse.trips.map(({ state }) => state)).toEqual(['reliable', 'possible']);
    expect(sparse.mergeSuggestions).toEqual([]);
    const chain = projectRecovery([...left, ...right, ...outing('third', 7, thailand)]);
    expect(chain.trips).toHaveLength(3);
    expect(chain.trips.every(({ state }) => state === 'reliable')).toBe(true);
    expect(chain.mergeSuggestions).toEqual([]);
  });

  it('proposes exact visit-aligned Local replacements while preserving protected groups and album authority', async () => {
    const visit = (label: string, firstDay: number, point: readonly [number, number]) =>
      [9, 12, 16, 32, 40].map((hour) => at(`${label}-${hour}`, firstDay + Math.floor(hour / 24), hour % 24, point));
    const left = visit('left', 2, taiwan);
    const right = visit('right', 9, thailand);
    const input = {
      rows: [...left, ...right].map((item) => ({
        evidence_id: item.id, captured_at_millis: item.capturedAtMillis, captured_day: item.capturedDay,
        has_precise_offset: 1, latitude: item.latitude, longitude: item.longitude,
        reported_accuracy_meters: item.reportedAccuracyMeters, availability: item.availability,
      })),
      excluded: new Set<string>(), privateFilter: { excluded: new Set<string>() },
      configuredHomeAreas: [{ area_id: 'home', latitude: vietnam[0], longitude: vietnam[1],
        radius_meters: 5_000, effective_start_day: null, effective_end_day: null }],
      storedCorrections: [], storedMemoryCorrections: [],
    };
    const { baseline, candidate } = await projectCanonicalCandidateHistory(input, undefined, undefined, 'recovery');
    expect(baseline.graph.journeys).toHaveLength(1);
    expect(candidate.mergeSuggestions).toHaveLength(1);
    const originalJourney = baseline.graph.journeys[0];
    const localInput = { baseline, candidate, mediaByEvidence: new Map(), protectedJourneyIds: new Set<string>(), withheldEvidence: new Set<string>() };
    const result = projectLocalRecoveryGraph(localInput);
    expect(result.policyVersion).toBe(LOCAL_RECOVERY_PROJECTION_VERSION);
    expect(result.graph.journeys).toHaveLength(2);
    expect(result.pairs).toEqual([expect.objectContaining({ replacedJourneyId: originalJourney.id })]);
    const [{ leftJourneyId, rightJourneyId }] = result.pairs;
    expect(result.graph.possibleMerges).toEqual([{ fromJourneyId: leftJourneyId, toJourneyId: rightJourneyId, reason: 'adjacent-gap' }]);
    for (const [journeyId, side] of [[leftJourneyId, left], [rightJourneyId, right]] as const) {
      expect(qualifyGraphJourneyV11(result.graph, journeyId, baseline.evidence, new Map(), baseline.homeAreas).classification).toBe('AUTO_CONFIRMED');
      expect(result.graph.memberships.filter((membership) => membership.journeyId === journeyId).map(({ evidenceId }) => evidenceId).sort())
        .toEqual(side.map(({ id }) => id).sort());
    }
    expect(baseline.graph.journeys).toEqual([originalJourney]);
    expect(projectLocalRecoveryGraph({ ...localInput, protectedJourneyIds: new Set([originalJourney.id]) }).graph).toBe(baseline.graph);
    expect(projectLocalRecoveryGraph({ ...localInput, withheldEvidence: new Set([left[0].id]) }).graph).toBe(baseline.graph);

    const albumOnly = { ...baseline.graph, memberships: [...baseline.graph.memberships,
      { journeyId: originalJourney.id, evidenceId: 'gps-less', state: 'suggested' as const, reason: 'unique-three-day-suggestion' as const }] };
    expect(projectLocalRecoveryGraph({ ...localInput, baseline: { ...baseline, graph: albumOnly } }).graph).toBe(albumOnly);
    const separate = { ...result.graph, possibleMerges: [] };
    const existing = projectLocalRecoveryGraph({ ...localInput, baseline: { ...baseline, graph: separate } });
    expect(existing.graph.journeys).toEqual(separate.journeys);
    expect(existing.pairs).toEqual([{ leftJourneyId, rightJourneyId, replacedJourneyId: null }]);
  });
});
const project = (rows: TripDetectorEvidence[], homeAreas = [home]) => projectCandidateTrips({ graph: reconstructV1(rows), evidence: rows, homeAreas });

describe('recognizable travel shadow projection', () => {
  it('keeps routine and photo volume out while allowing a nearby two-session outing', () => {
    const routine = Array.from({ length: 80 }, (_, i) => evidence(`routine-${i}`, 2, 10, 8));
    const outing = [evidence('start', 4, 10.15, 9), evidence('end', 4, 10.15, 16)];
    const result = project([...routine, ...outing]);
    expect(result.policyVersion).toBe(candidateTripPolicy.version);
    expect(result.trips).toHaveLength(1);
    expect(result.trips[0]).toMatchObject({ state: 'reliable', supportIds: ['end', 'start'] });
    expect(project([...routine, ...outing].reverse())).toEqual(result);
  });

  it('keeps a single burst possible and ignores conflicting or absent location', () => {
    const rows = [
      evidence('burst', 2), evidence('copy', 2, 10.15, 9, { duplicateFamilyId: 'copies' }),
      evidence('copy2', 2, 10.15, 15, { duplicateFamilyId: 'copies' }),
      evidence('no-gps', 2, 10, 15, { latitude: null }), evidence('conflict', 2, 10, 15, { duplicateConflict: true }),
    ];
    expect(project(rows).trips).toEqual([expect.objectContaining({
      state: 'possible', reasons: ['sparse-sessions'], supportKeys: ['E:burst', 'F:copies'],
    })]);
  });

  it('bridges a four-day gap with independent away support, but respects a corroborated return', () => {
    const holiday = [evidence('one', 1, 12, null), evidence('two', 2, 12.2), evidence('three', 6, 13, null), evidence('four', 7, 13.3)];
    expect(project([...holiday, evidence('unrelated-home', 29, 10)]).trips).toEqual([
      expect.objectContaining({ state: 'reliable', supportIds: ['four', 'one', 'three', 'two'] }),
    ]);
    const returned = project([...holiday, evidence('return-start', 4, 10, 9), evidence('return-end', 4, 10, 15)]);
    expect(returned.boundaries['home-return']).toBe(1);
    expect(returned.trips).toHaveLength(2);
    expect(returned.trips.every((trip) => trip.state === 'reliable')).toBe(true);
    const ambiguous = project(holiday.map((item) => ({ ...item, latitude: 10.15 })));
    expect(ambiguous.boundaries['uncertain-gap']).toBe(1);
    expect(ambiguous.trips.every((trip) => trip.state === 'possible')).toBe(true);
  });

  it('does not learn routine from later observations and uses an explicit dated answer only in its period', () => {
    const rows = [evidence('routine', 1, 10), ...[4, 16, 28].flatMap((day) => [
      evidence(`outing-${day}-a`, day, 10.2, 9), evidence(`outing-${day}-b`, day, 10.2, 15),
    ])];
    const graph = reconstructV1(rows);
    const place = graph.places.find((candidate) => candidate.memberIds.includes('routine'))!;
    expect(projectCandidateTrips({ graph, evidence: rows, homeAreas: [] }).trips).toEqual([]);
    const projection = projectCandidateTrips({ graph, evidence: rows, homeAreas: [], usualPlaceAnswers: [
      { placeId: place.id, startDay: '2025-01-01', endDay: '2025-01-20', usual: true },
    ] });
    expect(projection.trips).toHaveLength(2);
    expect(projection.trips.every((trip) => trip.state === 'reliable')).toBe(true);
  });

  it('respects a precise same-day owner split and does not corroborate contradictory exact motion', () => {
    const separated = project([
      evidence('left-a', 5, 10.15, 8), evidence('left-b', 5, 10.15, 10, { ownerBoundaryAfter: true }),
      evidence('right-a', 5, 10.25, 15), evidence('right-b', 5, 10.25, 17),
    ]);
    expect(separated.boundaries['owner-boundary']).toBe(1);
    expect(separated.trips.map((trip) => trip.supportIds)).toEqual([['left-a', 'left-b'], ['right-a', 'right-b']]);
    const conflict = project([evidence('first', 5, 10.15, 8), evidence('distant', 5, 28, 8)]);
    expect(conflict.boundaries['uncertain-gap']).toBe(1);
    expect(conflict.trips.every((trip) => trip.state === 'possible')).toBe(true);
  });

  it('keeps shadow input and results separate from baseline qualification', async () => {
    const rows = [evidence('first', 4, 10.2, 9), evidence('second', 4, 10.2, 14)];
    const input = { rows: rows.map((item) => ({
      evidence_id: item.id, captured_at_millis: item.capturedAtMillis, captured_day: item.capturedDay,
      has_precise_offset: 1, latitude: item.latitude, longitude: item.longitude,
      reported_accuracy_meters: item.reportedAccuracyMeters, availability: item.availability,
    })), excluded: new Set<string>(), privateFilter: { excluded: new Set<string>() }, configuredHomeAreas: [{
      area_id: home.id, latitude: home.latitude, longitude: home.longitude, radius_meters: home.radiusMeters!,
      effective_start_day: null, effective_end_day: null,
    }], storedCorrections: [], storedMemoryCorrections: [] };
    const { baseline, candidate } = await projectCanonicalCandidateHistory(input);
    const baselineQualifications = baseline.graph.journeys.map((journey) => qualifyGraphJourneyV11(
      baseline.graph, journey.id, baseline.evidence, new Map(), baseline.homeAreas,
    ));
    expect(baselineQualifications.length).toBeGreaterThan(0);
    expect(baselineQualifications.every((trip) => trip.classification !== 'AUTO_CONFIRMED')).toBe(true);
    expect(candidate.trips).toEqual([expect.objectContaining({ state: 'reliable', supportIds: ['first', 'second'] })]);
    expect(baseline.graph.journeys.every(({ id }) => !id.startsWith('candidate:'))).toBe(true);
    const recovery = await projectCanonicalCandidateHistory(input, undefined, undefined, 'recovery');
    expect(recovery.baseline.graph).toEqual(baseline.graph);
    expect(recovery.candidate.policyVersion).toBe(recoveryTripPolicy.version);
    expect(input.excluded.size).toBe(0);
  });

  it('preserves exact reviewed Home support without carrying excluded observations', async () => {
    const rows = [evidence('home-event', 4, 10, 9), evidence('private-away', 4, 10.2, 14)];
    const { candidate } = await projectCanonicalCandidateHistory({
      rows: rows.map((item) => ({
        evidence_id: item.id, captured_at_millis: item.capturedAtMillis, captured_day: item.capturedDay,
        has_precise_offset: 1, latitude: item.latitude, longitude: item.longitude,
        reported_accuracy_meters: item.reportedAccuracyMeters, availability: item.availability,
      })),
      excluded: new Set(['private-away']), privateFilter: { excluded: new Set(['private-away']) },
      configuredHomeAreas: [{ area_id: home.id, latitude: home.latitude, longitude: home.longitude,
        radius_meters: home.radiusMeters!, effective_start_day: null, effective_end_day: null }],
      storedCorrections: [{ revision_id: 'confirm-home-event', action: 'confirm', reviewed_support_json: '["E:home-event"]' }],
      storedMemoryCorrections: [],
    });
    expect(candidate.trips).toEqual([expect.objectContaining({ state: 'reliable', reasons: ['owner-reviewed'],
      supportIds: ['home-event'], supportKeys: ['E:home-event'] })]);
  });
});
