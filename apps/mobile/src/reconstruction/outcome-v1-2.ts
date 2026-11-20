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
 */
import type { FrequentPlaceContext, FrequentPlaceEpisodeMarker, OwnerConfiguredHomeArea, ReconstructionEvidence, ReconstructionGraph, TripDetectorEvidence, TripOutcome, TripOutcomeReasonCode } from './types';
import { TRIP_OUTCOME_RULE_VERSION } from './types';
import { effectiveConfiguredHomeDistanceV11 } from './engine-v1-1';

const NON_CAPTURE_ORIGINS = new Set(['screenshot', 'download', 'unknown']);

export { TRIP_OUTCOME_RULE_VERSION };

const EARTH_RADIUS_METERS = 6_371_000;
const AWAY_METERS = 50_000;
const RELIABLE_ACCURACY_METERS = 1_000;
const MIN_PHOTOS_FOR_OUTCOME = 2;
const MIN_PHOTOS_FOR_AUTO = 5;
const SESSION_GAP_MILLIS = 60 * 60_000;
const SESSION_SPAN_MILLIS = 4 * 60 * 60_000;
const SESSION_DISPLACEMENT_METERS = 1_000;
const PLACE_SEPARATION_METERS = 1_000;
const DEFAULT_HOME_RADIUS_METERS = 20_000;
const FREQUENT_PLACE_WINDOW_MILLIS = 90 * 24 * 60 * 60_000;
const FREQUENT_PLACE_MINIMUM_EPISODES = 8;

