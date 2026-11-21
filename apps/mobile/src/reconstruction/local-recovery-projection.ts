import { recoveryTripPolicy, type CandidateTrip, type CandidateTripProjection } from './candidate-projection';
import { applyStructuralBoundaries } from './canonical-core';
import type { projectCanonicalHistory } from './canonical-projection';
import { qualifyGraphJourneyWithClues } from '../clues/consumption';
import type { ClueRecord } from '../clues/types';
import type { JourneyDraft, JourneyMembership, ReconstructionGraph, TripDetectorEvidence } from './types';

export const LOCAL_RECOVERY_PROJECTION_VERSION = 'atlas-recovery-local-v1';

type CanonicalProjection = Awaited<ReturnType<typeof projectCanonicalHistory>>;
type LocalRecoveryPair = { leftJourneyId: string; rightJourneyId: string; replacedJourneyId: string | null };

type LocalRecoveryInput = {
  baseline: CanonicalProjection;
  candidate: CandidateTripProjection;
  mediaByEvidence: Map<string, 'image' | 'video'>;
  protectedJourneyIds: ReadonlySet<string>;
  withheldEvidence: ReadonlySet<string>;
  /** CAP-2/M11.1 (found by the 2026-11-20 code review): defaults to zero
   * clues, so a caller that never passes these keeps today's exact behavior. */
  clues?: readonly ClueRecord[];
  correctedKeys?: ReadonlySet<string>;
};

