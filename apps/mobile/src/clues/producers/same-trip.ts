/**
 * CAP-6's same-trip producer (clue-producers.md): "Pairs: two Possible
 * trips, or a Possible trip and an adjacent Atlas trip, within 10 days,
 * with no corroborated Home return between them." Of the spec's four
 * corroborating signals (same place clue, landmark-embedding similarity,
 * matching capture offset, matching camera), only "matching capture
 * offset" has a real producer today (CAP-4's capture-offset, built
 * alongside this one) — the others depend on unbuilt CAP-4 sub-producers
 * (sign/landmark readers) or data this app never captures (device make/
 * model). Honestly scoped to the one real signal rather than guessing at
 * the others; abstains (emits nothing) for a pair with no offset match.
 *
 * Pure and deterministic. The caller supplies each eligibility check's own
 * inputs (classification, timing, whether Home evidence corroborates a
 * return) — this module only decides pairing and emits the clue.
 */
import { applyOwnerConfiguredHomeAreas } from '../../reconstruction/engine-v1-1';
import type { ClueRecord } from '../types';
import type { OwnerConfiguredHomeArea, ReconstructionEvidence, ReconstructionGraph, TripDetectorEvidence, TripOutcomeClassification } from '../../reconstruction/types';

export const SAME_TRIP_PRODUCER_ID = 'same-trip-capture-offset';
export const SAME_TRIP_PRODUCER_VERSION = '1';

const MAX_GAP_DAYS = 10;
const ATLAS: ReadonlySet<TripOutcomeClassification> = new Set(['AUTO_CONFIRMED', 'USER_CONFIRMED']);
const POSSIBLE: ReadonlySet<TripOutcomeClassification> = new Set(['SUGGESTED', 'NOT_TRIP']);

export type SameTripJourney = {
  journeyId: string;
  classification: TripOutcomeClassification;
  /** This journey's own support keys (E:/F:), for the clue's subject. */
  evidenceKeys: readonly string[];
  /** A single stable support key (its earliest evidence) that survives a
   * journey id churning across rebuilds — `ClueSubject`'s own convention,
   * reused here to key the pair's clueId so re-emitting the same real pair
   * updates one row instead of ever-growing duplicates. */
  anchorKey: string;
  firstDay: string;
  lastDay: string;
  /** This journey's own representative capture-offset, or null when too
   * few of its photos carry one to trust (see `representativeOffsetMinutes`). */
  offsetMinutes: number | null;
};

export type SameTripPair = { a: SameTripJourney; b: SameTripJourney; gapDays: number };

function eligibleClassificationPair(a: TripOutcomeClassification, b: TripOutcomeClassification): boolean {
  if (POSSIBLE.has(a) && POSSIBLE.has(b)) return true;
  if (POSSIBLE.has(a) && ATLAS.has(b)) return true;
  if (ATLAS.has(a) && POSSIBLE.has(b)) return true;
  return false;
}

function dayGap(earlierLastDay: string, laterFirstDay: string): number {
  return Math.round((Date.parse(`${laterFirstDay}T00:00:00.000Z`) - Date.parse(`${earlierLastDay}T00:00:00.000Z`)) / 86_400_000);
}

/** The journey's own representative capture-offset: the most common value
 * among its photos' own `capture-offset` clues, or null when there are too
 * few to trust a single number (same mode-with-lowest-tiebreak convention
 * as `travel-window/window-detector.ts`'s `inferHomeOffsetMinutes`). */
export function representativeOffsetMinutes(offsets: readonly number[], minSamples = 2): number | null {
  if (offsets.length < minSamples) return null;
  const counts = new Map<number, number>();
  for (const offset of offsets) counts.set(offset, (counts.get(offset) ?? 0) + 1);
  let best: number | null = null;
  for (const [offset, count] of counts) {
    if (best === null || count > counts.get(best)! || (count === counts.get(best) && offset < best)) best = offset;
  }
  return best;
}

/** Every eligible pair: adjacent classification (never two Atlas trips,
 * never a rejected one), within `MAX_GAP_DAYS`, and the caller's own
 * no-Home-return check. `journeys` need not be pre-sorted. */
export function findSameTripCandidatePairs(
  journeys: readonly SameTripJourney[],
  noHomeReturnBetween: (earlier: SameTripJourney, later: SameTripJourney) => boolean,
): SameTripPair[] {
  const sorted = [...journeys].sort((left, right) => left.firstDay.localeCompare(right.firstDay) || left.journeyId.localeCompare(right.journeyId));
  const pairs: SameTripPair[] = [];
  for (let i = 0; i < sorted.length; i += 1) {
    const earlier = sorted[i];
    for (let j = i + 1; j < sorted.length; j += 1) {
      const later = sorted[j];
      if (later.firstDay < earlier.lastDay) continue; // overlapping: not an "adjacent" pair
      const gapDays = dayGap(earlier.lastDay, later.firstDay);
      if (gapDays > MAX_GAP_DAYS) break; // sorted by firstDay: every later candidate's gap only grows
      if (!eligibleClassificationPair(earlier.classification, later.classification)) continue;
      if (!noHomeReturnBetween(earlier, later)) continue;
      pairs.push({ a: earlier, b: later, gapDays });
    }
  }
  return pairs;
}

