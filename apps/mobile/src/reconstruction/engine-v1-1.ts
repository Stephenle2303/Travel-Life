import { TRIP_DETECTOR_RULE_VERSION, type OwnerConfiguredHomeArea, type QualifiedTrip, type TripDetectionResult, type TripDetectorEvidence } from './types';

type QualificationOptions = {
  baseContext: boolean;
  ambiguous?: boolean;
  ownerConfirmed?: boolean;
  rejected?: boolean;
  ownerVeto?: boolean;
  criticalConflict?: boolean;
  suspectedRoutine?: boolean;
};
const unique = <T>(values: Iterable<T>) => [...new Set(values)];
const ordered = <T extends { id: string }>(values: T[]) => [...values].sort((a, b) => a.id.localeCompare(b.id));
const validDay = (day: string | null | undefined) => {
  if (!day || !/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(day)) return false;
  const parsed = new Date(`${day}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === day;
};
const isActiveOn = (area: OwnerConfiguredHomeArea, day: string | null) => validDay(day)
  && (!area.effectiveStartDay || day! >= area.effectiveStartDay)
  && (!area.effectiveEndDay || day! <= area.effectiveEndDay);
const haversineMeters = (latitude: number, longitude: number, otherLatitude: number, otherLongitude: number) => {
  const radians = Math.PI / 180;
  const latitudeDelta = (otherLatitude - latitude) * radians;
  const longitudeDelta = ((((otherLongitude - longitude) + 540) % 360) - 180) * radians;
  const h = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(latitude * radians) * Math.cos(otherLatitude * radians) * Math.sin(longitudeDelta / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

/** Applies all active owner-configured homes independently. A row with no
 * reliable date or coordinate remains unclassified rather than borrowing a
 * current home or silently extending a period. */
export function applyOwnerConfiguredHomeAreas(evidence: TripDetectorEvidence[], areas: OwnerConfiguredHomeArea[]): TripDetectorEvidence[] {
  const canonicalAreas = [...areas].filter((area) => Number.isFinite(area.latitude) && Number.isFinite(area.longitude)
    && area.latitude >= -90 && area.latitude <= 90 && area.longitude >= -180 && area.longitude <= 180
    && Number.isFinite(area.radiusMeters ?? 50_000) && (area.radiusMeters ?? 50_000) > 0 && (area.radiusMeters ?? 50_000) <= 50_000
    && (!area.effectiveStartDay || validDay(area.effectiveStartDay)) && (!area.effectiveEndDay || validDay(area.effectiveEndDay))
    && (!area.effectiveStartDay || !area.effectiveEndDay || area.effectiveStartDay <= area.effectiveEndDay))
    .sort((left, right) => left.id.localeCompare(right.id));
  return evidence.map((item) => {
    if (!validDay(item.capturedDay) || !Number.isFinite(item.latitude) || !Number.isFinite(item.longitude)) return item;
    const active = canonicalAreas.filter((area) => isActiveOn(area, item.capturedDay)
      && haversineMeters(item.latitude!, item.longitude!, area.latitude, area.longitude) <= (area.radiusMeters ?? 50_000));
    if (!active.length) return item;
    // Stable choice is an opaque local diagnostic only; qualification uses the
    // presence of any configured-home context, never the chosen ID.
    return { ...item, usualAreaContext: true, configuredHomeAreaId: active[0].id };
  });
}

/** Immutable C0/C1 context. Learned bases deliberately require full scope and
 * twelve distinct dated support days; configured bases remain authoritative. */
export function deriveTemporalContextV11(evidence: TripDetectorEvidence[], configured: OwnerConfiguredHomeArea[], fullLibrary: boolean, excludedIds: ReadonlySet<string> = new Set()) {
  const remaining = applyOwnerConfiguredHomeAreas(evidence.filter((item) => !excludedIds.has(item.id)), configured);
  const configuredIds = new Set(remaining.flatMap((item) => item.configuredHomeAreaId ? [item.configuredHomeAreaId] : []));
  const learned = new Map<string, Set<string>>();
  if (fullLibrary) for (const item of remaining) {
    if (!item.supportPlaceId || !validDay(item.capturedDay) || item.usualAreaContext || item.captureLike !== true || item.origin !== 'capture-like' || item.duplicateConflict || item.excluded) continue;
    learned.set(item.supportPlaceId, new Set([...(learned.get(item.supportPlaceId) ?? []), item.capturedDay!]));
  }
  const learnedIds = [...learned.entries()].filter(([, days]) => days.size >= 12).map(([id]) => id).sort();
  return Object.freeze({ version: 'temporal-context-v1.1' as const, baseIds: Object.freeze([...configuredIds, ...learnedIds].sort()), fullLibrary });
}

/** Conservative routine predicate: recurrence without usable local-time data
 * remains suspected (and therefore unconfirmed), never a hidden hard veto. */
export function deriveRoutineVetoV11(prior: TripDetectorEvidence[], candidateStartMillis: number | null) {
  const before = candidateStartMillis === null ? [] : prior.filter((item) => item.capturedAtMillis !== null && item.capturedAtMillis < candidateStartMillis);
  const byPlace = new Map<string, TripDetectorEvidence[]>();
  for (const item of before) if (item.supportPlaceId && item.captureLike === true && item.origin === 'capture-like') byPlace.set(item.supportPlaceId, [...(byPlace.get(item.supportPlaceId) ?? []), item]);
  const routinePlaceIds = new Set<string>(); const suspectedPlaceIds = new Set<string>();
  for (const [placeId, items] of byPlace) {
    const days = new Set(items.map((item) => item.originalLocalDay).filter((day): day is string => validDay(day)));
    if (days.size < 8) continue;
    const timed = items.filter((item) => Number.isInteger(item.originalLocalTimeMinutes));
    if (timed.length < Math.ceil(items.length * .7)) { suspectedPlaceIds.add(placeId); continue; }
    const weekdays = timed.map((item) => new Date(`${item.originalLocalDay}T00:00:00Z`).getUTCDay());
    const weekdayShare = weekdays.filter((day) => day >= 1 && day <= 5).length / weekdays.length;
    const buckets = new Map<number, number>(); for (const item of timed) { const bucket = Math.floor(item.originalLocalTimeMinutes! / 240); buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1); }
    if (weekdayShare >= .7 && Math.max(...buckets.values()) / timed.length >= .7) routinePlaceIds.add(placeId);
    else suspectedPlaceIds.add(placeId);
  }
  return Object.freeze({ routinePlaceIds: Object.freeze([...routinePlaceIds].sort()), suspectedPlaceIds: Object.freeze([...suspectedPlaceIds].filter((id) => !routinePlaceIds.has(id)).sort()) });
}

export function joinReasonV11(left: TripDetectorEvidence[], right: TripDetectorEvidence[]) {
  const last = [...left].filter((item) => item.capturedAtMillis !== null).sort((a, b) => a.capturedAtMillis! - b.capturedAtMillis!).at(-1);
  const first = [...right].filter((item) => item.capturedAtMillis !== null).sort((a, b) => a.capturedAtMillis! - b.capturedAtMillis!)[0];
  if (!last || !first || last.capturedAtMillis === null || first.capturedAtMillis === null) return 'incomparable-time';
  if (last.usualAreaContext || first.usualAreaContext) return 'home-context-boundary';
  if (last.timeConflict || first.timeConflict) return 'time-conflict';
  const gap = first.capturedAtMillis - last.capturedAtMillis;
  if (gap < 0) return 'non-chronological';
  if (gap <= 18 * 3_600_000) return 'joined-short-gap';
  const far = [last, first].every((item) => (item.effectiveBaseDistanceMeters ?? 0) >= 150_000 || item.foreignToEveryBase === true);
  if (gap <= 72 * 3_600_000 && far) return 'joined-far-gap';
  return gap <= 10 * 24 * 3_600_000 ? 'uncertain-adjacency' : 'gap-too-large';
}

/** Pure, additive V1.1 qualification. It accepts only normalized local evidence
 * and fails closed without a date-scoped base or unambiguous episode. */
export function qualifyTripV11(id: string, evidence: TripDetectorEvidence[], options: QualificationOptions): QualifiedTrip {
  if (options.ownerConfirmed) return { id, classification: 'USER_CONFIRMED', score: 0, path: null, reasons: ['owner-confirmed'], supportIds: [], destinationSupportIds: [] };
  if (options.rejected) return { id, classification: 'REJECTED', score: 0, path: null, reasons: ['owner-rejected'], supportIds: [], destinationSupportIds: [] };

  const eligibleRows = ordered(evidence.filter((item) => item.mediaType !== 'video'
    // Unknown/exif-less provenance can remain a reviewable memory, but it is
    // not permitted to satisfy the automatic five-photo gate.
    && item.captureLike === true && item.origin === 'capture-like'
    && item.supportEligible !== false && !item.timeConflict && !item.excluded
    && item.availability !== 'unavailable' && !item.duplicateConflict));
  // A verified family supplies one independent capture unit. Stable selection
  // is for determinism only; it does not claim that member was the original.
  const photoUnits = [...new Map(eligibleRows.map((item) => [item.duplicateFamilyId ? `family:${item.duplicateFamilyId}` : `evidence:${item.id}`, item])).values()];
  const reliable = photoUnits.filter((item) => item.reliableLocation !== false && Number.isFinite(item.latitude) && Number.isFinite(item.longitude));
  const byPlace = new Map<string, TripDetectorEvidence[]>();
  for (const item of reliable) {
    const key = item.supportPlaceId ?? `unresolved:${item.id}`;
    byPlace.set(key, [...(byPlace.get(key) ?? []), item]);
  }
  // A distant outlier cannot become the main destination: support strength
  // wins before deterministic local tie-breaking.
  const destinations = [...byPlace.entries()].map(([placeId, items]) => ({
    placeId, items,
    sessions: unique(items.map((item) => item.sessionId).filter((value): value is string => Boolean(value))).length,
    distance: Math.min(...items.map((item) => item.effectiveBaseDistanceMeters ?? Number.NEGATIVE_INFINITY)),
  })).sort((a, b) => b.items.length - a.items.length || b.sessions - a.sessions || a.placeId.localeCompare(b.placeId));
  const main = destinations[0];
  const distance = main?.distance ?? Number.NEGATIVE_INFINITY;
  const sessions = unique(photoUnits.map((item) => item.sessionId).filter((value): value is string => Boolean(value)));
  const corroboratedPlaces = destinations.filter((destination) => destination.items.length >= 2).map((destination) => destination.placeId);
  const independentCorroboration = sessions.length >= 2
    || (corroboratedPlaces.length >= 2 && photoUnits.some((item) => (item.supportPlaceSeparationMeters ?? 0) >= 1_000));
  const localDays = unique(photoUnits.map((item) => item.originalLocalDay).filter((value): value is string => Boolean(value)));
  const routineAtMain = Boolean(main?.items.some((item) => item.routine));
  const configuredHomeUnits = photoUnits.filter((item) => item.usualAreaContext || item.configuredHomeAreaId);
  const reasons: string[] = [];
  if (!options.baseContext) reasons.push('base-context-missing');
  if (!Number.isFinite(distance)) reasons.push('distance-unknown'); else if (distance < 50_000) reasons.push('distance-below-50km');
  if (photoUnits.length < 5) reasons.push('photo-count-below-five');
  if (!independentCorroboration) reasons.push('independent-corroboration-missing');
  if (routineAtMain) reasons.push('routine');
  if (options.suspectedRoutine) reasons.push('suspected-routine');
  if (options.criticalConflict) reasons.push('critical-conflict');
  if (options.ownerVeto) reasons.push('owner-veto');
  if (options.ambiguous) reasons.push('ambiguous-context');
  if (configuredHomeUnits.length) reasons.push('configured-home-area');

  const score = Math.max(0, Math.min(100,
    (distance >= 50_000 ? 30 : 0) + (distance >= 150_000 ? 10 : 0)
    + (main?.items.some((item) => item.foreignToEveryBase) ? 45 : 0)
    + (main?.items.some((item) => item.rareDestination) ? 15 : 0)
    + (sessions.length >= 2 ? 15 : 0) + (corroboratedPlaces.length >= 2 ? 10 : 0)
    + (localDays.length >= 2 ? 5 : 0) - (routineAtMain ? 55 : 0)));
  const allOtherGates = options.baseContext && Number.isFinite(distance) && distance >= 50_000
    && photoUnits.length >= 5 && !routineAtMain && !options.suspectedRoutine
    && !options.criticalConflict && !options.ownerVeto && !options.ambiguous && configuredHomeUnits.length === 0;
  const episodeSpanMillis = Math.max(...photoUnits.map((item) => item.episodeSpanMillis ?? Number.NEGATIVE_INFINITY));
  const hasDayProfile = independentCorroboration && sessions.length >= 2 && corroboratedPlaces.length >= 2
    && episodeSpanMillis >= 4 * 60 * 60 * 1000;
  const hasStayProfile = independentCorroboration && sessions.length >= 3 && localDays.length >= 2
    && episodeSpanMillis >= 24 * 60 * 60 * 1000;
  const path = allOtherGates && independentCorroboration
    ? score >= 70 ? 'SCORE' : hasDayProfile ? 'DAY' : hasStayProfile ? 'STAY' : null : null;
  const classification = path ? 'AUTO_CONFIRMED'
    : configuredHomeUnits.length === photoUnits.length && photoUnits.length > 0 ? 'NOT_TRIP'
      : configuredHomeUnits.length > 0 ? 'UNCONFIRMED'
      : allOtherGates && !independentCorroboration && score >= 45 ? 'SUGGESTED'
      : !options.baseContext || !Number.isFinite(distance) || reliable.length === 0 || options.ambiguous || options.criticalConflict || options.ownerVeto || options.suspectedRoutine ? 'UNCONFIRMED' : 'NOT_TRIP';
  return { id, classification, score, path, reasons: unique(reasons).sort(), supportIds: photoUnits.map((item) => item.id).sort(), destinationSupportIds: (main?.items ?? []).map((item) => item.id).sort() };
}

export function reconstructV11(episodes: ({ id: string; evidence: TripDetectorEvidence[] } & QualificationOptions)[]): TripDetectionResult {
  return { ruleVersion: TRIP_DETECTOR_RULE_VERSION, trips: episodes.map((episode) => qualifyTripV11(episode.id, episode.evidence, episode)).sort((a, b) => a.id.localeCompare(b.id)) };
}

/** Deterministic candidate construction for normalized, time-bearing units.
 * It is deliberately conservative: an active owner home is a local boundary,
 * and incomparable/contradictory time never gets sorted by source ID as though
 * it were chronology. Context qualification remains a separate pure pass. */
export function buildV11Episodes(evidence: TripDetectorEvidence[], options: QualificationOptions & { ownerHomeAreas?: OwnerConfiguredHomeArea[] }): TripDetectionResult {
  const normalized = applyOwnerConfiguredHomeAreas(evidence, options.ownerHomeAreas ?? []);
  const routineContext = deriveRoutineVetoV11(normalized, null);
  const candidates = normalized.filter((item) => item.captureLike === true && item.origin === 'capture-like'
    && item.availability !== 'unavailable' && !item.excluded && !item.duplicateConflict);
  // Android's media API supplies a creation timestamp but no trustworthy
  // offset.  That is a civil-day observation, not an instant.  Build one
  // block per observed day so mixed precision can share trip membership while
  // preserving the fact that its internal ordering is unknown.
  const preciseTimestamp = (item: TripDetectorEvidence) => item.hasPreciseOffset ? item.capturedAtMillis : null;
  const blocks = new Map<string, TripDetectorEvidence[]>();
  for (const item of candidates) {
    const key = validDay(item.capturedDay) ? `day:${item.capturedDay}` : `unknown:${item.id}`;
    blocks.set(key, [...(blocks.get(key) ?? []), item]);
  }
  // A single near-home observation is explicitly not a return.  Only an
  // observed configured-home block with two civil days or two captures at
  // least an hour apart may close an away episode.
  const homeRowsByArea = new Map<string, TripDetectorEvidence[]>();
  for (const item of normalized) if (item.configuredHomeAreaId) homeRowsByArea.set(item.configuredHomeAreaId, [...(homeRowsByArea.get(item.configuredHomeAreaId) ?? []), item]);
  const corroboratedHomeAreas = new Set<string>();
  for (const [areaId, homeRows] of homeRowsByArea) {
    const homeDays = new Set(homeRows.map((item) => item.capturedDay).filter((day): day is string => validDay(day)));
    const homeTimes = homeRows.map(preciseTimestamp).filter((time): time is number => time !== null).sort((left, right) => left - right);
    if (homeDays.size >= 2 || homeTimes.some((time, index) => index > 0 && time - homeTimes[index - 1] >= 60 * 60 * 1000)) corroboratedHomeAreas.add(areaId);
  }
  const groups: TripDetectorEvidence[][] = [];
  const dayMillis = (items: TripDetectorEvidence[]) => {
    const day = items.map((item) => item.capturedDay).find(validDay);
    return day ? Date.parse(`${day}T00:00:00Z`) : null;
  };
  const orderedBlocks = [...blocks.values()].sort((left, right) => (dayMillis(left) ?? Number.MAX_SAFE_INTEGER) - (dayMillis(right) ?? Number.MAX_SAFE_INTEGER)
    || left.map((item) => item.id).sort().join('|').localeCompare(right.map((item) => item.id).sort().join('|')));
  const isCorroboratedHomeBlock = (items: TripDetectorEvidence[]) => items.some((item) => item.configuredHomeAreaId !== null
    && item.configuredHomeAreaId !== undefined && corroboratedHomeAreas.has(item.configuredHomeAreaId));
  const allKnownPointsAreAway = (items: TripDetectorEvidence[]) => {
    const distances = items.map((item) => item.effectiveBaseDistanceMeters).filter((distance): distance is number => Number.isFinite(distance));
    return distances.length > 0 && distances.every((distance) => distance >= 50_000);
  };
  for (const block of orderedBlocks) {
    const prior = groups.at(-1);
    const priorBlock = prior === undefined ? undefined : prior;
    const priorDay = priorBlock ? dayMillis(priorBlock) : null;
    const currentDay = dayMillis(block);
    const civilGap = priorDay === null || currentDay === null ? null : (currentDay - priorDay) / 86_400_000;
    const priorExact = priorBlock?.map(preciseTimestamp).filter((time): time is number => time !== null).sort((a, b) => a - b).at(-1) ?? null;
    const currentExact = block.map(preciseTimestamp).filter((time): time is number => time !== null).sort((a, b) => a - b)[0] ?? null;
    const exactGap = priorExact === null || currentExact === null ? null : currentExact - priorExact;
    const homeBoundary = isCorroboratedHomeBlock(block) || Boolean(priorBlock && isCorroboratedHomeBlock(priorBlock));
    const shortComparableLink = exactGap !== null && exactGap >= 0 && exactGap <= 72 * 60 * 60 * 1000;
    const shortCivilLink = civilGap !== null && civilGap >= 0 && civilGap <= 2;
    // A longer photo-silent city stay is still one away episode only when the
    // complete local context independently places both blocks away from home.
    const awayContinuation = civilGap !== null && civilGap >= 0 && civilGap <= 10
      && priorBlock !== undefined && allKnownPointsAreAway(priorBlock) && allKnownPointsAreAway(block);
    if (!priorBlock || homeBoundary || !(shortComparableLink || shortCivilLink || awayContinuation)) groups.push([...block]);
    else priorBlock.push(...block);
  }
  return reconstructV11(groups.map((group) => ({
    id: `episode:${group.map((item) => item.id).sort().join('|')}`,
    evidence: group.map((item) => ({ ...item, routine: Boolean(item.supportPlaceId && routineContext.routinePlaceIds.includes(item.supportPlaceId)) })),
    ...options, suspectedRoutine: options.suspectedRoutine || group.some((item) => Boolean(item.supportPlaceId && routineContext.suspectedPlaceIds.includes(item.supportPlaceId))),
  })));
}
