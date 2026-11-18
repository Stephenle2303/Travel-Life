import type { VisualEvidence } from './local-eligibility';

const deepDeviceCheck = typeof __DEV__ !== 'undefined' && __DEV__
  && process.env.EXPO_PUBLIC_TRAVEL_LIFE_VISUAL_DEEP_CHECK === 'true';
export const visualDiscoveryPolicyVersion = deepDeviceCheck ? 'visual-episodes-v5-dense-eval' : 'visual-episodes-v5';
export const visualDiscoveryPageSize = 256;
export const visualDiscoveryTextAttempts = 32;
export const visualDiscoveryPhotoAttempts = deepDeviceCheck ? 512 : 96;
export const visualDiscoveryPauseMillis = 250;
export const visualPartialPreviewScope = 'visual-partial-preview-v1';
export const visualCitySupportScope = 'visual-city-support-v1';

export function isVisualPartialPreviewEnabled() {
  return typeof __DEV__ !== 'undefined' && __DEV__
    && process.env.EXPO_PUBLIC_TRAVEL_LIFE_VISUAL_PLACE_PREVIEW === 'true'
    && process.env.EXPO_PUBLIC_TRAVEL_LIFE_VISUAL_PARTIAL_PREVIEW === 'true';
}
const hour = 3_600_000;
const basePhotoAttempts = 12;
const denseEpisodeRows = 72;
const episodeGap = 28 * hour;
export const visualCaptureSessionGap = 90 * 60_000;
const sampleBucket = 4 * hour;
const coverageBucket = 10 * 60_000;
const maximumEpisodeSpan = 14 * 24 * hour;
export const maximumVisualCoveragePhotos = 2 * (maximumEpisodeSpan / coverageBucket + 1);

export type DiscoveryPhoto = VisualEvidence & { source_origin?: string | null };
type Cursor = Pick<DiscoveryPhoto, 'captured_at_millis' | 'evidence_id'>;
export type DiscoveryCheckpoint = {
  cursor: Cursor | null;
  tail: DiscoveryPhoto[];
  coverage: DiscoveryPhoto[];
  rowCount: number;
  overflow: boolean;
  complete: boolean;
};
export type DiscoveryEpisode = { key: string; start: string; end: string; representatives: DiscoveryPhoto[] };
export type DiscoveryProposal = {
  key: string; start: string; end: string; placeId: string;
  photos: DiscoveryPhoto[]; stops: VisualStop[]; coverIds: string[];
  membership: VisualMembership[]; correctionId: string | null; pendingPlaceIds?: string[];
};
export type VisualStop = { placeId: string; supportIds: string[] };
export type VisualMembership = { id: string; placeId: string; basis: 'signage' | 'image' | 'combined' | 'scene' };
export type QualifiedVisualAlbum = Pick<DiscoveryProposal, 'start' | 'end' | 'placeId' | 'stops' | 'coverIds' | 'membership' | 'pendingPlaceIds'>;
export const visualProposalPageSize = 12;

export function initialVisualDiscovery(): DiscoveryCheckpoint {
  return { cursor: null, tail: [], coverage: [], rowCount: 0, overflow: false, complete: false };
}

function retainBucketPhoto(tail: DiscoveryPhoto[], row: DiscoveryPhoto, bucketMillis: number) {
  const bucket = Math.floor(row.captured_at_millis / bucketMillis);
  const sameBucket = (photo?: DiscoveryPhoto) => photo && Math.floor(photo.captured_at_millis / bucketMillis) === bucket;
  const last = tail.at(-1);
  if (!sameBucket(last)) {
    tail.push(row);
    return;
  }
  const previous = tail.at(-2);
  if (sameBucket(previous)) {
    if (previous?.family !== row.family) tail[tail.length - 1] = row;
  } else if (last?.family !== row.family) {
    tail.push(row);
  }
}

function appendRepresentativePhotos(target: DiscoveryPhoto[], candidates: DiscoveryPhoto[], limit: number, start: string, end: string) {
  const families = new Set(target.map((photo) => photo.family));
  const extras = candidates.filter((photo) => {
    if (photo.captured_day < start || photo.captured_day > end || families.has(photo.family)) return false;
    families.add(photo.family);
    return true;
  });
  const slots = Math.min(extras.length, limit - target.length);
  for (let index = 0; index < slots; index++) target.push(extras[Math.floor((index + 0.5) * extras.length / slots)]);
}

