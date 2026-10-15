export const RECONSTRUCTION_RULE_VERSION = 'reconstruction-v1';

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
