import { buildSameTripJourneys, findSameTripCandidatePairs, hasCorroboratedHomeReturn, representativeOffsetMinutes, sameTripClues, type SameTripJourney } from '@/clues/producers/same-trip';
import type { ReconstructionEvidence, ReconstructionGraph } from '@/reconstruction/types';

const revision = { evidenceRevision: 1, homeRevision: 0, correctionRevision: 0 };

function evidence(overrides: Partial<ReconstructionEvidence> & Pick<ReconstructionEvidence, 'id'>): ReconstructionEvidence {
  return {
    capturedAtMillis: null, capturedDay: null, hasPreciseOffset: false, latitude: null, longitude: null,
    reportedAccuracyMeters: null, availability: 'available', duplicateFamilyId: null, duplicateConflict: false, excluded: false,
    ...overrides,
  };
}

function journey(overrides: Partial<SameTripJourney> & Pick<SameTripJourney, 'journeyId' | 'firstDay' | 'lastDay'>): SameTripJourney {
  return {
    classification: 'SUGGESTED', evidenceKeys: [`E:${overrides.journeyId}`], anchorKey: `E:${overrides.journeyId}`, offsetMinutes: 540,
    ...overrides,
  };
}

describe('representativeOffsetMinutes', () => {
  it('returns the mode, lowest value wins a tie, and abstains below the minimum sample size', () => {
    expect(representativeOffsetMinutes([540, 540, -300])).toBe(540);
    expect(representativeOffsetMinutes([540, -300])).toBe(-300); // tie: lowest wins
    expect(representativeOffsetMinutes([540])).toBeNull();
    expect(representativeOffsetMinutes([])).toBeNull();
  });
});

describe('findSameTripCandidatePairs (CAP-6)', () => {
  const noHomeReturn = () => true;

  it('pairs two Possible trips within 10 days with no Home return between them', () => {
    const a = journey({ journeyId: 'a', firstDay: '2026-03-01', lastDay: '2026-03-03' });
    const b = journey({ journeyId: 'b', firstDay: '2026-03-08', lastDay: '2026-03-10' });
    const pairs = findSameTripCandidatePairs([a, b], noHomeReturn);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toMatchObject({ gapDays: 5 });
  });

  it('pairs a Possible trip with an adjacent Atlas trip, either order', () => {
    const possible = journey({ journeyId: 'p', firstDay: '2026-03-01', lastDay: '2026-03-03', classification: 'NOT_TRIP' });
    const atlas = journey({ journeyId: 'atlas', firstDay: '2026-03-05', lastDay: '2026-03-06', classification: 'AUTO_CONFIRMED' });
    expect(findSameTripCandidatePairs([possible, atlas], noHomeReturn)).toHaveLength(1);
    expect(findSameTripCandidatePairs([atlas, possible], noHomeReturn)).toHaveLength(1);
  });

  it('never pairs two Atlas trips, and never pairs a rejected journey', () => {
    const atlasA = journey({ journeyId: 'a', firstDay: '2026-03-01', lastDay: '2026-03-03', classification: 'USER_CONFIRMED' });
    const atlasB = journey({ journeyId: 'b', firstDay: '2026-03-05', lastDay: '2026-03-06', classification: 'AUTO_CONFIRMED' });
    expect(findSameTripCandidatePairs([atlasA, atlasB], noHomeReturn)).toHaveLength(0);

    const possible = journey({ journeyId: 'p', firstDay: '2026-03-01', lastDay: '2026-03-03', classification: 'SUGGESTED' });
    const rejected = journey({ journeyId: 'r', firstDay: '2026-03-05', lastDay: '2026-03-06', classification: 'REJECTED' });
    expect(findSameTripCandidatePairs([possible, rejected], noHomeReturn)).toHaveLength(0);
  });

  it('excludes a pair more than 10 days apart', () => {
    const a = journey({ journeyId: 'a', firstDay: '2026-03-01', lastDay: '2026-03-03' });
    const b = journey({ journeyId: 'b', firstDay: '2026-03-20', lastDay: '2026-03-21' });
    expect(findSameTripCandidatePairs([a, b], noHomeReturn)).toHaveLength(0);
  });

  it('excludes a pair with a corroborated Home return between them', () => {
    const a = journey({ journeyId: 'a', firstDay: '2026-03-01', lastDay: '2026-03-03' });
    const b = journey({ journeyId: 'b', firstDay: '2026-03-08', lastDay: '2026-03-10' });
    expect(findSameTripCandidatePairs([a, b], () => false)).toHaveLength(0);
  });

  it('excludes an overlapping pair', () => {
    const a = journey({ journeyId: 'a', firstDay: '2026-03-01', lastDay: '2026-03-10' });
    const b = journey({ journeyId: 'b', firstDay: '2026-03-05', lastDay: '2026-03-12' });
    expect(findSameTripCandidatePairs([a, b], noHomeReturn)).toHaveLength(0);
  });
});