/** In-memory Local experiment. Its caller owns source, generation and Replay authority. */
export function projectLocalRecoveryGraph({ baseline, candidate, mediaByEvidence, protectedJourneyIds, withheldEvidence, clues = [], correctedKeys = new Set() }: LocalRecoveryInput) {
  const { graph } = baseline;
  const pairs: LocalRecoveryPair[] = [];
  const result = { policyVersion: LOCAL_RECOVERY_PROJECTION_VERSION, graph, pairs };
  if (candidate.policyVersion !== recoveryTripPolicy.version || !candidate.mergeSuggestions.length || baseline.pendingFinalRemaps.length) return result;

  const protectedIds = new Set([...protectedJourneyIds, ...baseline.finalMatches.values(), ...baseline.memoryMatches.values()]);
  const usedJourneys = new Set(graph.possibleMerges.flatMap(({ fromJourneyId, toJourneyId }) => [fromJourneyId, toJourneyId]));
  const allJourneyIds = new Set(graph.journeys.map(({ id }) => id));
  const boundaryRows: TripDetectorEvidence[] = applyStructuralBoundaries(baseline.evidence, baseline.corrections, baseline.families);
  const boundaryEvidence = new Set(boundaryRows.filter(({ ownerBoundaryAfter, timeConflict, excluded }) =>
    ownerBoundaryAfter || timeConflict || excluded).map(({ id }) => id));
  const familyKey = (id: string) => baseline.families.keyForEvidence(id);
  const withheldFamilies = new Set([...withheldEvidence].map(familyKey));
  const visits = new Map(graph.visits.map((visit) => [visit.id, visit]));
  const owners = new Map<string, JourneyDraft | null>();
  for (const journey of graph.journeys) for (const id of journey.visitIds) owners.set(id, owners.has(id) ? null : journey);
  const memberships = new Map<string, JourneyMembership[]>();
  for (const membership of graph.memberships) {
    const group = memberships.get(membership.journeyId);
    if (group) group.push(membership);
    else memberships.set(membership.journeyId, [membership]);
  }

  const exactSide = (trip: CandidateTrip) => {
    const journey = owners.get(trip.visitIds[0]);
    if (trip.state !== 'reliable' || !journey || protectedIds.has(journey.id) || usedJourneys.has(journey.id)) return null;
    const visitIds = new Set(trip.visitIds);
    if (visitIds.size !== trip.visitIds.length || trip.visitIds.some((id) => owners.get(id) !== journey || !visits.has(id))) return null;
    const support = new Set(trip.visitIds.flatMap((id) => visits.get(id)!.evidenceIds));
    const families = new Set([...support].map(familyKey));
    if (!support.size || new Set(trip.supportIds).size !== support.size
      || trip.supportIds.some((id) => !support.has(id) || boundaryEvidence.has(id))
      || [...families].some((key) => withheldFamilies.has(key))) return null;
    return { journey, visitIds, support, families };
  };
  // v1.2 (decision 0021): agree with the Atlas surface on "reliable", not
  // the retired v1.1 score/learned-base path. Clue-aware (CAP-2/M11.1).
  const confirmed = (source: ReconstructionGraph, id: string) =>
    qualifyGraphJourneyWithClues(source, id, baseline.evidence, mediaByEvidence, baseline.homeAreas, clues, correctedKeys).classification === 'AUTO_CONFIRMED';
  const replacements = new Map<string, { journeys: JourneyDraft[]; leftSupport: ReadonlySet<string> }>();

  for (const pair of candidate.mergeSuggestions) {
    const left = exactSide(pair.left);
    const right = exactSide(pair.right);
    if (!left || !right || [...left.families].some((key) => right.families.has(key))) continue;

    if (left.journey !== right.journey) {
      if (left.visitIds.size !== left.journey.visitIds.length || right.visitIds.size !== right.journey.visitIds.length
        || !confirmed(graph, left.journey.id) || !confirmed(graph, right.journey.id)) continue;
      pairs.push({ leftJourneyId: left.journey.id, rightJourneyId: right.journey.id, replacedJourneyId: null });
      usedJourneys.add(left.journey.id);
      usedJourneys.add(right.journey.id);
      continue;
    }

    const parent = left.journey;
    if (left.visitIds.size + right.visitIds.size !== parent.visitIds.length
      || [...left.visitIds].some((id) => right.visitIds.has(id)) || !confirmed(graph, parent.id)) continue;
    // Album-only media cannot be assigned to a side without independent
    // authority. Preserve the entire prior grouping when any mapping is ambiguous.
    if ((memberships.get(parent.id) ?? []).some(({ evidenceId, state }) =>
      state === 'owner' || withheldEvidence.has(evidenceId) || (!left.support.has(evidenceId) && !right.support.has(evidenceId)))) continue;
    const child = (visitIds: ReadonlySet<string>): JourneyDraft => {
      const ordered = parent.visitIds.filter((id) => visitIds.has(id));
      return { id: `journey:v1-1:${[...ordered].sort((a, b) => a.localeCompare(b)).join('|')}`, visitIds: ordered, state: 'inferred' };
    };
    const leftChild = child(left.visitIds);
    const rightChild = child(right.visitIds);
    if (allJourneyIds.has(leftChild.id) || allJourneyIds.has(rightChild.id) || leftChild.id === rightChild.id) continue;
    const children = [leftChild, rightChild];
    const trial = { ...graph, journeys: children };
    if (!confirmed(trial, leftChild.id) || !confirmed(trial, rightChild.id)) continue;
    replacements.set(parent.id, { journeys: children, leftSupport: left.support });
    pairs.push({ leftJourneyId: leftChild.id, rightJourneyId: rightChild.id, replacedJourneyId: parent.id });
    usedJourneys.add(parent.id);
    allJourneyIds.add(leftChild.id);
    allJourneyIds.add(rightChild.id);
  }

  if (!pairs.length) return result;
  return { ...result, graph: {
    ...graph,
    journeys: graph.journeys.flatMap((journey) => replacements.get(journey.id)?.journeys ?? [journey]).sort((a, b) => a.id.localeCompare(b.id)),
    memberships: graph.memberships.map((membership) => {
      const replacement = replacements.get(membership.journeyId);
      if (!replacement) return membership;
      const child = replacement.journeys[replacement.leftSupport.has(membership.evidenceId) ? 0 : 1];
      return { ...membership, journeyId: child.id };
    }),
    possibleMerges: [...graph.possibleMerges, ...pairs.map(({ leftJourneyId, rightJourneyId }) =>
      ({ fromJourneyId: leftJourneyId, toJourneyId: rightJourneyId, reason: 'adjacent-gap' as const }))],
  } };
}
