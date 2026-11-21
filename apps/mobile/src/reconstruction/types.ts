export const RECONSTRUCTION_RULE_VERSION = 'reconstruction-v1';
/** Additive detector policy.  Legacy graphs remain readable until an approved
 * revision-bound migration activates a qualified generation. */
export const TRIP_DETECTOR_RULE_VERSION = 'trip-detector-v1.1';
/** SPEC-trip-recognition-repair / decision 0021. Owner-set Home only (no
 * learned base); a clear outcome rule replaces score/profile gating; every
 * non-Atlas outcome carries a closed reason. See detector-v1-2.md. */
export const TRIP_OUTCOME_RULE_VERSION = 'trip-detector-v1.2';
/** M10.8 (CAP-8): the detector rule a rebuild's qualification pass uses.
 * `trip-detector-v1.2` is the sole, unconditionally active default; v1.1
 * stays selectable for an owner-initiated rollback only (see
 * delivery-and-diagnostics.md). */
export type DetectorPolicy = typeof TRIP_DETECTOR_RULE_VERSION | typeof TRIP_OUTCOME_RULE_VERSION;
/** Closed reason codes shown to the owner (priority order, first match
 * wins) and stored for every SUGGESTED/NOT_TRIP outcome. */
export type TripOutcomeReasonCode =
  | 'home-not-set' | 'time-conflict' | 'no-location' | 'weak-location'
  | 'near-home' | 'frequent-place' | 'few-photos' | 'single-moment'
  | 'owner-veto' | 'no-away-evidence' | 'non-capture-source';
export type TripOutcomeClassification = 'AUTO_CONFIRMED' | 'SUGGESTED' | 'NOT_TRIP' | 'USER_CONFIRMED' | 'REJECTED';
/** CAP-3's Possible-trips card: one row per SUGGESTED journey on the latest
 * completed run. `reasonCode` is `reasons[0]` from the stored qualification;
 * `locatedCount` is read separately for the `few-photos` sentence's {n} and
 * is informational only (never gates classification). */
export type PossibleTripSummary = {
  displayId: string;
  periodLabel: string;
  reasonCode: TripOutcomeReasonCode;
  locatedCount: number;
};
export type TripOutcome = {
  classification: TripOutcomeClassification;
  /** Every applicable reason, highest priority first; reasons[0] is the one
   * sentence shown on a Possible-trip card. Empty only for AUTO/USER/REJECTED. */
  reasons: TripOutcomeReasonCode[];
  /** Stored diagnostic only (CAP-4); the outcome never gates on it. */
  diagnosticScore: number;
  supportIds: string[];
};
/** Built once per rebuild from the full set of qualified episodes. Counts
 * distinct prior episodes touching a macro place, not photo days. Each entry
 * carries its own journey id so a candidate can exclude itself by identity
 * rather than by start-time comparison (a candidate's own recorded start can
 * differ from the start its own classification computes, since the marker
 * is built from a journey's full unfiltered evidence while classification
 * uses only eligible, non-Home evidence — leave-one-candidate-out must not
 * depend on those two happening to agree). */
export type FrequentPlaceEpisodeMarker = { journeyId: string; placeId: string; startMillis: number };
export type FrequentPlaceContext = ReadonlyMap<string, readonly FrequentPlaceEpisodeMarker[]>;

export type TripClassification = 'AUTO_CONFIRMED' | 'USER_CONFIRMED' | 'SUGGESTED' | 'NOT_TRIP' | 'UNCONFIRMED' | 'REJECTED';
export type TripQualificationPath = 'SCORE' | 'DAY' | 'STAY' | null;
/** Owner-controlled, date-scoped local context. Multiple intervals may overlap;
 * each matching area remains authoritative rather than being averaged. */
export type OwnerConfiguredHomeArea = {
  id: string;
  latitude: number;
  longitude: number;
  effectiveStartDay?: string | null;
  effectiveEndDay?: string | null;
  radiusMeters?: number;
};
export type TripDetectorEvidence = ReconstructionEvidence & {
  mediaType?: 'image' | 'video';
  captureLike?: boolean;
  reliableLocation?: boolean;
  originalLocalDay?: string | null;
  originalLocalTimeMinutes?: number | null;
  sessionId?: string | null;
  supportPlaceId?: string | null;
  origin?: 'capture-like' | 'unknown' | 'download' | 'screenshot';
  timeConflict?: boolean;
  /** Test and repository normalization may supply a precomputed base distance;
   * production computes it from a date-scoped base medoid and uncertainty. */
  effectiveBaseDistanceMeters?: number | null;
  routine?: boolean;
  foreignToEveryBase?: boolean | null;
  /** Computed from the complete accessible prior-365-day context. */
  rareDestination?: boolean | null;
  /** The normalized episode span; absent means the pure rule must not invent it. */
  episodeSpanMillis?: number | null;
  /** A prevalidated pairwise separation for distinct support places. */
  supportPlaceSeparationMeters?: number | null;
  /** Set only by the date-scoped configured-home-area normalization pass. */
  configuredHomeAreaId?: string | null;
  configuredHomeAreaIds?: readonly string[];
};
export type QualifiedTrip = {
  id: string; classification: TripClassification; score: number; path: TripQualificationPath;
  reasons: string[]; supportIds: string[]; destinationSupportIds: string[];
};
export type TripDetectionResult = { ruleVersion: typeof TRIP_DETECTOR_RULE_VERSION; trips: QualifiedTrip[] };

export type ReconstructionEvidence = {
  id: string;
  capturedAtMillis: number | null;
  /** Civil day retained when the instant/offset cannot safely order evidence. */
  capturedDay: string | null;
  hasPreciseOffset: boolean;
  latitude: number | null;
  longitude: number | null;
  reportedAccuracyMeters: number | null;
  availability: 'available' | 'unavailable' | 'unknown';
  duplicateFamilyId: string | null;
  duplicateConflict: boolean;
  supportEligible?: boolean;
  /** Private import provenance retained solely for local qualification. */
  sourceOrigin?: string | null;
  excluded: boolean;
  /** Owner-confirmed split following this evidence. */
  ownerBoundaryAfter?: boolean;
  /** Date-scoped owner-confirmed usual-area context; it never proves a return. */
  usualAreaContext?: boolean;
};

export type Place = { id: string; memberIds: string[]; representativeId: string; uncertainty: string[] };
export type Visit = { id: string; placeId: string; evidenceIds: string[]; order: 'ordered' | 'uncertain' };
export type JourneyDraft = { id: string; visitIds: string[]; state: 'inferred' | 'possible-merge' };
export type EvidenceDisposition = { evidenceId: string; state: 'supported' | 'unresolved' | 'unassigned'; reasons: string[] };
export type JourneyMembership = { evidenceId: string; journeyId: string; state: 'inferred' | 'suggested' | 'owner'; reason: 'visit-support' | 'ordered-24-hour-bracket' | 'unique-three-day-suggestion' | 'owner-primary' };
export type ReconstructionGraph = {
  ruleVersion: typeof RECONSTRUCTION_RULE_VERSION;
  places: Place[];
  visits: Visit[];
  journeys: JourneyDraft[];
  possibleMerges: { fromJourneyId: string; toJourneyId: string; reason: 'adjacent-gap' | 'span-cap'; aiCandidates?: { localId: string; relativeDayOffset: number; evidenceCategory: 'geotagged' | 'gps-less' | 'manual' }[] }[];
  dispositions: EvidenceDisposition[];
  memberships: JourneyMembership[];
};