describe('sameTripClues (CAP-6)', () => {
  it('emits a clue only when both sides carry the same capture offset', () => {
    const a = journey({ journeyId: 'a', firstDay: '2026-03-01', lastDay: '2026-03-03', offsetMinutes: 540 });
    const b = journey({ journeyId: 'b', firstDay: '2026-03-08', lastDay: '2026-03-10', offsetMinutes: 540 });
    const clues = sameTripClues([{ a, b, gapDays: 5 }], revision, 1000);
    expect(clues).toHaveLength(1);
    expect(clues[0]).toMatchObject({
      kind: 'same-trip', subject: { evidenceKeys: ['E:a'] }, value: { pairedSubject: { evidenceKeys: ['E:b'] } },
    });
  });

  it('abstains when either side has no offset, or the offsets disagree', () => {
    const base = journey({ journeyId: 'a', firstDay: '2026-03-01', lastDay: '2026-03-03', offsetMinutes: 540 });
    const noOffset = journey({ journeyId: 'b', firstDay: '2026-03-08', lastDay: '2026-03-10', offsetMinutes: null });
    const differentOffset = journey({ journeyId: 'c', firstDay: '2026-03-08', lastDay: '2026-03-10', offsetMinutes: 0 });
    expect(sameTripClues([{ a: base, b: noOffset, gapDays: 5 }], revision, 1000)).toHaveLength(0);
    expect(sameTripClues([{ a: base, b: differentOffset, gapDays: 5 }], revision, 1000)).toHaveLength(0);
  });

  it('keys clueId by the pair\'s stable anchors, in a deterministic order independent of input order', () => {
    const a = journey({ journeyId: 'a', firstDay: '2026-03-01', lastDay: '2026-03-03', anchorKey: 'E:zzz', offsetMinutes: 540 });
    const b = journey({ journeyId: 'b', firstDay: '2026-03-08', lastDay: '2026-03-10', anchorKey: 'E:aaa', offsetMinutes: 540 });
    const forward = sameTripClues([{ a, b, gapDays: 5 }], revision, 1000);
    const backward = sameTripClues([{ a: b, b: a, gapDays: 5 }], revision, 2000);
    expect(forward[0].clueId).toBe(backward[0].clueId);
    expect(forward[0].clueId).toContain('E:aaa');
    expect(forward[0].clueId).toContain('E:zzz');
  });
});

