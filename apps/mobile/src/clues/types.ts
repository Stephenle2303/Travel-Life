/**
 * AI clue layer (SPEC-ai-clue-layer, decision 0022). CAP-1: the clue record
 * contract. A clue is evidence an AI producer adds; it is never a trip,
 * membership or classification write. See
 * _bmad-output/specs/spec-ai-clue-layer/clue-contract.md.
 */
export const CLUE_CONTRACT_VERSION = 'travel-clue-v1';

export type ClueStrength = 'weak' | 'strong';
export type ClueLifecycleState = 'active' | 'superseded' | 'retracted';

/** The exact support signature a clue is about: one evidence unit or a
 * sorted set of units. Never a generated journey id (those churn across
 * rebuilds; a clue must outlive one). Keys follow the existing `E:`/`F:`
 * support-key convention used by corrections. */
export type ClueSubject = { readonly evidenceKeys: readonly string[] };

export type ClueInputsRevision = { evidenceRevision: number; homeRevision: number; correctionRevision: number };

type ClueRecordBase = {
  clueId: string;
  subject: ClueSubject;
  strength: ClueStrength;
  /** Two clues are independent only when their independenceKey differs
   * (decision 0019's "two independent agreeing clues" rule, reused here). */
  independenceKey: string;
  producerId: string;
  producerVersion: string;
  inputsRevision: ClueInputsRevision;
  state: ClueLifecycleState;
  createdAtMillis: number;
};

export type PhotoSourceValue = 'camera' | 'imported' | 'received' | 'screenshot' | 'download' | 'unknown';

/** Closed, discriminated by `kind`; `value` is a closed code or offline
 * gazetteer id, never OCR text or model prose (clue-contract.md). */
export type ClueRecord =
  | (ClueRecordBase & { kind: 'place'; value: { countryCode: string; cityId?: string } })
  | (ClueRecordBase & { kind: 'photo-source'; value: { source: PhotoSourceValue } })
  | (ClueRecordBase & { kind: 'same-trip'; value: { pairedSubject: ClueSubject } })
  | (ClueRecordBase & { kind: 'capture-offset'; value: { offsetMinutes: number } })
  | (ClueRecordBase & { kind: 'landmark'; value: { placeId: string } })
  | (ClueRecordBase & { kind: 'sign-place'; value: { gazetteerId: string } })
  | (ClueRecordBase & { kind: 'sign-script'; value: { countryCodes: readonly string[] } });

export type ClueKind = ClueRecord['kind'];
