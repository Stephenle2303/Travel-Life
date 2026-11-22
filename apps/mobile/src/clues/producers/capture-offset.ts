/**
 * CAP-4's "Capture offset" producer (clue-producers.md). Pure and
 * deterministic — wraps the already-computed `utc_offset_minutes` the
 * travel-window scan persists per asset (`travel-window/capture-metadata.ts`,
 * `travel_window_capture`); no new native read, no model. "Never names a
 * place alone" (clue-producers.md): this clue carries only a device-clock
 * offset, never a location or destination. Its only consumer today is
 * CAP-6's same-trip matcher, which checks whether two candidate trips carry
 * the same offset.
 */
import type { ClueRecord } from '../types';

export const CAPTURE_OFFSET_PRODUCER_ID = 'capture-offset-metadata';
export const CAPTURE_OFFSET_PRODUCER_VERSION = '1';

export type CaptureOffsetSubject = { evidenceId: string; duplicateFamilyId: string | null; offsetMinutes: number };

/** Same support-key convention every clue producer/consumer uses: one
 * duplicate family is one subject, never one clue per raw copy. */
function supportKey(item: Pick<CaptureOffsetSubject, 'evidenceId' | 'duplicateFamilyId'>): string {
  return item.duplicateFamilyId === null ? `E:${item.evidenceId}` : `F:${item.duplicateFamilyId}`;
}

/** One `capture-offset` clue per distinct support key with a known offset.
 * A family's members could in principle disagree (rare); the first seen in
 * input order wins, deterministically — same convention as `photo-source`'s
 * producer. There is no "unknown" case to abstain from here: the caller
 * only ever passes subjects it already resolved a concrete offset for. */
export function captureOffsetClues(subjects: readonly CaptureOffsetSubject[], inputsRevision: ClueRecord['inputsRevision'], nowMillis: number): ClueRecord[] {
  const bySubjectKey = new Map<string, number>();
  for (const item of subjects) {
    const key = supportKey(item);
    if (!bySubjectKey.has(key)) bySubjectKey.set(key, item.offsetMinutes);
  }
  let sequence = 0;
  return [...bySubjectKey.entries()].map(([key, offsetMinutes]) => {
    sequence += 1;
    return {
      clueId: `${CAPTURE_OFFSET_PRODUCER_ID}-${nowMillis}-${sequence}`,
      kind: 'capture-offset' as const,
      subject: { evidenceKeys: [key] },
      value: { offsetMinutes },
      strength: 'strong' as const,
      independenceKey: CAPTURE_OFFSET_PRODUCER_ID,
      producerId: CAPTURE_OFFSET_PRODUCER_ID,
      producerVersion: CAPTURE_OFFSET_PRODUCER_VERSION,
      inputsRevision,
      state: 'active' as const,
      createdAtMillis: nowMillis,
    };
  });
}
