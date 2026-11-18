import { visualCaptureSessionGap, type DiscoveryPhoto, type QualifiedVisualAlbum, type VisualMembership, type VisualStop } from './discovery';
import { scoreLandmarkEmbedding } from './landmark-embedding';
import { canonicalVisualStop, isVisualLocality, resolveVisualPlace, visualLocalityId } from './place-catalog';
import { maximumVisualPhotos, VisualPlaceError, type VisualObservation } from './recovery';

const minute = 60_000;
const hour = 60 * minute;
const localDistanceKm = 20;
const excursionDistanceKm = 90;
const maximumLocalGap = 16 * hour;
const maximumExcursionGap = 12 * hour;
const sceneWindow = 2 * minute;
const seoulPlaceId = 'locality-seoul';
const namiPlaceId = 'nami-island';

type ResolvedPlace = NonNullable<ReturnType<typeof resolveVisualPlace>>;
type Observation = VisualObservation & { photo: DiscoveryPhoto };
type Support = Observation & { placeId: string; kind: NonNullable<VisualObservation['kind']> };
type Stop = { place: ResolvedPlace; support: Support[] };
type CaptureSupport = Pick<Support, 'photo' | 'kind'>;
type CitySupportPath = {
  stop: Stop;
  previous: CitySupportPath | null;
  namedCount: number;
  sharedNamedId: string | null;
  hasLocality: boolean;
};

export function compareVisualPhotos(a: DiscoveryPhoto, b: DiscoveryPhoto) {
  return a.captured_at_millis - b.captured_at_millis || a.evidence_id.localeCompare(b.evidence_id);
}

function distanceKm(a: ResolvedPlace, b: ResolvedPlace) {
  const longitude = ((a.longitude - b.longitude + 540) % 360) - 180;
  return 111.2 * Math.hypot(a.latitude - b.latitude, longitude * Math.cos((a.latitude + b.latitude) * Math.PI / 360));
}

function bridgeSupported(stops: readonly Stop[], index: number) {
  const before = stops[index - 1];
  const current = stops[index];
  const distance = distanceKm(before.place, current.place);
  const gap = current.support[0].photo.captured_at_millis - before.support.at(-1)!.photo.captured_at_millis;
  if (gap < Math.max(0, distance / 140 * hour - 10 * minute)) return false;
  if (before.place.locality === current.place.locality && distance <= localDistanceKm && gap <= maximumLocalGap) return true;
  if (distance > excursionDistanceKm || gap > maximumExcursionGap) return false;
  // An excursion needs a matched city on both sides. Proximity and dates alone
  // do not join a new town to a different, independently recognizable outing.
  const prior = stops[index - 2];
  const next = stops[index + 1];
  return Boolean((prior?.place.locality === current.place.locality && distanceKm(prior.place, current.place) <= localDistanceKm
    && before.support[0].photo.captured_at_millis - prior.support.at(-1)!.photo.captured_at_millis <= maximumExcursionGap)
    || (next?.place.locality === before.place.locality && distanceKm(next.place, before.place) <= localDistanceKm
      && next.support[0].photo.captured_at_millis - current.support.at(-1)!.photo.captured_at_millis <= maximumExcursionGap));
}

function captureSessions(photos: readonly DiscoveryPhoto[]) {
  const sessions = new Map<string, number>();
  const families = new Set<string>();
  let previous = -Infinity;
  let session = -1;
  for (const photo of [...photos].sort(compareVisualPhotos)) {
    if ((photo.source_origin != null && photo.source_origin !== 'capture-like') || families.has(photo.family)) continue;
    families.add(photo.family);
    if (photo.captured_at_millis - previous >= visualCaptureSessionGap) session++;
    sessions.set(photo.evidence_id, session);
    previous = photo.captured_at_millis;
  }
  return sessions;
}

export function usesVisualCitySupport(placeId: string, stops: readonly Pick<VisualStop, 'placeId'>[]) {
  const named = new Set(stops.map(({ placeId }) => canonicalVisualStop(placeId)).filter((id) => !isVisualLocality(id)));
  return stops.some((stop) => isVisualLocality(stop.placeId))
    || (named.size === 1 && (isVisualLocality(placeId) || [...named].some(visualLocalityId)));
}

function cityBridgeSupported(before: ResolvedPlace, beforeTime: number, current: ResolvedPlace, currentTime: number) {
  const gap = currentTime - beforeTime;
  return gap >= visualCaptureSessionGap && gap <= maximumLocalGap
    && (isVisualLocality(before.id) || isVisualLocality(current.id) || distanceKm(before, current) <= localDistanceKm);
}