function haversineMeters(aLat: number, aLon: number, bLat: number, bLon: number) {
  const radians = Math.PI / 180;
  const latDelta = (bLat - aLat) * radians;
  const lonDelta = ((((bLon - aLon) + 540) % 360) - 180) * radians;
  const h = Math.sin(latDelta / 2) ** 2 + Math.cos(aLat * radians) * Math.cos(bLat * radians) * Math.sin(lonDelta / 2) ** 2;
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function validDay(day: string | null | undefined): day is string {
  if (!day || !/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(day)) return false;
  const parsed = new Date(`${day}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === day;
}

function isHomeActiveOnDay(area: OwnerConfiguredHomeArea, day: string | null) {
  return validDay(day) && (!area.effectiveStartDay || day >= area.effectiveStartDay) && (!area.effectiveEndDay || day <= area.effectiveEndDay);
}

function validLocation(item: { latitude: number | null; longitude: number | null }) {
  return item.latitude !== null && Number.isFinite(item.latitude) && Math.abs(item.latitude) <= 90
    && item.longitude !== null && Number.isFinite(item.longitude) && Math.abs(item.longitude) <= 180;
}

/** Every distinct original/civil day in `units` has at least one Home area
 * active on it. An owner with no Home at all never covers anything (H-4).
 * Units with no valid day at all are conservatively uncovered too: a day
 * that cannot be checked must never be treated as covered by omission
 * (`Array.prototype.every` on an empty set would otherwise vacuously say
 * yes with zero days actually verified). */
export function homeCoversAllDays(units: readonly Pick<TripDetectorEvidence, 'capturedDay'>[], homeAreas: readonly OwnerConfiguredHomeArea[]) {
  if (!homeAreas.length || !units.length) return false;
  const days = new Set(units.map((item) => item.capturedDay).filter(validDay));
  if (!days.size) return false;
  return [...days].every((day) => homeAreas.some((area) => isHomeActiveOnDay(area, day)));
}

function isWithinActiveHomeRadius(item: TripDetectorEvidence, homeAreas: readonly OwnerConfiguredHomeArea[]) {
  if (!validLocation(item)) return false;
  return homeAreas.some((area) => isHomeActiveOnDay(area, item.capturedDay)
    && haversineMeters(item.latitude!, item.longitude!, area.latitude, area.longitude) <= (area.radiusMeters ?? DEFAULT_HOME_RADIUS_METERS));
}

/** V1.1 §1 sessions, simplified to one pass: unordered day/place buckets for
 * evidence without a trusted instant, elapsed-gap/displacement/span splitting
 * for evidence that has one. Returns a session id per evidence id. */
export function partitionSessions(units: readonly TripDetectorEvidence[]): ReadonlyMap<string, string> {
  const sessionById = new Map<string, string>();
  const dayOnly = units.filter((item) => !item.hasPreciseOffset || item.capturedAtMillis === null);
  for (const item of dayOnly) {
    const key = `day:${item.capturedDay ?? 'unknown'}:${item.supportPlaceId ?? item.id}`;
    sessionById.set(item.id, key);
  }
  const trusted = [...units.filter((item) => item.hasPreciseOffset && item.capturedAtMillis !== null)]
    .sort((a, b) => a.capturedAtMillis! - b.capturedAtMillis! || a.id.localeCompare(b.id));
  let session: TripDetectorEvidence[] = [];
  let sessionIndex = 0;
  for (const item of trusted) {
    const prior = session.at(-1);
    const first = session[0];
    const gap = prior ? item.capturedAtMillis! - prior.capturedAtMillis! : 0;
    const span = first ? item.capturedAtMillis! - first.capturedAtMillis! : 0;
    const displaced = prior && validLocation(prior) && validLocation(item)
      ? haversineMeters(prior.latitude!, prior.longitude!, item.latitude!, item.longitude!) > SESSION_DISPLACEMENT_METERS : false;
    if (prior && (gap > SESSION_GAP_MILLIS || span > SESSION_SPAN_MILLIS || displaced)) { sessionIndex += 1; session = []; }
    session.push(item);
    sessionById.set(item.id, `trusted:${sessionIndex}`);
  }
  return sessionById;
}

/** V1.1 §1's "two corroborated places" check needs >=1 km separation, finer
 * than reconstruction-v1's own 5 km place clustering (decision 0021 keeps
 * that clustering unchanged). Two points 3 km apart already share one
 * `supportPlaceId`, so this checks raw coordinates directly rather than
 * distinct place ids (found by the M10.1/M10.3 benchmark, 2026-11-19). */
function hasTwoSeparatedPlaces(units: readonly TripDetectorEvidence[]) {
  const located = units.filter(validLocation);
  for (let left = 0; left < located.length; left += 1) for (let right = left + 1; right < located.length; right += 1) {
    if (haversineMeters(located[left].latitude!, located[left].longitude!, located[right].latitude!, located[right].longitude!) >= PLACE_SEPARATION_METERS) return true;
  }
  return false;
}

/** One independent capture unit per verified duplicate family; deterministic,
 * never claims which member was the original (same rule as V1.1, and the
 * same tie-break: ascending sort then last-write-wins, so the highest id in
 * a family is the representative in both versions — V1.1's own `photoUnits`
 * builds a `Map` from an ascending-sorted array the same way, so the two
 * versions pick the same family representative for the same evidence). */
function photoUnitsOf(evidence: readonly TripDetectorEvidence[]) {
  const byUnit = new Map<string, TripDetectorEvidence>();
  for (const item of [...evidence].sort((a, b) => a.id.localeCompare(b.id))) {
    const key = item.duplicateFamilyId ? `family:${item.duplicateFamilyId}` : `unit:${item.id}`;
    byUnit.set(key, item);
  }
  return [...byUnit.values()];
}

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
 * loop). */
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

export type OutcomeDeltaBucket = 'gained' | 'lost' | 'changed' | 'unchanged';
/** CAP-8's dry run: a pure, owner-readable aggregate of what a policy change
 * would do to every journey's visible classification, keyed by journey id
 * so it survives journey-id churn across a rebuild only if the caller keeps
 * a stable key; production should key by exact support signature instead. */
export function summarizeOutcomeDelta(before: ReadonlyMap<string, string>, after: ReadonlyMap<string, string>) {
  const shown = (classification: string | undefined) => classification === 'AUTO_CONFIRMED' || classification === 'USER_CONFIRMED';
  const buckets: Record<OutcomeDeltaBucket, string[]> = { gained: [], lost: [], changed: [], unchanged: [] };
  const keys = new Set([...before.keys(), ...after.keys()]);
  for (const key of keys) {
    const priorClass = before.get(key);
    const nextClass = after.get(key);
    const priorShown = shown(priorClass);
    const nextShown = shown(nextClass);
    if (!priorShown && nextShown) buckets.gained.push(key);
    else if (priorShown && !nextShown) buckets.lost.push(key);
    else if (priorClass !== undefined && nextClass !== undefined && priorClass !== nextClass) buckets.changed.push(key);
    else buckets.unchanged.push(key);
  }
  return {
    gainedCount: buckets.gained.length, lostCount: buckets.lost.length,
    changedCount: buckets.changed.length, unchangedCount: buckets.unchanged.length,
    gained: buckets.gained.sort(), lost: buckets.lost.sort(), changed: buckets.changed.sort(),
  };
}
