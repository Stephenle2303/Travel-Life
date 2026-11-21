/**
 * CAP-3's core gate (background-and-surfacing.md): "never removes or
 * lowers an Atlas trip by itself ... a change that would lower an Atlas
 * trip creates a review card instead." Pure and deterministic — no DB
 * access, no producer calls. The caller (`reconstruction/repository.ts`)
 * loads the graph/evidence/clues, calls a producer, then calls this to
 * decide which freshly computed clues are safe to activate immediately
 * and which must wait for owner review.
 */
import { qualifyGraphJourneyWithClues } from './consumption';
import type { ClueRecord } from './types';
import type { FrequentPlaceContext, OwnerConfiguredHomeArea, ReconstructionEvidence, ReconstructionGraph, TripOutcomeClassification } from '../reconstruction/types';
import type { V12CandidateLookups } from '../reconstruction/outcome-v1-2';

const ATLAS_CLASSIFICATIONS = new Set<TripOutcomeClassification>(['AUTO_CONFIRMED', 'USER_CONFIRMED']);

/** Every raw evidence id a clue's subject names, resolving an `F:` family
 * key back to its current members (a family can gain/lose members across
 * rebuilds; this uses the graph's own current evidence snapshot, never a
 * stale membership). */
function subjectEvidenceIds(subjectKey: string, evidence: readonly ReconstructionEvidence[]): string[] {
  if (subjectKey.startsWith('E:')) return [subjectKey.slice(2)];
  if (subjectKey.startsWith('F:')) {
    const familyId = subjectKey.slice(2);
    return evidence.filter((item) => item.duplicateFamilyId === familyId).map((item) => item.id);
  }
  return [];
}

/** evidenceId -> journeyId, via `journey.visitIds -> visit.evidenceIds`
 * (visit-support) *and* `graph.memberships` (decision 0006: a GPS-less or
 * date-limited "memory" is attached to a journey directly, without a visit
 * in between — a separate relation from visit-support, but evidence that
 * still shows on that journey's Atlas card and so must affect gating the
 * same way). Found missing in the first draft by code review (2026-11-21):
 * a clue on membership-only evidence resolved to no journey at all and
 * silently bypassed the gate. An evidence id with neither affects no
 * journey and is always safe to activate. */
function journeyByEvidenceId(graph: ReconstructionGraph): ReadonlyMap<string, string> {
  const visitById = new Map(graph.visits.map((visit) => [visit.id, visit]));
  const byEvidenceId = new Map<string, string>();
  for (const journey of graph.journeys) for (const visitId of journey.visitIds) {
    const visit = visitById.get(visitId);
    if (!visit) continue;
    for (const evidenceId of visit.evidenceIds) if (!byEvidenceId.has(evidenceId)) byEvidenceId.set(evidenceId, journey.id);
  }
  for (const membership of graph.memberships) if (!byEvidenceId.has(membership.evidenceId)) byEvidenceId.set(membership.evidenceId, membership.journeyId);
  return byEvidenceId;
}

export type CluePassInput = {
  graph: ReconstructionGraph;
  evidence: readonly ReconstructionEvidence[];
  mediaByEvidence: ReadonlyMap<string, 'image' | 'video'>;
  homeAreas: readonly OwnerConfiguredHomeArea[];
  /** Every currently stored clue (any state); `qualifyGraphJourneyWithClues`
   * itself filters to active/uncorrected. */
  existingClues: readonly ClueRecord[];
  correctedKeys: ReadonlySet<string>;
  /** The journey's classification as currently stored, before this pass —
   * the "before" side of the "never lowers an Atlas trip" comparison. A
   * journey present in `graph.journeys` with no entry here is treated as
   * Atlas (fail closed), never as safe-by-omission. */
  currentClassifications: ReadonlyMap<string, TripOutcomeClassification>;
  /** Evidence belonging to a confirmed trip this gate cannot verify through
   * `graph`/`currentClassifications` at all — e.g. a GPS-less
   * (`travel_window_trip`) or visual-place (`visual_place_trip`) confirmed
   * album, which the owner sees as settled on Atlas but which lives outside
   * `reconstruction_journey`/`reconstruction_trip_qualification` entirely.
   * Any clue touching one of these ids always goes to review: this gate
   * has no way to dry-run those trip types' own classification, so it
   * cannot certify a clue on their evidence is safe. */
  protectedEvidenceIds?: ReadonlySet<string>;
  /** Freshly computed, not yet persisted; assumed `state: 'active'` already
   * (the producer's own output) — this function decides whether that is
   * safe, it does not mutate the records. */
  candidateClues: readonly ClueRecord[];
  frequentPlaceContext?: FrequentPlaceContext;
  lookups?: V12CandidateLookups;
};

