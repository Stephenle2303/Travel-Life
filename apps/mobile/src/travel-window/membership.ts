import type { CaptureRecord } from './types';
import type { CandidateWindow } from './window-detector';

export type ExclusionReason = 'messaging' | 'screenshot' | 'download' | 'located';
export type MembershipResult = {
  /** The owner's own camera captures, and Google Takeout imports (decision 0020). There is deliberately no size cap. */
  memberIds: string[];
  /** Unknown provenance: shown for review, never assumed to be the owner's. */
  reviewIds: string[];
  excluded: { id: string; reason: ExclusionReason }[];
};

/**
 * Membership comes from capture provenance, not visual similarity. Received,
 * messaging, downloaded and screenshot media stay out by default. The review
 * preview size never limits membership. A Google Takeout photo import
 * (`imported` provenance, decision 0020) is trusted the same as a camera
 * capture: it is the owner's own retained library, not received media.
 */
export function selectMembers(
  window: Pick<CandidateWindow, 'startMillis' | 'endMillis'>,
  records: readonly CaptureRecord[],
): MembershipResult {
  const result: MembershipResult = { memberIds: [], reviewIds: [], excluded: [] };
  const inside = records
    .filter((record) => record.capturedAtMillis >= window.startMillis && record.capturedAtMillis <= window.endMillis)
    .sort((a, b) => a.capturedAtMillis - b.capturedAtMillis || a.id.localeCompare(b.id));
  for (const record of inside) {
    if (record.located) result.excluded.push({ id: record.id, reason: 'located' });
    else if (record.provenance === 'camera' || record.provenance === 'imported') result.memberIds.push(record.id);
    else if (record.provenance === 'unknown') result.reviewIds.push(record.id);
    else result.excluded.push({ id: record.id, reason: record.provenance });
  }
  return result;
}

/**
 * The same window captures `selectMembers` would keep (member or review, in
 * its own chronological order), as a flat owner-review photo list. Never
 * includes a GPS-located or otherwise-excluded capture (decision 0019): this
 * is for the owner to look at before naming a place, not evidence for the
 * separate GPS reconstruction engine.
 */
export function windowPhotoIds(
  window: Pick<CandidateWindow, 'startMillis' | 'endMillis'>,
  records: readonly CaptureRecord[],
): string[] {
  const { memberIds, reviewIds } = selectMembers(window, records);
  const order = new Map(records.map((record) => [record.id, record.capturedAtMillis] as const));
  return [...memberIds, ...reviewIds].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0) || a.localeCompare(b));
}
