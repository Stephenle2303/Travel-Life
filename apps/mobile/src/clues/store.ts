/**
 * AI clue layer (SPEC-ai-clue-layer, decision 0022). CAP-1: validity rules.
 * Pure functions only; no storage, network or logging here. A persistence
 * layer (SQLite migration under `import-record/repository.ts`) applies
 * these rules when it reads/writes the clue table; that wiring is a
 * separate, blocked piece (see delivery-and-diagnostics.md) — these
 * functions are the reusable, tested contract it will call into.
 */
import type { ClueRecord, ClueSubject } from './types';

/** Every evidence unit a clue's subject names. */
function subjectKeys(subject: ClueSubject): readonly string[] {
  return subject.evidenceKeys;
}

/** A clue is retracted when any subject unit is no longer available:
 * deleted, privacy-excluded, or its source access withdrawn. `availableKeys`
 * is the current set of support keys the rules can still see. */
export function retractCluesForUnavailableEvidence(clues: readonly ClueRecord[], availableKeys: ReadonlySet<string>): ClueRecord[] {
  return clues.map((clue) => clue.state === 'retracted' || subjectKeys(clue.subject).every((key) => availableKeys.has(key))
    ? clue
    : { ...clue, state: 'retracted' as const });
}

/** A clue is superseded when its producer's version no longer matches the
 * current producer version (the producer must recompute it lazily; this
 * never deletes the record, only marks it not current). `currentVersions`
 * maps producerId -> the version running now. A producer missing from the
 * map is treated as unknown and leaves existing clues untouched (never
 * guess a producer was removed from a partial version map). */
export function supersedeCluesForProducerVersion(clues: readonly ClueRecord[], currentVersions: ReadonlyMap<string, string>): ClueRecord[] {
  return clues.map((clue) => {
    if (clue.state !== 'active') return clue;
    const current = currentVersions.get(clue.producerId);
    return current !== undefined && current !== clue.producerVersion ? { ...clue, state: 'superseded' as const } : clue;
  });
}

/** Only `active` clues are read by the rules (CAP-2). */
export function activeClues(clues: readonly ClueRecord[]): ClueRecord[] {
  return clues.filter((clue) => clue.state === 'active');
}

/** A clue whose subject the owner has corrected is ignored by the rules
 * (but stays stored for eval, per clue-contract.md) — the owner's decision
 * always wins over an AI clue on the same subject. `correctedKeys` is every
 * support key touched by an owner correction (reject/claim/place/etc). */
export function ignoredByOwnerCorrection(clue: ClueRecord, correctedKeys: ReadonlySet<string>): boolean {
  return subjectKeys(clue.subject).some((key) => correctedKeys.has(key));
}

/** Clues the rules may actually use this rebuild: active, and not
 * overridden by an owner correction on the same subject. */
export function usableClues(clues: readonly ClueRecord[], correctedKeys: ReadonlySet<string>): ClueRecord[] {
  return activeClues(clues).filter((clue) => !ignoredByOwnerCorrection(clue, correctedKeys));
}

/** Two clues corroborate only when their independence keys differ (decision
 * 0019's two-independent-clues rule, reused for CAP-4's place naming). */
export function independentClues(clues: readonly ClueRecord[]): boolean {
  const keys = new Set(clues.map((clue) => clue.independenceKey));
  return keys.size >= 2;
}
