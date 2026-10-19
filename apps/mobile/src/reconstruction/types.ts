export const RECONSTRUCTION_RULE_VERSION = 'reconstruction-v1';
/** Additive detector policy.  Legacy graphs remain readable until an approved
 * revision-bound migration activates a qualified generation. */
export const TRIP_DETECTOR_RULE_VERSION = 'trip-detector-v1.1';

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