/** Validate persisted support against the same time bounds used during qualification. */
export function validVisualCitySupport(placeId: string, start: string, end: string, stops: readonly VisualStop[],
  membership: readonly VisualMembership[], chronology: readonly DiscoveryPhoto[]) {
  if (!isVisualLocality(placeId) || canonicalVisualStop(placeId) !== placeId || stops.length < 2
    || !stops.some((stop) => !isVisualLocality(stop.placeId))) return false;
  const byId = new Map(chronology.map((photo) => [photo.evidence_id, photo]));
  const byMember = new Map(membership.map((item) => [item.id, item]));
  const sessions = captureSessions(chronology);
  let previousTime: number | undefined;
  let previousSession = -1;
  let previousPlace: ResolvedPlace | null = null;
  let firstDay: string | undefined;
  let lastDay: string | undefined;
  for (const stop of stops) {
    const place = resolveVisualPlace(stop.placeId);
    if (!place || canonicalVisualStop(stop.placeId) !== stop.placeId || visualLocalityId(stop.placeId) !== placeId
      || stop.supportIds.length < 2) return false;
    const session = sessions.get(stop.supportIds[0]);
    if (session === undefined || session <= previousSession) return false;
    const support: CaptureSupport[] = [];
    for (const [index, id] of stop.supportIds.entries()) {
      const photo = byId.get(id);
      const member = byMember.get(id);
      if (!photo || !member || member.placeId !== stop.placeId || member.basis === 'scene'
        || (isVisualLocality(stop.placeId) && member.basis === 'image') || sessions.get(id) !== session) return false;
      if (previousTime !== undefined) {
        const gap = photo.captured_at_millis - previousTime;
        if (index === 0 && previousPlace) {
          if (!cityBridgeSupported(previousPlace, previousTime, place, photo.captured_at_millis)) return false;
        } else if (gap < 0 || gap >= visualCaptureSessionGap) return false;
      }
      support.push({ photo, kind: member.basis });
      firstDay ??= photo.captured_day;
      lastDay = photo.captured_day;
      previousTime = photo.captured_at_millis;
    }
    if (!sufficientCaptureSupport(support)) return false;
    previousSession = session;
    previousPlace = place;
  }
  return firstDay === start && lastDay === end;
}

function sufficientCaptureSupport(support: readonly CaptureSupport[]) {
  return support.length >= 2 && (
    support.some(({ photo, kind }) => photo.source_origin === 'capture-like' || kind !== 'image')
    || support.at(-1)!.photo.captured_at_millis - support[0].photo.captured_at_millis >= 3 * minute
  );
}

function selectCityStops(sessions: readonly Stop[][]) {
  if (sessions.length < 2) return null;
  let paths: (CitySupportPath | null)[] = [null];
  for (const options of sessions) {
    const previousPaths = paths;
    paths = options.flatMap((stop) => {
      const locality = isVisualLocality(stop.place.id);
      const bestBySupport = new Map<string | null, CitySupportPath>();
      for (const previous of previousPaths) {
        if (previous && !cityBridgeSupported(previous.stop.place, previous.stop.support.at(-1)!.photo.captured_at_millis,
          stop.place, stop.support[0].photo.captured_at_millis)) continue;
        const namedCount = (previous?.namedCount ?? 0) + Number(!locality);
        const hasLocality = locality || previous?.hasLocality === true;
        const previousNamedId = previous?.sharedNamedId ?? null;
        const sharedNamedId = locality ? previousNamedId
          : (!previous?.namedCount || previousNamedId === stop.place.id) ? stop.place.id : null;
        // A city path needs a named stop plus locality support, or repeated evidence for one named stop.
        const supportKey = hasLocality ? (namedCount ? 'named-and-locality' : 'locality-only') : sharedNamedId;
        if ((bestBySupport.get(supportKey)?.namedCount ?? -1) < namedCount) {
          bestBySupport.set(supportKey, { stop, previous, namedCount, sharedNamedId, hasLocality });
        }
      }
      return [...bestBySupport.values()];
    });
    if (!paths.length) return null;
  }
  let best: CitySupportPath | null = null;
  for (const path of paths) {
    if (path?.namedCount && (path.hasLocality || path.sharedNamedId) && (!best || path.namedCount > best.namedCount)) best = path;
  }
  if (!best) return null;
  const stops: Stop[] = [];
  for (let path: CitySupportPath | null = best; path; path = path.previous) stops.push(path.stop);
  return stops.reverse();
}