export type CluePassReviewItem = { clue: ClueRecord; journeyId: string; reason: string };
export type CluePassResult = { toActivate: ClueRecord[]; toReview: CluePassReviewItem[] };

/** Partitions `candidateClues` into safe-to-activate and needs-review.
 * Clues touching the same Atlas journey are gated *together*, as the pass
 * would actually apply them in one rebuild — evaluating each alone against
 * only `existingClues` would miss a drop caused by several of this pass's
 * own clues combining (e.g. 8 of this pass's own screenshot clues on one
 * journey, none individually enough to matter, together enough to drop it
 * below the reliable-photo floor). A clue touching more than one journey is
 * held for review if *any* affected journey would drop off Atlas —
 * conservative by design, since a partially-safe clue is still a clue the
 * owner has not seen lower a trip they were shown as confirmed. */
export function gateCandidateClues(input: CluePassInput): CluePassResult {
  const { graph, evidence, mediaByEvidence, homeAreas, existingClues, correctedKeys, currentClassifications, protectedEvidenceIds, candidateClues, frequentPlaceContext, lookups } = input;
  const journeyByEvidence = journeyByEvidenceId(graph);

  const toActivate: ClueRecord[] = [];
  const toReview: CluePassReviewItem[] = [];
  const gatableClues: ClueRecord[] = [];
  const affectedJourneysByClue = new Map<ClueRecord, Set<string>>();
  const cluesByAtlasJourney = new Map<string, ClueRecord[]>();
  for (const clue of candidateClues) {
    const subjectEvidence = clue.subject.evidenceKeys.flatMap((key) => subjectEvidenceIds(key, evidence));
    if (protectedEvidenceIds && subjectEvidence.some((id) => protectedEvidenceIds.has(id))) {
      // Not a reconstruction-engine journey id — this clue's evidence
      // belongs to a confirmed trip family (GPS-less/visual-place) this
      // gate cannot resolve to one. `journeyId` here names the condition,
      // not a journey, for the review card's own record.
      toReview.push({ clue, journeyId: 'protected-confirmed-trip', reason: 'protected-confirmed-trip' });
      continue;
    }
    gatableClues.push(clue);
    const affected = new Set<string>();
    for (const evidenceId of subjectEvidence) {
      const journeyId = journeyByEvidence.get(evidenceId);
      if (journeyId) affected.add(journeyId);
    }
    affectedJourneysByClue.set(clue, affected);
    for (const journeyId of affected) {
      // A journey present in the graph with no classification row at all is
      // treated as Atlas (fail closed) — never as safe by omission. In
      // today's reconstruction-engine journeys this should not happen (every
      // journey gets a qualification row in the same rebuild that creates
      // it); this default only matters if that ever stops being true.
      const classification = currentClassifications.get(journeyId);
      const knownNotAtlas = classification !== undefined && !ATLAS_CLASSIFICATIONS.has(classification);
      if (knownNotAtlas) continue;
      const list = cluesByAtlasJourney.get(journeyId) ?? [];
      list.push(clue);
      cluesByAtlasJourney.set(journeyId, list);
    }
  }

  const unsafeJourneyIds = new Set<string>();
  for (const [journeyId, journeyClues] of cluesByAtlasJourney) {
    const dryRun = qualifyGraphJourneyWithClues(graph, journeyId, evidence, mediaByEvidence, homeAreas, [...existingClues, ...journeyClues], correctedKeys, frequentPlaceContext, lookups);
    if (!ATLAS_CLASSIFICATIONS.has(dryRun.classification)) unsafeJourneyIds.add(journeyId);
  }

  for (const clue of gatableClues) {
    const affected = [...(affectedJourneysByClue.get(clue) ?? [])];
    const unsafeJourneyId = affected.find((journeyId) => unsafeJourneyIds.has(journeyId));
    if (unsafeJourneyId) toReview.push({ clue, journeyId: unsafeJourneyId, reason: 'would-lower-atlas-trip' });
    else toActivate.push(clue);
  }
  return { toActivate, toReview };
}
