/**
 * trip-detector-v1.3 (SPEC-trip-recognition-repair, decision 0023).
 *
 * Inverts v1.2's funnel: Hidden is the default outcome, not Possible trips.
 * One owner-sized Home zone (a free per-Home radius; no separate "away"
 * distance or "near Home" band) — an episode reaches Atlas only with
 * clear, corroborated, own-capture evidence under an owner-set Home; a
 * Possible trip now needs positive evidence of its own (an overnight stay,
 * two independent sessions/places, or enough reliable photos) or an
 * owner-fixable gap (Home not set for these dates, a time conflict).
 * Frequent places no longer block Atlas. See
 * _bmad-output/specs/spec-trip-recognition-repair/detector-v1-3.md.
 *
 * Benchmarked candidate only — M10.12 adopts this as the active rule only
 * after the Hidden outings card ships (M10.11) and an owner-reviewed
 * device dry run; `qualifyGraphJourneyWithClues` still calls v1.2
 * (outcome-v1-2.ts) today.
 *
 * Shares every geometry/session primitive with outcome-v1-2.ts via
 * outcome-geometry.ts so "inside Home", "corroborated" and "one
 * independent photo unit" cannot drift between the two rule versions —
 * only the gates below are v1.3-specific.
 */
import type { OwnerConfiguredHomeArea, TripDetectorEvidence, TripOutcome, TripOutcomeReasonCode } from './types';
import { TRIP_OUTCOME_RULE_VERSION_V13 } from './types';
import {
  NON_CAPTURE_ORIGINS, RELIABLE_ACCURACY_METERS, hasTwoSeparatedPlaces, homeCoversAllDays,
  isWithinActiveHomeRadius, partitionSessions, photoUnitsOf, validDay, validLocation,
} from './outcome-geometry';

export { TRIP_OUTCOME_RULE_VERSION_V13 };

const MIN_PHOTOS_FOR_OUTCOME = 2;
const MIN_PHOTOS_FOR_AUTO = 5;
const MIN_RELIABLE_FOR_STRONG_SIGNAL = 5;
const MIN_CONSECUTIVE_DAYS = 2;
const ONE_DAY_MILLIS = 86_400_000;

export type TripOutcomeOptionsV13 = {
  homeAreas: readonly OwnerConfiguredHomeArea[];
  ownerConfirmed?: boolean;
  rejected?: boolean;
  ownerVeto?: boolean;
};

/** `true` when any single civil day in `units` touches 2+ distinct support
 * places — a same-day multi-stop signal independent of raw distance
 * (reconstruction-v1's place ids are already clustered, so 2 distinct ids
 * is meaningful even under the geometric 1 km `hasTwoSeparatedPlaces`
 * floor). Deliberately scoped to one calendar day: unlike
 * `partitionSessions`' day-only bucket key (which embeds the day and so
 * trivially yields one "session" per distinct day regardless of place),
 * this must not fire just because an episode spans multiple days — that
 * would corroborate the very single-place-errands-merged-by-the-episode-
 * builder noise decision 0023 exists to stop. A unit with no
 * `supportPlaceId` (unclustered, or no location at all) contributes
 * nothing here — it must never fall back to its own `id`, which would
 * register as a guaranteed-distinct "second place" for 2 unclustered
 * units at the exact same spot (code-review finding, 2026-11-22). */
function hasSameDayMultiPlace(units: readonly TripDetectorEvidence[]): boolean {
  const placesByDay = new Map<string, Set<string>>();
  for (const item of units) {
    if (!validDay(item.capturedDay) || !item.supportPlaceId) continue;
    const places = placesByDay.get(item.capturedDay) ?? new Set<string>();
    places.add(item.supportPlaceId);
    placesByDay.set(item.capturedDay, places);
  }
  return [...placesByDay.values()].some((places) => places.size >= 2);
}

/** `true` when `days` (civil-day strings, duplicates/order/invalid entries
 * all fine) contains a run of at least `minRun` calendar days with no gap
 * day in between — decision 0023's "overnight" strong signal (detector-
 * v1-3.md). Two support days a week apart does not qualify, even if the
 * episode builder merged them into one episode (open question in the
 * spec: aligning that merge's own grouping distance with the Home
 * radius). */
function hasConsecutiveDayRun(days: readonly (string | null)[], minRun: number): boolean {
  const sorted = [...new Set(days.filter(validDay))].sort();
  if (sorted.length < minRun) return false;
  let run = 1;
  for (let index = 1; index < sorted.length; index += 1) {
    const priorMillis = Date.parse(`${sorted[index - 1]}T00:00:00.000Z`);
    const currentMillis = Date.parse(`${sorted[index]}T00:00:00.000Z`);
    run = currentMillis - priorMillis === ONE_DAY_MILLIS ? run + 1 : 1;
    if (run >= minRun) return true;
  }
  return false;
}

/** Pure, deterministic v1.3 outcome rule (decision 0023). Hidden
 * (`NOT_TRIP`) is the default outcome: unlike v1.2, a Possible trip is
 * never the fallthrough for "didn't reach Atlas" — it requires its own
 * positive signal. Frequent places are not an input at all (v1.2's
 * `frequentPlaceContext` gate is retired for this version). */