function qualifyCityStops(photos: readonly DiscoveryPhoto[], matches: readonly Support[], placeId: string) {
  if (matches.some((match) => visualLocalityId(match.placeId) !== placeId)) return null;
  const sessions = captureSessions(photos);
  const bySession = new Map<number, Map<string, Stop[]>>();
  for (const match of matches) {
    const session = sessions.get(match.id);
    if (session === undefined || (isVisualLocality(match.placeId) && match.kind === 'image')) continue;
    const byPlace = bySession.get(session) ?? new Map<string, Stop[]>();
    bySession.set(session, byPlace);
    const groups = byPlace.get(match.placeId) ?? [];
    byPlace.set(match.placeId, groups);
    const last = groups.at(-1);
    if (last && match.photo.captured_at_millis - last.support.at(-1)!.photo.captured_at_millis < visualCaptureSessionGap) last.support.push(match);
    else groups.push({ place: resolveVisualPlace(match.placeId)!, support: [match] });
  }
  const eligibleSessions = [...bySession.values()].map((groups) => [...groups.values()].flat()
    .filter(({ support }) => sufficientCaptureSupport(support))).filter((groups) => groups.length);
  return selectCityStops(eligibleSessions);
}

/** Candidate metadata proposes a window. Independent recognized captures qualify its stops. */
export function qualifyVisualTrip(photos: readonly DiscoveryPhoto[], observations: readonly VisualObservation[], partialPreview = false,
  chronology: readonly DiscoveryPhoto[] = photos) {
  const byId = new Map(photos.map((photo) => [photo.evidence_id, photo]));
  const seen = new Set<string>();
  const pendingPhotos: DiscoveryPhoto[] = [];
  const ordered: Observation[] = [];
  if (!Array.isArray(observations)) throw new VisualPlaceError('MEDIA_SCHEMA');
  for (const observation of observations) {
    const photo = byId.get(observation?.id);
    if (!photo || seen.has(observation.id) || (observation.placeId === null) !== (observation.kind === null)
      || (observation.placeId !== null && (!resolveVisualPlace(observation.placeId)
        || !['signage', 'image', 'combined'].includes(observation.kind!)))) throw new VisualPlaceError('MEDIA_SCHEMA');
    seen.add(observation.id);
  }
  for (const observation of observations) {
    const photo = byId.get(observation.id)!;
    if (photo.source_origin != null && photo.source_origin !== 'capture-like') continue;
    if (partialPreview && observation.placeId === namiPlaceId) pendingPhotos.push(photo);
    else ordered.push({ ...observation, photo, placeId: observation.placeId ? canonicalVisualStop(observation.placeId) : null });
  }
  ordered.sort((a, b) => compareVisualPhotos(a.photo, b.photo));
  const families = new Set<string>();
  const matches = ordered.filter((observation): observation is Support => {
    if (!observation.placeId || !observation.kind || families.has(observation.photo.family)) return false;
    families.add(observation.photo.family);
    return true;
  });
  const sessions: Stop[] = [];
  for (const match of matches) {
    if (isVisualLocality(match.placeId)) continue;
    const previous = sessions.at(-1);
    if (previous?.place.id === match.placeId
      && match.photo.captured_at_millis - previous.support.at(-1)!.photo.captured_at_millis < visualCaptureSessionGap) {
      previous.support.push(match);
    } else {
      sessions.push({ place: resolveVisualPlace(match.placeId)!, support: [match] });
    }
  }
  const namedStops = sessions.filter(({ support }) => sufficientCaptureSupport(support));
  const city = namedStops[0] && visualLocalityId(namedStops[0].place.id);
  if (namedStops.length >= 2 && (!city || new Set(namedStops.map(({ place }) => place.id)).size >= 2)
    && namedStops.slice(1).every((_, index) => bridgeSupported(namedStops, index + 1))) {
    return { stops: namedStops, ordered, pendingPhotos };
  }
  const proposedCity = matches[0] && visualLocalityId(matches[0].placeId);
  const stops = proposedCity ? qualifyCityStops(chronology, matches, proposedCity) : null;
  return stops ? { stops, ordered, pendingPhotos } : null;
}

