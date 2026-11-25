export const RECONSTRUCTION_RULE_VERSION = 'reconstruction-v1';
/** Additive detector policy.  Legacy graphs remain readable until an approved
 * revision-bound migration activates a qualified generation. */
export const TRIP_DETECTOR_RULE_VERSION = 'trip-detector-v1.1';
/** SPEC-trip-recognition-repair / decision 0021. Owner-set Home only (no
 * learned base); a clear outcome rule replaces score/profile gating; every
 * non-Atlas outcome carries a closed reason. See detector-v1-2.md. */
export const TRIP_OUTCOME_RULE_VERSION = 'trip-detector-v1.2';
/** SPEC-trip-recognition-repair / decision 0023. Inverts v1.2's funnel
 * (Hidden is the default, not Possible trips); one owner-sized Home zone
 * with a free per-Home radius; Atlas/Possible/Hidden all gate on positive
 * evidence. Benchmarked candidate only — not yet the active default; see
 * outcome-v1-3.ts and detector-v1-3.md. */
export const TRIP_OUTCOME_RULE_VERSION_V13 = 'trip-detector-v1.3';
/** M10.10 (decision 0023/detector-v1-3.md): the owner's Home radius
 * ceiling, raised from a fixed 50 km. The canonical TypeScript value,
 * shared by the engine's own re-validation (engine-v1-1.ts) and the
 * Settings UI (mobile-screens.tsx) so the two cannot drift. The SQLite
 * CHECK (import-record/repository.ts migrationV55), the account history
 * contract (account/history-contract.ts) and the Supabase guard
 * (supabase/migrations/20261123120000_m10_home_radius_cap_raise.sql)
 * cannot import this — SQL text and a hand-rolled JS validator — and
 * restate the same `300000` literal; a future change to this constant
 * must update those by hand too. */
export const MAX_HOME_RADIUS_METERS = 300_000;
/** M10.8 (CAP-8) / M10.12 (decision 0023): the detector rule a rebuild's
 * qualification pass uses, read from the `detector_policy` table.
 * `trip-detector-v1.2` is the default until the owner explicitly switches;
 * v1.1 stays selectable for an owner-initiated rollback (delivery-and-
 * diagnostics.md); `trip-detector-v1.3` is selectable once the owner
 * reviews the on-device comparison and switches (Settings → Trip
 * detection) — see `compareDetectorPolicy`/`setDetectorPolicy`. */
export type DetectorPolicy = typeof TRIP_DETECTOR_RULE_VERSION | typeof TRIP_OUTCOME_RULE_VERSION | typeof TRIP_OUTCOME_RULE_VERSION_V13;
/** Closed reason codes shown to the owner (priority order, first match
 * wins) and stored for every SUGGESTED/NOT_TRIP outcome. `near-home` and
 * `frequent-place` are v1.2-only (decision 0023 retires both for v1.3);
 * `brief-outing` is v1.3-only, the Hidden outings card's own reason. */
export type TripOutcomeReasonCode =
  | 'home-not-set' | 'time-conflict' | 'no-location' | 'weak-location'
  | 'near-home' | 'frequent-place' | 'few-photos' | 'single-moment'
  | 'owner-veto' | 'no-away-evidence' | 'non-capture-source' | 'brief-outing';
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
/** M10.11 (decision 0023/detector-v1-3.md): the Hidden outings card's real
 * list. One row per NOT_TRIP journey whose stored `reasons[0]` is
 * `brief-outing` — the only hidden reason the card ever lists; every other
 * hidden reason (no-away-evidence, non-capture-source, no-location) stays
 * unlisted. No `locatedCount`: the card's one sentence is fixed text,
 * unlike the Possible-trips card's `few-photos` `{n}`. */
/** M10.10 (decision 0023/detector-v1-3.md): "N trips on Atlas / to review /
 * hidden" at a candidate Home radius, computed with the v1.3 pure rule
 * (`outcome-v1-3.ts`) against the latest completed run — shown before the
 * owner saves an edited radius, never written anywhere. A journey the
 * owner already decided (`USER_CONFIRMED`/`REJECTED`) keeps that decision
 * rather than being re-classified at the candidate radius: `rejected`
 * journeys are not counted in any of the three buckets (they are outside
 * the funnel, not part of "hidden"). */
export type HomeRadiusPreview = { atlasCount: number; reviewCount: number; hiddenCount: number };
/** M10.12 (decision 0023): the owner-facing comparison between the
 * currently active detector rule and the v1.3 candidate, read from the
 * latest completed run. `active` is whichever bucket counts the stored
 * (currently active) classifications fall into; `candidate` is the same
 * three buckets recomputed fresh with v1.3; `gainedCount`/`lostCount`/
 * `changedCount`/`unchangedCount` summarize how many journeys would move
 * (via `summarizeOutcomeDelta`, keyed by journey id — safe here because
 * both sides are read from the one same graph in a single call, never
 * compared across two separate rebuilds). `activePolicy` names which rule
 * produced `active`, so the Settings screen can show "currently: v1.2" vs
 * "currently: v1.3" and switch the button between Switch/Roll back. */
export type DetectorPolicyComparison = {
  activePolicy: DetectorPolicy;
  /** Whichever of v1.2/v1.3 is NOT `activePolicy` — so this one function
   * serves the initial v1.2→v1.3 adoption and a later v1.3→v1.2 rollback
   * comparison symmetrically. */
  candidatePolicy: DetectorPolicy;
  active: HomeRadiusPreview;
  candidate: HomeRadiusPreview;
  gainedCount: number;
  lostCount: number;
  changedCount: number;
  unchangedCount: number;
};
export type HiddenOutingSummary = {
  displayId: string;
  periodLabel: string;
  reasonCode: TripOutcomeReasonCode;
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
