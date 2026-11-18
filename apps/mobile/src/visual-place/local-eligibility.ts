export type VisualEvidence = {
  evidence_id: string;
  source_ref: string;
  captured_day: string;
  captured_at_millis: number;
  family: string;
};

export const visualEvidenceSql = `
  WITH away_days AS (
    SELECT DISTINCT evidence.captured_day AS day
    FROM reconstruction_trip_qualification qualification
    JOIN reconstruction_link journey ON journey.run_id = qualification.run_id
      AND journey.parent_id = qualification.journey_id AND journey.link_kind = 'journey-visit'
    JOIN reconstruction_link support ON support.run_id = journey.run_id
      AND support.parent_id = journey.child_id AND support.link_kind = 'visit-support'
    JOIN canonical_evidence evidence ON evidence.evidence_id = support.child_id
    WHERE qualification.run_id = ?1 AND qualification.classification IN ('AUTO_CONFIRMED', 'USER_CONFIRMED')
      AND evidence.availability = 'available' AND evidence.latitude IS NOT NULL AND evidence.longitude IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM json_each(?2) hidden WHERE hidden.value = qualification.journey_id)
  )
  SELECT evidence.evidence_id, evidence.source_ref, evidence.captured_day, evidence.captured_at_millis,
    COALESCE('platform:' || evidence.platform_duplicate_family_id, 'tuple:' || evidence.duplicate_tuple_fingerprint,
      'source:' || evidence.evidence_id) AS family
  FROM canonical_evidence evidence
  WHERE evidence.media_type = 'image' AND evidence.availability = 'available'
    AND evidence.latitude IS NULL AND evidence.longitude IS NULL
    AND evidence.captured_day IS NOT NULL AND evidence.captured_at_millis IS NOT NULL
    AND COALESCE(evidence.source_origin, 'capture-like') = 'capture-like'
    AND COALESCE(evidence.support_eligible, 1) = 1
    AND NOT EXISTS (SELECT 1 FROM away_days WHERE day = evidence.captured_day)
    AND EXISTS (SELECT 1 FROM away_days WHERE day BETWEEN date(evidence.captured_day, '-2 days') AND date(evidence.captured_day, '+2 days'))
    AND evidence.evidence_id NOT IN (SELECT link.child_id FROM reconstruction_link link WHERE link.run_id = ?1
      AND (link.link_kind = 'visit-support' OR link.link_kind LIKE 'membership:%'))
    AND NOT EXISTS (SELECT 1 FROM visual_place_album attachment WHERE attachment.evidence_id = evidence.evidence_id)
    AND NOT EXISTS (SELECT 1 FROM correction_overlays overlay WHERE overlay.target_kind = 'evidence'
      AND overlay.target_id = evidence.evidence_id)
    AND NOT EXISTS (SELECT 1 FROM journey_memory_correction_revision memory WHERE memory.source_evidence_id = evidence.evidence_id)
    AND NOT EXISTS (SELECT 1 FROM manual_journey trip WHERE evidence.captured_day BETWEEN trip.date_start AND trip.date_end)
  ORDER BY evidence.captured_day DESC, evidence.captured_at_millis DESC, evidence.evidence_id
  LIMIT 401`;

export const visualDatePageSize = 12;
export type VisualDateQuery = { start: string; end: string; page: number };
export type VisualOffer = { key: string; photos: VisualEvidence[]; start: string; end: string; dateQuery?: VisualDateQuery; hasMore?: boolean };

export const visualDateEvidenceSql = `
  SELECT evidence.evidence_id, evidence.source_ref, evidence.captured_day, evidence.captured_at_millis,
    COALESCE('platform:' || evidence.platform_duplicate_family_id, 'tuple:' || evidence.duplicate_tuple_fingerprint,
      'source:' || evidence.evidence_id) AS family
  FROM canonical_evidence evidence
  WHERE evidence.captured_day BETWEEN ?2 AND ?3
    AND evidence.media_type = 'image' AND evidence.availability IN ('available', 'unknown')
    AND evidence.latitude IS NULL AND evidence.longitude IS NULL AND evidence.captured_at_millis IS NOT NULL
    AND COALESCE(evidence.source_origin, 'capture-like') = 'capture-like'
    AND COALESCE(evidence.support_eligible, 1) = 1
    AND evidence.evidence_id NOT IN (SELECT value FROM json_each(?4))
    AND evidence.evidence_id NOT IN (SELECT link.child_id FROM reconstruction_link link WHERE link.run_id = ?1
      AND (link.link_kind = 'visit-support' OR link.link_kind LIKE 'membership:%'))
    AND NOT EXISTS (SELECT 1 FROM visual_place_album attachment WHERE attachment.evidence_id = evidence.evidence_id)
    AND NOT EXISTS (SELECT 1 FROM correction_overlays overlay WHERE overlay.target_kind = 'evidence' AND overlay.target_id = evidence.evidence_id)
    AND NOT EXISTS (SELECT 1 FROM journey_memory_correction_revision memory WHERE memory.source_evidence_id = evidence.evidence_id)
  ORDER BY evidence.captured_day DESC, evidence.captured_at_millis DESC, evidence.evidence_id
  LIMIT ?5 OFFSET ?6`;

function observedDay(day: string) {
  const millis = Date.parse(day);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(millis) && new Date(millis).toISOString().slice(0, 10) === day ? millis : null;
}

export function validVisualDateQuery({ start, end, page }: VisualDateQuery) {
  const from = observedDay(start);
  const to = observedDay(end);
  return from !== null && to !== null && to >= from && to - from < 31 * 86_400_000
    && Number.isSafeInteger(page) && page >= 0 && page <= Math.floor(Number.MAX_SAFE_INTEGER / visualDatePageSize);
}

/** Receives newest-first, privacy-filtered GPS-less photos near supported travel. */
export function visualOffers(rows: readonly VisualEvidence[]): VisualOffer[] {
  if (rows.length > 400) return [];
  const day = 86_400_000;
  const groups: VisualEvidence[][] = [];
  let group: VisualEvidence[] = [];
  for (const photo of rows) {
    const time = observedDay(photo.captured_day);
    if (time === null || !Number.isFinite(photo.captured_at_millis)) continue;
    if (group.length && observedDay(group[0].captured_day)! - time > day) {
      groups.push(group);
      group = [];
    }
    group.push(photo);
  }
  if (group.length) groups.push(group);
  return groups.flatMap((photos) => {
    const distinct = [...new Map([...photos].reverse().map((photo) => [photo.family, photo])).values()]
      .sort((a, b) => b.captured_at_millis - a.captured_at_millis || a.evidence_id.localeCompare(b.evidence_id));
    if (distinct.length < 3 || distinct.length > 40
      || distinct[0].captured_at_millis - distinct.at(-1)!.captured_at_millis < 90 * 60_000) return [];
    const representatives = [...new Set([0, Math.floor(distinct.length / 3), Math.floor(2 * distinct.length / 3), distinct.length - 1])]
      .map((index) => distinct[index]).reverse();
    return [{
      key: JSON.stringify([1, photos.map((photo) => [photo.evidence_id, photo.captured_day, photo.captured_at_millis]).sort((a, b) => String(a[0]).localeCompare(String(b[0])))]),
      photos: representatives,
      start: photos.at(-1)!.captured_day,
      end: photos[0].captured_day,
    }];
  });
}