/** One `same-trip` clue per pair whose capture offsets agree — the one
 * corroborating signal this version has a real producer for. A pair with
 * no offset on either side, or disagreeing offsets, is left alone
 * entirely: eligibility alone is never enough to suggest a merge.
 * `clueId` is keyed by the pair's own stable anchors (never a journey id),
 * so re-emitting the same real pair across rebuilds updates one row. */
export function sameTripClues(pairs: readonly SameTripPair[], inputsRevision: ClueRecord['inputsRevision'], nowMillis: number): ClueRecord[] {
  const clues: ClueRecord[] = [];
  for (const pair of pairs) {
    if (pair.a.offsetMinutes === null || pair.b.offsetMinutes === null || pair.a.offsetMinutes !== pair.b.offsetMinutes) continue;
    const [first, second] = pair.a.anchorKey <= pair.b.anchorKey ? [pair.a, pair.b] : [pair.b, pair.a];
    clues.push({
      clueId: `${SAME_TRIP_PRODUCER_ID}:${first.anchorKey}:${second.anchorKey}`,
      kind: 'same-trip',
      subject: { evidenceKeys: [...first.evidenceKeys] },
      value: { pairedSubject: { evidenceKeys: [...second.evidenceKeys] } },
      strength: 'strong',
      independenceKey: SAME_TRIP_PRODUCER_ID,
      producerId: SAME_TRIP_PRODUCER_ID,
      producerVersion: SAME_TRIP_PRODUCER_VERSION,
      inputsRevision,
      state: 'active',
      createdAtMillis: nowMillis,
    });
  }
  return clues;
}

/** Assembles each journey's own `SameTripJourney` summary from the hand-
 * built graph `runCluePass` already loads — its own evidence (visit-support
 * *and* `memberships`, decision 0006's GPS-less/date-limited "memories",
 * the exact gap a prior code review found missing from the lowering-trip
 * gate), current classification, day range, and representative offset. A
 * journey with no reliable day or no stored classification at all is left
 * out entirely — fail closed, never guessed into a pairing. */
export function buildSameTripJourneys(
  graph: Pick<ReconstructionGraph, 'journeys' | 'visits' | 'memberships'>,
  evidenceById: ReadonlyMap<string, ReconstructionEvidence>,
  currentClassifications: ReadonlyMap<string, TripOutcomeClassification>,
  offsetByEvidenceId: ReadonlyMap<string, number>,
): SameTripJourney[] {
  const visitById = new Map(graph.visits.map((visit) => [visit.id, visit]));
  const result: SameTripJourney[] = [];
  for (const journey of graph.journeys) {
    const evidenceIds = new Set<string>();
    for (const visitId of journey.visitIds) { const visit = visitById.get(visitId); if (visit) for (const id of visit.evidenceIds) evidenceIds.add(id); }
    for (const membership of graph.memberships) if (membership.journeyId === journey.id) evidenceIds.add(membership.evidenceId);
    const items = [...evidenceIds].map((id) => evidenceById.get(id)).filter((item): item is ReconstructionEvidence => !!item && !item.excluded);
    if (!items.length) continue;
    const days = items.map((item) => item.capturedDay).filter((day): day is string => !!day).sort();
    const classification = currentClassifications.get(journey.id);
    if (!days.length || !classification) continue;
    const keys = [...new Set(items.map((item) => (item.duplicateFamilyId ? `F:${item.duplicateFamilyId}` : `E:${item.id}`)))].sort();
    const earliest = [...items].sort((a, b) => (a.capturedDay ?? '').localeCompare(b.capturedDay ?? '') || a.id.localeCompare(b.id))[0];
    const anchorKey = earliest.duplicateFamilyId ? `F:${earliest.duplicateFamilyId}` : `E:${earliest.id}`;
    const offsets = items.map((item) => offsetByEvidenceId.get(item.id)).filter((value): value is number => value !== undefined);
    result.push({ journeyId: journey.id, classification, evidenceKeys: keys, anchorKey, firstDay: days[0], lastDay: days[days.length - 1], offsetMinutes: representativeOffsetMinutes(offsets) });
  }
  return result;
}

/** The one eligibility check `findSameTripCandidatePairs` needs from its
 * caller: whether any reliable evidence captured strictly between the two
 * trips falls within an active configured Home area. Reuses the exact
 * Home-area semantics the main engine already applies to evidence
 * (`applyOwnerConfiguredHomeAreas`'s own `usualAreaContext`), never a new,
 * separately-maintained definition of "home." No evidence in the gap at
 * all is not a return — it is simply unobserved, still eligible. */
export function hasCorroboratedHomeReturn(
  evidence: readonly ReconstructionEvidence[], homeAreas: readonly OwnerConfiguredHomeArea[], afterDay: string, beforeDay: string,
): boolean {
  const inGap = evidence.filter((item) => !item.excluded && item.capturedDay !== null && item.capturedDay > afterDay && item.capturedDay < beforeDay);
  if (!inGap.length) return false;
  return applyOwnerConfiguredHomeAreas(inGap as TripDetectorEvidence[], [...homeAreas]).some((item) => item.usualAreaContext === true);
}
