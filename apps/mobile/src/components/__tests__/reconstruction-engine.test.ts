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