export function qualifyTripOutcomeV13(evidence: readonly TripDetectorEvidence[], options: TripOutcomeOptionsV13): TripOutcome {
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
  // H-3 (classification scope only, same as v1.2): a photo inside an
  // active Home radius is never this episode's trip support.
  const photoUnits = allPhotoUnits.filter((item) => !isWithinActiveHomeRadius(item, homeAreas));
  const supportIds = photoUnits.map((item) => item.id).sort();
  const located = photoUnits.filter(validLocation);
  const reliable = located.filter((item) => item.reportedAccuracyMeters === null || item.reportedAccuracyMeters === undefined || item.reportedAccuracyMeters <= RELIABLE_ACCURACY_METERS);

  // Too little away evidence to surface anything at all, same thresholds
  // as v1.2's own floor — checked before the corroboration/overnight scan
  // below (which includes an O(n^2) pairwise distance check) so none of
  // that work runs on an episode this is going to discard anyway.
  if (nonCaptureOnly) return { classification: 'NOT_TRIP', reasons: ['non-capture-source'], diagnosticScore: 0, supportIds: [] };
  if (photoUnits.length < MIN_PHOTOS_FOR_OUTCOME) return { classification: 'NOT_TRIP', reasons: ['no-away-evidence'], diagnosticScore: 0, supportIds };
  // Decision 0023 (detector-v1-3.md): with no located support at all,
  // "left Home" cannot even be confirmed, so this never reaches the
  // Possible-trips or Hidden-outings cards — GPS-less trip discovery
  // (decision 0019) is the dedicated path for this evidence shape.
  if (located.length === 0) return { classification: 'NOT_TRIP', reasons: ['no-location'], diagnosticScore: 0, supportIds };

  // `corroborated` deliberately counts only genuinely independent trusted
  // (precise-offset) sessions, not `partitionSessions`' day-only buckets:
  // those key on `capturedDay` directly, so any 2+ distinct capture days
  // trivially produce 2+ "sessions" regardless of how far apart they are —
  // exactly the errand-a-week-apart noise v1.3 exists to stop (decision
  // 0023). The dedicated `overnight` check below is the real "multi-day"
  // signal; `corroborated` here means "two separated places" or "two
  // independently timed visits", not merely "two different days".
  const sessionById = partitionSessions(photoUnits);
  const trustedSessionCount = new Set([...sessionById.entries()].filter(([, key]) => key.startsWith('trusted:')).map(([, key]) => key)).size;
  const twoSeparatedPlaces = hasTwoSeparatedPlaces(photoUnits);
  const corroborated = trustedSessionCount >= 2 || twoSeparatedPlaces || hasSameDayMultiPlace(photoUnits);
  const overnight = hasConsecutiveDayRun(photoUnits.map((item) => item.capturedDay), MIN_CONSECUTIVE_DAYS);

  const reasons: TripOutcomeReasonCode[] = [];
  if (homeNotSet) reasons.push('home-not-set');
  if (timeConflict) reasons.push('time-conflict');
  if (reliable.length === 0) reasons.push('weak-location');
  if (reliable.length < MIN_PHOTOS_FOR_AUTO) reasons.push('few-photos');
  if (!corroborated) reasons.push('single-moment');
  if (options.ownerVeto) reasons.push('owner-veto');

  const diagnosticScore = Math.max(0, Math.min(100,
    (trustedSessionCount >= 2 ? 15 : 0) + (twoSeparatedPlaces ? 10 : 0) + (overnight ? 20 : 0)
    + (reliable.length >= MIN_RELIABLE_FOR_STRONG_SIGNAL ? 15 : 0)));

  const atlasEligible = !homeNotSet && !timeConflict && reliable.length >= MIN_PHOTOS_FOR_AUTO
    && corroborated && !options.ownerVeto;
  if (atlasEligible) return { classification: 'AUTO_CONFIRMED', reasons: [], diagnosticScore, supportIds };

  // Possible trip: positive evidence only (decision 0023) — either an
  // owner-fixable gap (Home not set / a time conflict, with real support
  // behind it) or a strong trip signal the Atlas gate didn't fully meet
  // (an overnight stay, two sessions/places, or enough reliable photos).
  // `options.ownerVeto` never gates this path, matching v1.2: a veto blocks
  // only Atlas, not visibility as a Possible trip.
  const ownerFixable = (homeNotSet || timeConflict) && photoUnits.length >= MIN_PHOTOS_FOR_OUTCOME;
  const strongSignal = located.length > 0 && (overnight || corroborated || reliable.length >= MIN_RELIABLE_FOR_STRONG_SIGNAL);
  if (ownerFixable || strongSignal) return { classification: 'SUGGESTED', reasons, diagnosticScore, supportIds };

  // Hidden by default (decision 0023): left Home, but with no strong trip
  // signal and no owner-fixable gap. Still stores a closed reason (never
  // silently dropped) for the collapsed Hidden outings card.
  return { classification: 'NOT_TRIP', reasons: ['brief-outing'], diagnosticScore, supportIds };
}
