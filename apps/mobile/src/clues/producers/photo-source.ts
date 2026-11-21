/**
 * CAP-5's metadata-stage producer (clue-producers.md). Pure and
 * deterministic — reuses the Story 1 folder classifier's already-known
 * provenance (`sourceOrigin`, populated at import, M10.6); no new model,
 * no async work, no DB access (the caller persists via `saveClues`).
 * "Content stage" (an on-device image classifier for an `unknown` origin)
 * is an explicitly later version, not built here.
 */
import type { ClueRecord, PhotoSourceValue } from '../types';

export const PHOTO_SOURCE_PRODUCER_ID = 'photo-source-metadata';
export const PHOTO_SOURCE_PRODUCER_VERSION = '1';

/** The folder classifier's own term (`travel-window/capture-metadata.ts`,
 * `outcome-v1-2.ts`'s `NON_CAPTURE_ORIGINS`) mapped to the clue layer's
 * public vocabulary. `unknown`/unset is deliberately absent: ambiguous
 * metadata abstains rather than guesses (clue-producers.md). */
const ORIGIN_TO_PHOTO_SOURCE: Readonly<Record<string, PhotoSourceValue>> = {
  camera: 'camera', imported: 'imported', messaging: 'received', screenshot: 'screenshot', download: 'download',
};

export type PhotoSourceSubject = { evidenceId: string; duplicateFamilyId: string | null; sourceOrigin: string | null };

/** Same support-key convention every clue consumer/correction uses: one
 * duplicate family is one subject, never one clue per raw copy. */
function supportKey(item: Pick<PhotoSourceSubject, 'evidenceId' | 'duplicateFamilyId'>): string {
  return item.duplicateFamilyId === null ? `E:${item.evidenceId}` : `F:${item.duplicateFamilyId}`;
}

/** One `photo-source` clue per distinct support key with unambiguous
 * origin metadata. A family's members could in principle disagree (rare:
 * distinct copies with different folder provenance); the first seen in
 * input order wins, deterministically. Abstains entirely (returns nothing
 * for that subject) when the origin is unknown or unset — "abstention is
 * the default" applies to ambiguous metadata, not to a lower-value result. */
export function photoSourceClues(subjects: readonly PhotoSourceSubject[], inputsRevision: ClueRecord['inputsRevision'], nowMillis: number): ClueRecord[] {
  const bySubjectKey = new Map<string, PhotoSourceValue>();
  for (const item of subjects) {
    const value = ORIGIN_TO_PHOTO_SOURCE[item.sourceOrigin ?? ''];
    if (!value) continue;
    const key = supportKey(item);
    if (!bySubjectKey.has(key)) bySubjectKey.set(key, value);
  }
  let sequence = 0;
  return [...bySubjectKey.entries()].map(([key, source]) => {
    sequence += 1;
    return {
      clueId: `${PHOTO_SOURCE_PRODUCER_ID}-${nowMillis}-${sequence}`,
      kind: 'photo-source' as const,
      subject: { evidenceKeys: [key] },
      value: { source },
      strength: 'strong' as const,
      independenceKey: PHOTO_SOURCE_PRODUCER_ID,
      producerId: PHOTO_SOURCE_PRODUCER_ID,
      producerVersion: PHOTO_SOURCE_PRODUCER_VERSION,
      inputsRevision,
      state: 'active' as const,
      createdAtMillis: nowMillis,
    };
  });
}
