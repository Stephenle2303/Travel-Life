/**
 * trip-detector-v1.2 (SPEC-trip-recognition-repair, decision 0021).
 *
 * Replaces V1.1's learned-base/score/profile selection with a clear outcome
 * rule: Home is only the owner's dated areas (H-1..H-5); an episode reaches
 * Atlas only with clear away evidence, else Possible trips with one closed
 * reason, else hidden with a closed (unshown) reason. See
 * _bmad-output/specs/spec-trip-recognition-repair/detector-v1-2.md.
 *
 * Deliberately does not build full 20 km macro-area destination grouping
 * (V1.1 §1's macro areas, detector-v1-2.md C-6); distance/corroboration use
 * per-unit and pairwise checks directly, which is sufficient for the outcome
 * decision. Macro-area destination grouping for display/membership remains
 * a smaller follow-up.
 *
 * Geometry/session primitives and the reason/diagnostic mapping now live in
 * outcome-geometry.ts/outcome-reasons.ts, shared with outcome-v1-3.ts
 * (decision 0023) so the two rule versions kept side by side for
 * benchmarking/rollback cannot drift on what those mean; only the gates in
 * this file are v1.2-specific.
 */
import type { FrequentPlaceContext, FrequentPlaceEpisodeMarker, OwnerConfiguredHomeArea, ReconstructionEvidence, ReconstructionGraph, TripDetectorEvidence, TripOutcome, TripOutcomeReasonCode } from './types';
import { TRIP_OUTCOME_RULE_VERSION } from './types';
import { effectiveConfiguredHomeDistanceV11 } from './engine-v1-1';
import {
  NON_CAPTURE_ORIGINS, RELIABLE_ACCURACY_METERS, hasTwoSeparatedPlaces, homeCoversAllDays,
  isWithinActiveHomeRadius, partitionSessions, photoUnitsOf, validLocation,
} from './outcome-geometry';
import { rebuildClassificationReasonCode as sharedRebuildClassificationReasonCode, summarizeOutcomeDelta as sharedSummarizeOutcomeDelta } from './outcome-reasons';
import type { OutcomeDeltaBucket, RebuildClassificationReasonCode } from './outcome-reasons';

export { TRIP_OUTCOME_RULE_VERSION };
// Re-exported for existing callers/tests (`@/reconstruction/outcome-v1-2`,
// `@/reconstruction/index`, `@/reconstruction/repository`); the geometry,
// session and reason-mapping logic itself now lives in outcome-geometry.ts/
// outcome-reasons.ts (see module doc above).
export { homeCoversAllDays, partitionSessions, NON_CAPTURE_ORIGINS };
export type { OutcomeDeltaBucket, RebuildClassificationReasonCode };
export const summarizeOutcomeDelta = sharedSummarizeOutcomeDelta;
export const rebuildClassificationReasonCode = sharedRebuildClassificationReasonCode;

const AWAY_METERS = 50_000;
const MIN_PHOTOS_FOR_OUTCOME = 2;
const MIN_PHOTOS_FOR_AUTO = 5;
const FREQUENT_PLACE_WINDOW_MILLIS = 90 * 24 * 60 * 60_000;
const FREQUENT_PLACE_MINIMUM_EPISODES = 8;

/** Built once per rebuild from every qualified episode's support places and
 * start time. A candidate excludes its own prior visits to the same place
 * by journey identity (`currentJourneyId`), not by comparing start times:
 * the marker for a journey is built from its full, unfiltered evidence
 * (`graphJourneyEpisodeMarkers`), while a candidate's own `candidateStart`
 * is computed from only its eligible, non-Home evidence inside
 * `qualifyTripOutcomeV12` — those two can legitimately differ for the same
 * journey, so a time-only self-exclusion could otherwise count a journey as
 * its own "prior" occurrence (or fail to exclude itself at all). */
