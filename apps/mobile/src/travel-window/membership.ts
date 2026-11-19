import type { CaptureRecord } from './types';
import type { CandidateWindow } from './window-detector';

export type ExclusionReason = 'messaging' | 'screenshot' | 'download' | 'located';
export type MembershipResult = {
  /** The owner's own camera captures. There is deliberately no size cap. */
  memberIds: string[];
  /** Unknown provenance: shown for review, never assumed to be the owner's. */
  reviewIds: string[];
  excluded: { id: string; reason: ExclusionReason }[];
};

/**
 * Membership comes from capture provenance, not visual similarity. Received,
 * messaging, downloaded and screenshot media stay out by default. The review
 * preview size never limits membership.
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
    else if (record.provenance === 'camera') result.memberIds.push(record.id);
    else if (record.provenance === 'unknown') result.reviewIds.push(record.id);
    else result.excluded.push({ id: record.id, reason: record.provenance });
  }
  return result;
}