function eligibleEpisode(rows: DiscoveryPhoto[], coverage: DiscoveryPhoto[], rowCount: number, overflow: boolean): DiscoveryEpisode | null {
  if (overflow || rows.length < 4) return null;
  const distinct = [...new Map([...rows].reverse().map((row) => [row.family, row])).values()]
    .sort((a, b) => a.captured_at_millis - b.captured_at_millis);
  const start = rows[rows.length - 1].captured_day;
  const end = rows[0].captured_day;
  const days = Date.parse(end) - Date.parse(start);
  if (distinct.length < 4 || !Number.isFinite(days) || days < 0 || days > maximumEpisodeSpan
    || distinct.some((row) => row.captured_day < start || row.captured_day > end)) return null;
  const sessions: DiscoveryPhoto[][] = [];
  for (const row of distinct) {
    const session = sessions[sessions.length - 1];
    if (!session || row.captured_at_millis - session[session.length - 1].captured_at_millis >= visualCaptureSessionGap) sessions.push([row]);
    else session.push(row);
  }
  if (sessions.filter((session) => session.length >= 2).length < 2) return null;
  // Spread the first pass across the episode before adding another image
  // from an already represented session.
  const sessionCount = Math.min(sessions.length, basePhotoAttempts);
  const ordered = Array.from({ length: sessionCount }, (_, index) =>
    sessions[Math.round(index * (sessions.length - 1) / (sessionCount - 1))]);
  const representatives: DiscoveryPhoto[] = [];
  for (let offset = 0; offset < basePhotoAttempts; offset += 1) {
    for (const session of ordered) {
      if (session[offset]) representatives.push(session[offset]);
      if (representatives.length === basePhotoAttempts) break;
    }
    if (representatives.length === basePhotoAttempts) break;
  }
  if (rowCount >= denseEpisodeRows) {
    const hourly = coverage.filter((photo, index) => index === 0
      || Math.floor(photo.captured_at_millis / hour) !== Math.floor(coverage[index - 1].captured_at_millis / hour));
    appendRepresentativePhotos(representatives, hourly, visualDiscoveryTextAttempts, start, end);
    appendRepresentativePhotos(representatives, coverage, visualDiscoveryPhotoAttempts, start, end);
  }
  // The sampling policy can change without resurfacing an unchanged dismissal.
  const key = JSON.stringify(['visual-episodes-v2', rowCount, rows.map((row) => [row.evidence_id, row.captured_day, row.captured_at_millis, row.family])]);
  return { key, start, end, representatives };
}

/** Accepts stable descending keyset pages. A completed episode is emitted once per checkpoint. */
export function advanceVisualDiscovery(checkpoint: DiscoveryCheckpoint, rows: readonly DiscoveryPhoto[], atEnd: boolean) {
  let { cursor, overflow, rowCount } = checkpoint;
  let tail = [...checkpoint.tail];
  let coverage = [...checkpoint.coverage];
  for (const row of rows) {
    if (cursor && cursor.captured_at_millis - row.captured_at_millis > episodeGap) {
      const candidate = eligibleEpisode(tail, coverage, rowCount, overflow);
      tail = [];
      coverage = [];
      overflow = false;
      rowCount = 0;
      if (candidate) return { candidate, next: { cursor, tail, coverage, rowCount, overflow, complete: false } };
    }
    if (tail.length && tail[0].captured_at_millis - row.captured_at_millis > maximumEpisodeSpan) overflow = true;
    if (!overflow) {
      retainBucketPhoto(tail, row, sampleBucket);
      if (deepDeviceCheck) {
        if (coverage.length < visualDiscoveryPhotoAttempts) coverage.push(row);
      } else {
        retainBucketPhoto(coverage, row, coverageBucket);
      }
    }
    rowCount += 1;
    cursor = { captured_at_millis: row.captured_at_millis, evidence_id: row.evidence_id };
  }
  const candidate = atEnd ? eligibleEpisode(tail, coverage, rowCount, overflow) : null;
  return { candidate, next: { cursor, tail: atEnd ? [] : tail, coverage: atEnd ? [] : coverage,
    rowCount: atEnd ? 0 : rowCount, overflow: atEnd ? false : overflow, complete: atEnd } };
}

export const visualDiscoveryPageSql = `
  SELECT e.evidence_id, e.source_ref, e.captured_day, e.captured_at_millis, e.source_origin,
    COALESCE('P:' || e.platform_duplicate_family_id, 'T:' || e.duplicate_tuple_fingerprint, 'S:' || e.evidence_id) AS family
  FROM canonical_evidence e
  WHERE e.media_type = 'image' AND e.availability IN ('available', 'unknown')
    AND e.latitude IS NULL AND e.longitude IS NULL
    AND e.captured_day IS NOT NULL AND e.captured_at_millis IS NOT NULL
    AND COALESCE(e.source_origin, 'capture-like') = 'capture-like'
    AND COALESCE(e.support_eligible, 1) = 1
    AND (?2 IS NULL OR (e.captured_at_millis, e.evidence_id) < (?2, ?3))
    AND NOT EXISTS (SELECT 1 FROM json_each(?4) hidden WHERE hidden.value = e.evidence_id)
    AND e.evidence_id NOT IN (SELECT child_id FROM reconstruction_link WHERE run_id = ?1
      AND (link_kind = 'visit-support' OR link_kind LIKE 'membership:%'))
    AND NOT EXISTS (SELECT 1 FROM visual_place_album attachment WHERE attachment.evidence_id = e.evidence_id
      AND NOT EXISTS (SELECT 1 FROM visual_place_review legacy WHERE legacy.manual_id = attachment.manual_id
        AND NOT EXISTS (SELECT 1 FROM visual_place_trip current WHERE current.manual_id = legacy.manual_id)))
    AND NOT EXISTS (SELECT 1 FROM correction_overlays overlay WHERE overlay.target_kind = 'evidence' AND overlay.target_id = e.evidence_id)
    AND NOT EXISTS (SELECT 1 FROM journey_memory_correction_revision memory WHERE memory.source_evidence_id = e.evidence_id)
    AND NOT EXISTS (SELECT 1 FROM manual_journey trip WHERE e.captured_day BETWEEN trip.date_start AND trip.date_end
      AND NOT EXISTS (SELECT 1 FROM visual_place_review legacy WHERE legacy.manual_id = trip.manual_id
        AND NOT EXISTS (SELECT 1 FROM visual_place_trip current WHERE current.manual_id = legacy.manual_id)))
  ORDER BY e.captured_at_millis DESC, e.evidence_id DESC LIMIT ?5`;