describe('buildSameTripJourneys (CAP-6)', () => {
  const graph: Pick<ReconstructionGraph, 'journeys' | 'visits' | 'memberships'> = {
    visits: [{ id: 'visit-1', placeId: 'place-1', evidenceIds: ['e1', 'e2'], order: 'ordered' }],
    journeys: [{ id: 'journey-1', visitIds: ['visit-1'], state: 'inferred' }],
    memberships: [{ evidenceId: 'e3', journeyId: 'journey-1', state: 'inferred', reason: 'unique-three-day-suggestion' }],
  };
  const evidenceById = new Map([
    ['e1', evidence({ id: 'e1', capturedDay: '2026-03-02' })],
    ['e2', evidence({ id: 'e2', capturedDay: '2026-03-01' })],
    ['e3', evidence({ id: 'e3', capturedDay: '2026-03-03' })],
  ]);
  const classifications = new Map([['journey-1', 'SUGGESTED' as const]]);

  it('includes membership-only evidence alongside visit-support, and picks the earliest day as the anchor', () => {
    const [journey] = buildSameTripJourneys(graph, evidenceById, classifications, new Map());
    expect(journey.evidenceKeys).toEqual(['E:e1', 'E:e2', 'E:e3']);
    expect(journey.firstDay).toBe('2026-03-01');
    expect(journey.lastDay).toBe('2026-03-03');
    expect(journey.anchorKey).toBe('E:e2'); // e2 is the earliest day (03-01)
  });

  it('computes the representative offset from every member with a known one', () => {
    const offsets = new Map([['e1', 540], ['e2', 540], ['e3', 540]]);
    const [journey] = buildSameTripJourneys(graph, evidenceById, classifications, offsets);
    expect(journey.offsetMinutes).toBe(540);
  });

  it('fails closed: leaves out a journey with no stored classification, and one with no reliable day', () => {
    expect(buildSameTripJourneys(graph, evidenceById, new Map(), new Map())).toHaveLength(0);
    const noDay = new Map([['e1', evidence({ id: 'e1', capturedDay: null })], ['e2', evidence({ id: 'e2', capturedDay: null })], ['e3', evidence({ id: 'e3', capturedDay: null })]]);
    expect(buildSameTripJourneys(graph, noDay, classifications, new Map())).toHaveLength(0);
  });

  it('excludes a journey whose only evidence is excluded', () => {
    const allExcluded = new Map([...evidenceById].map(([id, item]) => [id, { ...item, excluded: true }]));
    expect(buildSameTripJourneys(graph, allExcluded, classifications, new Map())).toHaveLength(0);
  });
});

describe('hasCorroboratedHomeReturn (CAP-6)', () => {
  const home = [{ id: 'home-1', latitude: 10.776, longitude: 106.700, radiusMeters: 20_000 }];

  it('returns false when there is no evidence in the gap at all', () => {
    expect(hasCorroboratedHomeReturn([], home, '2026-03-01', '2026-03-08')).toBe(false);
  });

  it('returns false when gap evidence exists but is not near Home', () => {
    const away = [evidence({ id: 'away-1', capturedDay: '2026-03-04', latitude: 21.028, longitude: 105.854, reportedAccuracyMeters: 10 })];
    expect(hasCorroboratedHomeReturn(away, home, '2026-03-01', '2026-03-08')).toBe(false);
  });

  it('returns true when reliable evidence in the gap falls within an active Home area', () => {
    const atHome = [evidence({ id: 'home-visit', capturedDay: '2026-03-04', latitude: 10.776, longitude: 106.700, reportedAccuracyMeters: 10 })];
    expect(hasCorroboratedHomeReturn(atHome, home, '2026-03-01', '2026-03-08')).toBe(true);
  });

  it('ignores excluded evidence and evidence outside the open gap window', () => {
    const excludedAtHome = [evidence({ id: 'excluded-home', capturedDay: '2026-03-04', latitude: 10.776, longitude: 106.700, reportedAccuracyMeters: 10, excluded: true })];
    expect(hasCorroboratedHomeReturn(excludedAtHome, home, '2026-03-01', '2026-03-08')).toBe(false);
    const onBoundary = [evidence({ id: 'boundary-home', capturedDay: '2026-03-01', latitude: 10.776, longitude: 106.700, reportedAccuracyMeters: 10 })];
    expect(hasCorroboratedHomeReturn(onBoundary, home, '2026-03-01', '2026-03-08')).toBe(false);
  });
});