export function visualTripDestination(stops: readonly Pick<VisualStop, 'placeId'>[]) {
  const places = stops.map((stop) => resolveVisualPlace(stop?.placeId));
  if (!places.every((place) => place !== null)) return undefined;
  const localities = new Map<string, number>();
  for (const { id, locality } of places) {
    const key = visualLocalityId(id) ?? locality;
    localities.set(key, (localities.get(key) ?? 0) + 1);
  }
  const destination = [...localities.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return destination && (isVisualLocality(destination) ? destination : places.find((place) => place.locality === destination)?.id);
}

/** The optional field carries one catalog identity and no source evidence. */
export function resolveVisualPendingPlace(placeId: string, stops: readonly VisualStop[], pendingIds: unknown, partialPreview: boolean) {
  if (pendingIds === undefined) return undefined;
  if (!partialPreview || placeId !== seoulPlaceId || !Array.isArray(pendingIds) || pendingIds.length !== 1
    || pendingIds[0] !== namiPlaceId || stops.some((stop) => stop?.placeId === namiPlaceId)) throw new VisualPlaceError('MEDIA_SCHEMA');
  const place = resolveVisualPlace(namiPlaceId);
  if (!place || visualTripDestination(stops) !== seoulPlaceId) {
    throw new VisualPlaceError('MEDIA_SCHEMA');
  }
  return place;
}

function hasSceneSupport(photo: Observation, stop: Stop) {
  if (!photo.embedding) return false;
  const time = photo.photo.captured_at_millis;
  const neighbors = stop.support.filter((sample) => sample.embedding && sample.photo.captured_day === photo.photo.captured_day
    && Math.abs(sample.photo.captured_at_millis - time) <= sceneWindow
    && sample.photo.family !== photo.photo.family);
  const corroborated = neighbors.filter((sample) => {
    const { global, pooled, regional } = scoreLandmarkEmbedding(photo.embedding!, sample.embedding!);
    return global >= 0.82 && pooled >= 0.84 && regional >= 0.8;
  });
  return corroborated.some((sample) => sample.photo.captured_at_millis < time)
    && corroborated.some((sample) => sample.photo.captured_at_millis > time);
}

/** Only recognized captures and independently corroborated scenes become album members. */
export function associateVisualAlbum(trip: NonNullable<ReturnType<typeof qualifyVisualTrip>>): QualifiedVisualAlbum | null {
  const stopMembers = new Map(trip.stops.flatMap((stop) => stop.support.map(({ id, kind }) => [id, {
    id, basis: kind, placeId: stop.place.id,
  }] as const)));
  const families = new Set(trip.stops.flatMap((stop) => stop.support.map(({ photo }) => photo.family)));
  const first = trip.stops[0];
  const last = trip.stops.at(-1)!;
  const stops = trip.stops.map((stop) => ({ placeId: stop.place.id, supportIds: stop.support.map(({ id }) => id) }));
  const mainPlace = visualTripDestination(stops);
  if (!mainPlace) return null;
  const pendingFamilies = new Set(trip.pendingPhotos.map(({ family }) => family));
  const hasPendingPlace = mainPlace === seoulPlaceId && trip.pendingPhotos.some((photo) => !families.has(photo.family)
    && photo.captured_at_millis >= first.support[0].photo.captured_at_millis
    && photo.captured_at_millis <= last.support.at(-1)!.photo.captured_at_millis);
  const membership = trip.ordered.flatMap((item): VisualMembership[] => {
    const member = stopMembers.get(item.id);
    if (member) return [member];
    if (item.placeId || families.has(item.photo.family) || pendingFamilies.has(item.photo.family)) return [];
    const candidates = trip.stops.filter((stop) => hasSceneSupport(item, stop));
    if (candidates.length !== 1) return [];
    families.add(item.photo.family);
    return [{ id: item.id, basis: 'scene', placeId: candidates[0].place.id }];
  });
  if (membership.length < 4) return null;
  const distinctPlaces = [...new Map([...trip.stops].reverse().map((stop) => [stop.place.id, stop])).values()].reverse();
  const firstCovers = distinctPlaces.map((stop) => stop.support[0]);
  const coverIds = [...new Map([...firstCovers, ...trip.stops.map((stop) => stop.support[0])]
    .map((item) => [item.id, item])).keys()].slice(0, maximumVisualPhotos);
  return {
    start: first.support[0].photo.captured_day, end: last.support.at(-1)!.photo.captured_day, placeId: mainPlace,
    stops,
    coverIds, membership, ...(hasPendingPlace ? { pendingPlaceIds: [namiPlaceId] } : {}),
  };
}
