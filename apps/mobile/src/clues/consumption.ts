/**
 * AI clue layer (SPEC-ai-clue-layer, decision 0022). CAP-2: rules consume
 * clues, clues never bypass Home or owner rules. Pure functions only; the
 * caller is responsible for passing only `usableClues` output (active,
 * not owner-corrected — see store.ts) and for the clue store's own
 * retraction/supersession bookkeeping.
 *
 * Per clue-contract.md's consumption table:
 * - A `photo-source` clue can only ever LOWER support (never raise it):
 *   received/screenshot/download stops a unit counting as support; a
 *   camera/imported clue confirms what the engine already assumes by
 *   default and changes nothing on its own.
 * - A `place` clue (already the result of two independent agreeing
 *   producer clues combined upstream — CAP-4's "place combiner", not yet
 *   built) can name a destination for display, but never changes
 *   AUTO/SUGGESTED/NOT_TRIP: "Can raise to Atlas? Only via a promotion
 *   class" (default off, gated by the eval engine, CAP-8 — not built).
 * - `same-trip`/`capture-offset` consumption is not implemented yet.
 *
 * Determinism: the same evidence + Home + corrections + active clues
 * always yields the same outcome; with zero clues the result equals the
 * clue-free `qualifyTripOutcomeV12`/`qualifyGraphJourneyV12`.
 */
import { qualifyTripOutcomeV12, type TripOutcomeOptions } from '../reconstruction/outcome-v1-2';
import type { TripDetectorEvidence, TripOutcome } from '../reconstruction/types';
import { usableClues } from './store';
import type { ClueRecord } from './types';

/** Same derivation as `candidate-projection.ts`'s own `supportKey`. */
function supportKey(item: Pick<TripDetectorEvidence, 'id' | 'duplicateFamilyId'>): string {
  return item.duplicateFamilyId === null ? `E:${item.id}` : `F:${item.duplicateFamilyId}`;
}

/** A photo-source clue overriding or confirming a unit's provenance,
 * keyed by its support key. Only the first active, usable clue found per
 * key is used (clue ordering is the caller's responsibility; ties are not
 * expected since a producer should not emit two live clues for one unit). */
function photoSourceBySupportKey(clues: readonly ClueRecord[]): ReadonlyMap<string, ClueRecord & { kind: 'photo-source' }> {
  const byKey = new Map<string, ClueRecord & { kind: 'photo-source' }>();
  for (const clue of clues) {
    if (clue.kind !== 'photo-source') continue;
    for (const key of clue.subject.evidenceKeys) if (!byKey.has(key)) byKey.set(key, clue);
  }
  return byKey;
}

/** Applies every usable `photo-source` clue to `evidence`, overriding
 * `sourceOrigin` so the existing own-capture exclusion in
 * `qualifyTripOutcomeV12` picks it up unchanged — this function changes
 * evidence, never the outcome rule itself. Only `received`/`screenshot`/
 * `download`/`unknown` clue values change anything (they can only lower
 * support); a `camera`/`imported` clue value is a no-op here because the
 * engine already treats unclassified provenance as own-capture by default
 * (consistent with "can raise to Atlas? Only via a promotion class"). */
export function applyPhotoSourceClues<T extends TripDetectorEvidence>(evidence: readonly T[], clues: readonly ClueRecord[]): T[] {
  const bySubject = photoSourceBySupportKey(clues);
  if (!bySubject.size) return [...evidence];
  return evidence.map((item) => {
    const clue = bySubject.get(supportKey(item));
    if (!clue || clue.value.source === 'camera' || clue.value.source === 'imported') return item;
    return { ...item, sourceOrigin: clue.value.source };
  });
}

export type NamedPlace = { countryCode: string; cityId?: string; clueId: string };

/** The one `place` clue, if any, naming the given subject's destination.
 * By design this never changes AUTO/SUGGESTED/NOT_TRIP; callers attach it
 * to a Possible-trip card as a confirmable suggestion, never a silent
 * classification change (promotion classes are a separate, gated step —
 * eval-engine.md — not built). Independent-agreement is the upstream
 * "place combiner" producer's job (CAP-4, not built); a `place`-kind clue
 * reaching this function is already assumed to be that combiner's output. */
export function namedPlaceForSubject(subjectKeys: readonly string[], clues: readonly ClueRecord[]): NamedPlace | null {
  const keys = new Set(subjectKeys);
  const match = clues.find((clue) => clue.kind === 'place' && clue.strength === 'strong' && clue.subject.evidenceKeys.some((key) => keys.has(key)));
  return match && match.kind === 'place' ? { ...match.value, clueId: match.clueId } : null;
}

/** Filters `clues` down to what the rules may use this rebuild (CAP-1's
 * `usableClues`) and applies the photo-source overrides, in one call so a
 * caller building per-journey evidence does not have to remember the order. */
export function prepareClueAwareEvidence<T extends TripDetectorEvidence>(evidence: readonly T[], allClues: readonly ClueRecord[], correctedKeys: ReadonlySet<string>): { evidence: T[]; usable: ClueRecord[] } {
  const usable = usableClues(allClues, correctedKeys);
  return { evidence: applyPhotoSourceClues(evidence, usable), usable };
}

export type TripOutcomeWithClue = TripOutcome & { namedPlace: NamedPlace | null };

/** Single CAP-2 entry point: filters clues to what's usable, applies
 * photo-source overrides to the evidence, qualifies with the unmodified
 * `qualifyTripOutcomeV12`, and attaches a named place for display only —
 * never changing the classification. With zero clues this is byte-for-byte
 * `qualifyTripOutcomeV12`'s own result plus `namedPlace: null` (CAP-2's
 * "zero clues equals the clue-free rule" requirement). */
export function qualifyTripOutcomeWithClues(evidence: readonly TripDetectorEvidence[], clues: readonly ClueRecord[], correctedKeys: ReadonlySet<string>, options: TripOutcomeOptions): TripOutcomeWithClue {
  const { evidence: clueAwareEvidence, usable } = prepareClueAwareEvidence(evidence, clues, correctedKeys);
  const outcome = qualifyTripOutcomeV12(clueAwareEvidence, options);
  const byId = new Map(evidence.map((item) => [item.id, item]));
  const supportIds = outcome.supportIds.length ? outcome.supportIds : evidence.map((item) => item.id);
  const subjectKeys = supportIds.map((id) => { const item = byId.get(id); return item ? supportKey(item) : `E:${id}`; });
  return { ...outcome, namedPlace: namedPlaceForSubject(subjectKeys, usable) };
}