export function buildFrequentPlaceContext(episodes: readonly FrequentPlaceEpisodeMarker[]): FrequentPlaceContext {
  const byPlace = new Map<string, FrequentPlaceEpisodeMarker[]>();
  for (const episode of episodes) {
    if (!episode.placeId || episode.startMillis === null || !Number.isFinite(episode.startMillis)) continue;
    const markers = byPlace.get(episode.placeId) ?? [];
    markers.push(episode);
    byPlace.set(episode.placeId, markers);
  }
  return new Map([...byPlace.entries()].map(([placeId, markers]) => [placeId, markers.slice().sort((a, b) => a.startMillis - b.startMillis)]));
}

function isFrequentPlace(placeIds: readonly string[], candidateStartMillis: number | null, context: FrequentPlaceContext | undefined, currentJourneyId: string | undefined) {
  if (!context || candidateStartMillis === null) return false;
  return placeIds.some((placeId) => {
    const markers = context.get(placeId);
    if (!markers) return false;
    const priorCount = markers.filter((marker) => marker.journeyId !== currentJourneyId
      && marker.startMillis < candidateStartMillis && candidateStartMillis - marker.startMillis <= FREQUENT_PLACE_WINDOW_MILLIS).length;
    return priorCount >= FREQUENT_PLACE_MINIMUM_EPISODES;
  });
}

export type TripOutcomeOptions = {
  homeAreas: readonly OwnerConfiguredHomeArea[];
  frequentPlaceContext?: FrequentPlaceContext;
  candidateStartMillis?: number | null;
  /** The journey this candidate's own entry (if any) was recorded under in
   * `frequentPlaceContext`, so it never counts as a "prior" visit to itself. */
  currentJourneyId?: string;
  ownerConfirmed?: boolean;
  rejected?: boolean;
  ownerVeto?: boolean;
};

/** Pure, deterministic outcome rule (CAP-3/CAP-4/CAP-5). No learned Home, no
 * score gate: an episode reaches Atlas only with clear, corroborated,
 * own-capture away evidence under an owner-set Home; otherwise it is a
 * Possible trip with one closed reason, or hidden with a closed, unshown one. */
