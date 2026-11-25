/**
 * Version-agnostic outcome-delta/diagnostic mapping shared by every
 * trip-detector outcome rule version. Classification strings and reason
 * codes are the same closed vocabulary across v1.2 and v1.3 (decisions
 * 0021/0023 both store a `TripOutcomeReasonCode`), so the mapping lives
 * once here rather than once per rule version.
 */
import type { TripOutcomeReasonCode } from './types';

export type OutcomeDeltaBucket = 'gained' | 'lost' | 'changed' | 'unchanged';
/** CAP-8's dry run: a pure, owner-readable aggregate of what a policy change
 * would do to every journey's visible classification, keyed by journey id
 * so it survives journey-id churn across a rebuild only if the caller keeps
 * a stable key; production should key by exact support signature instead. */
export function summarizeOutcomeDelta(before: ReadonlyMap<string, string>, after: ReadonlyMap<string, string>) {
  const shown = (classification: string | undefined) => classification === 'AUTO_CONFIRMED' || classification === 'USER_CONFIRMED';
  const buckets: Record<OutcomeDeltaBucket, string[]> = { gained: [], lost: [], changed: [], unchanged: [] };
  const keys = new Set([...before.keys(), ...after.keys()]);
  for (const key of keys) {
    const priorClass = before.get(key);
    const nextClass = after.get(key);
    const priorShown = shown(priorClass);
    const nextShown = shown(nextClass);
    if (!priorShown && nextShown) buckets.gained.push(key);
    else if (priorShown && !nextShown) buckets.lost.push(key);
    else if (priorClass !== undefined && nextClass !== undefined && priorClass !== nextClass) buckets.changed.push(key);
    else buckets.unchanged.push(key);
  }
  return {
    gainedCount: buckets.gained.length, lostCount: buckets.lost.length,
    changedCount: buckets.changed.length, unchangedCount: buckets.unchanged.length,
    gained: buckets.gained.sort(), lost: buckets.lost.sort(), changed: buckets.changed.sort(),
  };
}

/** The diagnostic reason codes `rebuildClassificationReasonCode` can return.
 * Each name matches an `AppDiagnosticReasonCode` member one-to-one — kept
 * as a separate literal union (not an import) so `reconstruction/` never
 * depends on `diagnostics/` at runtime; `atlas-phase-profile.ts`'s own
 * `classification()` parameter type is the thing that actually enforces
 * the match. `BRIEF_OUTING` is v1.3-only (decision 0023): the Hidden
 * outings card's own reason, never produced by v1.2. */
export type RebuildClassificationReasonCode =
  | 'HOME_NOT_SET' | 'TIME_CONFLICT' | 'NO_LOCATION' | 'WEAK_LOCATION' | 'NEAR_HOME'
  | 'FREQUENT_PLACE' | 'FEW_PHOTOS' | 'SINGLE_MOMENT' | 'OWNER_VETO' | 'NO_AWAY_EVIDENCE' | 'NON_CAPTURE_SOURCE'
  | 'BRIEF_OUTING' | 'COMPLETE';

const REBUILD_REASON_DIAGNOSTIC_CODES: Record<TripOutcomeReasonCode | 'owner-confirmed', RebuildClassificationReasonCode> = {
  'home-not-set': 'HOME_NOT_SET', 'time-conflict': 'TIME_CONFLICT', 'no-location': 'NO_LOCATION',
  'weak-location': 'WEAK_LOCATION', 'near-home': 'NEAR_HOME', 'frequent-place': 'FREQUENT_PLACE',
  'few-photos': 'FEW_PHOTOS', 'single-moment': 'SINGLE_MOMENT', 'owner-veto': 'OWNER_VETO',
  'no-away-evidence': 'NO_AWAY_EVIDENCE', 'non-capture-source': 'NON_CAPTURE_SOURCE', 'brief-outing': 'BRIEF_OUTING',
  'owner-confirmed': 'COMPLETE',
};

/** M10.2's device-aggregate read (delivery-and-diagnostics.md): bucketed,
 * content-free classification counts for one rebuild. `reasons[0]` is
 * already the single sentence a Possible-trip/Hidden-outings card would
 * show, so mapping just that first entry gives one bucket per journey;
 * AUTO_CONFIRMED/USER_CONFIRMED/REJECTED carry no reason and map to
 * 'COMPLETE'. Never logs a journey id, place or date — only this closed
 * code, counted by the collection recipe across one correlation id. */
export function rebuildClassificationReasonCode(reasons: readonly (TripOutcomeReasonCode | 'owner-confirmed')[]): RebuildClassificationReasonCode {
  const first = reasons[0];
  return first ? REBUILD_REASON_DIAGNOSTIC_CODES[first] : 'COMPLETE';
}
