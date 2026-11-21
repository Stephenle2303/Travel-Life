import { gateCandidateClues } from '@/clues/background-pass';
import type { ClueRecord } from '@/clues/types';
import { qualifyGraphJourneyV12 } from '@/reconstruction/outcome-v1-2';
import type { OwnerConfiguredHomeArea, ReconstructionGraph, TripDetectorEvidence, TripOutcomeClassification } from '@/reconstruction/types';

const HOME = { lat: 10.776, lon: 106.700 };
const forever: OwnerConfiguredHomeArea[] = [{ id: 'home-1', latitude: HOME.lat, longitude: HOME.lon, radiusMeters: 20_000, effectiveStartDay: null, effectiveEndDay: null }];
let seq = 0;
function unit(day: string, hour: number, lat: number, lon: number, overrides: Partial<TripDetectorEvidence> = {}): TripDetectorEvidence {
  seq += 1;
  return {
    id: `u${String(seq).padStart(4, '0')}`, capturedAtMillis: Date.parse(`${day}T${String(hour).padStart(2, '0')}:00:00Z`), capturedDay: day, hasPreciseOffset: false,
    latitude: lat, longitude: lon, reportedAccuracyMeters: 10, availability: 'available',
    duplicateFamilyId: null, duplicateConflict: false, supportEligible: true, excluded: false,
    mediaType: 'image', supportPlaceId: `place:${lat.toFixed(3)},${lon.toFixed(3)}`,
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
function graphFor(units: TripDetectorEvidence[]): ReconstructionGraph {
  const visit = { id: 'visit-1', placeId: 'place-1', evidenceIds: units.map((u) => u.id), order: 'ordered' as const };
  const journey = { id: 'journey-1', visitIds: [visit.id], state: 'inferred' as const };
  return { ruleVersion: 'reconstruction-v1', places: [{ id: 'place-1', memberIds: visit.evidenceIds, representativeId: units[0].id, uncertainty: [] }],
    visits: [visit], journeys: [journey], possibleMerges: [], dispositions: [], memberships: [] };
}
const mediaByEvidence = new Map<string, 'image' | 'video'>();
const noCorrections = new Set<string>();

beforeEach(() => { seq = 0; clueSeq = 0; });

describe('gateCandidateClues (CAP-3\'s "never silently lower an Atlas trip" gate)', () => {
  it('activates a clue directly when it would not change an AUTO_CONFIRMED journey\'s classification', () => {
    const units = outingUnits();
    const graph = graphFor(units);
    const baseline = qualifyGraphJourneyV12(graph, 'journey-1', units, mediaByEvidence, forever);
    expect(baseline.classification).toBe('AUTO_CONFIRMED');
    // Reclassify 2 of 12 as screenshots: 10 reliable remain, still >= the 5-photo floor.
    const candidate = clue({ kind: 'photo-source', value: { source: 'screenshot' }, subject: { evidenceKeys: [`E:${units[0].id}`] } });
    const result = gateCandidateClues({
      graph, evidence: units, mediaByEvidence, homeAreas: forever, existingClues: [], correctedKeys: noCorrections,
      currentClassifications: new Map<string, TripOutcomeClassification>([['journey-1', 'AUTO_CONFIRMED']]),
      candidateClues: [candidate],
    });
    expect(result.toActivate).toEqual([candidate]);
    expect(result.toReview).toHaveLength(0);
  });

  it('defers a clue to review when it would drop an AUTO_CONFIRMED journey below Atlas, instead of activating it', () => {
    const units = outingUnits();
    const graph = graphFor(units);
    const baseline = qualifyGraphJourneyV12(graph, 'journey-1', units, mediaByEvidence, forever);
    expect(baseline.classification).toBe('AUTO_CONFIRMED');
    // Reclassify 8 of 12 as screenshots: only 4 own-capture reliable photos remain, below the 5-photo floor.
    const candidates = units.slice(0, 8).map((item) => clue({ kind: 'photo-source', value: { source: 'screenshot' }, subject: { evidenceKeys: [`E:${item.id}`] } }));
    const result = gateCandidateClues({
      graph, evidence: units, mediaByEvidence, homeAreas: forever, existingClues: [], correctedKeys: noCorrections,
      currentClassifications: new Map<string, TripOutcomeClassification>([['journey-1', 'AUTO_CONFIRMED']]),
      candidateClues: candidates,
    });
    expect(result.toActivate).toHaveLength(0);
    expect(result.toReview).toHaveLength(8);
    for (const item of result.toReview) { expect(item.journeyId).toBe('journey-1'); expect(item.reason).toBe('would-lower-atlas-trip'); }
  });

  it('activates a clue on a SUGGESTED (non-Atlas) journey without any dry-run gating', () => {
    const units = Array.from({ length: 8 }, (_, i) => unit(`2025-10-0${1 + Math.floor(i / 2)}`, 9 + i, 0, 0, { latitude: null, longitude: null, supportPlaceId: null }));
    const graph = graphFor(units);
    const baseline = qualifyGraphJourneyV12(graph, 'journey-1', units, mediaByEvidence, forever);
    expect(baseline.classification).toBe('SUGGESTED');
    const candidate = clue({ kind: 'photo-source', value: { source: 'screenshot' }, subject: { evidenceKeys: [`E:${units[0].id}`] } });
    const result = gateCandidateClues({
      graph, evidence: units, mediaByEvidence, homeAreas: forever, existingClues: [], correctedKeys: noCorrections,
      currentClassifications: new Map<string, TripOutcomeClassification>([['journey-1', 'SUGGESTED']]),
      candidateClues: [candidate],
    });
    expect(result.toActivate).toEqual([candidate]);
    expect(result.toReview).toHaveLength(0);
  });

  it('activates a clue on evidence with no visit-support (unaffiliated with any journey)', () => {
    const units = outingUnits();
    const graph = graphFor(units);
    const candidate = clue({ kind: 'photo-source', value: { source: 'screenshot' }, subject: { evidenceKeys: ['E:unsupported-evidence'] } });
    const result = gateCandidateClues({
      graph, evidence: units, mediaByEvidence, homeAreas: forever, existingClues: [], correctedKeys: noCorrections,
      currentClassifications: new Map<string, TripOutcomeClassification>([['journey-1', 'AUTO_CONFIRMED']]),
      candidateClues: [candidate],
    });
    expect(result.toActivate).toEqual([candidate]);
    expect(result.toReview).toHaveLength(0);
  });

  it('gates a clue on membership-only evidence (no visit-support) the same as visit-supported evidence (closed 2026-11-21)', () => {
    const units = outingUnits();
    const memory = unit('2025-06-07', 23, outingPlaces[0].lat, outingPlaces[0].lon);
    const graph: ReconstructionGraph = { ...graphFor(units), memberships: [{ evidenceId: memory.id, journeyId: 'journey-1', state: 'inferred', reason: 'ordered-24-hour-bracket' }] };
    const allEvidence = [...units, memory];
    const baseline = qualifyGraphJourneyV12(graph, 'journey-1', allEvidence, mediaByEvidence, forever);
    expect(baseline.classification).toBe('AUTO_CONFIRMED');
    // A clue on the membership-only evidence alone would previously resolve
    // to no journey at all (journeyByEvidenceId only walked visit-support)
    // and silently auto-activate with zero gating, regardless of impact.
    const candidates = [...units.slice(0, 8), memory].map((item) => clue({ kind: 'photo-source', value: { source: 'screenshot' }, subject: { evidenceKeys: [`E:${item.id}`] } }));
    const result = gateCandidateClues({
      graph, evidence: allEvidence, mediaByEvidence, homeAreas: forever, existingClues: [], correctedKeys: noCorrections,
      currentClassifications: new Map<string, TripOutcomeClassification>([['journey-1', 'AUTO_CONFIRMED']]),
      candidateClues: candidates,
    });
    expect(result.toActivate).toHaveLength(0);
    expect(result.toReview).toHaveLength(9);
  });

  it('fails closed (gates, never silently activates) when a graph journey has no stored classification at all (closed 2026-11-21)', () => {
    const units = outingUnits();
    const graph = graphFor(units);
    // 8 of 12 reclassified: would drop the journey below the reliable-photo
    // floor, same scenario as the "defers to review" test above, but this
    // time currentClassifications has no entry for 'journey-1' at all.
    const candidates = units.slice(0, 8).map((item) => clue({ kind: 'photo-source', value: { source: 'screenshot' }, subject: { evidenceKeys: [`E:${item.id}`] } }));
    const result = gateCandidateClues({
      graph, evidence: units, mediaByEvidence, homeAreas: forever, existingClues: [], correctedKeys: noCorrections,
      currentClassifications: new Map<string, TripOutcomeClassification>(),
      candidateClues: candidates,
    });
    expect(result.toActivate).toHaveLength(0);
    expect(result.toReview).toHaveLength(8);
  });

  it('always defers a clue on protectedEvidenceIds to review, regardless of journey resolution (closed 2026-11-21)', () => {
    const units = outingUnits();
    const graph = graphFor(units);
    // Even a clue that would be trivially safe on its own resolved journey
    // (or unaffiliated with any reconstruction-engine journey at all) must
    // still defer when its evidence belongs to a confirmed trip family
    // (GPS-less/visual-place) this gate cannot verify.
    const candidate = clue({ kind: 'photo-source', value: { source: 'camera' }, subject: { evidenceKeys: [`E:${units[0].id}`] } });
    const result = gateCandidateClues({
      graph, evidence: units, mediaByEvidence, homeAreas: forever, existingClues: [], correctedKeys: noCorrections,
      currentClassifications: new Map<string, TripOutcomeClassification>([['journey-1', 'AUTO_CONFIRMED']]),
      protectedEvidenceIds: new Set([units[0].id]),
      candidateClues: [candidate],
    });
    expect(result.toActivate).toHaveLength(0);
    expect(result.toReview).toEqual([{ clue: candidate, journeyId: 'protected-confirmed-trip', reason: 'protected-confirmed-trip' }]);
  });
});