export function qualifyTripOutcomeV12(evidence: readonly TripDetectorEvidence[], options: TripOutcomeOptions): TripOutcome {
  if (options.ownerConfirmed) return { classification: 'USER_CONFIRMED', reasons: [], diagnosticScore: 0, supportIds: [] };
  if (options.rejected) return { classification: 'REJECTED', reasons: [], diagnosticScore: 0, supportIds: [] };

  const homeAreas = options.homeAreas;
  const eligible = evidence.filter((item) => item.mediaType !== 'video' && item.supportEligible !== false
    && !item.timeConflict && !item.excluded && item.availability !== 'unavailable' && !item.duplicateConflict);
  const ownCapture = (item: TripDetectorEvidence) => !NON_CAPTURE_ORIGINS.has(item.sourceOrigin ?? '') && !NON_CAPTURE_ORIGINS.has(item.origin ?? '');
  const ownRows = eligible.filter(ownCapture);
  const nonCaptureOnly = eligible.length > 0 && ownRows.length === 0;

  const allPhotoUnits = photoUnitsOf(ownRows);
  const timeConflict = evidence.some((item) => item.timeConflict);
  const homeNotSet = !homeCoversAllDays(allPhotoUnits, homeAreas);
  // H-3 (classification scope only): a photo inside an active Home area is
  // never counted as this episode's trip support, even when V1's unchanged
  // visit/journey linking grouped it with away evidence in the same episode
  // (Findings F4/F5/F8). This keeps it out of `supportIds` and every gate
  // below, but the graph's own `visit-support` rows are untouched, so a
  // cover/album/title query that reads `graph.visits` directly (not this
  // function's `supportIds`) still sees it. Filtering it out of the graph
  // itself, at episode-building time, so every consumer agrees, remains open
  // — see consolidation.md.
  const photoUnits = allPhotoUnits.filter((item) => !isWithinActiveHomeRadius(item, homeAreas));
  const supportIds = photoUnits.map((item) => item.id).sort();
  const located = photoUnits.filter(validLocation);
  const reliable = located.filter((item) => item.reportedAccuracyMeters === null || item.reportedAccuracyMeters === undefined || item.reportedAccuracyMeters <= RELIABLE_ACCURACY_METERS);

  const awayDistances = reliable.map((item) => effectiveConfiguredHomeDistanceV11(item, homeAreas)).filter((distance): distance is number => distance !== null);
  const mainDistance = awayDistances.length ? Math.max(...awayDistances) : null;
  const farEnough = mainDistance !== null && mainDistance >= AWAY_METERS;

  const sessionById = partitionSessions(photoUnits);
  const sessionCount = new Set(sessionById.values()).size;
  const twoSeparatedPlaces = hasTwoSeparatedPlaces(photoUnits);
  const corroborated = sessionCount >= 2 || twoSeparatedPlaces;

  const placeIds = [...new Set(photoUnits.map((item) => item.supportPlaceId).filter((id): id is string => Boolean(id)))];
  const candidateStarts = photoUnits.map((item) => item.capturedAtMillis).filter((value): value is number => value !== null);
  const candidateStart = options.candidateStartMillis ?? (candidateStarts.length ? Math.min(...candidateStarts) : null);
  const frequent = isFrequentPlace(placeIds, candidateStart, options.frequentPlaceContext, options.currentJourneyId);

  // Too little away evidence to surface anything at all, regardless of distance.
  if (nonCaptureOnly) return { classification: 'NOT_TRIP', reasons: ['non-capture-source'], diagnosticScore: 0, supportIds: [] };
  if (photoUnits.length < MIN_PHOTOS_FOR_OUTCOME) return { classification: 'NOT_TRIP', reasons: ['no-away-evidence'], diagnosticScore: 0, supportIds };

  const reasons: TripOutcomeReasonCode[] = [];
  if (homeNotSet) reasons.push('home-not-set');
  if (timeConflict) reasons.push('time-conflict');
  if (located.length === 0) reasons.push('no-location');
  else if (reliable.length === 0) reasons.push('weak-location');
  // "Close to Home" is meaningless with no Home to be close to; that case is
  // already covered by `home-not-set`.
  else if (!farEnough && homeAreas.length > 0) reasons.push('near-home');
  if (frequent) reasons.push('frequent-place');
  if (reliable.length < MIN_PHOTOS_FOR_AUTO) reasons.push('few-photos');
  if (!corroborated) reasons.push('single-moment');
  if (options.ownerVeto) reasons.push('owner-veto');

  const diagnosticScore = Math.max(0, Math.min(100,
    (farEnough ? 30 : 0) + (mainDistance !== null && mainDistance >= 150_000 ? 10 : 0)
    + (sessionCount >= 2 ? 15 : 0) + (twoSeparatedPlaces ? 10 : 0) - (frequent ? 55 : 0)));

  const atlasEligible = !homeNotSet && !timeConflict && farEnough && reliable.length >= MIN_PHOTOS_FOR_AUTO
    && corroborated && !frequent && !options.ownerVeto;
  if (atlasEligible) return { classification: 'AUTO_CONFIRMED', reasons: [], diagnosticScore, supportIds };
  return { classification: 'SUGGESTED', reasons, diagnosticScore, supportIds };
}

/** One marker per distinct place a journey's visits touch (not only its
 * first visit — a frequent *second* stop on a recurring multi-stop trip must
 * still be able to trip the frequent-place gate), for
 * `buildFrequentPlaceContext`. Full 20 km macro-area grouping (C-6) is a
 * smaller follow-up; see outcome-v1-2.ts's module doc. */
export function graphJourneyEpisodeMarkers(graph: ReconstructionGraph, evidenceById: ReadonlyMap<string, ReconstructionEvidence>): FrequentPlaceEpisodeMarker[] {
  const visitById = new Map(graph.visits.map((visit) => [visit.id, visit]));
  const markers: FrequentPlaceEpisodeMarker[] = [];
  for (const journey of graph.journeys) {
    const visits = journey.visitIds.map((id) => visitById.get(id)).filter((visit): visit is NonNullable<typeof visit> => Boolean(visit));
    const starts = visits.flatMap((visit) => visit.evidenceIds)
      .map((id) => evidenceById.get(id)?.capturedAtMillis).filter((value): value is number => value !== null && value !== undefined);
    const startMillis = starts.length ? Math.min(...starts) : null;
    if (startMillis === null) continue;
    for (const placeId of new Set(visits.map((visit) => visit.placeId))) markers.push({ journeyId: journey.id, placeId, startMillis });
  }
  return markers;
}

