/**
 * Decision core for GPS-less trip discovery (SPEC-gps-less-trip-discovery).
 * Pure functions over private, device-local metadata. Nothing here performs
 * I/O, logging or storage. Provenance and offset values must come from a
 * native reader that does not exist yet; absent values are `unknown`/`null`
 * and are always treated conservatively.
 */

export type ProvenanceClass = 'camera' | 'messaging' | 'screenshot' | 'download' | 'unknown';

export type CaptureRecord = {
  /** Opaque evidence id. Never rendered or logged. */
  id: string;
  capturedAtMillis: number;
  /** Capture-time UTC offset in minutes when the device recorded one. */
  utcOffsetMinutes: number | null;
  provenance: ProvenanceClass;
  /** True when the capture carries GPS; located captures belong to the located engine. */
  located: boolean;
};

/** A place the evidence points to. Labels come from the offline gazetteer. */
export type PlaceClaim = {
  countryCode: string;
  countryLabel: string;
  cityId?: string;
  cityLabel?: string;
};

export type ClueKind =
  | 'burst'
  | 'offset-shift'
  | 'edge-located'
  | 'script'
  | 'sign-place'
  | 'landmark'
  | 'on-device-model'
  | 'owner-answer';

export type Clue = {
  kind: ClueKind;
  /**
   * Two clues are independent only when their keys differ, for example
   * `signage:session-1` and `landmark:session-2`. Providers assign the key.
   */
  independenceKey: string;
  claim: PlaceClaim | null;
};

/** A located capture just outside a window, e.g. an airport on the way out. */
export type EdgeFix = {
  capturedAtMillis: number;
  /** Computed by the caller. A fix near home never supports a trip. */
  farFromHome: boolean;
  claim: PlaceClaim | null;
};

/** Only these kinds may carry a place claim. Metadata alone never names a place. */
const claimKinds: ReadonlySet<ClueKind> = new Set<ClueKind>([
  'edge-located', 'script', 'sign-place', 'landmark', 'on-device-model', 'owner-answer',
]);
export function canClaimPlace(kind: ClueKind) {
  return claimKinds.has(kind);
}