/** Prebuilt lookups for one rebuild, shared by every journey's qualification
 * call so each call is O(its own evidence), not O(the whole library). */
export type V12CandidateLookups = { visitById: ReadonlyMap<string, ReconstructionGraph['visits'][number]>; evidenceById: ReadonlyMap<string, ReconstructionEvidence> };
export function buildV12CandidateLookups(graph: ReconstructionGraph, evidence: readonly ReconstructionEvidence[]): V12CandidateLookups {
  return { visitById: new Map(graph.visits.map((visit) => [visit.id, visit])), evidenceById: new Map(evidence.map((item) => [item.id, item])) };
}

/** Builds a `TripDetectorEvidence[]` for one journey's candidate support,
 * without V1.1's learned-base fields and without overriding `sourceOrigin`/
 * `origin` (the V1.1 mapper hardcodes `captureLike: true, origin:
 * 'capture-like'` regardless of provenance — Finding F11). Pass `lookups`
 * (from `buildV12CandidateLookups`, built once per rebuild) to avoid
 * rebuilding the whole library's maps on every journey; omitting it rebuilds
 * them locally for a single call (fine for tests, O(library) per call in a
 * loop). Shared as-is by outcome-v1-3.ts: this builds candidate evidence
 * from the graph, not an outcome gate, so it has no version-specific
 * behavior to fork. */
export function buildV12CandidateEvidence(graph: ReconstructionGraph, journeyId: string, evidence: readonly ReconstructionEvidence[], mediaByEvidence: ReadonlyMap<string, 'image' | 'video'>, lookups?: V12CandidateLookups): TripDetectorEvidence[] {
  const journey = graph.journeys.find((candidate) => candidate.id === journeyId);
  if (!journey) throw new Error('Unknown reconstructed journey.');
  const { visitById, evidenceById } = lookups ?? buildV12CandidateLookups(graph, evidence);
  const candidateVisits = journey.visitIds.map((id) => visitById.get(id)).filter((visit): visit is NonNullable<typeof visit> => Boolean(visit));
  // One pass building evidenceId -> placeId, not a nested find/includes scan
  // per candidate id (that was O((visits x evidence-per-visit)^2) per journey).
  const placeIdByEvidence = new Map<string, string>();
  for (const visit of candidateVisits) for (const id of visit.evidenceIds) if (!placeIdByEvidence.has(id)) placeIdByEvidence.set(id, visit.placeId);
  return [...placeIdByEvidence.keys()].map((id) => evidenceById.get(id)).filter((item): item is ReconstructionEvidence => Boolean(item)).map((item) => ({
    ...item, mediaType: mediaByEvidence.get(item.id) ?? 'image', supportPlaceId: placeIdByEvidence.get(item.id) ?? null,
  }));
}

/** Production entry point (CAP-2/CAP-7): one function, callable from the
 * same site that used to call `qualifyGraphJourneyV11`. Pass `lookups` and
 * `currentJourneyId` from the rebuild loop; both are optional so existing
 * callers (and tests) keep working unchanged. */
export function qualifyGraphJourneyV12(graph: ReconstructionGraph, journeyId: string, evidence: readonly ReconstructionEvidence[], mediaByEvidence: ReadonlyMap<string, 'image' | 'video'>, homeAreas: readonly OwnerConfiguredHomeArea[], frequentPlaceContext?: FrequentPlaceContext, lookups?: V12CandidateLookups): TripOutcome {
  const candidateEvidence = buildV12CandidateEvidence(graph, journeyId, evidence, mediaByEvidence, lookups);
  return qualifyTripOutcomeV12(candidateEvidence, { homeAreas, frequentPlaceContext, currentJourneyId: journeyId });
}
