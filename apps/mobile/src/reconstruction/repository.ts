import { projectCanonicalHistory } from './canonical-projection';
import { candidateTripPolicy, projectCandidateFromCanonical, projectCanonicalCandidateHistory, type CandidateTrip, type CandidateTripProjection } from './candidate-projection';
import { LOCAL_RECOVERY_PROJECTION_VERSION, projectLocalRecoveryGraph } from './local-recovery-projection';
import { assertReplicaOpen, trackReplicaConnection } from '@/account/replica-connections';
import { resolvePlaceCountryCode, JourneyCorrectionRemapRequiredError, resolveVerifiedDuplicateFamilies, correctionFamilySnapshots, resolveReviewedSupportKey, predecessorWideScopeRevisions, type FamilySnapshot } from './canonical-core';
import type { PossibleTripSummary, ReconstructionEvidence, ReconstructionGraph, TripOutcomeReasonCode } from './types';
import { RECONSTRUCTION_RULE_VERSION, TRIP_DETECTOR_RULE_VERSION } from './types';
import { NATURAL_EARTH_ADMIN_0_DATASET_VERSION, countryDisplayName } from './country-resolver';
import { destinationLabel, type DestinationSupport } from './destination-label';
import { effectiveConfiguredHomeDistanceV11 } from './engine-v1-1';
import { buildFrequentPlaceContext, buildV12CandidateLookups, graphJourneyEpisodeMarkers, rebuildClassificationReasonCode } from './outcome-v1-2';
import type { RecognizableShadowPair } from './recognizable-shadow-types';
import type { DurableRevealRecord, JourneyDetail, RevealMapAnchor } from '@/reveal/types';
import type { ManualJourneyInput } from '@/import-record/types';
import { clueFromRow, ensureNativeImportSchema, type ClueRow } from '@/import-record/repository';
import { qualifyGraphJourneyWithClues } from '@/clues/consumption';
import type { ClueRecord } from '@/clues/types';
import { NativeTransactionWithdrawnError, runOwnedTransaction, serializeNativeTransactions } from '@/database/native-transaction';
import type { ReplayMutation, ReplayMutationReceipt, ReplayReconciliation } from '@/replay/draft-repository-contract';
import { ReplayDraftStaleError } from '@/replay/draft-error';
import { ReplayPreparedArtifactError } from '@/replay/prepared-error';
import { createAtlasPhaseProfile } from '@/diagnostics/atlas-phase-profile';
import { classifyAppDiagnosticError, createDiagnosticCorrelationId, recordAppDiagnostic, type AppDiagnosticEvent } from '@/diagnostics/app-diagnostics';
import { activePrivacySql, assertPrivacyRevision, reviewedPrivacyIds, type PrivacyRevision, type JourneyPrivacyReview, type JourneyPrivacyPolicy } from '@/history-record/privacy';
import { validVisualDateQuery, visualDateEvidenceSql, visualDatePageSize, visualEvidenceSql, visualOffers, type VisualDateQuery, type VisualEvidence, type VisualOffer } from '@/visual-place/local-eligibility';
import { ewhaPlace, maximumVisualPhotos, VisualPlaceError } from '@/visual-place/recovery';
import { advanceVisualDiscovery, initialVisualDiscovery, isVisualPartialPreviewEnabled, maximumVisualCoveragePhotos, visualCitySupportScope, visualDiscoveryPageSize, visualDiscoveryPageSql, visualDiscoveryPhotoAttempts, visualDiscoveryPolicyVersion, visualPartialPreviewScope, visualProposalPageSize,
  type DiscoveryCheckpoint, type DiscoveryEpisode, type DiscoveryPhoto, type DiscoveryProposal, type QualifiedVisualAlbum, type VisualStop } from '@/visual-place/discovery';
import { isVisualLocality, resolveVisualPlace, visualRecognizerPolicyVersion } from '@/visual-place/place-catalog';
import { regionalLandmarkPolicyVersion, regionalPackPreviewConfig } from '@/visual-place/regional-pack-config';
import { compareVisualPhotos, resolveVisualPendingPlace, usesVisualCitySupport, validVisualCitySupport, visualTripDestination } from '@/visual-place/trip-recovery';
import { searchOwnerPlaces } from './owner-place-search';
export { resolvePlaceCountryCode, qualifyGraphJourneyV11, mergeContinuousAwayJourneysV11, constructCanonicalV11Graph, resolveVerifiedDuplicateFamilies, structuralBoundaryEvidenceIds, applyStructuralBoundaries, predecessorWideScopeRevisions, applyOwnerJourneyMerges, applyJourneyCorrections, mapCorrectionsToCommittedJourneys, mapFinalCorrectionApplications } from './canonical-core';
export { qualifyGraphJourneyV12, buildFrequentPlaceContext, buildV12CandidateLookups, graphJourneyEpisodeMarkers, summarizeOutcomeDelta, TRIP_OUTCOME_RULE_VERSION } from './outcome-v1-2';

type Database = {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, ...parameters: (string | number | null)[]): Promise<unknown>;
  getAllAsync<T>(source: string, ...parameters: (string | number | null)[]): Promise<T[]>;
  getFirstAsync<T>(source: string, ...parameters: (string | number | null)[]): Promise<T | null>;
};

type EvidenceRow = { evidence_id: string; media_type?: 'image' | 'video'; captured_at_millis: number | null; captured_day: string | null; has_precise_offset: number; availability: ReconstructionEvidence['availability']; latitude: number | null; longitude: number | null; reported_accuracy_meters: number | null; platform_duplicate_family_id?: string | null; source_origin?: string | null; support_eligible?: number | null; duplicate_tuple_version?: number | null; duplicate_tuple_fingerprint?: string | null };
export type JourneyCorrectionAction = 'confirm' | 'reject' | 'claim' | 'place' | 'split' | 'merge' | 'remove-visit';
type JourneyCorrectionRevision = { revision_id: string; action: JourneyCorrectionAction; source_run_id?: number; reviewed_support_json: string; reviewed_visits_json?: string; reviewed_family_snapshot_json?: string | null; structural_boundary_json?: string | null };
export type CandidateShadowOptions = { canUseSource: () => boolean | Promise<boolean>; correlationId?: string; limit?: number; purpose?: 'reveal'; signal?: AbortSignal };
export type CandidateShadowCard = {
  id: string; title: string; observedPeriod: string; coverRefs: string[];
  state: CandidateTrip['state']; reasons: CandidateTrip['reasons'];
  canReview?: boolean; canReject?: boolean;
};
export type CandidateShadowResult =
  | { status: 'complete'; policyVersion: CandidateTripProjection['policyVersion']; cards: CandidateShadowCard[]; token: object; observed?: RevealMapAnchor[];
      separatePairs?: RecognizableShadowPair[];
      comparison?: { baselineRuleVersion: typeof RECONSTRUCTION_RULE_VERSION; baselineTripDetectorVersion: typeof TRIP_DETECTOR_RULE_VERSION; evidenceRows: number; elapsedMillis: number } }
  | { status: 'stale' | 'blocked' | 'unavailable' | 'too-large' | 'failed' };
type CandidateShadowStamp = {
  run: number | null; run_evidence: number | null; run_home: number | null; evidence: number | null;
  home: number | null; privacy: number; overlay: number; owner: string; memory: string; rejections: number; state: string | null;
};
type VisualDiscoveryRow = { enabled: number; revision: number; scope: string | null; checkpoint: string | null; proposal: string | null };
type VisualDiscoveryAuthority = { stamp: CandidateShadowStamp; scope: string; row: VisualDiscoveryRow; partialPreview: boolean; regionalRelease?: string };
type VisualDiscoveryPage =
  | { kind: 'proposal'; token: object; proposal: DiscoveryProposal }
  | { kind: 'scan'; token: object; candidate: DiscoveryEpisode | null; more: boolean }
  | { kind: 'done' };
const candidateShadowEvidenceLimit = 4_000;
const candidateComparisonEvidenceLimit = 24_000;
const candidateComparisonPageSize = 512;
const candidateShadowCardLimit = 48;
const recognizableTripMediaLimit = 6;
const recognizableObservationLimit = 128;
export type CandidateShadowReviewResult = 'applied' | 'stale' | 'unsupported' | 'retry' | 'unknown';
type CandidateReviewTarget = { journeyId: string; partition: string; reviewedSupport: string; reviewedVisits: string; families: string };
type CandidateRevealEntry = { card: CandidateShadowCard; refs: string[]; target?: CandidateReviewTarget; signature: string | null };
type CandidateShadowAuthority = { stamp: CandidateShadowStamp; reveal?: Map<string, CandidateRevealEntry> };
type CandidateDecisionReceipt = { revision_id: string; source_run_id: number; journey_id: string; action: string; state: string; reviewed_support_json: string; reviewed_visits_json: string; reviewed_family_snapshot_json: string };
type CandidateRejectionReceipt = { policy_version: string; support_signature: string };

class CandidateDecisionGuard extends Error {
  constructor(readonly reason: 'ACCESS' | 'HISTORY_STALE' | 'HISTORY_CONFLICT' | 'JOURNEY_REMAP' | 'SKIPPED') { super('Possible trip review could not be verified.'); }
}

function candidatePartition(groups: readonly (readonly string[])[]) {
  return JSON.stringify(groups.map((group) => JSON.stringify([...group].sort())).sort());
}

type MemoryCorrectionAction = 'assign' | 'move' | 'reject' | 'unassign';
type MemoryCorrectionRevision = { revision_id: string; action: MemoryCorrectionAction; source_evidence_id: string; reviewed_support_json: string; reviewed_family_snapshot_json?: string | null; created_at_millis: number };
type OwnerJourneyClaim = NonNullable<JourneyDetail['ownerClaim']>;
type OwnerJourneyPlace = NonNullable<JourneyDetail['ownerPlace']>;
type StructuralSplit = { afterVisitId: string };
type StructuralMerge = {
  withJourneyId: string;
  suggested?: boolean;
  expectedPrivacyRevision?: number;
  canUseSource?: () => Promise<boolean>;
  onStage?: (stage: 'POSSIBLE_TRIP_REBUILD' | 'POSSIBLE_TRIP_ACK') => void;
  onRollback?: (outcome: 'start' | 'complete' | 'failed') => void;
};
type VisitRemoval = { visitId: string };
const RECONCILIATION_LEASE_MILLIS = 5 * 60 * 1000;
export type ReconciliationStage = 'LEASE_OPEN' | 'MAINTENANCE_LEASE_READ' | 'LEASE_WRITE' | 'QUEUE_READ' | 'REBUILD' | 'OUTCOME_READ' | 'OUTCOME_SAVE' | 'LEASE_RELEASE';

export type DurableRevealStage =
  | 'DURABLE_OPEN' | 'DURABLE_SCHEMA' | 'DURABLE_LIFECYCLE_READ' | 'DURABLE_RUN_READ'
  | 'DURABLE_MANUAL_READ' | 'DURABLE_JOURNEY_READ' | 'DURABLE_COUNTRY_READ'
  | 'DURABLE_OWNER_PLACE_READ' | 'DURABLE_STATISTICS_READ' | 'DURABLE_DIAGNOSTICS_READ'
  | 'DURABLE_DESTINATION_QUERY' | 'DURABLE_DESTINATION_COMPUTATION' | 'DURABLE_CORRECTION_READ' | 'DURABLE_FAMILY_READ'
  | 'DURABLE_SUPPORT_READ' | 'DURABLE_PROJECTION'
  | 'DURABLE_MANUAL_EMPTY_LAYOUT' | 'DURABLE_MANUAL_RETAINED_LAYOUT';

const manualSchemaFailureStages = {
  manual_id: 'DURABLE_MANUAL_ID_FIELD', command_key: 'DURABLE_MANUAL_COMMAND_FIELD',
  owner_label: 'DURABLE_MANUAL_LABEL_FIELD', owner_context: 'DURABLE_MANUAL_CONTEXT_FIELD',
  latitude: 'DURABLE_MANUAL_LATITUDE_FIELD', longitude: 'DURABLE_MANUAL_LONGITUDE_FIELD',
  date_kind: 'DURABLE_MANUAL_DATE_KIND_FIELD', date_start: 'DURABLE_MANUAL_START_FIELD', date_end: 'DURABLE_MANUAL_END_FIELD',
} as const;
export type DurableRevealDiagnosticStage = DurableRevealStage | typeof manualSchemaFailureStages[keyof typeof manualSchemaFailureStages] | 'DURABLE_MANUAL_TABLE';

/** Native detail stays in memory; only the fixed stage crosses diagnostics. */
export class DurableRevealStageError extends Error {
  constructor(readonly stage: DurableRevealStage, readonly originalError: unknown) {
    super('Local Atlas read did not finish.');
    this.name = 'DurableRevealStageError';
  }
}

export class LocalRecoveryStageError extends Error {
  constructor(readonly stage: 'CANDIDATE_INPUT_READ' | 'CANDIDATE_CLASSIFY' | 'CANDIDATE_READBACK', readonly originalError: unknown) {
    super('Local recovery projection did not finish.');
    this.name = 'LocalRecoveryStageError';
  }
}

export function durableRevealFailureStage(error: unknown): DurableRevealDiagnosticStage | null {
  if (!(error instanceof DurableRevealStageError)) return null;
  if (error.stage === 'DURABLE_MANUAL_READ' && error.originalError instanceof Error) {
    // Recognize only known schema signatures in memory. Neither the parsed
    // identifier nor the native message is returned or sent to diagnostics.
    const message = error.originalError.message.toLowerCase();
    if (/no such table:\s*manual_journey\b/.test(message)) return 'DURABLE_MANUAL_TABLE';
    const field = /no such column:\s*(?:manual_journey\.)?([a-z_]+)\b/.exec(message)?.[1];
    if (field && Object.prototype.hasOwnProperty.call(manualSchemaFailureStages, field)) {
      return manualSchemaFailureStages[field as keyof typeof manualSchemaFailureStages];
    }
  }
  return error.stage;
}

/** Carries an internal, fixed processing stage without exposing a native SQLite error to the UI log. */
export class ReconciliationStageError extends Error {
  constructor(readonly stage: ReconciliationStage, readonly originalError: unknown) {
    super(originalError instanceof Error ? originalError.message : 'Local reconciliation failed.');
    this.name = 'ReconciliationStageError';
  }
}

function reconciliationStageError(stage: ReconciliationStage, error: unknown) {
  return error instanceof ReconciliationStageError ? error : new ReconciliationStageError(stage, error);
}

// Keep each statement below SQLite's conservative 999-variable boundary.
const MAX_RECONSTRUCTION_INSERT_PARAMETERS = 800;
// Generated place IDs can contain every support ID. Bound bridge payloads as
// well as SQLite parameters so one dense place does not create a huge call.
const MAX_RECONSTRUCTION_INSERT_CHARACTERS = 256_000;

type SqlValue = string | number | null;

function reconstructionRowWriter(db: Database, tableAndColumns: string, width: number) {
  const rowsPerStatement = Math.floor(MAX_RECONSTRUCTION_INSERT_PARAMETERS / width);
  let batch: SqlValue[][] = [];
  let characters = 0;
  const flush = async () => {
    if (!batch.length) return;
    const slots = `(${Array(width).fill('?').join(', ')})`;
    await db.runAsync(`INSERT INTO ${tableAndColumns} VALUES ${batch.map(() => slots).join(', ')}`, ...batch.flat());
    batch = [];
    characters = 0;
  };
  return {
    async add(row: SqlValue[]) {
      if (row.length !== width) throw new Error('Invalid reconstruction insert row width.');
      const rowCharacters = row.reduce<number>((count, value) => count + String(value ?? '').length, 0);
      if (rowCharacters > MAX_RECONSTRUCTION_INSERT_CHARACTERS) throw new Error('Reconstruction insert row exceeds the local SQLite bridge limit.');
      if (batch.length >= rowsPerStatement || characters + rowCharacters > MAX_RECONSTRUCTION_INSERT_CHARACTERS) await flush();
      batch.push(row);
      characters += rowCharacters;
    },
    flush,
  };
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Formats the default coarse owner-only Timeline period. */
export function monthRangeLabel(firstDay: string | null, lastDay: string | null, firstYear: number | null, lastYear: number | null) {
  const monthFor = (day: string | null) => day && /^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(day) ? { year: Number(day.slice(0, 4)), month: Number(day.slice(5, 7)) - 1 } : null;
  const first = monthFor(firstDay); const last = monthFor(lastDay);
  if (first && last) {
    const start = `${MONTH_NAMES[first.month]} ${first.year}`;
    return first.year === last.year && first.month === last.month ? start : `${start}–${MONTH_NAMES[last.month]} ${last.year}`;
  }
  return firstYear === null ? 'Date unknown' : firstYear === lastYear ? String(firstYear) : `${firstYear}–${lastYear}`;
}

function observedDayLabel(day: string | null) {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const parsed = new Date(`${day}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== day) return null;
  return `${MONTH_NAMES[parsed.getUTCMonth()]} ${parsed.getUTCDate()}, ${parsed.getUTCFullYear()}`;
}

function coarseMapAnchor(latitude: number | null, longitude: number | null): RevealMapAnchor | null {
  if (latitude === null || longitude === null || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  // About eleven kilometres at the equator: useful for an Atlas overview but
  // deliberately not a precise personal location.
  return { latitude: Math.round(latitude * 10) / 10, longitude: Math.round(longitude * 10) / 10 };
}

/** Keeps an internal reconstruction ID out of the UI while retaining a stable local key. */
function opaqueJourneyDisplayId(journeyId: string) {
  let first = 2166136261;
  let second = 5381;
  for (let index = 0; index < journeyId.length; index += 1) {
    const code = journeyId.charCodeAt(index);
    first = Math.imul(first ^ code, 16777619);
    second = Math.imul(second, 33) ^ code;
  }
  return `atlas-${(first >>> 0).toString(36)}-${(second >>> 0).toString(36)}`;
}

function isCalendarDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function validatedOwnerClaim(claim: OwnerJourneyClaim | undefined): OwnerJourneyClaim {
  if (!claim || (!claim.title && !claim.date)) throw new Error('Enter a private journey title or date before saving.');
  if (claim.title && (claim.title !== claim.title.trim() || claim.title.length > 120)) throw new Error('Enter a private journey title of 120 characters or fewer.');
  if (!claim.date) return claim;
  if (claim.date.kind === 'exact') {
    if (!isCalendarDay(claim.date.day)) throw new Error('Enter an exact owner date as YYYY-MM-DD.');
    return claim;
  }
  if (!isCalendarDay(claim.date.startDay) || !isCalendarDay(claim.date.endDay) || claim.date.startDay > claim.date.endDay) {
    throw new Error('Enter an ordered approximate date interval as YYYY-MM-DD.');
  }
  return claim;
}

function validatedOwnerPlace(place: OwnerJourneyPlace | undefined): OwnerJourneyPlace {
  if (!place || !place.id || place.id.length > 160 || !place.name || place.name !== place.name.trim() || place.name.length > 120 || !place.context || place.context !== place.context.trim() || place.context.length > 160) {
    throw new Error('Choose a local place result before saving.');
  }
  if (!Number.isFinite(place.anchor.latitude) || !Number.isFinite(place.anchor.longitude) || place.anchor.latitude < -90 || place.anchor.latitude > 90 || place.anchor.longitude < -180 || place.anchor.longitude > 180) {
    throw new Error('The selected place has an invalid local map anchor.');
  }
  return place;
}

type ManualRow = { manual_id: string; command_key: string; owner_label: string; owner_context: string; latitude: number; longitude: number; date_kind: 'exact' | 'approximate'; date_start: string; date_end: string };

function validateManualJourney(input: ManualJourneyInput) {
  if (!input.commandKey || input.commandKey.length > 160) throw new Error('A stable private save key is required.');
  if (!input.label || input.label !== input.label.trim() || input.label.length > 120) throw new Error('Enter a destination label of 120 characters or fewer.');
  if (!input.context || input.context !== input.context.trim() || input.context.length > 160) throw new Error('Enter a destination area of 160 characters or fewer.');
  if (!Number.isFinite(input.anchor.latitude) || !Number.isFinite(input.anchor.longitude) || input.anchor.latitude < -90 || input.anchor.latitude > 90 || input.anchor.longitude < -180 || input.anchor.longitude > 180) throw new Error('Choose a valid coarse map area.');
  if (input.date.kind === 'exact') {
    if (!isCalendarDay(input.date.day)) throw new Error('Enter an exact date as YYYY-MM-DD.');
  } else if (!isCalendarDay(input.date.startDay) || !isCalendarDay(input.date.endDay) || input.date.startDay > input.date.endDay) {
    throw new Error('Enter an ordered approximate date interval as YYYY-MM-DD.');
  }
}

function manualRange(input: ManualJourneyInput | ManualRow) {
  return 'date' in input ? (input.date.kind === 'exact' ? [input.date.day, input.date.day] as const : [input.date.startDay, input.date.endDay] as const) : [input.date_start, input.date_end] as const;
}

/** A graph rebuild is one local transaction, so readers see the prior complete run or the next one. */
export function createNativeReconstructionRepository(options?: { databaseName: string; enableLocalRecovery?: boolean; canUseRecoverySource?: () => Promise<boolean> }) {
  const databaseName = options?.databaseName ?? 'travel-life-import-v1.db';
  if (databaseName !== 'travel-life-import-v1.db' && !/^travel-life-account-[a-f0-9-]{36}\.db$/.test(databaseName)) throw new Error('Private record namespace is invalid.');
  let database: Promise<Database> | null = null;
  let projectionWriter: Promise<Database> | null = null;
  // Populated only by the redacted Atlas read. It keeps the raw journey id in
  // this local repository, so opening one selected card never scans all IDs.
  const displayedJourneys = new Map<string, { runId: number; journeyId: string }>();
  const displayedVisits = new Map<string, { visitId: string; capturedAtMillis: number | null; ordering: 'chronological' | 'uncertain' }>();
  const displayedMemories = new Map<string, { evidenceId: string; availability: 'available' | 'unavailable' | 'unknown' }>();
  // A Replay attachment is scoped to both its journey and evidence. The same
  // evidence can legitimately support more than one visible journey, so an
  // evidence ID alone cannot preserve an owner's per-chapter edit.
  const displayedReplayMemories = new Map<string, { journeyId: string; evidenceId: string }>();
  const displayedReplayGroups = new Map<string, string>();
  let displayedReplaySnapshot: { snapshotToken: number; privacyRevision: number } | null = null;
  const displayedPendingRemaps = new Map<string, { candidateId: string; revisionId: string; runId: number; kind: 'journey' | 'memory' }>();
  const privacyReviews = new Map<string, { displayId: string; runId: number; label: string; manualId: string | null; evidence: string[]; families: string[]; hideEvidence: string[]; hideFamilies: string[]; revision: number }>();
  let privacyReviewSequence = 0;
  const withheldPrivacySnapshots = new Map<string, Set<string>>();
  const candidateShadowTokens = new WeakMap<object, CandidateShadowAuthority>();
  const visualPlaceOffers = new WeakMap<object, { stamp: CandidateShadowStamp; offer: VisualOffer }>();
  const visualDiscoveryPages = new WeakMap<object, { authority: VisualDiscoveryAuthority; next: DiscoveryCheckpoint; candidate: DiscoveryEpisode | null }>();
  const visualDiscoveryReviews = new WeakMap<object, { authority: VisualDiscoveryAuthority; proposal: DiscoveryProposal }>();
  const visualDiscoveryReadbacks = new WeakMap<object, VisualDiscoveryAuthority>();
  const visualAlbumTokens = new Map<string, { run: number; revision: number; command: string; token: number }>();
  let nextVisualAlbumToken = -1;

  async function candidateShadowStamp(db: Database) {
    return db.getFirstAsync<CandidateShadowStamp>(`SELECT run.run_id AS run, run.evidence_revision AS run_evidence, run.home_revision AS run_home,
      history.canonical_evidence_revision AS evidence, home.revision AS home,
      COALESCE((SELECT MAX(revision) FROM journey_privacy_revision), 0) AS privacy,
      COALESCE((SELECT MAX(revision) FROM correction_overlays), 0) AS overlay,
      (SELECT json_group_array(json_array(revision_id, state)) FROM
        (SELECT revision_id, state FROM journey_correction_revision ORDER BY revision_id)) AS owner,
      (SELECT json_group_array(json_array(revision_id, state)) FROM
        (SELECT revision_id, state FROM journey_memory_correction_revision ORDER BY revision_id)) AS memory,
      (SELECT COUNT(*) FROM recognizable_candidate_rejection) AS rejections,
      (SELECT state FROM private_record_lifecycle WHERE record_id = 1) AS state
      FROM private_history_record history CROSS JOIN home_projection_context home
      LEFT JOIN reconstruction_run run ON run.run_id = (SELECT MAX(run_id) FROM reconstruction_run WHERE status = 'complete')
      WHERE history.record_id = 1 AND home.record_id = 1`);
  }

  function sameShadowStamp(left: CandidateShadowStamp | null, right: CandidateShadowStamp) {
    return left?.state === 'connected' && JSON.stringify(left) === JSON.stringify(right);
  }

  async function visualDiscoveryRow(db: Database) {
    const row = await db.getFirstAsync<VisualDiscoveryRow>('SELECT enabled, revision, scope, checkpoint, proposal FROM visual_discovery_state WHERE record_id = 1');
    if (!row) throw new VisualPlaceError('MEDIA_SCHEMA');
    return row;
  }

  function sameVisualState(left: VisualDiscoveryRow, right: VisualDiscoveryRow) {
    return left.revision === right.revision && left.enabled === right.enabled
      && left.scope === right.scope && left.checkpoint === right.checkpoint && left.proposal === right.proposal;
  }

  async function verifyVisualDiscoveryAuthority(db: Database, expected: VisualDiscoveryAuthority, canUseSource: () => Promise<boolean>, checkState = true) {
    if (!await canUseSource()) throw new VisualPlaceError('ACCESS');
    const row = await visualDiscoveryRow(db);
    if (!row.enabled) throw new VisualPlaceError('HISTORY_CONSENT');
    if (expected.partialPreview !== isVisualPartialPreviewEnabled()
      || (expected.regionalRelease !== undefined && expected.regionalRelease !== regionalPackPreviewConfig()?.manifestSha256)
      || !sameShadowStamp(await candidateShadowStamp(db), expected.stamp)
      || row.revision !== expected.row.revision || (checkState && !sameVisualState(row, expected.row))) {
      throw new VisualPlaceError('HISTORY_STALE');
    }
    if (!await canUseSource()) throw new VisualPlaceError('ACCESS');
  }

  function readVisualJson<T>(raw: string | null): T | null {
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      throw new VisualPlaceError('MEDIA_SCHEMA');
    }
  }

  async function visualEpisodeOverlaps(db: Database, run: number, start: string, end: string, correctionId: string | null) {
    return Boolean(await db.getFirstAsync(`
      SELECT 1 FROM manual_journey WHERE date_start <= ?3 AND date_end >= ?2 AND manual_id IS NOT ?4
      UNION ALL
      SELECT 1 FROM reconstruction_trip_qualification qualification
      JOIN reconstruction_link journey ON journey.run_id = qualification.run_id
        AND journey.parent_id = qualification.journey_id AND journey.link_kind = 'journey-visit'
      JOIN reconstruction_link support ON support.run_id = journey.run_id
        AND support.parent_id = journey.child_id AND support.link_kind = 'visit-support'
      JOIN canonical_evidence evidence ON evidence.evidence_id = support.child_id
      WHERE qualification.run_id = ?1 AND qualification.classification IN ('AUTO_CONFIRMED', 'USER_CONFIRMED')
      GROUP BY qualification.journey_id
      HAVING MIN(evidence.captured_day) <= ?3 AND MAX(evidence.captured_day) >= ?2
      LIMIT 1`, run, start, end, correctionId));
  }

  async function visualCorrectionTarget(db: Database, clusterKey: string) {
    const row = await db.getFirstAsync<{ manual_id: string }>(`
      SELECT review.manual_id FROM visual_place_review review JOIN manual_journey trip ON trip.manual_id = review.manual_id
      WHERE review.cluster_key = ? AND review.decision = 'confirmed'
      AND NOT EXISTS (SELECT 1 FROM visual_place_trip current WHERE current.manual_id = review.manual_id)`, clusterKey);
    return row?.manual_id ?? null;
  }

  function visualProposalCommand(proposal: DiscoveryProposal) {
    return JSON.stringify([visualDiscoveryPolicyVersion, visualRecognizerPolicyVersion, proposal.key, proposal.correctionId,
      proposal.placeId, proposal.start, proposal.end, proposal.stops, proposal.membership]);
  }

  async function validateVisualDiscoveryProposal(db: Database, { stamp, partialPreview }: VisualDiscoveryAuthority, proposal: DiscoveryProposal,
    representatives?: readonly DiscoveryPhoto[]) {
    const place = resolveVisualPlace(proposal.placeId);
    const photos = Array.isArray(proposal.photos) ? proposal.photos : [];
    const byId = new Map(photos.map((photo) => [photo?.evidence_id, photo]));
    const members = Array.isArray(proposal.membership) ? proposal.membership : [];
    const stops = Array.isArray(proposal.stops) ? proposal.stops : [];
    const supported = stops.flatMap((stop) => Array.isArray(stop?.supportIds) ? stop.supportIds : []);
    if (!place || !proposal.key || !/^\d{4}-\d{2}-\d{2}$/.test(proposal.start) || !/^\d{4}-\d{2}-\d{2}$/.test(proposal.end)
      || proposal.start > proposal.end || photos.length < 4 || photos.length > visualDiscoveryPhotoAttempts
      || byId.size !== photos.length || new Set(photos.map((photo) => photo?.family)).size !== photos.length
      || photos.some((photo, i) => !photo || typeof photo.evidence_id !== 'string' || typeof photo.source_ref !== 'string'
        || typeof photo.family !== 'string' || !Number.isFinite(photo.captured_at_millis)
        || photo.captured_day < proposal.start || photo.captured_day > proposal.end
        || (i > 0 && compareVisualPhotos(photos[i - 1], photo) >= 0))
      || members.length !== photos.length || members.some((item, i) => item?.id !== photos[i].evidence_id
        || !['signage', 'image', 'combined', 'scene'].includes(item.basis)
        || !stops.some((stop) => stop?.placeId === item.placeId)
        || (item.basis === 'scene') === supported.includes(item.id))
      || stops.length < 2 || stops.some((stop) => !stop || !resolveVisualPlace(stop.placeId) || !Array.isArray(stop.supportIds)
        || stop.supportIds.length < 2 || stop.supportIds.some((id) => !members.some((item) => item.id === id && item.placeId === stop.placeId)))
      || new Set(supported).size !== supported.length
      || !Array.isArray(proposal.coverIds) || !proposal.coverIds.length || proposal.coverIds.length > maximumVisualPhotos
      || new Set(proposal.coverIds).size !== proposal.coverIds.length || proposal.coverIds.some((id) => !supported.includes(id))
      || !(proposal.correctionId === null || typeof proposal.correctionId === 'string')) throw new VisualPlaceError('MEDIA_SCHEMA');
    if (visualTripDestination(stops) !== proposal.placeId
      || (usesVisualCitySupport(proposal.placeId, stops)
        && !validVisualCitySupport(proposal.placeId, proposal.start, proposal.end, stops, members, representatives ?? photos))) {
      throw new VisualPlaceError('MEDIA_SCHEMA');
    }
    resolveVisualPendingPlace(proposal.placeId, stops, proposal.pendingPlaceIds, partialPreview);
    if (!stamp.run || await visualEpisodeOverlaps(db, stamp.run, proposal.start, proposal.end, proposal.correctionId)) return false;
    if (proposal.correctionId && await visualCorrectionTarget(db, proposal.key) !== proposal.correctionId) return false;
    const homes = await db.getAllAsync<{ area_id: string; latitude: number; longitude: number; effective_start_day: string | null; effective_end_day: string | null; radius_meters: number }>(
      `SELECT area_id, latitude, longitude, effective_start_day, effective_end_day, radius_meters FROM configured_home_area
      WHERE (effective_start_day IS NULL OR effective_start_day <= ?) AND (effective_end_day IS NULL OR effective_end_day >= ?)`, proposal.end, proposal.start);
    const atHome = (point: { latitude: number; longitude: number; capturedDay: string }, accuracy = 0) => homes.some((home) => {
      const distance = effectiveConfiguredHomeDistanceV11(point, [{
        id: home.area_id, latitude: home.latitude, longitude: home.longitude,
        effectiveStartDay: home.effective_start_day, effectiveEndDay: home.effective_end_day,
      }]);
      return distance !== null && distance + accuracy <= home.radius_meters;
    });
    if (stops.some((stop) => {
      const location = resolveVisualPlace(stop.placeId)!;
      return stop.supportIds.some((id) => atHome({ ...location, capturedDay: byId.get(id)!.captured_day }));
    })) return false;
    const privacy = await privacyFilter(db, stamp.run);
    if (proposal.correctionId && privacy.manual.has(proposal.correctionId)) return false;
    if (homes.length) {
      const intervening = await db.getAllAsync<{ latitude: number; longitude: number; captured_day: string; reported_accuracy_meters: number | null; family: string }>(`
        SELECT latitude, longitude, captured_day, reported_accuracy_meters,
          COALESCE(platform_duplicate_family_id, duplicate_tuple_fingerprint, evidence_id) AS family
        FROM canonical_evidence WHERE captured_at_millis BETWEEN ? AND ?
          AND latitude IS NOT NULL AND longitude IS NOT NULL AND availability = 'available'
          AND COALESCE(support_eligible, 1) = 1 AND COALESCE(source_origin, 'capture-like') = 'capture-like'
          AND NOT EXISTS (SELECT 1 FROM json_each(?) hidden WHERE hidden.value = evidence_id)
        LIMIT 513`, photos[0].captured_at_millis, photos.at(-1)!.captured_at_millis, JSON.stringify([...privacy.protectedEvidence]));
      const homeFamilies = new Set(intervening.filter((point) => atHome({ ...point, capturedDay: point.captured_day }, point.reported_accuracy_meters ?? 0))
        .map((point) => point.family));
      if (intervening.length > 512 || homeFamilies.size >= 2) return false;
    }
    const ids = JSON.stringify(photos.map((photo) => photo.evidence_id));
    const current = await db.getAllAsync<DiscoveryPhoto>(`
      SELECT e.evidence_id, e.source_ref, e.captured_day, e.captured_at_millis, e.source_origin,
        COALESCE('P:' || e.platform_duplicate_family_id, 'T:' || e.duplicate_tuple_fingerprint, 'S:' || e.evidence_id) AS family
      FROM canonical_evidence e
      WHERE e.evidence_id IN (SELECT value FROM json_each(?2))
        AND e.media_type = 'image' AND e.availability IN ('available', 'unknown')
        AND e.latitude IS NULL AND e.longitude IS NULL
        AND COALESCE(e.source_origin, 'capture-like') = 'capture-like' AND COALESCE(e.support_eligible, 1) = 1
        AND e.evidence_id NOT IN (SELECT child_id FROM reconstruction_link WHERE run_id = ?1 AND (link_kind = 'visit-support' OR link_kind LIKE 'membership:%'))
        AND NOT EXISTS (SELECT 1 FROM visual_place_album attachment WHERE attachment.evidence_id = e.evidence_id AND attachment.manual_id IS NOT ?3)
        AND NOT EXISTS (SELECT 1 FROM correction_overlays overlay WHERE overlay.target_kind = 'evidence' AND overlay.target_id = e.evidence_id)
        AND NOT EXISTS (SELECT 1 FROM journey_memory_correction_revision memory WHERE memory.source_evidence_id = e.evidence_id)`, stamp.run, ids, proposal.correctionId);
    const currentById = new Map(current.map((row) => [row.evidence_id, row]));
    return photos.every((photo) => !privacy.protectedEvidence.has(photo.evidence_id) && [currentById.get(photo.evidence_id)].some((row) => row &&
      row.evidence_id === photo.evidence_id && row.source_ref === photo.source_ref && row.captured_day === photo.captured_day
      && row.captured_at_millis === photo.captured_at_millis && row.family === photo.family && row.source_origin === photo.source_origin));
  }

  async function eligibleVisualOffers(db: Database, stamp: CandidateShadowStamp) {
    if (!stamp.run || stamp.evidence !== stamp.run_evidence || stamp.home !== stamp.run_home) return [];
    const privacy = await privacyFilter(db, stamp.run);
    const rows = await db.getAllAsync<VisualEvidence>(visualEvidenceSql, stamp.run, JSON.stringify([...privacy.blocked]));
    if (rows.length > 400) return [];
    return visualOffers(rows.filter((row) => !privacy.protectedEvidence.has(row.evidence_id)));
  }

  async function visualDateOffer(db: Database, stamp: CandidateShadowStamp, dateQuery: VisualDateQuery): Promise<VisualOffer | null> {
    if (!validVisualDateQuery(dateQuery)) throw new VisualPlaceError('HISTORY_CONSENT');
    if (!stamp.run || stamp.evidence !== stamp.run_evidence || stamp.home !== stamp.run_home) throw new VisualPlaceError('HISTORY_STALE');
    const { start, end, page } = dateQuery;
    const privacy = await privacyFilter(db, stamp.run);
    const rows = await db.getAllAsync<VisualEvidence>(visualDateEvidenceSql, stamp.run, start, end,
      JSON.stringify([...privacy.protectedEvidence]), visualDatePageSize + 1, page * visualDatePageSize);
    await assertPrivacyReadCurrent(db, privacy.revision);
    const photos = rows.slice(0, visualDatePageSize);
    return photos.length ? { key: JSON.stringify(['date', start, end, photos.map(({ evidence_id }) => evidence_id)]),
      photos, start, end, dateQuery: { ...dateQuery }, hasMore: rows.length > visualDatePageSize } : null;
  }

  async function visualAlbumRows(db: Database, manualId: string, run: number) {
    const attachment = await db.getFirstAsync('SELECT 1 FROM visual_place_album WHERE manual_id = ? LIMIT 1', manualId);
    if (!attachment) return { revision: 0, attached: false, rows: [] };
    const privacy = await privacyFilter(db, run);
    if (privacy.manual.has(manualId)) throw new VisualPlaceError('ACCESS');
    const stamp = await candidateShadowStamp(db);
    if (stamp?.state !== 'connected' || stamp.run_evidence !== stamp.evidence) throw new VisualPlaceError('HISTORY_STALE');
    const rows = await db.getAllAsync<{ slot: number; evidence_id: string; source_ref: string | null; availability: 'available' | 'unavailable' }>(`
      SELECT attachment.slot, attachment.evidence_id, evidence.source_ref,
        CASE WHEN evidence.availability IN ('available', 'unknown') THEN 'available' ELSE 'unavailable' END AS availability
      FROM visual_place_album attachment LEFT JOIN canonical_evidence evidence
        ON evidence.evidence_id = attachment.evidence_id AND evidence.source_ref = attachment.source_ref
        AND evidence.media_type = 'image' AND evidence.latitude IS NULL AND evidence.longitude IS NULL
      WHERE attachment.manual_id = ? ORDER BY attachment.slot`, manualId);
    await assertPrivacyReadCurrent(db, privacy.revision);
    return { revision: privacy.revision, attached: rows.length > 0, rows: rows.filter((row) => !privacy.protectedEvidence.has(row.evidence_id)) };
  }

  async function visualAlbumSnapshot(db: Database, manualId: string, run: number, revision: number) {
    const record = await db.getFirstAsync<{ command: string; stops: string }>(
      'SELECT command, stops FROM visual_place_trip WHERE manual_id = ?', manualId);
    if (!record) return { token: run, destinationNames: [] };
    const stops = readVisualJson<VisualStop[]>(record.stops);
    if (!Array.isArray(stops) || stops.length < 2 || stops.some((stop) => !stop || !resolveVisualPlace(stop.placeId))) {
      throw new VisualPlaceError('MEDIA_SCHEMA');
    }
    const prior = visualAlbumTokens.get(manualId);
    const snapshot = prior?.run === run && prior.revision === revision && prior.command === record.command
      ? prior : { run, revision, command: record.command, token: nextVisualAlbumToken-- };
    visualAlbumTokens.set(manualId, snapshot);
    const namedStops = stops.filter((stop) => !isVisualLocality(stop.placeId));
    return { token: snapshot.token, destinationNames: [...new Set(namedStops.map((stop) => resolveVisualPlace(stop.placeId)!.label))] };
  }

  /** Decision 0019/0020's GPS-less confirmed album. Mirrors visualAlbumRows,
   * minus the candidate-shadow staleness check: there is no live discovery
   * pipeline behind this data to go stale against — it is a fixed set
   * resolved once at confirm time (travel-window/storage.ts). */
  async function travelAlbumRows(db: Database, manualId: string, run: number) {
    const attachment = await db.getFirstAsync('SELECT 1 FROM travel_window_album WHERE manual_id = ? LIMIT 1', manualId);
    if (!attachment) return { revision: 0, attached: false, rows: [] };
    const privacy = await privacyFilter(db, run);
    if (privacy.manual.has(manualId)) throw new Error('Journey is private. Review Privacy Settings to restore it.');
    const rows = await db.getAllAsync<{ slot: number; evidence_id: string; source_ref: string | null; availability: 'available' | 'unavailable' }>(`
      SELECT attachment.slot, attachment.evidence_id, evidence.source_ref,
        CASE WHEN evidence.availability IN ('available', 'unknown') THEN 'available' ELSE 'unavailable' END AS availability
      FROM travel_window_album attachment LEFT JOIN canonical_evidence evidence
        ON evidence.evidence_id = attachment.evidence_id AND evidence.source_ref = attachment.source_ref
      WHERE attachment.manual_id = ? ORDER BY attachment.slot`, manualId);
    await assertPrivacyReadCurrent(db, privacy.revision);
    return { revision: privacy.revision, attached: rows.length > 0, rows: rows.filter((row) => !privacy.protectedEvidence.has(row.evidence_id)) };
  }

  async function candidateCommittedPartition(db: Database, run: number, journeyId: string) {
    const rows = await db.getAllAsync<{ visit_id: string; evidence_id: string }>(`SELECT journey.child_id AS visit_id, support.child_id AS evidence_id
      FROM reconstruction_link journey JOIN reconstruction_link support
        ON support.run_id = journey.run_id AND support.link_kind = 'visit-support' AND support.parent_id = journey.child_id
      WHERE journey.run_id = ? AND journey.link_kind = 'journey-visit' AND journey.parent_id = ?`, run, journeyId);
    const groups = new Map<string, string[]>();
    for (const row of rows) {
      const group = groups.get(row.visit_id) ?? [];
      group.push(row.evidence_id);
      groups.set(row.visit_id, group);
    }
    return candidatePartition([...groups.values()]);
  }

  function findCandidateDecision(db: Database, commandKey: string) {
    return db.getFirstAsync<CandidateDecisionReceipt>(`SELECT revision_id, source_run_id, journey_id, action, state, reviewed_support_json,
      reviewed_visits_json, reviewed_family_snapshot_json FROM journey_correction_revision WHERE command_key = ?`, commandKey);
  }

  function findCandidateRejection(db: Database, commandKey: string) {
    return db.getFirstAsync<CandidateRejectionReceipt>('SELECT policy_version, support_signature FROM recognizable_candidate_rejection WHERE command_key = ?', commandKey);
  }

  function assertExactCandidateDecision(receipt: CandidateDecisionReceipt, expected: CandidateShadowStamp, target: CandidateReviewTarget, action: string) {
    if (receipt.source_run_id !== expected.run || receipt.journey_id !== target.journeyId || receipt.action !== action
      || receipt.reviewed_support_json !== target.reviewedSupport || receipt.reviewed_visits_json !== target.reviewedVisits
      || receipt.reviewed_family_snapshot_json !== target.families) throw new CandidateDecisionGuard('HISTORY_CONFLICT');
    if (receipt.state !== 'effective') throw new CandidateDecisionGuard('HISTORY_STALE');
  }

  async function verifyCandidateDecision(db: Database, run: number, revisionId: string, target: CandidateReviewTarget) {
    const result = await db.getFirstAsync<{ target_kind: string; journey_id: string | null; classification: string | null }>(`SELECT
      application.target_kind, application.journey_id, qualification.classification
      FROM journey_correction_application application LEFT JOIN reconstruction_trip_qualification qualification
        ON qualification.run_id = application.run_id AND qualification.journey_id = application.journey_id
      WHERE application.revision_id = ? AND application.run_id = ? AND application.application_state = 'effective'`, revisionId, run);
    return result?.target_kind === 'journey' && result.classification === 'USER_CONFIRMED'
      && result.journey_id !== null && await candidateCommittedPartition(db, run, result.journey_id) === target.partition;
  }
  async function openConnection() {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const sqlite = require('expo-sqlite') as { openDatabaseAsync(name: string, options?: { useNewConnection?: boolean }): Promise<Database> };
      // Expo SQLite can retain a released cached native handle after Android
      // recreates the React runtime while the process survives. The import
      // repository owns its cached connection; reconstruction gets a fresh
      // handle and the existing transaction gate serializes their writers.
      assertReplicaOpen(databaseName);
      const db = serializeNativeTransactions(trackReplicaConnection(databaseName,await sqlite.openDatabaseAsync(databaseName, { useNewConnection: true })));
      await db.execAsync('PRAGMA busy_timeout = 30000');
      return db;
  }
  async function open() {
    return database ??= openConnection().catch((error) => { database = null; throw error; });
  }
  async function openProjectionWriter() {
    return projectionWriter ??= openConnection().catch((error) => { projectionWriter = null; throw error; });
  }

  function forgetReleasedNativeHandle(error: unknown) {
    // Do not replay an owner mutation automatically. Dropping only a known
    // released handle lets the owner's explicit Retry open a fresh connection.
    if (error instanceof Error && /nullpointerexception|released native handle/i.test(error.message)) database = null;
  }

  async function replayDraftWrite<T>(operation: () => Promise<T>) {
    try {
      return await operation();
    } catch (error) {
      forgetReleasedNativeHandle(error);
      throw error;
    }
  }

  async function validateReplayScope(db: Database, snapshotToken: number | undefined, privacyRevision: number | undefined) {
    const lifecycle = await db.getFirstAsync<{ state: string }>('SELECT state FROM private_record_lifecycle WHERE record_id = 1');
    const completed = await loadPublishedRun(db);
    const revision = (await db.getFirstAsync<{ revision: number | null }>('SELECT MAX(revision) AS revision FROM journey_privacy_revision'))?.revision ?? 0;
    if (lifecycle?.state !== 'connected' || completed?.run_id !== snapshotToken || revision !== privacyRevision) throw new ReplayDraftStaleError('Replay draft is stale.', 'scope', 'scope');
  }
  async function findReplayReceipt(db: Database, mutation: ReplayMutation | undefined, kind: string, digest: string) {
    if (!mutation) return null;
    const receipt = await db.getFirstAsync<ReplayMutationReceipt>('SELECT * FROM replay_mutation_receipt WHERE operation_id = ?', mutation.operationId);
    if (receipt && (receipt.payload_digest !== digest || receipt.kind !== kind || receipt.session_id !== mutation.sessionId || receipt.edit_version !== mutation.editVersion)) throw new ReplayDraftStaleError('Replay draft conflict.', 'revision', 'receipt');
    return receipt;
  }
  async function recordReplayReceipt(db: Database, mutation: ReplayMutation | undefined, kind: string, digest: string, snapshotToken: number | undefined, privacyRevision: number | undefined, revision: number) {
    if (!mutation) return;
    await db.runAsync('INSERT INTO replay_mutation_receipt (operation_id, session_id, edit_version, kind, payload_digest, snapshot_token, privacy_revision, resulting_revision, created_at_millis) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', mutation.operationId, mutation.sessionId, mutation.editVersion, kind, digest, snapshotToken ?? 0, privacyRevision ?? 0, revision, Date.now());
    await db.runAsync('UPDATE replay_draft SET working_session_id = ?, working_edit_version = ? WHERE record_id = 1', mutation.sessionId, mutation.editVersion);
    // A receipt becomes visible only with its settled mutation. The serialized
    // session cannot start a successor until that result reconciles; retain the
    // just-written receipt explicitly, including when timestamps tie.
    await db.runAsync('DELETE FROM replay_mutation_receipt WHERE operation_id <> ? AND operation_id NOT IN (SELECT operation_id FROM replay_mutation_receipt WHERE operation_id <> ? ORDER BY created_at_millis DESC, rowid DESC LIMIT 31)', mutation.operationId, mutation.operationId);
  }

  async function privacyFilter(db: Database, runId: number, policyId?: string, capturedEvidence?: EvidenceRow[]) {
    const revision = (await db.getFirstAsync<{ revision: number | null }>('SELECT MAX(revision) AS revision FROM journey_privacy_revision'))?.revision ?? 0;
    const policyRows = (await db.getAllAsync<PrivacyRevision>(activePrivacySql)) ?? [];
    for (const policy of policyRows) assertPrivacyRevision(policy);
    const policies = policyRows.filter((policy) => policyId === undefined || policy.policy_id === policyId);
    const blocked = new Set<string>();
    const manual = new Set<string>();
    const excluded = new Set<string>();
    const protectedEvidence = new Set<string>();
    const protectedFamilies = new Set<string>();
    for (const policy of policies) {
      if (policy.target_kind === 'manual' && policy.manual_id) manual.add(policy.manual_id);
      for (const id of reviewedPrivacyIds(policy.reviewed_evidence_json)) {
        protectedEvidence.add(id);
        if (policy.action === 'exclude') excluded.add(id);
      }
      for (const key of reviewedPrivacyIds(policy.reviewed_family_json)) protectedFamilies.add(key);
    }
    if (policies.some((policy) => policy.target_kind === 'inferred')) {
      const evidence = capturedEvidence ?? await db.getAllAsync<EvidenceRow>('SELECT evidence_id, captured_at_millis, captured_day, has_precise_offset, availability, latitude, longitude, reported_accuracy_meters, platform_duplicate_family_id, source_origin, support_eligible, duplicate_tuple_version, duplicate_tuple_fingerprint FROM canonical_evidence');
      const families = resolveVerifiedDuplicateFamilies(evidence);
      for (const row of evidence) {
        if (protectedFamilies.has(families.keyForEvidence(row.evidence_id)) || (row.platform_duplicate_family_id && protectedFamilies.has(`P:${row.platform_duplicate_family_id}`))) protectedEvidence.add(row.evidence_id);
      }
      // An overlap with any successor withholds it, including ambiguous splits
      // and merges. It never silently transfers or expands the reviewed policy.
      const links = await db.getAllAsync<{ journey_id: string; evidence_id: string }>(`SELECT journey.parent_id AS journey_id, support.child_id AS evidence_id
        FROM reconstruction_link journey JOIN reconstruction_link support ON support.run_id = journey.run_id AND support.parent_id = journey.child_id AND support.link_kind = 'visit-support'
        WHERE journey.run_id = ? AND journey.link_kind = 'journey-visit'
        UNION SELECT parent_id AS journey_id, child_id AS evidence_id FROM reconstruction_link WHERE run_id = ? AND link_kind LIKE 'membership:%'`, runId, runId);
      for (const link of links) if (protectedEvidence.has(link.evidence_id)) blocked.add(link.journey_id);
    }
    return { revision, policies, blocked, manual, excluded, protectedEvidence };
  }

  async function assertPrivacyReadCurrent(db: Database, revision: number) {
    const current = (await db.getFirstAsync<{ revision: number | null }>('SELECT MAX(revision) AS revision FROM journey_privacy_revision'))?.revision ?? 0;
    const lifecycle = await db.getFirstAsync<{ state: string }>('SELECT state FROM private_record_lifecycle WHERE record_id = 1');
    if (current !== revision || lifecycle?.state !== 'connected') throw new Error('Private record changed during this read. Reopen it before continuing.');
  }

  async function assertPrivacyVisible(db: Database, displayId: string, selected?: { runId: number; journeyId: string }) {
    if (selected) {
      const home = await db.getFirstAsync<{ committed: number; current: number }>(`SELECT run.home_revision AS committed, context.revision AS current
        FROM reconstruction_run run CROSS JOIN home_projection_context context WHERE run.run_id = ? AND context.record_id = 1`, selected.runId);
      if (home && home.committed !== home.current) throw new Error('Journey is no longer available.');
    }
    const filter = await privacyFilter(db, selected?.runId ?? 0);
    if (displayId.startsWith('manual:') ? filter.manual.has(displayId.slice(7)) : !selected || filter.blocked.has(selected.journeyId)) throw new Error('Journey is private. Review Privacy Settings to restore it.');
    await assertPrivacyReadCurrent(db, filter.revision);
    return filter.revision;
  }

  async function readDestinationLabels(db: Database, runId: number, journeyId: string | null = null, setStage?: (stage: 'DURABLE_DESTINATION_QUERY' | 'DURABLE_DESTINATION_COMPUTATION') => void) {
    type SupportRow = EvidenceRow & { journey_id: string; place_id: string; visit_id: string };
    const batchSize = 256;
    const support: SupportRow[] = [];
    const seen = new Set<string>();
    let cursor: SupportRow | undefined;
    setStage?.('DURABLE_DESTINATION_QUERY');
    while (true) {
      // Traverse the two link primary keys in order. Sorting by place would
      // rebuild the joined result before SQLite could return each page.
      const seek = cursor ? [cursor.journey_id, cursor.visit_id, cursor.journey_id, cursor.visit_id, cursor.evidence_id] : [];
      const batch: SupportRow[] = await db.getAllAsync<SupportRow>(`
      SELECT journey.parent_id AS journey_id, visit.place_id, journey.child_id AS visit_id,
        evidence.evidence_id, evidence.captured_at_millis, evidence.captured_day,
        evidence.has_precise_offset, evidence.availability, evidence.latitude, evidence.longitude,
        evidence.reported_accuracy_meters, evidence.platform_duplicate_family_id,
        evidence.source_origin, evidence.support_eligible, evidence.duplicate_tuple_version,
        evidence.duplicate_tuple_fingerprint
      FROM reconstruction_link journey
      ${journeyId === null ? `CROSS JOIN reconstruction_trip_qualification qualification ON qualification.run_id = journey.run_id
        AND qualification.journey_id = journey.parent_id
        AND qualification.classification IN ('AUTO_CONFIRMED', 'USER_CONFIRMED')` : ''}
      CROSS JOIN reconstruction_visit visit ON visit.run_id = journey.run_id AND visit.visit_id = journey.child_id
      CROSS JOIN reconstruction_link support ON support.run_id = visit.run_id
        AND support.link_kind = 'visit-support' AND support.parent_id = visit.visit_id
      CROSS JOIN canonical_evidence evidence ON evidence.evidence_id = support.child_id
      WHERE journey.run_id = ? AND journey.link_kind = 'journey-visit'
        AND (? IS NULL OR journey.parent_id = ?)
        ${cursor ? `AND (journey.parent_id, journey.child_id) >= (?, ?)
          AND (journey.parent_id, journey.child_id, support.child_id) > (?, ?, ?)` : ''}
      ORDER BY journey.parent_id, journey.child_id, support.child_id
      LIMIT ?
    `, runId, journeyId, journeyId, ...seek, batchSize);
      for (const row of batch) {
        // A place may contain several visits that link to the same evidence.
        const key = JSON.stringify([row.journey_id, row.place_id, row.evidence_id]);
        if (seen.has(key)) continue;
        seen.add(key);
        support.push(row);
      }
      if (batch.length < batchSize) break;
      cursor = batch[batch.length - 1];
    }
    setStage?.('DURABLE_DESTINATION_COMPUTATION');
    const families = resolveVerifiedDuplicateFamilies(support);
    const grouped = new Map<string, DestinationSupport[]>();
    for (const row of support) {
      if (row.availability === 'unavailable' || !families.supportEligible(row.evidence_id) || families.conflictForEvidence(row.evidence_id)) continue;
      const items = grouped.get(row.journey_id) ?? [];
      items.push({
        placeId: row.place_id, familyId: families.keyForEvidence(row.evidence_id),
        latitude: row.latitude, longitude: row.longitude, reportedAccuracyMeters: row.reported_accuracy_meters,
        capturedDay: row.captured_day,
      });
      grouped.set(row.journey_id, items);
    }
    const labels = new Map<string, string>();
    const resolvedPoints = new Map<string, ReturnType<typeof import('./country-resolver').resolveDestination>>();
    for (const [id, items] of grouped) labels.set(id, await destinationLabel(items, journeyId !== null, resolvedPoints));
    return labels;
  }

  async function activeMaintenanceLease(db: Database, nowMillis: number) {
    const maintenance = await db.getFirstAsync<{ expires_at_millis: number }>('SELECT expires_at_millis FROM maintenance_lease WHERE record_id = 1');
    return maintenance !== null && maintenance.expires_at_millis > nowMillis;
  }

  async function acquireLease(nowMillis: number, setStage: (stage: ReconciliationStage) => void): Promise<number | null> {
    setStage('LEASE_OPEN');
    const db = await open();
    // An OS-invoked metadata pass uses this durable lease from another JS
    // runtime. Reading it first avoids racing its active writer for SQLite's
    // exclusive transaction lock; its owner will reconcile the queue itself.
    setStage('MAINTENANCE_LEASE_READ');
    if (await activeMaintenanceLease(db, nowMillis)) return null;
    setStage('LEASE_WRITE');
    try {
      await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
    } catch (error) {
      // A task can acquire its durable maintenance lease between the read
      // above and this write. Recheck once to classify that race without
      // retrying an unknown SQLite failure or adding another write.
      try {
        setStage('MAINTENANCE_LEASE_READ');
        if (await activeMaintenanceLease(db, nowMillis)) return null;
      } catch {
        // Preserve the original write-lock failure when the read cannot run.
      }
      setStage('LEASE_WRITE');
      throw error;
    }
    try {
      const lifecycle = await db.getFirstAsync<{ state: string }>('SELECT state FROM private_record_lifecycle WHERE record_id = 1');
      if (lifecycle?.state !== 'connected') throw new Error('Private record is not connected.');
      const existing = await db.getFirstAsync<{ expires_at_millis: number }>('SELECT expires_at_millis FROM reconciliation_lease WHERE record_id = 1');
      if (existing && existing.expires_at_millis > nowMillis) { await db.execAsync('COMMIT'); return null; }
      const sequence = await db.getFirstAsync<{ next_token: number }>('SELECT next_token FROM reconciliation_run_sequence WHERE record_id = 1');
      const token = sequence?.next_token ?? 1;
      await db.runAsync('INSERT INTO reconciliation_run_sequence (record_id, next_token) VALUES (?, ?) ON CONFLICT(record_id) DO UPDATE SET next_token=excluded.next_token', 1, token + 1);
      await db.runAsync('INSERT INTO reconciliation_lease (record_id, owner_token, expires_at_millis) VALUES (?, ?, ?) ON CONFLICT(record_id) DO UPDATE SET owner_token=excluded.owner_token, expires_at_millis=excluded.expires_at_millis', 1, token, nowMillis + RECONCILIATION_LEASE_MILLIS);
      await db.execAsync('COMMIT');
      return token;
    } catch (error) { await db.execAsync('ROLLBACK'); throw error; }
  }

  async function releaseLease(token: number) {
    await (await open()).runAsync('DELETE FROM reconciliation_lease WHERE record_id = 1 AND owner_token = ?', token);
  }

  async function saveOutcome(status: 'pending' | 'restricted' | 'error', message: string) {
    const db = await open();
    await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
    try {
      await db.runAsync('UPDATE reconciliation_state SET status = ?, message = ? WHERE record_id = 1', status, message);
      await db.runAsync('UPDATE reconciliation_checkpoint SET status = ?, message = ? WHERE record_id = 1', status, message);
      await db.execAsync('COMMIT');
    } catch (error) { await db.execAsync('ROLLBACK'); throw error; }
  }

  async function saveNoQueuedOutcome(nowMillis: number) {
    const db = await open();
    await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
    try {
      await db.runAsync("UPDATE reconciliation_state SET status = 'complete', last_checked_at_millis = ?, last_updated_at_millis = ?, new_journey_count = 0, updated_journey_count = 0, message = ? WHERE record_id = 1", nowMillis, nowMillis, 'No local journey updates were waiting.');
      await db.runAsync("UPDATE reconciliation_checkpoint SET status = 'complete', message = ? WHERE record_id = 1", 'No local journey updates were waiting.');
      await db.execAsync('COMMIT');
    } catch (error) { await db.execAsync('ROLLBACK'); throw error; }
  }

  async function recordPendingCorrectionRemap(revisionId: string) {
    const db = await open();
    await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
    try {
      const lifecycle = await db.getFirstAsync<{ state: string }>('SELECT state FROM private_record_lifecycle WHERE record_id = 1');
      if (lifecycle?.state !== 'connected') throw new Error('Private record is not connected.');
      const revision = await db.getFirstAsync<{ source_run_id: number }>(
        "SELECT source_run_id FROM journey_correction_revision WHERE revision_id = ? AND state = 'effective'", revisionId,
      );
      if (!revision) {
        const memoryRevision = await db.getFirstAsync<{ source_run_id: number }>(
          "SELECT source_run_id FROM journey_memory_correction_revision WHERE revision_id = ? AND state = 'effective'", revisionId,
        );
        if (!memoryRevision) { await db.execAsync('COMMIT'); return; }
        const existing = await db.getFirstAsync<{ candidate_id: string }>(
          "SELECT candidate_id FROM journey_memory_correction_candidate WHERE revision_id = ? AND state = 'pending_remap' LIMIT 1", revisionId,
        );
        if (existing) { await db.execAsync('COMMIT'); return; }
        const candidateId = `memory-candidate-${revisionId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        await db.runAsync(`INSERT INTO journey_memory_correction_candidate (candidate_id, revision_id, base_run_id, state, reason, created_at_millis)
          VALUES (?, ?, ?, 'pending_remap', ?, ?)`, candidateId, revisionId, memoryRevision.source_run_id, 'The selected memory or its reviewed target no longer maps uniquely to this rebuilt journey.', Date.now());
        await db.execAsync('COMMIT'); return;
      }
      const existing = await db.getFirstAsync<{ candidate_id: string }>(
        "SELECT candidate_id FROM journey_correction_candidate WHERE revision_id = ? AND state = 'pending_remap' LIMIT 1", revisionId,
      );
      if (existing) { await db.execAsync('COMMIT'); return; }
      const candidateId = `candidate-${revisionId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      await db.runAsync(
        `INSERT INTO journey_correction_candidate (candidate_id, revision_id, base_run_id, state, reason, created_at_millis)
         VALUES (?, ?, ?, 'pending_remap', ?, ?)`,
        candidateId, revisionId, revision.source_run_id, 'Reviewed support did not map uniquely to a successor.', Date.now(),
      );
      await db.execAsync('COMMIT');
    } catch (error) { await db.execAsync('ROLLBACK'); throw error; }
  }

  /**
   * A transient native-source failure can complete a reconstruction pass with
   * no qualified journeys.  Keep the last non-empty projection for the same
   * evidence revision available until a later authoritative pass replaces it.
   * Current privacy filters are still applied by each caller.
   */
  async function loadPublishedRun(db: Database) {
    const latest = await db.getFirstAsync<{ run_id: number }>("SELECT MAX(run_id) AS run_id FROM reconstruction_run WHERE status = 'complete'");
    if (!latest) return null;
    const home = await db.getFirstAsync<{ committed: number; current: number; configured?: number }>(`SELECT run.home_revision AS committed, context.revision AS current,
      EXISTS(SELECT 1 FROM configured_home_area) AS configured
      FROM reconstruction_run run CROSS JOIN home_projection_context context WHERE run.run_id = ? AND context.record_id = 1`, latest.run_id);
    if (home && home.committed !== home.current) return null;
    if (home && (home.committed > 0 || home.configured === 1)) return latest;
    const latestRevision = await db.getFirstAsync<{ evidence_revision: number }>('SELECT evidence_revision FROM reconstruction_run WHERE run_id = ?', latest.run_id);
    if (!latestRevision) return latest;
    const retained = await db.getFirstAsync<{ run_id: number }>(`
      SELECT run.run_id
      FROM reconstruction_run run
      WHERE run.status = 'complete'
        AND run.evidence_revision = ?
        AND EXISTS (
          SELECT 1 FROM reconstruction_trip_qualification qualification
          WHERE qualification.run_id = run.run_id
            AND qualification.classification IN ('AUTO_CONFIRMED', 'USER_CONFIRMED')
        )
      ORDER BY run.run_id DESC
      LIMIT 1
    `, latestRevision.evidence_revision);
    return retained ?? latest;
  }

  async function readReplayRecoveryProtection(db: Database) {
    const draft = await db.getFirstAsync<{ committed_overrides_json: string; working_overrides_json: string | null }>(
      'SELECT committed_overrides_json, working_overrides_json FROM replay_draft WHERE record_id = 1');
    const ids = new Set<string>();
    if (!draft) return { ids, ambiguous: false };
    for (const text of [draft.committed_overrides_json, draft.working_overrides_json]) {
      if (!text) continue;
      try {
        const parsed = JSON.parse(text) as Record<string, unknown>;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ids, ambiguous: true };
        for (const key of ['keptEvidenceIds', 'excludedEvidenceIds', 'orderedEvidenceIds']) {
          const legacy = parsed[key];
          if (legacy !== undefined && (!Array.isArray(legacy) || legacy.length > 0)) return { ids, ambiguous: true };
        }
        for (const key of ['excludedGroupJourneyIds', 'autoGroupJourneyIds', 'keptMemoryRefs', 'excludedMemoryRefs', 'orderedMemoryRefs']) {
          const preferences = parsed[key];
          if (preferences === undefined) continue;
          if (!Array.isArray(preferences) || preferences.some((value) => typeof value !== 'string')) return { ids, ambiguous: true };
          for (const value of preferences) {
            if (key.endsWith('JourneyIds')) ids.add(value);
            else {
              const reference: unknown = JSON.parse(value);
              if (!Array.isArray(reference) || reference.length !== 2 || reference.some((part) => typeof part !== 'string')) return { ids, ambiguous: true };
              ids.add(reference[0]);
            }
          }
        }
      } catch { return { ids, ambiguous: true }; }
    }
    return { ids, ambiguous: false };
  }

  async function readPublishedMergePairs(db: Database, runId: number) {
    if (databaseName !== 'travel-life-import-v1.db') return [];
    const proposals = await db.getFirstAsync(`
      SELECT 1 FROM reconstruction_link WHERE run_id = ? AND link_kind = 'possible-merge:adjacent-gap' LIMIT 1
    `, runId);
    if (!proposals) return [];
    const replay = await readReplayRecoveryProtection(db);
    if (replay.ambiguous) return [];
    return db.getAllAsync<{ left_id: string; right_id: string }>(`
      WITH ordered AS (
        SELECT j.journey_id, COUNT(DISTINCT v.visit_id) AS visit_count,
          MIN(e.captured_at_millis) AS first_time, MAX(e.captured_at_millis) AS last_time,
          MIN(v.ordering = 'ordered') AS chronological,
          ROW_NUMBER() OVER (ORDER BY MIN(e.captured_at_millis), j.journey_id) AS position
        FROM reconstruction_journey j
        JOIN reconstruction_link l ON l.run_id = j.run_id AND l.link_kind = 'journey-visit' AND l.parent_id = j.journey_id
        JOIN reconstruction_visit v ON v.run_id = j.run_id AND v.visit_id = l.child_id
        JOIN reconstruction_link s ON s.run_id = j.run_id AND s.link_kind = 'visit-support' AND s.parent_id = v.visit_id
        JOIN canonical_evidence e ON e.evidence_id = s.child_id
        WHERE j.run_id = ? GROUP BY j.journey_id
      )
      SELECT proposal.parent_id AS left_id, proposal.child_id AS right_id
      FROM reconstruction_link proposal
      JOIN ordered a ON a.journey_id = proposal.parent_id
      JOIN ordered b ON b.journey_id = proposal.child_id
      JOIN reconstruction_trip_qualification aq ON aq.run_id = proposal.run_id AND aq.journey_id = a.journey_id
      JOIN reconstruction_trip_qualification bq ON bq.run_id = proposal.run_id AND bq.journey_id = b.journey_id
      WHERE proposal.run_id = ? AND proposal.link_kind = 'possible-merge:adjacent-gap'
        AND proposal.run_id = (SELECT MAX(run_id) FROM reconstruction_run WHERE status = 'complete')
        AND a.visit_count = 1 AND b.visit_count = 1 AND a.chronological = 1 AND b.chronological = 1
        AND a.position + 1 = b.position AND a.last_time < b.first_time
        AND aq.classification = 'AUTO_CONFIRMED' AND bq.classification = 'AUTO_CONFIRMED'
        AND NOT EXISTS (
          SELECT 1 FROM journey_correction_application c
          WHERE c.run_id = proposal.run_id AND c.journey_id IN (a.journey_id, b.journey_id)
        )
        AND NOT EXISTS (SELECT 1 FROM json_each(?) pinned WHERE pinned.value IN (a.journey_id, b.journey_id))
      ORDER BY a.position LIMIT 50
    `, runId, runId, JSON.stringify([...replay.ids]));
  }

  return {
    async loadCandidateShadowSnapshot(options: CandidateShadowOptions): Promise<CandidateShadowResult> {
      const correlationId = options.correlationId ?? createDiagnosticCorrelationId();
      const compare = options.purpose !== 'reveal';
      const startedAt = Date.now();
      const checkpoint = () => {
        if (options.signal?.aborted) throw new NativeTransactionWithdrawnError();
      };
      const yieldComparison = async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        checkpoint();
      };
      let stage: 'CANDIDATE_INPUT_READ' | 'CANDIDATE_CLASSIFY' | 'CANDIDATE_PRESENTATION' | 'CANDIDATE_READBACK' = 'CANDIDATE_INPUT_READ';
      const report = (reasonCode: Parameters<typeof recordAppDiagnostic>[0]['reasonCode'],
        durableOutcome: Parameters<typeof recordAppDiagnostic>[0]['durableOutcome'], retryable = false) => {
        recordAppDiagnostic({ operation: 'ATLAS_REBUILD', stage, correlationId, reasonCode, durableOutcome, retryable });
      };
      report('START', 'unchanged');
      try {
        if (options.signal?.aborted) { report('SKIPPED', 'skipped'); return { status: 'stale' }; }
        if (databaseName !== 'travel-life-import-v1.db' || !await options.canUseSource()) {
          report(options.signal?.aborted ? 'SKIPPED' : 'ACCESS', options.signal?.aborted ? 'skipped' : 'blocked');
          return { status: options.signal?.aborted ? 'stale' : 'blocked' };
        }
        assertReplicaOpen(databaseName);
        const db = await open();
        const read = await runOwnedTransaction(db, { kind: 'foreground', mode: 'read', signal: options.signal }, async (snapshot) => {
          const stamp = await candidateShadowStamp(snapshot);
          if (!stamp || stamp.state !== 'connected') return { status: 'blocked' } as const;
          if (stamp.run === null || stamp.evidence === null || stamp.home === null) return { status: 'unavailable' } as const;
          if (stamp.run_evidence !== Math.max(stamp.evidence, stamp.overlay) || stamp.run_home !== stamp.home) return { status: 'stale' } as const;
          const columns = `SELECT evidence_id, source_ref, media_type,
            captured_at_millis, captured_day, has_precise_offset, availability, latitude, longitude, reported_accuracy_meters,
            platform_duplicate_family_id, source_origin, support_eligible, duplicate_tuple_version, duplicate_tuple_fingerprint
            FROM canonical_evidence`;
          type ShadowEvidenceRow = EvidenceRow & { source_ref: string };
          const rows: ShadowEvidenceRow[] = [];
          const limit = compare ? candidateComparisonEvidenceLimit : candidateShadowEvidenceLimit;
          let cursor: string | undefined;
          while (rows.length <= limit) {
            checkpoint();
            const pageLimit = Math.min(compare ? candidateComparisonPageSize : limit + 1, limit + 1 - rows.length);
            const page: ShadowEvidenceRow[] = cursor === undefined
              ? await snapshot.getAllAsync<ShadowEvidenceRow>(`${columns} ORDER BY evidence_id LIMIT ?`, pageLimit)
              : await snapshot.getAllAsync<ShadowEvidenceRow>(`${columns} WHERE evidence_id > ? ORDER BY evidence_id LIMIT ?`, cursor, pageLimit);
            rows.push(...page);
            if (!compare || page.length === 0) break;
            cursor = page.at(-1)!.evidence_id;
          }
          if (rows.length > limit) return { status: 'too-large' } as const;
          checkpoint();
          const privateFilter = await privacyFilter(snapshot, stamp.run, undefined, rows);
          const overlay = await snapshot.getAllAsync<{ target_id: string }>(`SELECT current.target_id FROM correction_overlays current
            JOIN (SELECT target_id, MAX(revision) AS revision FROM correction_overlays WHERE target_kind = 'evidence' AND correction_scope = 'inclusion' GROUP BY target_id) latest
              ON latest.target_id = current.target_id AND latest.revision = current.revision
            WHERE current.target_kind = 'evidence' AND current.correction_scope = 'inclusion' AND current.owner_action = 'remove'`);
          const excluded = new Set([...privateFilter.excluded, ...overlay.map(({ target_id }) => target_id)]);
          const withheld = new Set(privateFilter.protectedEvidence);
          if (privateFilter.blocked.size) {
            const blocked = JSON.stringify([...privateFilter.blocked]);
            const links = await snapshot.getAllAsync<{ evidence_id: string }>(`SELECT support.child_id AS evidence_id
              FROM reconstruction_link journey JOIN reconstruction_link support
                ON support.run_id = journey.run_id AND support.parent_id = journey.child_id AND support.link_kind = 'visit-support'
              WHERE journey.run_id = ? AND journey.link_kind = 'journey-visit' AND journey.parent_id IN (SELECT value FROM json_each(?))
              UNION SELECT child_id AS evidence_id FROM reconstruction_link
              WHERE run_id = ? AND link_kind LIKE 'membership:%' AND parent_id IN (SELECT value FROM json_each(?))`,
            stamp.run, blocked, stamp.run, blocked);
            for (const { evidence_id } of links) withheld.add(evidence_id);
          }
          const configuredHomeAreas = await snapshot.getAllAsync<import('./canonical-projection').CanonicalHomeRow>(
            'SELECT area_id, latitude, longitude, effective_start_day, effective_end_day, radius_meters FROM configured_home_area ORDER BY area_id');
          const storedCorrections = await snapshot.getAllAsync<JourneyCorrectionRevision>(`SELECT revision_id, action, source_run_id,
            reviewed_support_json, reviewed_visits_json, reviewed_family_snapshot_json, structural_boundary_json
            FROM journey_correction_revision WHERE state = 'effective' ORDER BY revision_id`);
          const storedMemoryCorrections = await snapshot.getAllAsync<MemoryCorrectionRevision>(`SELECT revision_id, action, source_evidence_id,
            reviewed_support_json, reviewed_family_snapshot_json, created_at_millis FROM journey_memory_correction_revision
            WHERE state = 'effective' ORDER BY created_at_millis, revision_id`);
          const rejections = options.purpose === 'reveal' ? await snapshot.getAllAsync<{ support_signature: string }>(
            'SELECT support_signature FROM recognizable_candidate_rejection WHERE policy_version = ? LIMIT ?', candidateTripPolicy.version, candidateShadowEvidenceLimit + 1) : [];
          if (rejections.length > candidateShadowEvidenceLimit) return { status: 'too-large' } as const;
          const qualifying = options.purpose === 'reveal' ? await snapshot.getAllAsync<{ evidence_id: string }>(`SELECT DISTINCT support.child_id AS evidence_id
            FROM reconstruction_trip_qualification qualification JOIN reconstruction_link journey
              ON journey.run_id = qualification.run_id AND journey.parent_id = qualification.journey_id AND journey.link_kind = 'journey-visit'
            JOIN reconstruction_link support ON support.run_id = journey.run_id AND support.parent_id = journey.child_id AND support.link_kind = 'visit-support'
            WHERE qualification.run_id = ? AND qualification.classification IN ('AUTO_CONFIRMED', 'USER_CONFIRMED')`, stamp.run) : [];
          checkpoint();
          return { status: 'captured', stamp, withheld, rejections, qualifying, input: { rows, excluded, privateFilter, configuredHomeAreas, storedCorrections, storedMemoryCorrections } } as const;
        });
        if (read.status !== 'captured') {
          report(options.signal?.aborted ? 'SKIPPED' : read.status === 'blocked' ? 'ACCESS' : read.status === 'stale' ? 'HISTORY_STALE' : read.status === 'too-large' ? 'ROW_LIMIT' : 'HISTORY_INCOMPLETE',
            read.status === 'blocked' ? 'blocked' : 'skipped');
          return { status: read.status };
        }

        stage = 'CANDIDATE_CLASSIFY';
        report('START', 'unchanged');
        if (compare) await yieldComparison();
        const { baseline, candidate } = await projectCanonicalCandidateHistory(read.input, undefined, compare ? yieldComparison : undefined, compare ? 'recovery' : undefined);
        if (compare) await yieldComparison();
        stage = 'CANDIDATE_PRESENTATION';
        report('START', 'unchanged');
        const rows = new Map(read.input.rows.map((row) => [row.evidence_id, row]));
        const visits = new Map(baseline.graph.visits.map((visit) => [visit.id, visit]));
        const withheldKeys = new Set([...read.withheld].map((id) => baseline.families.keyForEvidence(id)));
        const withheld = (id: string) => read.withheld.has(id) || read.input.excluded.has(id) || withheldKeys.has(baseline.families.keyForEvidence(id));
        const ownerMedia = new Set(read.input.storedMemoryCorrections.map(({ source_evidence_id }) => baseline.families.keyForEvidence(source_evidence_id)));
        const reference = (id: string, strict: boolean) => {
          const row = rows.get(id);
          if (!row?.source_ref || row.availability !== 'available' || (strict && ownerMedia.has(baseline.families.keyForEvidence(id)))) return [];
          return [row.source_ref];
        };
        const limit = Math.max(1, Math.min(candidateShadowCardLimit, Number.isSafeInteger(options.limit) ? options.limit! : 24));
        const cards: CandidateShadowCard[] = [];
        const reveal = options.purpose === 'reveal' ? new Map<string, CandidateRevealEntry>() : undefined;
        const rejected = new Set(read.rejections.map(({ support_signature }) => support_signature));
        const qualifyingKeys = new Set(read.qualifying.map(({ evidence_id }) => baseline.families.keyForEvidence(evidence_id)));
        const observed = new Map<string, RevealMapAnchor>();
        if (reveal) for (const place of baseline.graph.places) {
          if (observed.size >= recognizableObservationLimit) break;
          const item = place.memberIds.map((id) => rows.get(id)).find((row) => row?.availability === 'available'
            && !withheld(row.evidence_id) && baseline.families.supportEligible(row.evidence_id) && !baseline.families.conflictForEvidence(row.evidence_id));
          const anchor = item ? coarseMapAnchor(item.latitude, item.longitude) : null;
          if (anchor) observed.set(`${anchor.latitude},${anchor.longitude}`, anchor);
        }
        const baselineByPartition = new Map<string, string[]>();
        if (reveal) for (const journey of baseline.graph.journeys) {
          const groups = journey.visitIds.map((id) => visits.get(id)?.evidenceIds ?? []);
          const partition = candidatePartition(groups);
          baselineByPartition.set(partition, [...(baselineByPartition.get(partition) ?? []), journey.id]);
        }
        const allowedTrips = candidate.trips.filter((trip) => !trip.supportIds.some(withheld));
        const describeTrip = async (trip: CandidateTrip, allowed: ReadonlySet<string>, exactDay: boolean) => {
          const support = trip.visitIds.flatMap((id): DestinationSupport[] => {
            const visit = visits.get(id);
            if (!visit) return [];
            return visit.evidenceIds.flatMap((evidenceId): DestinationSupport[] => {
              const row = rows.get(evidenceId);
              return row && allowed.has(evidenceId) ? [{ placeId: visit.placeId, familyId: baseline.families.keyForEvidence(evidenceId),
                latitude: row.latitude, longitude: row.longitude, reportedAccuracyMeters: row.reported_accuracy_meters,
                capturedDay: row.captured_day }] : [];
            });
          });
          const dated = trip.supportIds.flatMap((id) => {
            const day = rows.get(id)?.captured_day;
            return day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? [day] : [];
          }).sort();
          const first = dated[0] ?? null;
          const last = dated.at(-1) ?? null;
          const firstLabel = exactDay ? observedDayLabel(first) : null;
          const lastLabel = exactDay ? observedDayLabel(last) : null;
          return { title: await destinationLabel(support), observedPeriod: firstLabel && lastLabel
            ? firstLabel === lastLabel ? firstLabel : `${firstLabel}–${lastLabel}`
            : monthRangeLabel(first, last, first ? Number(first.slice(0, 4)) : null, last ? Number(last.slice(0, 4)) : null) };
        };
        const separatePairs: RecognizableShadowPair[] = [];
        if (compare && candidate.mergeSuggestions.length) {
          const visibleTrips = new Set(allowedTrips.map(({ id }) => id));
          const supportSignature = (ids: readonly string[]) => JSON.stringify([...new Set(ids.map((id) => baseline.families.keyForEvidence(id)))].sort());
          const proposed = candidate.mergeSuggestions.filter(({ left, right }) => visibleTrips.has(left.id) && visibleTrips.has(right.id)).slice(0, limit)
            .map(({ left, right }) => ({ left, right, leftKey: supportSignature(left.supportIds), rightKey: supportSignature(right.supportIds),
              joinedKey: supportSignature([...left.supportIds, ...right.supportIds]) }));
          const targets = new Set(proposed.flatMap(({ leftKey, rightKey, joinedKey }) => [leftKey, rightKey, joinedKey]));
          const matches = new Map<string, number>();
          if (targets.size) for (const journey of baseline.graph.journeys) {
            const support = journey.visitIds.flatMap((id) => visits.get(id)?.evidenceIds ?? []);
            if (read.input.privateFilter.blocked.has(journey.id) || support.some(withheld)) continue;
            const key = supportSignature(support);
            if (targets.has(key)) matches.set(key, (matches.get(key) ?? 0) + 1);
          }
          for (const { left, right, leftKey, rightKey, joinedKey } of proposed) {
            checkpoint();
            const joined = matches.get(joinedKey) ?? 0;
            const leftMatches = matches.get(leftKey) ?? 0;
            const rightMatches = matches.get(rightKey) ?? 0;
            separatePairs.push({
              id: `comparison-pair-${separatePairs.length + 1}`,
              left: await describeTrip(left, new Set(left.supportIds), true),
              right: await describeTrip(right, new Set(right.supportIds), true),
              baselineGrouping: joined === 1 && !leftMatches && !rightMatches ? 'joined'
                : !joined && leftMatches === 1 && rightMatches === 1 ? 'separate' : 'unmatched',
            });
          }
        }
        const ranked = reveal ? allowedTrips.map((trip) => ({ trip, mediaCount: new Set(trip.supportIds.flatMap((id) => reference(id, true))).size }))
          .sort((a, b) => Math.min(recognizableTripMediaLimit, b.mediaCount) - Math.min(recognizableTripMediaLimit, a.mediaCount)
            || b.trip.visitIds.length - a.trip.visitIds.length || b.trip.supportKeys.length - a.trip.supportKeys.length || a.trip.id.localeCompare(b.trip.id))
          .map(({ trip }) => trip) : allowedTrips;
        let reliableCount = 0;
        let possibleCount = 0;
        for (const trip of ranked) {
          checkpoint();
          if (!reveal && cards.length >= limit) break;
          if (reveal && (trip.state === 'reliable' ? reliableCount >= 3 : possibleCount >= limit)) continue;
          const allowed = new Set(trip.supportIds);
          const groups = reveal ? trip.visitIds.map((id) => (visits.get(id)?.evidenceIds ?? []).filter((evidenceId) => allowed.has(evidenceId))) : [];
          const reviewedVisits = reveal ? groups.map((group) => [...new Set(group.map((id) => baseline.families.keyForEvidence(id)))].sort((a, b) => a.localeCompare(b))) : [];
          const supportKeys = reviewedVisits.flat().sort((a, b) => a.localeCompare(b));
          const stablePartition = reviewedVisits.length > 0 && reviewedVisits.every((visit) => visit.length > 0) && new Set(supportKeys).size === supportKeys.length;
          const families = stablePartition ? JSON.stringify(baseline.families.snapshotsFor(supportKeys)) : '{}';
          const signature = stablePartition ? JSON.stringify([candidatePartition(reviewedVisits), families]) : null;
          if (signature && rejected.has(signature)) continue;
          let coverIds = trip.supportIds;
          if (reveal) {
            const orderedIds = [...trip.supportIds].sort((left, right) => (rows.get(left)?.captured_at_millis ?? Infinity) - (rows.get(right)?.captured_at_millis ?? Infinity) || left.localeCompare(right));
            const firstPerVisit = groups.flatMap((group) => orderedIds.find((id) => group.includes(id) && reference(id, true).length) ?? []);
            coverIds = [...firstPerVisit, ...orderedIds];
          }
          const refs = [...new Set(coverIds.flatMap((id) => reference(id, Boolean(reveal))))].slice(0, recognizableTripMediaLimit);
          let target: CandidateReviewTarget | undefined;
          if (reveal && trip.state === 'possible' && refs.length) {
            const partition = candidatePartition(groups);
            const matches = baselineByPartition.get(partition);
            if (matches?.length === 1 && !read.input.privateFilter.blocked.has(matches[0]) && stablePartition) {
              target = { journeyId: matches[0], partition, reviewedSupport: JSON.stringify(supportKeys), reviewedVisits: JSON.stringify(reviewedVisits), families };
            }
          }
          const card: CandidateShadowCard = { id: `shadow-${read.stamp.run}-${cards.length + 1}`, ...await describeTrip(trip, allowed, false),
            coverRefs: refs.slice(0, 2), state: trip.state, reasons: trip.reasons, ...(reveal ? { canReview: Boolean(target),
              canReject: trip.state === 'possible' && signature !== null && !supportKeys.some((key) => qualifyingKeys.has(key)) } : {}) };
          cards.push(card);
          if (reveal) reveal.set(card.id, { card, refs, target, signature });
          if (trip.state === 'reliable') reliableCount += 1; else possibleCount += 1;
        }

        stage = 'CANDIDATE_READBACK';
        report('START', 'unchanged');
        const token = Object.freeze({});
        candidateShadowTokens.set(token, { stamp: read.stamp, reveal });
        if (!await this.verifyCandidateShadowSnapshot(token, options.canUseSource) || options.signal?.aborted) {
          candidateShadowTokens.delete(token);
          report(options.signal?.aborted ? 'SKIPPED' : 'HISTORY_STALE', 'skipped');
          return { status: 'stale' };
        }
        report('COMPLETE', 'unchanged');
        return { status: 'complete', policyVersion: candidate.policyVersion, cards, token, ...(reveal ? { observed: [...observed.values()] } : {}),
          ...(compare ? { separatePairs, comparison: { baselineRuleVersion: baseline.graph.ruleVersion, baselineTripDetectorVersion: TRIP_DETECTOR_RULE_VERSION,
            evidenceRows: read.input.rows.length, elapsedMillis: Date.now() - startedAt } } : {}) };
      } catch (error) {
        if (error instanceof NativeTransactionWithdrawnError || options.signal?.aborted) { report('SKIPPED', 'skipped'); return { status: 'stale' }; }
        forgetReleasedNativeHandle(error);
        const reason = error instanceof JourneyCorrectionRemapRequiredError ? 'OWNER_REVIEW' : classifyAppDiagnosticError(error);
        report(reason, reason === 'OWNER_REVIEW' ? 'blocked' : 'unchanged', reason === 'DATABASE_BUSY' || reason === 'NATIVE_HANDLE');
        return { status: reason === 'OWNER_REVIEW' ? 'blocked' : 'failed' };
      }
    },
    async verifyCandidateShadowSnapshot(token: object, canUseSource: CandidateShadowOptions['canUseSource']): Promise<boolean> {
      const expected = candidateShadowTokens.get(token);
      if (!expected || !await canUseSource()) return false;
      assertReplicaOpen(databaseName);
      const db = await open();
      if (!sameShadowStamp(await candidateShadowStamp(db), expected.stamp) || !await canUseSource()) return false;
      return sameShadowStamp(await candidateShadowStamp(db), expected.stamp);
    },
    async readCandidateShadowMedia(token: object, id: string, canUseSource: CandidateShadowOptions['canUseSource']) {
      const authority = candidateShadowTokens.get(token);
      const entry = authority?.reveal?.get(id);
      if (!entry || !authority?.stamp.run || !await this.verifyCandidateShadowSnapshot(token, canUseSource)) return null;
      return { refs: [...entry.refs], card: entry.card, run: authority.stamp.run };
    },
    async saveCandidateShadowDecision(token: object, id: string, decision: 'keep' | 'reject', commandKey: string, options: CandidateShadowOptions): Promise<CandidateShadowReviewResult> {
      const correlationId = options.correlationId ?? createDiagnosticCorrelationId();
      let stage: 'POSSIBLE_TRIP_SAVE' | 'POSSIBLE_TRIP_REBUILD' | 'POSSIBLE_TRIP_ACK' | 'POSSIBLE_TRIP_READBACK' = 'POSSIBLE_TRIP_SAVE';
      const report = (reasonCode: AppDiagnosticEvent['reasonCode'], durableOutcome: AppDiagnosticEvent['durableOutcome'], retryable = false) =>
        recordAppDiagnostic({ operation: 'POSSIBLE_TRIP_REVIEW', stage, reasonCode, durableOutcome, retryable, correlationId });
      const enter = (next: typeof stage) => { stage = next; report('START', 'unchanged'); };
      const authority = candidateShadowTokens.get(token);
      const entry = authority?.reveal?.get(id);
      const expected = authority?.stamp;
      const action = 'confirm';
      let attempted = false;
      let acknowledgement = false;
      let rolledBack = false;
      let checkingReceipt = false;
      let committedHere = false;
      const requireSource = async () => {
        if (options.signal?.aborted) throw new CandidateDecisionGuard('SKIPPED');
        if (!await options.canUseSource()) throw new CandidateDecisionGuard(options.signal?.aborted ? 'SKIPPED' : 'ACCESS');
      };
      enter('POSSIBLE_TRIP_SAVE');
      try {
        if (databaseName !== 'travel-life-import-v1.db' || !expected?.run || !entry || entry.card.state !== 'possible') throw new CandidateDecisionGuard('HISTORY_STALE');
        const command = decision === 'reject' && entry.signature && entry.card.canReject ? { kind: 'reject' as const, signature: entry.signature }
          : decision === 'keep' && entry.target ? { kind: 'keep' as const, target: entry.target } : null;
        if (!command) throw new CandidateDecisionGuard('JOURNEY_REMAP');
        if (!commandKey || commandKey.length > 200) throw new CandidateDecisionGuard('HISTORY_CONFLICT');
        await requireSource();
        const db = await openProjectionWriter();
        await runOwnedTransaction(db, { kind: 'foreground', signal: options.signal, onRollback: (outcome) => { rolledBack = outcome === 'complete'; } }, async (writer) => {
          if (await findCandidateDecision(writer, commandKey) || await findCandidateRejection(writer, commandKey)) return;
          await requireSource();
          if (!sameShadowStamp(await candidateShadowStamp(writer), expected)) throw new CandidateDecisionGuard('HISTORY_STALE');
          if (command.kind === 'reject') {
            attempted = true;
            await writer.runAsync('INSERT INTO recognizable_candidate_rejection (command_key, policy_version, support_signature) VALUES (?, ?, ?)', commandKey, candidateTripPolicy.version, command.signature);
          } else {
            const target = command.target;
            if (await candidateCommittedPartition(writer, expected.run!, target.journeyId) !== target.partition) throw new CandidateDecisionGuard('JOURNEY_REMAP');
            const now = Date.now();
            const revisionId = `journey-review-${now}-${Math.random().toString(36).slice(2)}`;
            attempted = true;
            await writer.runAsync(`INSERT INTO journey_correction_revision (revision_id, action, source_run_id, journey_id,
              reviewed_support_json, state, created_at_millis, reviewed_visits_json, reviewed_family_snapshot_json, command_key)
              VALUES (?, ?, ?, ?, ?, 'effective', ?, ?, ?, ?)`, revisionId, action, expected.run, target.journeyId,
              target.reviewedSupport, now, target.reviewedVisits, target.families, commandKey);
            enter('POSSIBLE_TRIP_REBUILD');
            await this.rebuild(now, false, async () => true, true, writer);
            const rebuilt = await candidateShadowStamp(writer);
            if (!rebuilt?.run || !await verifyCandidateDecision(writer, rebuilt.run, revisionId, target)) throw new CandidateDecisionGuard('JOURNEY_REMAP');
          }
          await requireSource();
          enter('POSSIBLE_TRIP_ACK');
          acknowledgement = true;
        });
        committedHere = acknowledgement;
        checkingReceipt = true;
        enter('POSSIBLE_TRIP_READBACK');
        const verified = await runOwnedTransaction(db, { kind: 'foreground', mode: 'read', signal: options.signal }, async (reader) => {
          const receipt = await findCandidateDecision(reader, commandKey);
          const rejection = await findCandidateRejection(reader, commandKey);
          const stamp = await candidateShadowStamp(reader);
          if (command.kind === 'reject') {
            if (receipt || rejection && (rejection.policy_version !== candidateTripPolicy.version || rejection.support_signature !== command.signature)) {
              throw new CandidateDecisionGuard('HISTORY_CONFLICT');
            }
            if (!rejection) return false;
            if (!stamp || !sameShadowStamp({ ...stamp, rejections: expected.rejections }, expected)) throw new CandidateDecisionGuard('HISTORY_STALE');
          } else {
            if (rejection) throw new CandidateDecisionGuard('HISTORY_CONFLICT');
            if (!receipt) return false;
            assertExactCandidateDecision(receipt, expected, command.target, action);
            if (!stamp?.run || stamp.state !== 'connected' || stamp.run_home !== stamp.home || stamp.run_evidence !== Math.max(stamp.evidence ?? 0, stamp.overlay)
              || stamp.evidence !== expected.evidence || stamp.home !== expected.home || stamp.privacy !== expected.privacy || stamp.overlay !== expected.overlay
              || stamp.memory !== expected.memory || stamp.rejections !== expected.rejections) throw new CandidateDecisionGuard('HISTORY_STALE');
            const otherOwners = (JSON.parse(stamp.owner) as [string, string][]).filter(([id]) => id !== receipt.revision_id);
            if (JSON.stringify(otherOwners) !== expected.owner || !await verifyCandidateDecision(reader, stamp.run, receipt.revision_id, command.target)) {
              throw new CandidateDecisionGuard('HISTORY_STALE');
            }
          }
          await requireSource();
          return true;
        });
        report(verified ? 'COMPLETE' : 'UNKNOWN', verified ? 'complete' : 'unknown', !verified);
        return verified ? 'applied' : 'unknown';
      } catch (error) {
        if (error instanceof CandidateDecisionGuard) {
          const unsupported = error.reason === 'JOURNEY_REMAP';
          report(error.reason, committedHere ? 'complete' : unsupported || error.reason === 'HISTORY_CONFLICT' ? 'blocked' : error.reason === 'ACCESS' ? 'restricted' : 'skipped');
          return unsupported ? 'unsupported' : 'stale';
        }
        if (error instanceof NativeTransactionWithdrawnError) { report('SKIPPED', committedHere ? 'complete' : 'skipped'); return 'stale'; }
        const reason = error instanceof JourneyCorrectionRemapRequiredError ? 'JOURNEY_REMAP' : classifyAppDiagnosticError(error);
        const uncertain = checkingReceipt || (acknowledgement || attempted) && !rolledBack;
        report(reason, uncertain ? 'unknown' : 'unchanged', true);
        return uncertain ? 'unknown' : reason === 'JOURNEY_REMAP' ? 'unsupported' : 'retry';
      }
    },
    async applyJourneyPrivacyToRecord(record: DurableRevealRecord): Promise<DurableRevealRecord> {
      const db = await open();
      const completed = await db.getFirstAsync<{ run_id: number }>("SELECT MAX(run_id) AS run_id FROM reconstruction_run WHERE status = 'complete'");
      const filter = await privacyFilter(db, completed?.run_id ?? 0);
      const blockedDisplayIds = new Set([...filter.blocked].map(opaqueJourneyDisplayId));
      for (const ids of withheldPrivacySnapshots.values()) for (const id of ids) blockedDisplayIds.add(id);
      await assertPrivacyReadCurrent(db, filter.revision);
      return { journeys: record.journeys.filter((journey) => !blockedDisplayIds.has(journey.displayId) && !(journey.displayId.startsWith('manual:') && filter.manual.has(journey.displayId.slice(7)))), statistics: null, diagnostics: null };
    },
    async loadJourneyEligibility(displayId: string, snapshotToken: number, purpose: import('@/reveal/types').PrivateSelectionPurpose, expectedPrivacyRevision?: number): Promise<import('@/reveal/types').JourneyEligibility> {
      const db = await open(); await ensureNativeImportSchema(db);
      const privacyRevision = (await db.getFirstAsync<{ revision: number | null }>('SELECT MAX(revision) AS revision FROM journey_privacy_revision'))?.revision ?? 0;
      const withheld = (reason: 'private' | 'stale' | 'needs-review' | 'no-observed-destinations') => ({ eligible: false, reason, privacyRevision });
      if (expectedPrivacyRevision !== undefined && privacyRevision !== expectedPrivacyRevision) return withheld('stale');
      const lifecycle = await db.getFirstAsync<{ state: string }>('SELECT state FROM private_record_lifecycle WHERE record_id = 1');
      if (lifecycle?.state !== 'connected') return withheld('private');
      const selected = displayedJourneys.get(displayId);
      const filter = await privacyFilter(db, selected?.runId ?? 0);
      if (displayId.startsWith('manual:') ? filter.manual.has(displayId.slice(7)) : selected && filter.blocked.has(selected.journeyId)) return withheld('private');
      if (!displayId.startsWith('manual:') && (!selected || selected.runId !== snapshotToken)) return withheld('stale');
      if (!displayId.startsWith('manual:')) {
        const completed = await loadPublishedRun(db);
        if (completed?.run_id !== snapshotToken) return withheld('stale');
      }
      const detail = await this.loadJourneyDetail(displayId);
      if (detail.snapshotToken !== snapshotToken) return withheld('stale');
      if (purpose === 'replay' && detail.detail.ownerEntered) return withheld('no-observed-destinations');
      if (detail.detail.pendingRemap || (!detail.detail.ownerEntered && purpose === 'share' && detail.detail.correctionState !== 'confirmed')) return withheld('needs-review');
      // A policy can change while the async detail query runs.
      const settledRevision = (await db.getFirstAsync<{ revision: number | null }>('SELECT MAX(revision) AS revision FROM journey_privacy_revision'))?.revision ?? 0;
      if (settledRevision !== privacyRevision) return { eligible: false, reason: 'stale', privacyRevision: settledRevision };
      return { eligible: true, reason: 'eligible', privacyRevision };
    },
    /** Builds Replay input from the completed, policy-visible projection only. */
    async loadReplayManifestInput(): Promise<import('@/replay/types').ReplayManifestInput> {
      const db = await open(); await ensureNativeImportSchema(db);
      const lifecycle = await db.getFirstAsync<{ state: string }>('SELECT state FROM private_record_lifecycle WHERE record_id = 1');
      const completed = await loadPublishedRun(db);
      const privacyRevision = (await db.getFirstAsync<{ revision: number | null }>('SELECT MAX(revision) AS revision FROM journey_privacy_revision'))?.revision ?? 0;
      if (lifecycle?.state !== 'connected' || !completed?.run_id) return { snapshotToken: 0, privacyRevision, groups: [], memories: [] };
      // Reuse the committed Journey List projection as the sole scope authority.
      // It already withholds hidden, excluded and pending-review records and
      // preserves the list's presentation order/precision without promoting it
      // to observed chronology.
      const visibleRecord = await this.loadDurableReveal();
      const filter = await privacyFilter(db, completed.run_id);
      const rows = await db.getAllAsync<{ journey_id: string; start_day: string | null; end_day: string | null; uncertain: number }>(`SELECT journey.journey_id, MIN(evidence.captured_day) AS start_day, MAX(evidence.captured_day) AS end_day,
        MAX(CASE WHEN visit.ordering <> 'chronological' THEN 1 ELSE 0 END) AS uncertain
        FROM reconstruction_journey journey
        JOIN reconstruction_link journey_visit ON journey_visit.run_id = journey.run_id AND journey_visit.link_kind = 'journey-visit' AND journey_visit.parent_id = journey.journey_id
        JOIN reconstruction_visit visit ON visit.run_id = journey.run_id AND visit.visit_id = journey_visit.child_id
        JOIN reconstruction_link support ON support.run_id = visit.run_id AND support.link_kind = 'visit-support' AND support.parent_id = visit.visit_id
        JOIN canonical_evidence evidence ON evidence.evidence_id = support.child_id
        WHERE journey.run_id = ? GROUP BY journey.journey_id`, completed.run_id);
      const rowsByDisplayId = new Map(rows.map((row) => [opaqueJourneyDisplayId(row.journey_id), row]));
      const groups: import('@/replay/types').ReplayGroup[] = [];
      for (const journey of visibleRecord.journeys) {
        if (journey.needsReview) continue;
        const row = rowsByDisplayId.get(journey.displayId);
        // Manual journeys can be visible but have no reconstructed membership
        // rows. They remain in the private scene list rather than being
        // fabricated as observed destinations.
        const interval = row?.start_day && row.end_day
          ? { startDay: row.start_day, endDay: row.end_day }
          : undefined;
        groups.push({ key: journey.displayId, label: journey.label ?? 'Private journey', interval, inferred: journey.locationKind === 'inferred', eligible: true, orderCertain: journey.ordering === 'chronological', state: journey.state === 'owner-entered' ? 'owner-entered' : journey.locationKind === 'owner-confirmed' ? 'confirmed' : 'inferred' });
      }
      const memories: import('@/replay/types').ReplayMemory[] = [];
      const draft = await db.getFirstAsync<{ revision: number; committed_overrides_json: string; working_overrides_json: string | null; working_base_revision: number | null; working_revision: number }>('SELECT revision, committed_overrides_json, working_overrides_json, working_base_revision, working_revision FROM replay_draft WHERE record_id = 1');
      let keptEvidence = new Set<string>();
      let excludedEvidence = new Set<string>();
      let keptMemoryRefs = new Set<string>();
      let excludedMemoryRefs = new Set<string>();
      let draftOrder = new Map<string, number>();
      let replayDirection: import('@/replay/types').ReplayDirection = 'oldest-first';
      let replaySoundtrack: import('@/replay/types').ReplaySoundtrack = { kind: 'bundled', revision: 'happy-moments-1.4' };
      let excludedGroupJourneyIds = new Set<string>();
      let preparedArtifact: import('@/replay/types').ReplayPreparedArtifactRecord | undefined;
      let autoGroupJourneyIds = new Set<string>();
      // A missing field belongs to legacy drafts, where every included trip was
      // automatic. An explicitly persisted empty array instead means every trip
      // has been made manual and must survive a reload as such.
      let committedAutoGroupKeysSpecified = false;
      let workingOverrides: { keptMemoryRefs?: string[]; excludedGroupJourneyIds?: string[]; autoGroupJourneyIds?: string[]; autoGroupKeysSpecified: boolean; direction?: import('@/replay/types').ReplayDirection; soundtrack?: import('@/replay/types').ReplaySoundtrack } | null = null;
      try {
        const parsed = draft ? JSON.parse(draft.committed_overrides_json) as { keptEvidenceIds?: unknown; excludedEvidenceIds?: unknown; orderedEvidenceIds?: unknown; keptMemoryRefs?: unknown; excludedMemoryRefs?: unknown; orderedMemoryRefs?: unknown; excludedGroupJourneyIds?: unknown; autoGroupJourneyIds?: unknown; direction?: unknown; directionPreferenceVersion?: unknown; soundtrack?: unknown; preparedArtifact?: unknown } : {};
        if (Array.isArray(parsed.keptEvidenceIds) && parsed.keptEvidenceIds.every((value) => typeof value === 'string')) keptEvidence = new Set(parsed.keptEvidenceIds);
        if (Array.isArray(parsed.excludedEvidenceIds) && parsed.excludedEvidenceIds.every((value) => typeof value === 'string')) excludedEvidence = new Set(parsed.excludedEvidenceIds);
        if (Array.isArray(parsed.keptMemoryRefs) && parsed.keptMemoryRefs.every((value) => typeof value === 'string')) keptMemoryRefs = new Set(parsed.keptMemoryRefs);
        if (Array.isArray(parsed.excludedMemoryRefs) && parsed.excludedMemoryRefs.every((value) => typeof value === 'string')) excludedMemoryRefs = new Set(parsed.excludedMemoryRefs);
        if (Array.isArray(parsed.excludedGroupJourneyIds) && parsed.excludedGroupJourneyIds.every((value) => typeof value === 'string')) excludedGroupJourneyIds = new Set(parsed.excludedGroupJourneyIds);
        if (Array.isArray(parsed.autoGroupJourneyIds) && parsed.autoGroupJourneyIds.every((value) => typeof value === 'string')) {
          committedAutoGroupKeysSpecified = true;
          autoGroupJourneyIds = new Set(parsed.autoGroupJourneyIds);
        }
        const orderedReferences = Array.isArray(parsed.orderedMemoryRefs) && parsed.orderedMemoryRefs.every((value) => typeof value === 'string') ? parsed.orderedMemoryRefs : Array.isArray(parsed.orderedEvidenceIds) && parsed.orderedEvidenceIds.every((value) => typeof value === 'string') ? parsed.orderedEvidenceIds : [];
        draftOrder = new Map(orderedReferences.map((id, index) => [id, index]));
        // Drafts written before oldest-first became the product default did not
        // distinguish a saved value from an explicit owner choice. Treat those
        // legacy values as the new default; future editor saves mark the choice.
        if (parsed.directionPreferenceVersion === 1 && parsed.direction === 'newest-first') replayDirection = 'newest-first';
        if (parsed.soundtrack && typeof parsed.soundtrack === 'object') {
          const soundtrack = parsed.soundtrack as { kind?: unknown; revision?: unknown; localUri?: unknown };
          if (soundtrack.kind === 'bundled' && soundtrack.revision === 'happy-moments-1.4') replaySoundtrack = { kind: 'bundled', revision: 'happy-moments-1.4' };
          if (soundtrack.kind === 'custom' && typeof soundtrack.revision === 'string' && typeof soundtrack.localUri === 'string') replaySoundtrack = { kind: 'custom', revision: soundtrack.revision, localUri: soundtrack.localUri };
        }
        const cached = parsed.preparedArtifact as { identity?: unknown; cacheVersion?: unknown; fileKey?: unknown; durationSeconds?: unknown; renderedMemoryCount?: unknown; chapters?: unknown } | undefined;
        if (typeof cached?.identity === 'string' && typeof cached.fileKey === 'string' && typeof cached.durationSeconds === 'number' && typeof cached.renderedMemoryCount === 'number' && Number.isFinite(cached.durationSeconds) && Number.isInteger(cached.renderedMemoryCount) && cached.durationSeconds > 0 && cached.renderedMemoryCount >= 0) {
          const chapters = Array.isArray(cached.chapters) && cached.chapters.every((chapter) => {
            if (!chapter || typeof chapter !== 'object') return false;
            const value = chapter as { identity?: unknown; fileKey?: unknown; durationSeconds?: unknown; renderedMemoryCount?: unknown };
            return typeof value.identity === 'string' && typeof value.fileKey === 'string' && typeof value.durationSeconds === 'number' && Number.isFinite(value.durationSeconds) && value.durationSeconds > 0 && typeof value.renderedMemoryCount === 'number' && Number.isInteger(value.renderedMemoryCount) && value.renderedMemoryCount >= 0;
          }) ? cached.chapters.map((chapter) => {
            const value = chapter as { identity: string; fileKey: string; durationSeconds: number; renderedMemoryCount: number };
            return { identity: value.identity, fileKey: value.fileKey, durationSeconds: value.durationSeconds, renderedMemoryCount: value.renderedMemoryCount };
          }) : undefined;
          preparedArtifact = { identity: cached.identity, ...(cached.cacheVersion === 2 ? { cacheVersion: 2 as const } : {}), fileKey: cached.fileKey, durationSeconds: cached.durationSeconds, renderedMemoryCount: cached.renderedMemoryCount, ...(chapters ? { chapters } : {}) };
        }
      } catch { keptEvidence = new Set(); excludedEvidence = new Set(); keptMemoryRefs = new Set(); excludedMemoryRefs = new Set(); excludedGroupJourneyIds = new Set(); autoGroupJourneyIds = new Set(); committedAutoGroupKeysSpecified = false; draftOrder = new Map(); replayDirection = 'oldest-first'; }
      try {
        const parsed = draft?.working_overrides_json ? JSON.parse(draft.working_overrides_json) as { keptMemoryRefs?: unknown; excludedGroupJourneyIds?: unknown; autoGroupJourneyIds?: unknown; direction?: unknown; soundtrack?: unknown } : null;
        if (parsed && Array.isArray(parsed.keptMemoryRefs) && parsed.keptMemoryRefs.every((value) => typeof value === 'string') && (parsed.direction === 'oldest-first' || parsed.direction === 'newest-first')) {
          const soundtrack = parsed.soundtrack as { kind?: unknown; revision?: unknown; localUri?: unknown } | undefined;
          const excluded = Array.isArray(parsed.excludedGroupJourneyIds) && parsed.excludedGroupJourneyIds.every((value) => typeof value === 'string') ? parsed.excludedGroupJourneyIds : [];
          const auto = Array.isArray(parsed.autoGroupJourneyIds) && parsed.autoGroupJourneyIds.every((value) => typeof value === 'string') ? parsed.autoGroupJourneyIds : [];
          const autoGroupKeysSpecified = Array.isArray(parsed.autoGroupJourneyIds) && parsed.autoGroupJourneyIds.every((value) => typeof value === 'string');
          if (soundtrack?.kind === 'bundled' && soundtrack.revision === 'happy-moments-1.4') workingOverrides = { keptMemoryRefs: parsed.keptMemoryRefs, excludedGroupJourneyIds: excluded, autoGroupJourneyIds: auto, autoGroupKeysSpecified, direction: parsed.direction, soundtrack: { kind: 'bundled', revision: 'happy-moments-1.4' } };
          if (soundtrack?.kind === 'custom' && typeof soundtrack.revision === 'string' && typeof soundtrack.localUri === 'string') workingOverrides = { keptMemoryRefs: parsed.keptMemoryRefs, excludedGroupJourneyIds: excluded, autoGroupJourneyIds: auto, autoGroupKeysSpecified, direction: parsed.direction, soundtrack: { kind: 'custom', revision: soundtrack.revision, localUri: soundtrack.localUri } };
        }
      } catch { workingOverrides = null; }
      displayedReplayMemories.clear();
      displayedReplayGroups.clear();
      // Aligned one-for-one with `memories` for the provider's local resolver.
      // These source references never reach a React screen or diagnostic event.
      const previewSourceRefs: (string | null)[] = [];
      const memoryKeyByReference = new Map<string, string>();
      for (const [groupIndex, group] of groups.entries()) {
        const row = rowsByDisplayId.get(group.key);
        // Owner-entered journeys are valid scene-only Replay groups. They have
        // no reconstructed support row, but their stable namespaced identity
        // must round-trip through the same inclusion/exclusion writer map.
        if (group.state === 'owner-entered') {
          displayedReplayGroups.set(group.key, group.key);
          continue;
        }
        const selected = displayedJourneys.get(group.key) ?? (row ? { runId: completed.run_id, journeyId: row.journey_id } : undefined);
        if (!selected || filter.blocked.has(selected.journeyId)) continue;
        displayedJourneys.set(group.key, selected);
        displayedReplayGroups.set(group.key, selected.journeyId);
        const media = await db.getAllAsync<{ evidence_id: string; source_ref: string; captured_day: string | null; availability: 'available' | 'unavailable' | 'unknown'; media_type: 'image' | 'video'; disposition: string | null }>(`SELECT DISTINCT evidence.evidence_id, evidence.source_ref, evidence.captured_day, evidence.availability, evidence.media_type, disposition.disposition_state AS disposition
          FROM canonical_evidence evidence
          LEFT JOIN reconstruction_disposition disposition ON disposition.run_id = ? AND disposition.evidence_id = evidence.evidence_id
          WHERE evidence.evidence_id IN (
            SELECT membership.child_id FROM reconstruction_link membership
            WHERE membership.run_id = ? AND membership.parent_id = ?
              AND (membership.link_kind LIKE 'membership:owner:%'
                OR (membership.link_kind LIKE 'membership:inferred:%'
                  AND json_array(membership.parent_id, membership.child_id) IN (SELECT value FROM json_each(?))))
            UNION
            SELECT support.child_id FROM reconstruction_link journey_visit
            JOIN reconstruction_link support ON support.run_id = journey_visit.run_id AND support.parent_id = journey_visit.child_id AND support.link_kind = 'visit-support'
            WHERE journey_visit.run_id = ? AND journey_visit.parent_id = ? AND journey_visit.link_kind = 'journey-visit'
          )
          ORDER BY evidence.captured_day IS NULL, evidence.captured_day, evidence.evidence_id`, completed.run_id, completed.run_id, selected.journeyId, JSON.stringify([...keptMemoryRefs]), completed.run_id, selected.journeyId);
        let itemIndex = 0;
        for (const item of media) if (item.disposition !== 'rejected') {
          // An unknown import-time status is a candidate for native resolution.
          // A null capture date remains honest metadata, not a reason to drop an
          // attachment from the owner-visible Journey List scope.
          const key = `replay-memory-${groupIndex}-${itemIndex++}`;
          const reference = JSON.stringify([selected.journeyId, item.evidence_id]);
          memoryKeyByReference.set(reference, key);
          displayedReplayMemories.set(key, { journeyId: selected.journeyId, evidenceId: item.evidence_id });
          memories.push({ key, groupKey: group.key, kind: item.media_type === 'video' ? 'video' : 'photo', available: item.availability === 'available', eligible: true, ...(keptMemoryRefs.has(reference) || keptEvidence.has(item.evidence_id) ? { intent: 'keep' as const } : excludedMemoryRefs.has(reference) || excludedEvidence.has(item.evidence_id) ? { intent: 'exclude' as const } : {}), ...(draftOrder.has(reference) || draftOrder.has(item.evidence_id) ? { order: draftOrder.get(reference) ?? draftOrder.get(item.evidence_id) } : {}), capture: item.captured_day ? { startDay: item.captured_day, endDay: item.captured_day } : undefined });
          previewSourceRefs.push(item.availability === 'unavailable' ? null : item.source_ref);
        }
      }
      await assertPrivacyReadCurrent(db, filter.revision);
      displayedReplaySnapshot = { snapshotToken: completed.run_id, privacyRevision };
      for (let index = 0; index < groups.length; index += 1) {
        const journeyId = displayedReplayGroups.get(groups[index]!.key);
        if (journeyId && excludedGroupJourneyIds.has(journeyId)) groups[index] = { ...groups[index]!, eligible: false };
      }
      const includedGroupKeys = groups.filter((group) => group.eligible).map((group) => group.key);
      const autoGroupKeys = groups.filter((group) => group.eligible && (!committedAutoGroupKeysSpecified || autoGroupJourneyIds.has(displayedReplayGroups.get(group.key) ?? ''))).map((group) => group.key);
      const workingDraft = workingOverrides && draft && draft.working_base_revision === draft.revision
        ? { memoryKeys: (workingOverrides.keptMemoryRefs ?? []).map((reference) => memoryKeyByReference.get(reference)).filter((key): key is string => Boolean(key)), includedGroupKeys: groups.filter((group) => !((workingOverrides.excludedGroupJourneyIds ?? []).includes(displayedReplayGroups.get(group.key) ?? ''))).map((group) => group.key), autoGroupKeys: groups.filter((group) => !workingOverrides.autoGroupKeysSpecified || (workingOverrides.autoGroupJourneyIds ?? []).includes(displayedReplayGroups.get(group.key) ?? '')).map((group) => group.key), direction: workingOverrides.direction!, soundtrack: workingOverrides.soundtrack!, baseRevision: draft.working_base_revision, revision: draft.working_revision }
        : undefined;
      return { snapshotToken: completed.run_id, privacyRevision, direction: replayDirection, soundtrack: replaySoundtrack, preparedArtifact, workingDraft, includedGroupKeys, autoGroupKeys, groups, memories, previewSourceRefs };
    },
    hasReplayMapping(snapshotToken: number, privacyRevision: number) { return displayedReplaySnapshot?.snapshotToken === snapshotToken && displayedReplaySnapshot.privacyRevision === privacyRevision; },
    async reconcileReplayMutation(mutation: ReplayMutation, snapshotToken: number, privacyRevision: number): Promise<ReplayReconciliation> {
      const db = await open(); await ensureNativeImportSchema(db);
      // Never inspect a receipt on a shared connection inside another owner's
      // uncommitted transaction. This read owns the same settlement gate.
      return runOwnedTransaction(db, { kind: 'foreground' }, async (db): Promise<ReplayReconciliation> => {
      try { await validateReplayScope(db, snapshotToken, privacyRevision); } catch { return { kind: 'scope-invalid' }; }
      const receipt = await db.getFirstAsync<ReplayMutationReceipt>('SELECT * FROM replay_mutation_receipt WHERE operation_id = ?', mutation.operationId);
      if (!receipt) return { kind: 'outcome-unknown' };
      if (receipt.session_id !== mutation.sessionId || receipt.edit_version !== mutation.editVersion || receipt.snapshot_token !== snapshotToken || receipt.privacy_revision !== privacyRevision) return { kind: 'conflict' };
      const current = await db.getFirstAsync<{ revision: number; working_revision: number; working_session_id: string | null; working_edit_version: number }>('SELECT revision, working_revision, working_session_id, working_edit_version FROM replay_draft WHERE record_id = 1');
      if (!current || (receipt.kind === 'commit' ? current.revision !== receipt.resulting_revision : current.working_revision !== receipt.resulting_revision) || current.working_session_id !== mutation.sessionId || current.working_edit_version !== mutation.editVersion) return { kind: 'conflict' };
      return { kind: 'acknowledged', revision: receipt.resulting_revision };
      });
    },
    /** Resolves one bounded editor page without exposing native source references to React. */
    async loadReplayEditorPreviewPage(memoryKeys: readonly string[], snapshotToken: number, privacyRevision: number) {
      if (memoryKeys.length > 48) throw new Error('Replay editor page is too large.');
      const db = await open(); await ensureNativeImportSchema(db);
      const lifecycle = await db.getFirstAsync<{ state: string }>('SELECT state FROM private_record_lifecycle WHERE record_id = 1');
      const completed = await loadPublishedRun(db);
      const currentPrivacyRevision = (await db.getFirstAsync<{ revision: number | null }>('SELECT MAX(revision) AS revision FROM journey_privacy_revision'))?.revision ?? 0;
      if (lifecycle?.state !== 'connected' || !displayedReplaySnapshot || displayedReplaySnapshot.snapshotToken !== snapshotToken || displayedReplaySnapshot.privacyRevision !== privacyRevision || completed?.run_id !== snapshotToken || currentPrivacyRevision !== privacyRevision) throw new Error('Replay editor page is stale.');
      const entries = memoryKeys.map((key) => ({ key, value: displayedReplayMemories.get(key) })).filter((entry): entry is { key: string; value: { journeyId: string; evidenceId: string } } => Boolean(entry.value));
      if (entries.length !== memoryKeys.length) throw new Error('Replay editor page is stale.');
      if (!entries.length) return { keys: [], previewSourceRefs: [] };
      const evidenceIds = entries.map(({ value }) => value.evidenceId);
      const rows = await db.getAllAsync<{ evidence_id: string; source_ref: string; availability: 'available' | 'unavailable' | 'unknown' }>(`SELECT evidence_id, source_ref, availability FROM canonical_evidence WHERE evidence_id IN (${evidenceIds.map(() => '?').join(', ')})`, ...evidenceIds);
      const byId = new Map(rows.map((row) => [row.evidence_id, row]));
      const previewSourceRefs = entries.map(({ value }) => {
        const row = byId.get(value.evidenceId);
        return row?.availability === 'unavailable' ? null : row?.source_ref ?? null;
      });
      await assertPrivacyReadCurrent(db, privacyRevision);
      return { keys: [...memoryKeys], previewSourceRefs };
    },
    async saveReplayDraft(memoryKeys: readonly string[], snapshotToken?: number, privacyRevision?: number, direction: import('@/replay/types').ReplayDirection = 'oldest-first', soundtrack?: import('@/replay/types').ReplaySoundtrack, expectedWorkingRevision?: number, includedGroupKeys?: readonly string[], autoGroupKeys?: readonly string[], mutation?: ReplayMutation): Promise<void> {
      return replayDraftWrite(async () => {
      const db = await open(); await ensureNativeImportSchema(db);
      const lifecycle = await db.getFirstAsync<{ state: string }>('SELECT state FROM private_record_lifecycle WHERE record_id = 1');
      if (lifecycle?.state !== 'connected') throw new ReplayDraftStaleError('Replay draft is stale.', 'scope', 'scope');
      const completed = await loadPublishedRun(db);
      const currentPrivacyRevision = (await db.getFirstAsync<{ revision: number | null }>('SELECT MAX(revision) AS revision FROM journey_privacy_revision'))?.revision ?? 0;
      if (!displayedReplaySnapshot || snapshotToken !== displayedReplaySnapshot.snapshotToken || privacyRevision !== displayedReplaySnapshot.privacyRevision) throw new ReplayDraftStaleError('Replay draft is stale.', 'scope', 'mapping');
      if (completed?.run_id !== snapshotToken || currentPrivacyRevision !== privacyRevision) throw new ReplayDraftStaleError('Replay draft is stale.', 'scope', 'scope');
      const keptMemoryRefs = memoryKeys.map((key) => displayedReplayMemories.get(key)).filter((value): value is { journeyId: string; evidenceId: string } => Boolean(value)).map((value) => JSON.stringify([value.journeyId, value.evidenceId]));
      if (keptMemoryRefs.length !== memoryKeys.length) throw new ReplayDraftStaleError('Replay draft is stale.', 'scope', 'memory');
      const excludedMemoryRefs = [...displayedReplayMemories.values()].map((value) => JSON.stringify([value.journeyId, value.evidenceId])).filter((reference) => !keptMemoryRefs.includes(reference));
      const included = new Set(includedGroupKeys ?? [...displayedReplayGroups.keys()]);
      if ([...included].some((key) => !displayedReplayGroups.has(key))) throw new ReplayDraftStaleError('Replay draft is stale.', 'scope', 'group');
      const excludedGroupJourneyIds = [...displayedReplayGroups.entries()].filter(([key]) => !included.has(key)).map(([, journeyId]) => journeyId);
      const automatic = new Set(autoGroupKeys ?? included);
      if ([...automatic].some((key) => !included.has(key))) throw new ReplayDraftStaleError('Replay draft is stale.', 'scope', 'automatic');
      const autoGroupJourneyIds = [...displayedReplayGroups.entries()].filter(([key]) => automatic.has(key)).map(([, journeyId]) => journeyId);
      const digest = JSON.stringify([memoryKeys, snapshotToken, privacyRevision, direction, soundtrack, expectedWorkingRevision, includedGroupKeys, autoGroupKeys]);
      return runOwnedTransaction(db, { kind: 'foreground' }, async (db) => {
        await validateReplayScope(db, snapshotToken, privacyRevision);
        const receipt = await findReplayReceipt(db, mutation, 'commit', digest);
        if (receipt) return undefined;
        const current = await db.getFirstAsync<{ revision: number; working_base_revision: number | null; working_revision: number }>('SELECT revision, working_base_revision, working_revision FROM replay_draft WHERE record_id = 1');
        if (expectedWorkingRevision !== undefined && (!current || current.working_base_revision !== current.revision || current.working_revision !== expectedWorkingRevision)) throw new ReplayDraftStaleError('Replay draft conflict.', 'revision', 'revision');
        await db.runAsync('INSERT INTO replay_draft (record_id, revision, committed_overrides_json, working_overrides_json, working_base_revision, working_revision, updated_at_millis) VALUES (1, ?, ?, NULL, NULL, ?, ?) ON CONFLICT(record_id) DO UPDATE SET revision = excluded.revision, committed_overrides_json = excluded.committed_overrides_json, working_overrides_json = NULL, working_base_revision = NULL, working_revision = excluded.working_revision, updated_at_millis = excluded.updated_at_millis', (current?.revision ?? 0) + 1, JSON.stringify({ keptMemoryRefs, excludedMemoryRefs, excludedGroupJourneyIds, autoGroupJourneyIds, orderedMemoryRefs: keptMemoryRefs, direction: direction === 'newest-first' ? 'newest-first' : 'oldest-first', directionPreferenceVersion: 1, soundtrack }), current?.working_revision ?? 0, Date.now());
        await recordReplayReceipt(db, mutation, 'commit', digest, snapshotToken, privacyRevision, (current?.revision ?? 0) + 1);
      });
      });
    },
    async stageReplayWorkingDraft(memoryKeys: readonly string[], snapshotToken?: number, privacyRevision?: number, direction: import('@/replay/types').ReplayDirection = 'oldest-first', soundtrack: import('@/replay/types').ReplaySoundtrack = { kind: 'bundled', revision: 'happy-moments-1.4' }, expectedWorkingRevision?: number, includedGroupKeys?: readonly string[], autoGroupKeys?: readonly string[], mutation?: ReplayMutation) {
      return replayDraftWrite(async () => {
      const db = await open(); await ensureNativeImportSchema(db);
      const lifecycle = await db.getFirstAsync<{ state: string }>('SELECT state FROM private_record_lifecycle WHERE record_id = 1');
      const completed = await loadPublishedRun(db);
      const currentPrivacyRevision = (await db.getFirstAsync<{ revision: number | null }>('SELECT MAX(revision) AS revision FROM journey_privacy_revision'))?.revision ?? 0;
      if (lifecycle?.state !== 'connected' || completed?.run_id !== snapshotToken || currentPrivacyRevision !== privacyRevision) throw new ReplayDraftStaleError('Replay draft is stale.', 'scope', 'scope');
      if (!displayedReplaySnapshot || snapshotToken !== displayedReplaySnapshot.snapshotToken || privacyRevision !== displayedReplaySnapshot.privacyRevision) throw new ReplayDraftStaleError('Replay draft is stale.', 'scope', 'mapping');
      const keptMemoryRefs = memoryKeys.map((key) => displayedReplayMemories.get(key)).filter((value): value is { journeyId: string; evidenceId: string } => Boolean(value)).map((value) => JSON.stringify([value.journeyId, value.evidenceId]));
      if (keptMemoryRefs.length !== memoryKeys.length) throw new ReplayDraftStaleError('Replay draft is stale.', 'scope', 'memory');
      const included = new Set(includedGroupKeys ?? [...displayedReplayGroups.keys()]);
      if ([...included].some((key) => !displayedReplayGroups.has(key))) throw new ReplayDraftStaleError('Replay draft is stale.', 'scope', 'group');
      const excludedGroupJourneyIds = [...displayedReplayGroups.entries()].filter(([key]) => !included.has(key)).map(([, journeyId]) => journeyId);
      const automatic = new Set(autoGroupKeys ?? included);
      if ([...automatic].some((key) => !included.has(key))) throw new ReplayDraftStaleError('Replay draft is stale.', 'scope', 'automatic');
      const autoGroupJourneyIds = [...displayedReplayGroups.entries()].filter(([key]) => automatic.has(key)).map(([, journeyId]) => journeyId);
      const digest = JSON.stringify([memoryKeys, snapshotToken, privacyRevision, direction, soundtrack, expectedWorkingRevision, includedGroupKeys, autoGroupKeys]);
      return runOwnedTransaction(db, { kind: 'foreground' }, async (db) => {
        await validateReplayScope(db, snapshotToken, privacyRevision);
        const receipt = await findReplayReceipt(db, mutation, 'stage', digest);
        if (receipt) return receipt.resulting_revision;
        const current = await db.getFirstAsync<{ revision: number; committed_overrides_json: string; working_base_revision: number | null; working_revision: number }>('SELECT revision, committed_overrides_json, working_base_revision, working_revision FROM replay_draft WHERE record_id = 1');
        if (expectedWorkingRevision !== undefined && (current?.working_revision ?? 0) !== expectedWorkingRevision) throw new ReplayDraftStaleError('Replay draft conflict.', 'revision', 'revision');
        if (current?.working_base_revision !== null && current?.working_base_revision !== undefined && current.working_base_revision !== current.revision) throw new ReplayDraftStaleError('Replay draft conflict.', 'branch', 'branch');
        const baseRevision = current?.revision ?? 0;
        await db.runAsync('INSERT INTO replay_draft (record_id, revision, committed_overrides_json, working_overrides_json, working_base_revision, working_revision, updated_at_millis) VALUES (1, ?, ?, ?, ?, ?, ?) ON CONFLICT(record_id) DO UPDATE SET working_overrides_json = excluded.working_overrides_json, working_base_revision = excluded.working_base_revision, working_revision = excluded.working_revision, updated_at_millis = excluded.updated_at_millis', baseRevision, current?.committed_overrides_json ?? '{}', JSON.stringify({ keptMemoryRefs, excludedGroupJourneyIds, autoGroupJourneyIds, direction, soundtrack }), baseRevision, (current?.working_revision ?? 0) + 1, Date.now());
        await recordReplayReceipt(db, mutation, 'stage', digest, snapshotToken, privacyRevision, (current?.working_revision ?? 0) + 1);
        return (current?.working_revision ?? 0) + 1;
      });
      });
    },
    async resetReplayDraft(snapshotToken?: number, privacyRevision?: number) {
      const db = await open(); await ensureNativeImportSchema(db);
      const lifecycle = await db.getFirstAsync<{ state: string }>('SELECT state FROM private_record_lifecycle WHERE record_id = 1');
      if (lifecycle?.state !== 'connected') throw new Error('Replay draft is stale.');
      const completed = await loadPublishedRun(db);
      const currentPrivacyRevision = (await db.getFirstAsync<{ revision: number | null }>('SELECT MAX(revision) AS revision FROM journey_privacy_revision'))?.revision ?? 0;
      if (!displayedReplaySnapshot || snapshotToken !== displayedReplaySnapshot.snapshotToken || privacyRevision !== displayedReplaySnapshot.privacyRevision || completed?.run_id !== snapshotToken || currentPrivacyRevision !== privacyRevision) throw new Error('Replay draft is stale.');
      // Reset abandons only the recoverable working branch. It must never replace
      // a committed composition or its verified output before an explicit commit.
      await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
      try {
        await db.runAsync('UPDATE replay_draft SET working_overrides_json = NULL, working_base_revision = NULL, updated_at_millis = ? WHERE record_id = 1', Date.now());
        await db.execAsync('COMMIT');
      } catch (error) {
        try { await db.execAsync('ROLLBACK'); } catch { /* Keep the primary failure. */ }
        throw error;
      }
    },
    async saveReplayPreparedArtifact(record: import('@/replay/types').ReplayPreparedArtifactRecord, snapshotToken?: number, privacyRevision?: number) {
      const db = await open(); await ensureNativeImportSchema(db);
      return runOwnedTransaction(db, { kind: 'foreground' }, async (db) => {
        const lifecycle = await db.getFirstAsync<{ state: string }>('SELECT state FROM private_record_lifecycle WHERE record_id = 1');
        const completed = await loadPublishedRun(db);
        const currentPrivacyRevision = (await db.getFirstAsync<{ revision: number | null }>('SELECT MAX(revision) AS revision FROM journey_privacy_revision'))?.revision ?? 0;
        if (lifecycle?.state !== 'connected') throw new ReplayPreparedArtifactError('REPLAY_SCOPE_INVALID', 'REPLAY_OUTPUT_LIFECYCLE');
        if (!displayedReplaySnapshot || snapshotToken !== displayedReplaySnapshot.snapshotToken || privacyRevision !== displayedReplaySnapshot.privacyRevision) throw new ReplayPreparedArtifactError('REPLAY_MAPPING_INVALID', 'REPLAY_OUTPUT_MAPPING');
        if (completed?.run_id !== snapshotToken) throw new ReplayPreparedArtifactError('REPLAY_SCOPE_INVALID', 'REPLAY_OUTPUT_RUN');
        if (currentPrivacyRevision !== privacyRevision) throw new ReplayPreparedArtifactError('REPLAY_SCOPE_INVALID', 'REPLAY_OUTPUT_PRIVACY');
        const prior = await db.getFirstAsync<{ revision: number; committed_overrides_json: string }>('SELECT revision, committed_overrides_json FROM replay_draft WHERE record_id = 1');
        let overrides: Record<string, unknown> = {};
        try { overrides = prior ? JSON.parse(prior.committed_overrides_json) as Record<string, unknown> : {}; } catch { /* Preserve only validated new cache data. */ }
        // Cache metadata does not change the owner's composition. Advancing its
        // revision here invalidates an otherwise current recoverable working draft.
        // Compare the exact metadata source as well as the revision: another cache
        // write can change that JSON without changing the composition revision.
        const nextOverrides = JSON.stringify({ ...overrides, preparedArtifact: record });
        const saved = (prior
          ? await db.runAsync('UPDATE replay_draft SET committed_overrides_json = ?, updated_at_millis = ? WHERE record_id = 1 AND revision = ? AND committed_overrides_json = ?', nextOverrides, Date.now(), prior.revision, prior.committed_overrides_json)
          : await db.runAsync('INSERT INTO replay_draft (record_id, revision, committed_overrides_json, updated_at_millis) VALUES (1, 0, ?, ?) ON CONFLICT(record_id) DO NOTHING', nextOverrides, Date.now())) as { changes: number };
        if (saved.changes !== 1) throw new ReplayPreparedArtifactError('REPLAY_RECEIPT_CONFLICT', 'REPLAY_OUTPUT_CAS');
      });
    },
    async reviewJourneyPrivacy(displayId: string, snapshotToken: number): Promise<JourneyPrivacyReview> {
      const loaded = await this.loadJourneyDetail(displayId);
      if (loaded.snapshotToken !== snapshotToken) throw new Error('Privacy review is stale. Reopen the journey.');
      const db = await open();
      const revision = (await db.getFirstAsync<{ revision: number | null }>('SELECT MAX(revision) AS revision FROM journey_privacy_revision'))?.revision ?? 0;
      let evidence: string[] = [];
      let familyKeys: string[] = [];
      let hideEvidence: string[] = [];
      let hideFamilies: string[] = [];
      let supportCount = 0;
      let duplicateFamilyCount = 0;
      let affectedJourneyCount = 1;
      const selected = displayedJourneys.get(displayId);
      if (!loaded.detail.ownerEntered) {
        if (!selected) throw new Error('Privacy review is stale.');
        const supports = await db.getAllAsync<{ evidence_id: string }>(`SELECT DISTINCT support.child_id AS evidence_id FROM reconstruction_link journey
          JOIN reconstruction_link support ON support.run_id = journey.run_id AND support.parent_id = journey.child_id AND support.link_kind = 'visit-support'
          WHERE journey.run_id = ? AND journey.link_kind = 'journey-visit' AND journey.parent_id = ?`, selected.runId, selected.journeyId);
        const rows = await db.getAllAsync<EvidenceRow>('SELECT evidence_id, captured_at_millis, captured_day, has_precise_offset, availability, latitude, longitude, reported_accuracy_meters, platform_duplicate_family_id, source_origin, support_eligible, duplicate_tuple_version, duplicate_tuple_fingerprint FROM canonical_evidence');
        const evidenceById = new Map(rows.map((row) => [row.evidence_id, row]));
        const families = resolveVerifiedDuplicateFamilies(rows);
        const supportIds = new Set(supports.map((row) => row.evidence_id));
        supportCount = supportIds.size;
        const supportKeys = new Set(supports.map((row) => families.keyForEvidence(row.evidence_id)));
        evidence = rows.filter((row) => supportIds.has(row.evidence_id) || supportKeys.has(families.keyForEvidence(row.evidence_id))).map((row) => row.evidence_id).sort();
        familyKeys = [...new Set(evidence.flatMap((id) => {
          const row = evidenceById.get(id)!;
          const key = families.keyForEvidence(id);
          return [...(key.startsWith('F:') ? [key] : []), ...(row.platform_duplicate_family_id ? [`P:${row.platform_duplicate_family_id}`] : [])];
        }))].sort();
        const members = await db.getAllAsync<{ evidence_id: string }>("SELECT DISTINCT child_id AS evidence_id FROM reconstruction_link WHERE run_id = ? AND parent_id = ? AND link_kind LIKE 'membership:%'", selected.runId, selected.journeyId);
        const hiddenUnits = new Set([...evidence, ...members.map((row) => row.evidence_id)].map((id) => families.keyForEvidence(id)));
        hideEvidence = [...new Set([...evidence, ...members.map((row) => row.evidence_id), ...rows.filter((row) => hiddenUnits.has(families.keyForEvidence(row.evidence_id))).map((row) => row.evidence_id)])].sort();
        hideFamilies = [...new Set([...familyKeys, ...hideEvidence.flatMap((id) => {
          const row = evidenceById.get(id);
          const key = families.keyForEvidence(id);
          return [...(key.startsWith('F:') ? [key] : []), ...(row?.platform_duplicate_family_id ? [`P:${row.platform_duplicate_family_id}`] : [])];
        })])].sort();
        duplicateFamilyCount = new Set(evidence.map((id) => families.keyForEvidence(id)).filter((key) => key.startsWith('F:'))).size;
        if (!evidence.length) throw new Error('This journey has no reviewed supporting scope.');
        const links = await db.getAllAsync<{ journey_id: string; evidence_id: string }>(`SELECT journey.parent_id AS journey_id, support.child_id AS evidence_id
          FROM reconstruction_link journey JOIN reconstruction_link support ON support.run_id = journey.run_id AND support.parent_id = journey.child_id AND support.link_kind = 'visit-support'
          WHERE journey.run_id = ? AND journey.link_kind = 'journey-visit'
          UNION SELECT parent_id AS journey_id, child_id AS evidence_id FROM reconstruction_link WHERE run_id = ? AND link_kind LIKE 'membership:%'`, selected.runId, selected.runId);
        const hideIds = new Set(hideEvidence);
        affectedJourneyCount = new Set(links.filter((link) => hideIds.has(link.evidence_id)).map((link) => link.journey_id)).size;
      }
      const reviewId = `privacy-review-${++privacyReviewSequence}`;
      privacyReviews.set(reviewId, { displayId, runId: snapshotToken, label: loaded.detail.title, manualId: loaded.detail.ownerEntered ? displayId.slice(7) : null, evidence, families: familyKeys, hideEvidence, hideFamilies, revision });
      return { reviewId, title: loaded.detail.title, ownerEntered: !!loaded.detail.ownerEntered, supportingPhotoCount: supportCount, duplicatePhotoCount: evidence.length - supportCount, duplicateFamilyCount, hideMediaCount: hideEvidence.length, affectedJourneyCount };
    },
    async saveJourneyPrivacy(reviewId: string, action: 'hide' | 'exclude', commandKey: string) {
      if (!commandKey || commandKey.length > 250 || (action !== 'hide' && action !== 'exclude')) throw new Error('Privacy command is invalid.');
      const db = await open();
      await ensureNativeImportSchema(db);
      await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
      try {
        const lifecycle = await db.getFirstAsync<{ state: string }>('SELECT state FROM private_record_lifecycle WHERE record_id = 1');
        if (lifecycle?.state !== 'connected') throw new Error('Private record is not connected.');
        const existing = await db.getFirstAsync<PrivacyRevision>('SELECT * FROM journey_privacy_revision WHERE command_key = ?', commandKey);
        if (existing) {
          assertPrivacyRevision(existing);
          if (existing.action !== action || existing.policy_id !== commandKey) throw new Error('Privacy command conflicts with a saved action.');
          const reviewed = privacyReviews.get(reviewId);
          const expectedEvidence = reviewed ? action === 'hide' ? reviewed.hideEvidence : reviewed.evidence : null;
          if (!reviewed || existing.manual_id !== reviewed.manualId || existing.source_run_id !== reviewed.runId || existing.reviewed_evidence_json !== JSON.stringify(expectedEvidence)) throw new Error('Privacy command conflicts with its reviewed target.');
          await db.execAsync('COMMIT'); return;
        }
        const review = privacyReviews.get(reviewId);
        if (!review || (review.manualId && action === 'exclude')) throw new Error('Privacy scope needs review. Manual journeys support Hide.');
        const currentRevision = (await db.getFirstAsync<{ revision: number | null }>('SELECT MAX(revision) AS revision FROM journey_privacy_revision'))?.revision ?? 0;
        const completed = await db.getFirstAsync<{ run_id: number }>("SELECT MAX(run_id) AS run_id FROM reconstruction_run WHERE status = 'complete'");
        if (currentRevision !== review.revision || (!review.manualId && completed?.run_id !== review.runId)) throw new Error('Privacy review is stale. Reopen the journey.');
        // Re-read the exact scope under the writer lock. A rescan/family change
        // cannot silently extend what the owner just confirmed.
        const refreshed = await this.reviewJourneyPrivacy(review.displayId, review.runId);
        const current = privacyReviews.get(refreshed.reviewId)!;
        if (JSON.stringify(current.evidence) !== JSON.stringify(review.evidence) || JSON.stringify(current.families) !== JSON.stringify(review.families)) throw new Error('Privacy scope changed. Review it again.');
        if (action === 'hide' && (JSON.stringify(current.hideEvidence) !== JSON.stringify(review.hideEvidence) || JSON.stringify(current.hideFamilies) !== JSON.stringify(review.hideFamilies))) throw new Error('Privacy scope changed. Review it again.');
        const savedEvidence = action === 'hide' ? review.hideEvidence : review.evidence;
        const savedFamilies = action === 'hide' ? review.hideFamilies : review.families;
        await db.runAsync(`INSERT INTO journey_privacy_revision (policy_id, command_key, action, target_kind, manual_id, source_run_id, reviewed_evidence_json, reviewed_family_json, reviewed_label, created_at_millis)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, commandKey, commandKey, action, review.manualId ? 'manual' : 'inferred', review.manualId, review.runId, JSON.stringify(savedEvidence), JSON.stringify(savedFamilies), review.label, Date.now());
        const saved = await db.getFirstAsync<PrivacyRevision>('SELECT * FROM journey_privacy_revision WHERE command_key = ?', commandKey);
        if (saved) assertPrivacyRevision(saved);
        const settled = await db.getFirstAsync<{ state: string }>('SELECT state FROM private_record_lifecycle WHERE record_id = 1');
        if (!saved || saved.action !== action || saved.reviewed_evidence_json !== JSON.stringify(savedEvidence) || settled?.state !== 'connected') throw new Error('Privacy save could not be verified.');
        const protectedSnapshot = await privacyFilter(db, review.runId, commandKey);
        const withheldIds = new Set([...protectedSnapshot.blocked].map(opaqueJourneyDisplayId));
        withheldIds.add(review.displayId);
        await db.execAsync('COMMIT');
        withheldPrivacySnapshots.set(commandKey, withheldIds);
      } catch (error) { await db.execAsync('ROLLBACK'); throw error; }
    },
    async loadJourneyPrivacyPolicies(): Promise<JourneyPrivacyPolicy[]> {
      const db = await open(); await ensureNativeImportSchema(db);
      const lifecycle = await db.getFirstAsync<{ state: string }>('SELECT state FROM private_record_lifecycle WHERE record_id = 1');
      if (lifecycle?.state !== 'connected') return [];
      return ((await db.getAllAsync<PrivacyRevision>(activePrivacySql)) ?? []).map((row) => { assertPrivacyRevision(row); return { policyId: row.policy_id, revision: row.revision, action: row.action as 'hide' | 'exclude', title: row.reviewed_label, supportingPhotoCount: reviewedPrivacyIds(row.reviewed_evidence_json).length, duplicateFamilyCount: reviewedPrivacyIds(row.reviewed_family_json).filter((key) => key.startsWith('F:')).length, status: 'protected' as const }; });
    },
    async restoreJourneyPrivacy(policyId: string, expectedRevision: number, commandKey: string) {
      if (!commandKey || commandKey.length > 250 || !Number.isInteger(expectedRevision)) throw new Error('Privacy restore is invalid.');
      const db = await open(); await ensureNativeImportSchema(db);
      await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
      try {
        const lifecycle = await db.getFirstAsync<{ state: string }>('SELECT state FROM private_record_lifecycle WHERE record_id = 1');
        if (lifecycle?.state !== 'connected') throw new Error('Private record is not connected.');
        const existing = await db.getFirstAsync<PrivacyRevision>('SELECT * FROM journey_privacy_revision WHERE command_key = ?', commandKey);
        if (existing) {
          assertPrivacyRevision(existing);
          if (existing.action !== 'restore' || existing.policy_id !== policyId) throw new Error('Privacy command conflicts with a saved action.');
          await db.execAsync('COMMIT'); return;
        }
        const current = await db.getFirstAsync<PrivacyRevision>('SELECT * FROM journey_privacy_revision WHERE policy_id = ? ORDER BY revision DESC LIMIT 1', policyId);
        if (current) assertPrivacyRevision(current);
        if (!current || current.revision !== expectedRevision || current.action === 'restore') throw new Error('Privacy restore is stale. Reload Privacy Settings.');
        reviewedPrivacyIds(current.reviewed_evidence_json); reviewedPrivacyIds(current.reviewed_family_json);
        await db.runAsync(`INSERT INTO journey_privacy_revision (policy_id, command_key, action, target_kind, manual_id, source_run_id, reviewed_evidence_json, reviewed_family_json, reviewed_label, created_at_millis)
          VALUES (?, ?, 'restore', ?, ?, ?, ?, ?, ?, ?)`, policyId, commandKey, current.target_kind, current.manual_id, current.source_run_id, current.reviewed_evidence_json, current.reviewed_family_json, current.reviewed_label, Date.now());
        const saved = await db.getFirstAsync<PrivacyRevision>('SELECT * FROM journey_privacy_revision WHERE command_key = ?', commandKey);
        if (saved) assertPrivacyRevision(saved);
        const settled = await db.getFirstAsync<{ state: string }>('SELECT state FROM private_record_lifecycle WHERE record_id = 1');
        if (!saved || saved.action !== 'restore' || settled?.state !== 'connected') throw new Error('Privacy restore could not be verified.');
        await db.execAsync('COMMIT');
        withheldPrivacySnapshots.delete(policyId);
      } catch (error) { await db.execAsync('ROLLBACK'); throw error; }
    },
    async findManualJourneyOverlaps(input: ManualJourneyInput) {
      validateManualJourney(input);
      const db = await open();
      await ensureNativeImportSchema(db);
      const [start, end] = manualRange(input);
      const lifecycle = await db.getFirstAsync<{ state: string }>('SELECT state FROM private_record_lifecycle WHERE record_id = 1');
      if (lifecycle?.state !== 'connected') throw new Error('Private record is not connected.');
      const manual = await db.getAllAsync<ManualRow>(`SELECT manual_id, command_key, owner_label, owner_context, latitude, longitude, date_kind, date_start, date_end
        FROM manual_journey WHERE date_start <= ? AND date_end >= ? ORDER BY date_start, manual_id`, end, start);
      const completed = await db.getFirstAsync<{ run_id: number }>("SELECT MAX(run_id) AS run_id FROM reconstruction_run WHERE status = 'complete'");
      const inferred = completed?.run_id ? await db.getAllAsync<{ journey_id: string; first_day: string; last_day: string }>(`
        SELECT journey_visit.parent_id AS journey_id, MIN(evidence.captured_day) AS first_day, MAX(evidence.captured_day) AS last_day
        FROM reconstruction_link journey_visit
        JOIN reconstruction_trip_qualification qualification ON qualification.run_id = journey_visit.run_id AND qualification.journey_id = journey_visit.parent_id
        JOIN reconstruction_link support ON support.run_id = journey_visit.run_id AND support.link_kind = 'visit-support' AND support.parent_id = journey_visit.child_id
        JOIN canonical_evidence evidence ON evidence.evidence_id = support.child_id
        WHERE journey_visit.run_id = ? AND journey_visit.link_kind = 'journey-visit'
          AND qualification.classification IN ('AUTO_CONFIRMED', 'USER_CONFIRMED')
        GROUP BY journey_visit.parent_id HAVING MIN(evidence.captured_day) <= ? AND MAX(evidence.captured_day) >= ?`, completed.run_id, end, start) : [];
      const privateFilter = await privacyFilter(db, completed?.run_id ?? 0);
      await assertPrivacyReadCurrent(db, privateFilter.revision);
      return [
        ...manual.filter((row) => !privateFilter.manual.has(row.manual_id)).map((row) => ({ id: `manual:${row.manual_id}`, label: `${row.owner_label} · owner-entered`, editable: false })),
        ...inferred.filter((row) => !privateFilter.blocked.has(row.journey_id)).map((row) => ({ id: opaqueJourneyDisplayId(row.journey_id), label: row.first_day === row.last_day ? `Inferred journey near ${row.first_day}` : `Inferred journey ${row.first_day} to ${row.last_day}`, editable: true })),
      ];
    },
    async createManualJourney(input: ManualJourneyInput) {
      validateManualJourney(input);
      const db = await open();
      await ensureNativeImportSchema(db);
      const [start, end] = manualRange(input);
      await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
      try {
        const lifecycle = await db.getFirstAsync<{ state: string }>('SELECT state FROM private_record_lifecycle WHERE record_id = 1');
        if (lifecycle?.state !== 'connected') throw new Error('Private record is not connected.');
        const existing = await db.getFirstAsync<ManualRow>('SELECT manual_id, command_key, owner_label, owner_context, latitude, longitude, date_kind, date_start, date_end FROM manual_journey WHERE command_key = ?', input.commandKey);
        if (existing) { await db.execAsync('COMMIT'); return `manual:${existing.manual_id}`; }
        const overlapRows = await db.getAllAsync<{ manual_id: string }>('SELECT manual_id FROM manual_journey WHERE date_start <= ? AND date_end >= ?', end, start);
        const completed = await db.getFirstAsync<{ run_id: number }>("SELECT MAX(run_id) AS run_id FROM reconstruction_run WHERE status = 'complete'");
        const inferredRows = completed?.run_id ? await db.getAllAsync<{ journey_id: string }>(`
          SELECT journey_visit.parent_id AS journey_id
          FROM reconstruction_link journey_visit
          JOIN reconstruction_trip_qualification qualification ON qualification.run_id = journey_visit.run_id AND qualification.journey_id = journey_visit.parent_id
          JOIN reconstruction_link support ON support.run_id = journey_visit.run_id AND support.link_kind = 'visit-support' AND support.parent_id = journey_visit.child_id
          JOIN canonical_evidence evidence ON evidence.evidence_id = support.child_id
          WHERE journey_visit.run_id = ? AND journey_visit.link_kind = 'journey-visit'
            AND qualification.classification IN ('AUTO_CONFIRMED', 'USER_CONFIRMED')
          GROUP BY journey_visit.parent_id HAVING MIN(evidence.captured_day) <= ? AND MAX(evidence.captured_day) >= ?`, completed.run_id, end, start) : [];
        const privateFilter = await privacyFilter(db, completed?.run_id ?? 0);
        const overlapIds = [...overlapRows.filter((row) => !privateFilter.manual.has(row.manual_id)).map((row) => `manual:${row.manual_id}`), ...inferredRows.filter((row) => !privateFilter.blocked.has(row.journey_id)).map((row) => opaqueJourneyDisplayId(row.journey_id))].sort();
        const reviewed = [...new Set(input.reviewedOverlapIds)].sort();
        if (overlapIds.join('|') !== reviewed.join('|')) throw new Error('The private record changed after overlap review. Review overlaps again before saving.');
        const id = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        const anchor = coarseMapAnchor(input.anchor.latitude, input.anchor.longitude)!;
        await db.runAsync(`INSERT INTO manual_journey (manual_id, command_key, owner_label, owner_context, latitude, longitude, date_kind, date_start, date_end, created_at_millis)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, id, input.commandKey, input.label, input.context, anchor.latitude, anchor.longitude, input.date.kind, start, end, Date.now());
        const readBack = await db.getFirstAsync<{ manual_id: string }>('SELECT manual_id FROM manual_journey WHERE manual_id = ?', id);
        if (!readBack) throw new Error('The owner-entered journey could not be read back.');
        await db.execAsync('COMMIT');
        return `manual:${id}`;
      } catch (error) { await db.execAsync('ROLLBACK'); throw error; }
    },
    /**
     * Removes an owner-entered journey and its own source module's data —
     * never evidence, never a reconstructed journey. A plain "Add journey"
     * entry has no side tables; a visual-place or travel-window confirmed
     * trip also clears its album/trip/disposition rows, so the underlying
     * window or cluster is free to be offered again rather than left
     * permanently "confirmed" to data that no longer exists.
     */
    async removeManualJourney(displayId: string): Promise<void> {
      if (!displayId.startsWith('manual:')) throw new Error('Only an owner-entered journey can be removed this way.');
      const manualId = displayId.slice('manual:'.length);
      const db = await open();
      await ensureNativeImportSchema(db);
      await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
      try {
        const lifecycle = await db.getFirstAsync<{ state: string }>('SELECT state FROM private_record_lifecycle WHERE record_id = 1');
        if (lifecycle?.state !== 'connected') throw new Error('Private record is not connected.');
        const existing = await db.getFirstAsync<{ manual_id: string }>('SELECT manual_id FROM manual_journey WHERE manual_id = ?', manualId);
        if (existing) {
          if (manualId.startsWith('visual-')) {
            await db.runAsync('DELETE FROM visual_place_album WHERE manual_id = ?', manualId);
            await db.runAsync('DELETE FROM visual_place_trip WHERE manual_id = ?', manualId);
            await db.runAsync('DELETE FROM visual_place_review WHERE manual_id = ?', manualId);
            await db.runAsync('DELETE FROM visual_place_disposition WHERE manual_id = ?', manualId);
            visualAlbumTokens.delete(manualId);
          } else if (manualId.startsWith('travel-')) {
            await db.runAsync('DELETE FROM travel_window_album WHERE manual_id = ?', manualId);
            await db.runAsync('DELETE FROM travel_window_trip WHERE manual_id = ?', manualId);
            await db.runAsync('DELETE FROM travel_window_disposition WHERE manual_id = ?', manualId);
          }
          await db.runAsync('DELETE FROM manual_journey WHERE manual_id = ?', manualId);
        }
        await db.execAsync('COMMIT');
      } catch (error) { await db.execAsync('ROLLBACK'); throw error; }
    },
    async saveConfiguredHomeAreaFromJourney(displayId: string, areaId: string, visitId: string, ownerLabel: string, effectiveStartDay: string | null, effectiveEndDay: string | null) {
      const db = await open();
      const lifecycle = await db.getFirstAsync<{ state: string }>('SELECT state FROM private_record_lifecycle WHERE record_id = 1');
      const selected = displayedJourneys.get(displayId);
      if (lifecycle?.state !== 'connected' || !selected || !areaId || !visitId || !ownerLabel.trim()) throw new Error('Private place selection is unavailable.');
      const validHomeDay = (day: string | null) => day === null || (/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(day) && new Date(`${day}T00:00:00.000Z`).toISOString().slice(0, 10) === day);
      if (!validHomeDay(effectiveStartDay) || !validHomeDay(effectiveEndDay) || (effectiveStartDay && effectiveEndDay && effectiveStartDay > effectiveEndDay)) throw new Error('Home-area dates must be valid and ordered.');
      const place = await db.getFirstAsync<{ latitude: number; longitude: number }>(`SELECT evidence.latitude, evidence.longitude FROM reconstruction_link journey_visit JOIN reconstruction_visit visit ON visit.run_id = journey_visit.run_id AND visit.visit_id = journey_visit.child_id JOIN reconstruction_place reconstruction_place ON reconstruction_place.run_id = visit.run_id AND reconstruction_place.place_id = visit.place_id JOIN canonical_evidence evidence ON evidence.evidence_id = reconstruction_place.representative_evidence_id WHERE journey_visit.run_id = ? AND journey_visit.parent_id = ? AND journey_visit.child_id = ? AND journey_visit.link_kind = 'journey-visit' AND evidence.latitude IS NOT NULL AND evidence.longitude IS NOT NULL LIMIT 1`, selected.runId, selected.journeyId, visitId);
      if (!place) throw new Error('Choose an observed area in this journey.');
      await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
      try {
        const currentLifecycle = await db.getFirstAsync<{ state: string }>('SELECT state FROM private_record_lifecycle WHERE record_id = 1');
        const completed = await db.getFirstAsync<{ run_id: number }>("SELECT MAX(run_id) AS run_id FROM reconstruction_run WHERE status = 'complete'");
        if (currentLifecycle?.state !== 'connected' || completed?.run_id !== selected.runId) throw new Error('Private place selection is stale. Reopen this journey.');
        await assertPrivacyVisible(db, displayId, selected);
        await db.runAsync("INSERT INTO configured_home_area (area_id, owner_label, origin, latitude, longitude, effective_start_day, effective_end_day, radius_meters) VALUES (?, ?, 'observed-area', ?, ?, ?, ?, ?) ON CONFLICT(area_id) DO UPDATE SET owner_label=excluded.owner_label, origin=excluded.origin, latitude=excluded.latitude, longitude=excluded.longitude, effective_start_day=excluded.effective_start_day, effective_end_day=excluded.effective_end_day, radius_meters=excluded.radius_meters", areaId, ownerLabel.trim(), place.latitude, place.longitude, effectiveStartDay, effectiveEndDay, 20_000);
        await db.execAsync('COMMIT');
      }
      catch (error) { await db.execAsync('ROLLBACK'); throw error; }
    },
    /** Resolves an opaque Atlas id only inside SQLite and returns owner-readable text. */
    async loadJourneyDetail(displayId: string, previewStage?: (stage: import('@/diagnostics/app-diagnostics').JourneyPreviewStage) => void): Promise<{ detail: JourneyDetail; previewSourceRefs: (string | null)[]; snapshotToken: number; privacyRevision?: number }> {
      previewStage?.('PREVIEW_SCOPE');
      const db = await open();
      await ensureNativeImportSchema(db);
      const privacyRevision = await assertPrivacyVisible(db, displayId, displayedJourneys.get(displayId));
      const lifecycle = await db.getFirstAsync<{ state: string }>('SELECT state FROM private_record_lifecycle WHERE record_id = 1');
      if (lifecycle?.state !== 'connected') throw new Error('Private record is not connected.');
      if (displayId.startsWith('manual:')) {
        const manualId = displayId.slice('manual:'.length);
        const manual = await db.getFirstAsync<ManualRow>('SELECT manual_id, command_key, owner_label, owner_context, latitude, longitude, date_kind, date_start, date_end FROM manual_journey WHERE manual_id = ?', manualId);
        if (!manual) throw new Error('Journey is unavailable.');
        const ownerClaim: OwnerJourneyClaim = manual.date_kind === 'exact'
          ? { title: manual.owner_label, date: { kind: 'exact', day: manual.date_start } }
          : { title: manual.owner_label, date: { kind: 'approximate', startDay: manual.date_start, endDay: manual.date_end } };
        if (manualId.startsWith('visual-')) {
          const run = (await loadPublishedRun(db))?.run_id ?? 0;
          previewStage?.('PREVIEW_READ');
          const prior = await visualAlbumSnapshot(db, manualId, run, privacyRevision);
          const album = await visualAlbumRows(db, manualId, run);
          previewStage?.('PREVIEW_VERIFY');
          const snapshot = await visualAlbumSnapshot(db, manualId, run, album.revision);
          const verifiedManual = await db.getFirstAsync<ManualRow>('SELECT manual_id, command_key, owner_label, owner_context, latitude, longitude, date_kind, date_start, date_end FROM manual_journey WHERE manual_id = ?', manualId);
          if (!album.attached || prior.token !== snapshot.token || privacyRevision !== album.revision
            || JSON.stringify(verifiedManual) !== JSON.stringify(manual)
            || ((await loadPublishedRun(db))?.run_id ?? 0) !== run) throw new VisualPlaceError('HISTORY_STALE');
          return { detail: { id: displayId, title: manual.owner_label, observedSpan: manual.date_start === manual.date_end
            ? manual.date_start : `${manual.date_start} – ${manual.date_end}`, destinationNames: snapshot.destinationNames, visits: [],
            memories: album.rows.map((row) => ({ id: `memory-${row.slot}`, availability: row.availability, association: 'Added by you to the album. Capture location unknown.' })),
            uncertainty: ['The confirmed place is an owner assertion. The photos do not establish where they were taken.'], ownerClaim,
            ownerPlace: { id: `manual-place:${manualId}`, name: manual.owner_label, context: manual.owner_context, anchor: coarseMapAnchor(manual.latitude, manual.longitude)! }, ownerEntered: true },
          previewSourceRefs: album.rows.slice(0, 4).map((row) => row.availability === 'available' ? row.source_ref : null),
          snapshotToken: snapshot.token, privacyRevision: album.revision };
        }
        if (manualId.startsWith('travel-')) {
          // Decision 0019/0020's GPS-less confirmed trip: a static album
          // resolved once at confirm time (travel-window/storage.ts), never
          // re-edited or re-recognized, so there is no separate shadow-stamp
          // staleness check — only the privacy revision can invalidate it.
          const run = (await loadPublishedRun(db))?.run_id ?? 0;
          previewStage?.('PREVIEW_READ');
          const album = await travelAlbumRows(db, manualId, run);
          previewStage?.('PREVIEW_VERIFY');
          const verifiedManual = await db.getFirstAsync<ManualRow>('SELECT manual_id, command_key, owner_label, owner_context, latitude, longitude, date_kind, date_start, date_end FROM manual_journey WHERE manual_id = ?', manualId);
          if (!album.attached || privacyRevision !== album.revision || JSON.stringify(verifiedManual) !== JSON.stringify(manual)) throw new Error('Journey changed. Reopen Atlas.');
          return { detail: { id: displayId, title: manual.owner_label, observedSpan: manual.date_start === manual.date_end
            ? manual.date_start : `${manual.date_start} – ${manual.date_end}`, visits: [],
            memories: album.rows.map((row) => ({ id: `memory-${row.slot}`, availability: row.availability, association: 'Added by you to the album. Capture location unknown.' })),
            uncertainty: ['The confirmed place is an owner assertion. The photos do not establish where they were taken.'], ownerClaim,
            ownerPlace: { id: `manual-place:${manualId}`, name: manual.owner_label, context: manual.owner_context, anchor: coarseMapAnchor(manual.latitude, manual.longitude)! }, ownerEntered: true },
          previewSourceRefs: album.rows.slice(0, 4).map((row) => row.availability === 'available' ? row.source_ref : null),
          snapshotToken: album.revision, privacyRevision: album.revision };
        }
        await assertPrivacyVisible(db, displayId);
        return { detail: { id: displayId, title: manual.owner_label, observedSpan: 'Owner-entered date claim; no observed evidence is attached.', visits: [], memories: [], uncertainty: ['This is an owner-entered private assertion. It does not prove presence or create visit support.'], ownerClaim, ownerPlace: { id: `manual-place:${manual.manual_id}`, name: manual.owner_label, context: manual.owner_context, anchor: coarseMapAnchor(manual.latitude, manual.longitude)! }, ownerEntered: true }, previewSourceRefs: [], snapshotToken: 0 };
      }
      const selected = displayedJourneys.get(displayId);
      if (!selected) throw new Error('Journey is unavailable.');
      const completed = await loadPublishedRun(db);
      if (completed?.run_id !== selected.runId) throw new Error('Journey changed. Reopen Atlas.');
      previewStage?.('PREVIEW_READ');
      const visits = await db.getAllAsync<{ visit_id: string; captured_day: string | null; captured_at_millis: number | null; has_precise_offset: number; ordering: 'chronological' | 'uncertain' }>(`WITH visit_summary AS (
        SELECT visit.visit_id, MIN(evidence.captured_day) AS captured_day, MIN(evidence.captured_at_millis) AS captured_at_millis, MIN(evidence.has_precise_offset) AS has_precise_offset, visit.ordering
        FROM reconstruction_link journey_visit
        JOIN reconstruction_visit visit ON visit.run_id = journey_visit.run_id AND visit.visit_id = journey_visit.child_id
        LEFT JOIN reconstruction_link support ON support.run_id = visit.run_id AND support.link_kind = 'visit-support' AND support.parent_id = visit.visit_id
        LEFT JOIN canonical_evidence evidence ON evidence.evidence_id = support.child_id
        WHERE journey_visit.run_id = ? AND journey_visit.link_kind = 'journey-visit' AND journey_visit.parent_id = ?
        GROUP BY visit.visit_id, visit.ordering
      ) SELECT visit_id, captured_day, captured_at_millis, has_precise_offset, ordering FROM visit_summary
        ORDER BY captured_day IS NULL, captured_day, visit_id`, selected.runId, selected.journeyId);
      const memories = await db.getAllAsync<{ evidence_id: string; captured_day: string | null; availability: 'available' | 'unavailable' | 'unknown'; source_ref: string; association: string; disposition: string | null }>(`WITH journey_evidence AS (
          SELECT child_id AS evidence_id, link_kind AS association
          FROM reconstruction_link
          WHERE run_id = ?
            AND parent_id = ? AND link_kind LIKE 'membership:owner:%'
          UNION ALL
          SELECT support.child_id AS evidence_id, 'visit-support' AS association
          FROM reconstruction_link journey_visit
          JOIN reconstruction_link support ON support.run_id = journey_visit.run_id AND support.link_kind = 'visit-support' AND support.parent_id = journey_visit.child_id
          WHERE journey_visit.run_id = ?
            AND journey_visit.link_kind = 'journey-visit' AND journey_visit.parent_id = ?
        )
        SELECT evidence.evidence_id, evidence.captured_day, evidence.availability, evidence.source_ref, GROUP_CONCAT(journey_evidence.association) AS association, disposition.disposition_state AS disposition
        FROM journey_evidence JOIN canonical_evidence evidence ON evidence.evidence_id = journey_evidence.evidence_id
        LEFT JOIN reconstruction_disposition disposition ON disposition.run_id = ? AND disposition.evidence_id = evidence.evidence_id
        GROUP BY evidence.evidence_id
        ORDER BY evidence.captured_day IS NULL, evidence.captured_day, evidence.evidence_id LIMIT 4`, selected.runId, selected.journeyId, selected.runId, selected.journeyId, selected.runId);
      if (!visits.length && !memories.length) throw new Error('Journey is unavailable.');
      const days = visits.map((visit) => visit.captured_day).filter((day): day is string => !!day).sort();
      const mergeRows = (await db.getAllAsync<{ journey_id: string; captured_day: string | null }>(`SELECT journey.journey_id, MIN(evidence.captured_day) AS captured_day
        FROM reconstruction_journey journey JOIN reconstruction_link journey_visit ON journey_visit.run_id = journey.run_id AND journey_visit.link_kind = 'journey-visit' AND journey_visit.parent_id = journey.journey_id
        JOIN reconstruction_link visit_support ON visit_support.run_id = journey_visit.run_id AND visit_support.link_kind = 'visit-support' AND visit_support.parent_id = journey_visit.child_id
        JOIN canonical_evidence evidence ON evidence.evidence_id = visit_support.child_id
        WHERE journey.run_id = ? AND journey.journey_id <> ? GROUP BY journey.journey_id ORDER BY captured_day IS NULL, captured_day, journey.journey_id LIMIT 2`, selected.runId, selected.journeyId)) ?? [];
      const privateFilter = await privacyFilter(db, selected.runId);
      const mergeCandidates = mergeRows.filter((row) => !privateFilter.blocked.has(row.journey_id)).map((row, index) => {
        const id = opaqueJourneyDisplayId(row.journey_id);
        displayedJourneys.set(id, { runId: selected.runId, journeyId: row.journey_id });
        return { id, label: row.captured_day ? `Journey near ${row.captured_day}` : `Journey candidate ${index + 1}` };
      });
      const correction = await db.getFirstAsync<{ action: 'confirm' | 'reject'; application_state: 'effective' | 'pending_remap' }>(
        `SELECT revision.action, application.application_state
         FROM journey_correction_application application
         JOIN journey_correction_revision revision ON revision.revision_id = application.revision_id
          WHERE application.run_id = ? AND application.target_kind = 'journey' AND application.journey_id = ? AND revision.action IN ('confirm', 'reject') AND revision.state <> 'superseded'
         ORDER BY revision.created_at_millis DESC LIMIT 1`, selected.runId, selected.journeyId,
      );
      const pendingScopeReview = await db.getFirstAsync<{ scope_review_id: string }>(
        `SELECT scope_review_id FROM journey_correction_scope_review
         WHERE run_id = ? AND journey_id = ? AND state = 'pending_scope_review' LIMIT 1`, selected.runId, selected.journeyId,
      );
      const ownerClaimRow = await db.getFirstAsync<{ owner_title: string | null; owner_date_kind: 'exact' | 'approximate' | null; owner_date_start: string | null; owner_date_end: string | null }>(
        `SELECT revision.owner_title, revision.owner_date_kind, revision.owner_date_start, revision.owner_date_end
         FROM journey_correction_application application
         JOIN journey_correction_revision revision ON revision.revision_id = application.revision_id
         WHERE application.run_id = ? AND application.target_kind = 'journey' AND application.journey_id = ?
           AND revision.action = 'claim' AND revision.state = 'effective'
         ORDER BY revision.created_at_millis DESC LIMIT 1`, selected.runId, selected.journeyId,
      );
      const ownerDate = ownerClaimRow?.owner_date_kind === 'exact' && ownerClaimRow.owner_date_start
        ? { kind: 'exact' as const, day: ownerClaimRow.owner_date_start }
        : ownerClaimRow?.owner_date_kind === 'approximate' && ownerClaimRow.owner_date_start && ownerClaimRow.owner_date_end
          ? { kind: 'approximate' as const, startDay: ownerClaimRow.owner_date_start, endDay: ownerClaimRow.owner_date_end }
          : undefined;
      const ownerClaim = ownerClaimRow && (ownerClaimRow.owner_title || ownerDate)
        ? { ...(ownerClaimRow.owner_title ? { title: ownerClaimRow.owner_title } : {}), ...(ownerDate ? { date: ownerDate } : {}) }
        : undefined;
      const ownerPlaceRow = await db.getFirstAsync<{ owner_place_id: string; owner_place_name: string; owner_place_context: string; owner_latitude: number; owner_longitude: number }>(
        `SELECT revision.owner_place_id, revision.owner_place_name, revision.owner_place_context, revision.owner_latitude, revision.owner_longitude
         FROM journey_correction_application application
         JOIN journey_correction_revision revision ON revision.revision_id = application.revision_id
         WHERE application.run_id = ? AND application.target_kind = 'journey' AND application.journey_id = ?
           AND revision.action = 'place' AND revision.state = 'effective'
         ORDER BY revision.created_at_millis DESC LIMIT 1`, selected.runId, selected.journeyId,
      );
      const ownerPlaceAnchor = ownerPlaceRow ? coarseMapAnchor(ownerPlaceRow.owner_latitude, ownerPlaceRow.owner_longitude) : null;
      const ownerPlace = ownerPlaceRow?.owner_place_id && ownerPlaceRow.owner_place_name && ownerPlaceRow.owner_place_context && ownerPlaceAnchor
        ? { id: ownerPlaceRow.owner_place_id, name: ownerPlaceRow.owner_place_name, context: ownerPlaceRow.owner_place_context, anchor: ownerPlaceAnchor }
        : undefined;
      const currentSupportRows = (await db.getAllAsync<{ evidence_id: string }>(`SELECT DISTINCT support.child_id AS evidence_id
        FROM reconstruction_link journey JOIN reconstruction_link support
          ON support.run_id = journey.run_id AND support.link_kind = 'visit-support' AND support.parent_id = journey.child_id
        WHERE journey.run_id = ? AND journey.link_kind = 'journey-visit' AND journey.parent_id = ?`, selected.runId, selected.journeyId)) ?? [];
      previewStage?.('PREVIEW_SUPPORT_READ');
      const familyRows = await db.getAllAsync<EvidenceRow>('SELECT evidence_id, captured_at_millis, captured_day, has_precise_offset, availability, latitude, longitude, reported_accuracy_meters, platform_duplicate_family_id, source_origin, support_eligible, duplicate_tuple_version, duplicate_tuple_fingerprint FROM canonical_evidence');
      const detailFamilies = resolveVerifiedDuplicateFamilies(familyRows ?? []);
      const currentSupport = new Set(currentSupportRows.map((row) => detailFamilies.keyForEvidence(row.evidence_id)));
      const pendingCandidates = (await db.getAllAsync<{ candidate_id: string; revision_id: string; reason: string; reviewed_support_json: string; reviewed_family_snapshot_json: string | null }>(
        `SELECT candidate.candidate_id, candidate.revision_id, candidate.reason, revision.reviewed_support_json, revision.reviewed_family_snapshot_json
         FROM journey_correction_candidate candidate
         JOIN journey_correction_revision revision ON revision.revision_id = candidate.revision_id
         WHERE candidate.state = 'pending_remap'
         ORDER BY candidate.created_at_millis DESC`,
      )) ?? [];
      const pendingRemap = pendingCandidates.find((candidate) => {
        try {
          const reviewed = JSON.parse(candidate.reviewed_support_json) as unknown;
          if (!Array.isArray(reviewed)) return false;
          const snapshots = correctionFamilySnapshots(candidate.reviewed_family_snapshot_json, candidate.revision_id);
          return reviewed.some((key) => typeof key === 'string' && currentSupport.has(key)
            && Boolean(resolveReviewedSupportKey(key, candidate.revision_id, snapshots, detailFamilies)));
        } catch { return false; }
      });
      const pendingMemoryCandidates = (await db.getAllAsync<{ candidate_id: string; revision_id: string; reason: string; source_evidence_id: string }>(`SELECT candidate.candidate_id, candidate.revision_id, candidate.reason, revision.source_evidence_id
        FROM journey_memory_correction_candidate candidate JOIN journey_memory_correction_revision revision ON revision.revision_id = candidate.revision_id
        WHERE candidate.state = 'pending_remap' ORDER BY candidate.created_at_millis DESC`)) ?? [];
      const pendingMemoryRemap = pendingMemoryCandidates.find((candidate) => memories.some((memory) => memory.evidence_id === candidate.source_evidence_id));
      if (pendingRemap) displayedPendingRemaps.set(displayId, { candidateId: pendingRemap.candidate_id, revisionId: pendingRemap.revision_id, runId: selected.runId, kind: 'journey' });
      else if (pendingMemoryRemap) displayedPendingRemaps.set(displayId, { candidateId: pendingMemoryRemap.candidate_id, revisionId: pendingMemoryRemap.revision_id, runId: selected.runId, kind: 'memory' });
      else displayedPendingRemaps.delete(displayId);
      const span = !days.length ? 'Observed date unknown' : days[0] === days[days.length - 1] ? `Observed ${days[0]}` : `Observed ${days[0]} to ${days[days.length - 1]}`;
      const detailVisits = visits.map((visit, index) => {
        const id = `visit-${index + 1}`;
        displayedVisits.set(`${displayId}:${id}`, { visitId: visit.visit_id, capturedAtMillis: visit.captured_at_millis, ordering: visit.ordering });
        return { id, label: visit.captured_day ?? 'Date unknown', precision: visit.captured_day ? (visit.has_precise_offset ? 'Observed day and time' : 'Observed day') : 'Date precision unavailable', support: 'Source supports this visit; it does not prove owner presence.' };
      });
      const detailMemories = memories.map((memory, index) => {
        const id = `memory-${index + 1}`;
        displayedMemories.set(`${displayId}:${id}`, { evidenceId: memory.evidence_id, availability: memory.availability });
        const primary = memory.association.includes('membership:owner:owner-primary');
        const hasVisitSupport = memory.association.includes('visit-support');
        const hasMembership = memory.association.includes('membership:');
        return { id, availability: memory.availability, membershipState: primary ? 'primary' as const : hasMembership ? 'suggested' as const : 'unassigned' as const, association: [hasVisitSupport ? 'Supports an observed visit; it does not prove owner presence.' : null, hasMembership ? `Associated with this journey as a memory (${memory.association.split(',').find((item) => item.startsWith('membership:'))?.slice('membership:'.length).replaceAll(/[-:]/g, ' ')}); separate from destination support.` : !hasVisitSupport ? 'Unassigned memory; it has no visit or place support.' : null, memory.disposition ? `This source is ${memory.disposition}; it is reviewable without being visit support.` : null].filter(Boolean).join(' ') };
      });
      const uncertainty = [...new Set([...(visits.some((visit) => visit.ordering === 'uncertain') ? ['Visit ordering is uncertain.'] : []), ...(visits.some((visit) => !visit.captured_day || !visit.has_precise_offset) ? ['Date precision is limited for part of this journey.'] : []), ...memories.filter((memory) => memory.disposition === 'unresolved' || memory.disposition === 'unassigned').map((memory) => `A source remains ${memory.disposition} and is not treated as visit support.`), ...memories.filter((memory) => memory.association.startsWith('membership:') && memory.captured_day === null).map(() => 'A GPS-less or date-limited memory is associated with this journey without destination support.')])];
      const destinationLabels = await readDestinationLabels(db, selected.runId, selected.journeyId);
      previewStage?.('PREVIEW_VERIFY');
      if ((await loadPublishedRun(db))?.run_id !== selected.runId) throw new Error('Journey changed. Reopen Atlas.');
      await assertPrivacyReadCurrent(db, privacyRevision);
      return { detail: { id: displayId, title: ownerClaim?.title ?? ownerPlace?.name ?? destinationLabels.get(selected.journeyId) ?? 'Private journey', observedSpan: span, visits: detailVisits, mergeCandidates, memories: detailMemories, uncertainty, ownerClaim, ownerPlace, pendingRemap: pendingRemap ? { reason: pendingRemap.reason } : pendingMemoryRemap ? { reason: pendingMemoryRemap.reason } : undefined, correctionState: pendingScopeReview ? 'pending scope review' : pendingRemap || pendingMemoryRemap || correction?.application_state === 'pending_remap' ? 'pending remap' : correction?.action === 'confirm' ? 'confirmed' : correction?.action === 'reject' ? 'rejected' : 'inferred' },
        // Unknown is not unavailable. Resolve this bounded, selected set under
        // current permission so Android imports made before URI probing can
        // become visible; the adapter still fails closed if access is gone.
        previewSourceRefs: memories.map((memory) => memory.availability === 'unavailable' ? null : memory.source_ref), snapshotToken: selected.runId, privacyRevision };
    },
    /** One bounded read after media resolution, without repeating the album or privacy joins. */
    async hasPendingHomeProjection(): Promise<boolean> {
      const db = await open();
      const row = await db.getFirstAsync<{ pending: number }>(`SELECT EXISTS (
        SELECT 1 FROM home_projection_context context JOIN reconstruction_run run
          ON run.run_id = (SELECT MAX(run_id) FROM reconstruction_run WHERE status = 'complete')
        WHERE context.record_id = 1 AND run.home_revision <> context.revision
          AND (SELECT state FROM private_record_lifecycle WHERE record_id = 1) = 'connected'
      ) AS pending`);
      return row?.pending === 1;
    },
    async loadJourneyMediaInspection(displayId: string, run: number, slot: number) {
      if (!Number.isSafeInteger(slot) || slot < 1) return null;
      const page = await this.loadJourneyMediaPage(displayId, run, Math.floor((slot - 1) / 60));
      const reference = page.previewSourceRefs[(slot - 1) % 60];
      if (!reference || page.privacyRevision === undefined) return null;
      const db = await open();
      const evidence = await db.getFirstAsync<{ latitude: number | null; longitude: number | null }>(
        'SELECT latitude, longitude FROM canonical_evidence WHERE source_ref = ?', reference);
      if (!evidence || !await this.verifyJourneyMediaSnapshot(displayId, run, page.privacyRevision)) return null;
      return { reference, evidence, privacyRevision: page.privacyRevision };
    },
    async verifyJourneyMediaSnapshot(displayId: string, expectedRun: number, expectedPrivacy: number): Promise<boolean> {
      const db = await open();
      if (displayId.startsWith('manual:visual-')) {
        const manualId = displayId.slice(7);
        const run = (await loadPublishedRun(db))?.run_id ?? 0;
        const album = await visualAlbumRows(db, manualId, run);
        const current = await visualAlbumSnapshot(db, manualId, run, album.revision);
        return album.attached && album.revision === expectedPrivacy && current.token === expectedRun
          && ((await loadPublishedRun(db))?.run_id ?? 0) === run;
      }
      if (displayId.startsWith('manual:travel-')) {
        const manualId = displayId.slice(7);
        const run = (await loadPublishedRun(db))?.run_id ?? 0;
        const album = await travelAlbumRows(db, manualId, run);
        return album.attached && album.revision === expectedPrivacy && expectedRun === album.revision;
      }
      const selected = displayedJourneys.get(displayId);
      if (!selected || selected.runId !== expectedRun) return false;
      const published = await loadPublishedRun(db);
      const scope = await db.getFirstAsync<{ revision: number | null; state: string | null }>(`SELECT
        (SELECT MAX(revision) FROM journey_privacy_revision) AS revision,
        (SELECT state FROM private_record_lifecycle WHERE record_id = 1) AS state`);
      return displayedJourneys.get(displayId)?.runId === expectedRun && scope?.state === 'connected'
        && published?.run_id === expectedRun && (scope.revision ?? 0) === expectedPrivacy;
    },
    /** Reads one stable, local-only associated-media page after an explicit gallery action. */
    async loadJourneyMediaPage(displayId: string, expectedSnapshotToken: number, page: number,
      previewStage?: (stage: import('@/diagnostics/app-diagnostics').JourneyPreviewStage) => void): Promise<{ items: import('@/reveal/types').JourneyMediaPage['items']; previewSourceRefs: (string | null)[]; hasMore: boolean; privacyRevision?: number }> {
      // A gallery opens as a photo grid. Keep fetches bounded while avoiding
      // the old list-like page-by-page experience.
      const pageSize = 60;
      if (!Number.isInteger(page) || page < 0) throw new Error('Gallery page is unavailable.');
      const db = await open();
      if (displayId.startsWith('manual:visual-')) {
        previewStage?.('PREVIEW_SCOPE');
        const manualId = displayId.slice(7);
        const run = (await loadPublishedRun(db))?.run_id ?? 0;
        const revision = await assertPrivacyVisible(db, displayId);
        if ((await visualAlbumSnapshot(db, manualId, run, revision)).token !== expectedSnapshotToken) throw new VisualPlaceError('HISTORY_STALE');
        previewStage?.('PREVIEW_READ');
        const album = await visualAlbumRows(db, manualId, run);
        previewStage?.('PREVIEW_VERIFY');
        if (!album.attached || album.revision !== revision
          || (await visualAlbumSnapshot(db, manualId, run, album.revision)).token !== expectedSnapshotToken
          || ((await loadPublishedRun(db))?.run_id ?? 0) !== run) throw new VisualPlaceError('HISTORY_STALE');
        const rows = album.rows.slice(page * pageSize, (page + 1) * pageSize);
        return { items: rows.map((row) => ({ id: `memory-${row.slot}`, availability: row.availability, kind: 'photo' as const,
          association: 'Added by you to the album. Capture location unknown.' })),
        previewSourceRefs: rows.map((row) => row.availability === 'available' ? row.source_ref : null),
        hasMore: (page + 1) * pageSize < album.rows.length, privacyRevision: album.revision };
      }
      if (displayId.startsWith('manual:travel-')) {
        previewStage?.('PREVIEW_SCOPE');
        const manualId = displayId.slice(7);
        const run = (await loadPublishedRun(db))?.run_id ?? 0;
        const revision = await assertPrivacyVisible(db, displayId);
        if (revision !== expectedSnapshotToken) throw new Error('Journey changed. Reopen Atlas.');
        previewStage?.('PREVIEW_READ');
        const album = await travelAlbumRows(db, manualId, run);
        previewStage?.('PREVIEW_VERIFY');
        if (!album.attached || album.revision !== revision) throw new Error('Journey changed. Reopen Atlas.');
        const rows = album.rows.slice(page * pageSize, (page + 1) * pageSize);
        return { items: rows.map((row) => ({ id: `memory-${row.slot}`, availability: row.availability, kind: 'photo' as const,
          association: 'Added by you to the album. Capture location unknown.' })),
        previewSourceRefs: rows.map((row) => row.availability === 'available' ? row.source_ref : null),
        hasMore: (page + 1) * pageSize < album.rows.length, privacyRevision: album.revision };
      }
      const selected = displayedJourneys.get(displayId);
      const lifecycle = await db.getFirstAsync<{ state: string }>('SELECT state FROM private_record_lifecycle WHERE record_id = 1');
      const completed = await loadPublishedRun(db);
      if (!selected || selected.runId !== expectedSnapshotToken || lifecycle?.state !== 'connected' || completed?.run_id !== expectedSnapshotToken) throw new Error('Gallery changed. Return to the journey and try again.');
      const privacyRevision = await assertPrivacyVisible(db, displayId, selected);
      const rows = (await db.getAllAsync<{ evidence_id: string; availability: 'available' | 'unavailable' | 'unknown'; source_ref: string; media_type: string; association: string }>(`WITH journey_evidence AS (
          SELECT child_id AS evidence_id, link_kind AS association FROM reconstruction_link
          WHERE run_id = ? AND parent_id = ? AND link_kind LIKE 'membership:owner:%'
          UNION ALL
          SELECT support.child_id AS evidence_id, 'visit-support' AS association
          FROM reconstruction_link journey_visit JOIN reconstruction_link support
            ON support.run_id = journey_visit.run_id AND support.link_kind = 'visit-support' AND support.parent_id = journey_visit.child_id
          WHERE journey_visit.run_id = ? AND journey_visit.link_kind = 'journey-visit' AND journey_visit.parent_id = ?
        ) SELECT evidence.evidence_id, evidence.availability, evidence.source_ref, evidence.media_type,
          GROUP_CONCAT(journey_evidence.association) AS association
        FROM journey_evidence JOIN canonical_evidence evidence ON evidence.evidence_id = journey_evidence.evidence_id
        GROUP BY evidence.evidence_id
        ORDER BY evidence.captured_day IS NULL, evidence.captured_day, evidence.evidence_id
        LIMIT ? OFFSET ?`, selected.runId, selected.journeyId, selected.runId, selected.journeyId, pageSize + 1, page * pageSize)) ?? [];
      const visible = rows.slice(0, pageSize);
      if ((await loadPublishedRun(db))?.run_id !== expectedSnapshotToken) throw new Error('Journey changed. Reopen Atlas.');
      await assertPrivacyReadCurrent(db, privacyRevision);
      return {
        items: visible.map((row, index) => ({ id: `media-${page * pageSize + index + 1}`, availability: row.availability, association: row.association, kind: row.media_type === 'video' ? 'video' as const : 'photo' as const })),
        previewSourceRefs: visible.map((row) => row.availability === 'unavailable' ? null : row.source_ref),
        hasMore: rows.length > pageSize,
        privacyRevision,
      };
    },
    async loadVisualDiscoveryEnabled() {
      if (databaseName !== 'travel-life-import-v1.db') return false;
      const db = await open();
      await ensureNativeImportSchema(db);
      return (await visualDiscoveryRow(db)).enabled === 1;
    },
    async setVisualDiscoveryEnabled(enabled: boolean, canChange: () => boolean) {
      if (databaseName !== 'travel-life-import-v1.db' || !canChange()) throw new VisualPlaceError('ACCESS');
      const reader = await open();
      await ensureNativeImportSchema(reader);
      const writer = await openProjectionWriter();
      const expected = await runOwnedTransaction(writer, { kind: 'privacy' }, async (db) => {
        if (!canChange()) throw new VisualPlaceError('ACCESS');
        const row = await visualDiscoveryRow(db);
        if (row.enabled === Number(enabled)) return row.revision;
        await db.runAsync('UPDATE visual_discovery_state SET enabled = ?, revision = revision + 1, proposal = NULL, checkpoint = NULL, scope = NULL WHERE record_id = 1', Number(enabled));
        if (!canChange()) throw new VisualPlaceError('ACCESS');
        return row.revision + 1;
      });
      const row = await visualDiscoveryRow(reader);
      if (row.revision !== expected || row.enabled !== Number(enabled) || !canChange()) throw new VisualPlaceError('HISTORY_STALE');
    },
    async loadVisualDiscoveryPage(canUseSource: () => Promise<boolean>, onProposalRead: () => void = () => {},
      stagedToken?: object, regionalRelease?: string): Promise<VisualDiscoveryPage> {
      const expected = stagedToken && visualDiscoveryReadbacks.get(stagedToken);
      if (stagedToken && !expected) throw new VisualPlaceError('HISTORY_STALE');
      if (databaseName !== 'travel-life-import-v1.db' || !await canUseSource()) throw new VisualPlaceError('ACCESS');
      const db = await open();
      await ensureNativeImportSchema(db);
      const stamp = await candidateShadowStamp(db);
      if (!stamp?.run || stamp.evidence !== stamp.run_evidence || stamp.home !== stamp.run_home) throw new VisualPlaceError('HISTORY_STALE');
      const row = await visualDiscoveryRow(db);
      const runPolicy = await db.getFirstAsync<{ rule_version: string }>('SELECT rule_version FROM reconstruction_run WHERE run_id = ?', stamp.run);
      const partialPreview = isVisualPartialPreviewEnabled();
      const scope = JSON.stringify([visualDiscoveryPolicyVersion, visualRecognizerPolicyVersion, runPolicy?.rule_version,
        stamp.evidence, stamp.home, stamp.privacy, stamp.overlay, stamp.owner, stamp.memory, stamp.rejections, visualCitySupportScope,
        ...(partialPreview ? [visualPartialPreviewScope] : []), ...(regionalRelease ? [regionalLandmarkPolicyVersion, regionalRelease] : [])]);
      const authority = { stamp, scope, row, partialPreview, regionalRelease };
      await verifyVisualDiscoveryAuthority(db, authority, canUseSource);
      if (expected && (expected.scope !== scope || !sameShadowStamp(stamp, expected.stamp) || !sameVisualState(row, expected.row))) {
        throw new VisualPlaceError('HISTORY_STALE');
      }
      const token = Object.freeze({});
      const checkpoint = (row.scope === scope ? readVisualJson<DiscoveryCheckpoint>(row.checkpoint) : null) ?? initialVisualDiscovery();
      const validSample = (sample: DiscoveryPhoto[], limit: number) => Array.isArray(sample) && sample.length <= limit
        && sample.length <= checkpoint.rowCount && sample.every((photo) => photo
          && Number.isFinite(photo.captured_at_millis) && typeof photo.evidence_id === 'string'
          && typeof photo.captured_day === 'string' && typeof photo.family === 'string' && typeof photo.source_ref === 'string');
      if (typeof checkpoint.complete !== 'boolean' || typeof checkpoint.overflow !== 'boolean'
        || !Number.isSafeInteger(checkpoint.rowCount) || !validSample(checkpoint.tail, 170)
        || !validSample(checkpoint.coverage, maximumVisualCoveragePhotos)
        || (checkpoint.cursor !== null
        && (!Number.isFinite(checkpoint.cursor?.captured_at_millis) || typeof checkpoint.cursor.evidence_id !== 'string'))) throw new VisualPlaceError('MEDIA_SCHEMA');
      if (row.scope === scope && row.proposal !== null) onProposalRead();
      const proposal = row.scope === scope ? readVisualJson<DiscoveryProposal>(row.proposal) : null;
      if (proposal) {
        const eligible = await validateVisualDiscoveryProposal(db, authority, proposal);
        await verifyVisualDiscoveryAuthority(db, authority, canUseSource);
        if (eligible) {
          visualDiscoveryReviews.set(token, { authority, proposal });
          if (stagedToken) visualDiscoveryReadbacks.delete(stagedToken);
          return { kind: 'proposal', token, proposal };
        }
        visualDiscoveryPages.set(token, { authority, next: checkpoint, candidate: null });
        return { kind: 'scan', token, candidate: null, more: !checkpoint.complete };
      }
      if (checkpoint.complete) return { kind: 'done' };
      const privacy = await privacyFilter(db, stamp.run);
      const rows = await db.getAllAsync<DiscoveryPhoto>(visualDiscoveryPageSql, stamp.run,
        checkpoint.cursor?.captured_at_millis ?? null, checkpoint.cursor?.evidence_id ?? null,
        JSON.stringify([...privacy.protectedEvidence]), visualDiscoveryPageSize);
      const { candidate, next } = advanceVisualDiscovery(checkpoint, rows, rows.length < visualDiscoveryPageSize);
      const correctionId = candidate && await visualCorrectionTarget(db, candidate.key);
      const eligible = candidate && !await visualEpisodeOverlaps(db, stamp.run, candidate.start, candidate.end, correctionId)
        && !await db.getFirstAsync("SELECT 1 FROM visual_place_review WHERE cluster_key = ? AND decision = 'dismissed'", candidate.key);
      await verifyVisualDiscoveryAuthority(db, authority, canUseSource);
      const reviewable = eligible ? candidate : null;
      visualDiscoveryPages.set(token, { authority, next, candidate: reviewable });
      return { kind: 'scan', token, candidate: reviewable, more: !next.complete };
    },
    async verifyVisualDiscovery(token: object, canUseSource: () => Promise<boolean>) {
      const selection = visualDiscoveryPages.get(token) ?? visualDiscoveryReviews.get(token);
      if (!selection) throw new VisualPlaceError('HISTORY_STALE');
      await verifyVisualDiscoveryAuthority(await open(), selection.authority, canUseSource);
    },
    async loadVisualDiscoveryAlbum(token: object, page: number, canUseSource: () => Promise<boolean>) {
      const selection = visualDiscoveryReviews.get(token);
      if (!selection) throw new VisualPlaceError('HISTORY_STALE');
      if (!Number.isSafeInteger(page) || page < 0 || page >= Math.ceil(selection.proposal.photos.length / visualProposalPageSize)) {
        throw new VisualPlaceError('MEDIA_SCHEMA');
      }
      const { authority, proposal } = selection;
      await verifyVisualDiscoveryAuthority(await open(), authority, canUseSource);
      return { photos: proposal.photos.slice(page * visualProposalPageSize, (page + 1) * visualProposalPageSize),
        hasMore: (page + 1) * visualProposalPageSize < proposal.photos.length };
    },
    async checkpointVisualDiscovery(token: object, result: QualifiedVisualAlbum | null,
      canUseSource: () => Promise<boolean>, signal: AbortSignal, onAcknowledge: () => void) {
      const selection = visualDiscoveryPages.get(token);
      if (!selection) throw new VisualPlaceError('HISTORY_STALE');
      const { authority, candidate, next } = selection;
      const representatives = new Map(candidate?.representatives.map((photo) => [photo.evidence_id, photo]));
      const photos = result && Array.isArray(result.membership) ? result.membership.map((item) => representatives.get(item?.id)) : [];
      if (result && (!candidate || !Array.isArray(result.membership) || photos.some((photo) => !photo)
        || result.start < candidate.start || result.end > candidate.end)) throw new VisualPlaceError('MEDIA_SCHEMA');
      const writer = await openProjectionWriter();
      let staged: VisualDiscoveryRow | undefined;
      const operation = async (db: Database) => {
        await verifyVisualDiscoveryAuthority(db, authority, canUseSource);
        const proposal = result && candidate ? { ...result, key: candidate.key,
          photos: photos.filter((photo): photo is DiscoveryPhoto => Boolean(photo)),
          correctionId: await visualCorrectionTarget(db, candidate.key) } : null;
        const eligible = proposal && await validateVisualDiscoveryProposal(db, authority, proposal, candidate?.representatives)
          && !await db.getFirstAsync(`SELECT 1 FROM visual_place_disposition WHERE command = ?1 OR (
            ?7 = 1 AND decision = 'dismissed'
            AND json_extract(command, '$[0]') = ?3 AND json_extract(command, '$[1]') = ?4
            AND json_extract(command, '$[2]') = ?5 AND json_extract(command, '$[3]') IS ?6
            AND json_extract(command, '$[4]') = ?2
          )`, visualProposalCommand(proposal), proposal.placeId, visualDiscoveryPolicyVersion, visualRecognizerPolicyVersion,
          proposal.key, proposal.correctionId, Number(isVisualLocality(proposal.placeId)));
        staged = { ...authority.row, scope: authority.scope, checkpoint: JSON.stringify(next), proposal: eligible ? JSON.stringify(proposal) : null };
        await db.runAsync('UPDATE visual_discovery_state SET scope = ?, checkpoint = ?, proposal = ? WHERE record_id = 1',
          staged.scope, staged.checkpoint, staged.proposal);
        if (signal.aborted || !await canUseSource()) throw new VisualPlaceError('ACCESS');
        onAcknowledge();
      };
      try {
        await runOwnedTransaction(writer, { kind: 'background', signal }, operation);
      } catch (error) {
        if (!staged || !sameVisualState(await visualDiscoveryRow(await open()), staged)) throw error;
      }
      if (!staged || !sameVisualState(await visualDiscoveryRow(await open()), staged)) throw new VisualPlaceError('HISTORY_STALE');
      await verifyVisualDiscoveryAuthority(await open(), { ...authority, row: staged }, canUseSource);
      visualDiscoveryPages.delete(token);
      const immediate = authority.partialPreview || authority.regionalRelease || (result && usesVisualCitySupport(result.placeId, result.stops));
      if (immediate && staged.proposal !== null) visualDiscoveryReadbacks.set(token, { ...authority, row: staged });
      return { staged: staged.proposal !== null, more: !next.complete };
    },
    async reviewVisualDiscovery(token: object, decision: 'confirm' | 'dismiss', canUseSource: () => Promise<boolean>,
      signal: AbortSignal, onAcknowledge: () => void) {
      const selection = visualDiscoveryReviews.get(token);
      if (!selection || databaseName !== 'travel-life-import-v1.db') throw new VisualPlaceError('HISTORY_STALE');
      const { authority, proposal } = selection;
      const place = resolveVisualPlace(proposal.placeId);
      if (!place) throw new VisualPlaceError('MEDIA_SCHEMA');
      const photos = proposal.photos;
      const command = visualProposalCommand(proposal);
      const stops = JSON.stringify(proposal.stops);
      const membership = JSON.stringify(proposal.membership);
      const anchor = coarseMapAnchor(place.latitude, place.longitude)!;
      const receipt = async (db: Database) => {
        const row = await db.getFirstAsync<{ manual_id: string | null; decision: string }>(
          'SELECT manual_id, decision FROM visual_place_disposition WHERE command = ?', command);
        if (!row) return null;
        if (decision === 'dismiss' && row.decision === 'dismissed') return { manualId: null };
        if (decision !== 'confirm' || row.decision !== 'confirmed' || !row.manual_id
          || (proposal.correctionId && proposal.correctionId !== row.manual_id)) throw new VisualPlaceError('HISTORY_STALE');
        const visual = await db.getFirstAsync<{ command: string; stops: string; membership: string }>(
          'SELECT command, stops, membership FROM visual_place_trip WHERE manual_id = ?', row.manual_id);
        const trip = await db.getFirstAsync<{ owner_label: string; owner_context: string; latitude: number; longitude: number; date_start: string; date_end: string }>(
          'SELECT owner_label, owner_context, latitude, longitude, date_start, date_end FROM manual_journey WHERE manual_id = ?', row.manual_id);
        const album = await visualAlbumRows(db, row.manual_id, authority.stamp.run ?? 0);
        if (visual?.command !== command || visual.stops !== stops || visual.membership !== membership
          || trip?.owner_label !== place.label || trip.owner_context !== place.locality || trip.latitude !== anchor.latitude
          || trip.longitude !== anchor.longitude || trip.date_start !== proposal.start || trip.date_end !== proposal.end
          || album.rows.length !== photos.length || !album.rows.every((photo, i) => photo.evidence_id === photos[i].evidence_id
            && photo.source_ref === photos[i].source_ref && photo.availability === 'available')) throw new VisualPlaceError('HISTORY_STALE');
        return { manualId: row.manual_id };
      };
      const reader = await open();
      await verifyVisualDiscoveryAuthority(reader, authority, canUseSource, false);
      const writer = await openProjectionWriter();
      try {
        await runOwnedTransaction(writer, { kind: 'foreground', signal }, async (db) => {
          await verifyVisualDiscoveryAuthority(db, authority, canUseSource, false);
          if (await receipt(db)) { onAcknowledge(); return; }
          await verifyVisualDiscoveryAuthority(db, authority, canUseSource);
          if (!await validateVisualDiscoveryProposal(db, authority, proposal)) throw new VisualPlaceError('HISTORY_STALE');
          const id = decision === 'confirm' ? proposal.correctionId ?? `visual-${Date.now()}-${Math.random().toString(36).slice(2, 10)}` : null;
          const dateKind = proposal.start === proposal.end ? 'exact' : 'approximate';
          if (id) {
            if (proposal.correctionId) {
              const replay = await readReplayRecoveryProtection(db);
              if (replay.ambiguous || replay.ids.has(id) || replay.ids.has(`manual:${id}`)) throw new VisualPlaceError('HISTORY_STALE');
              await db.runAsync(`UPDATE manual_journey SET owner_label = ?, owner_context = ?, latitude = ?, longitude = ?,
                date_kind = ?, date_start = ?, date_end = ? WHERE manual_id = ?`,
              place.label, place.locality, anchor.latitude, anchor.longitude, dateKind, proposal.start, proposal.end, id);
              await db.runAsync('DELETE FROM visual_place_album WHERE manual_id = ?', id);
              await db.runAsync('UPDATE visual_place_review SET place_id = ? WHERE cluster_key = ? AND manual_id = ?', place.id, proposal.key, id);
            } else {
              await db.runAsync(`INSERT INTO manual_journey (manual_id, command_key, owner_label, owner_context, latitude, longitude, date_kind, date_start, date_end, created_at_millis)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, id, id, place.label, place.locality, anchor.latitude, anchor.longitude, dateKind, proposal.start, proposal.end, Date.now());
              await db.runAsync("INSERT INTO visual_place_review (cluster_key, manual_id, place_id, decision) VALUES (?, ?, ?, 'confirmed')",
                proposal.key, id, place.id);
            }
            for (const [i, photo] of photos.entries()) await db.runAsync('INSERT INTO visual_place_album (manual_id, slot, evidence_id, source_ref) VALUES (?, ?, ?, ?)', id, i + 1, photo.evidence_id, photo.source_ref);
            await db.runAsync('INSERT INTO visual_place_trip (manual_id, command, stops, membership) VALUES (?, ?, ?, ?)', id, command, stops, membership);
          }
          await db.runAsync('INSERT INTO visual_place_disposition (command, manual_id, decision) VALUES (?, ?, ?)', command, id, id ? 'confirmed' : 'dismissed');
          await db.runAsync('UPDATE visual_discovery_state SET proposal = NULL WHERE record_id = 1');
          if (signal.aborted || !await canUseSource()) throw new VisualPlaceError('ACCESS');
          onAcknowledge();
        });
      } catch (error) {
        await verifyVisualDiscoveryAuthority(reader, authority, canUseSource, false);
        if (!await receipt(reader)) throw error;
      }
      await verifyVisualDiscoveryAuthority(reader, authority, canUseSource, false);
      const reviewed = await receipt(reader);
      if (!reviewed) throw new VisualPlaceError('HISTORY_STALE');
      return reviewed;
    },
    /** Retained fixture path for the date-scoped prototype. */
    async loadVisualPlaceOffer(canUseSource: () => Promise<boolean>, dateQuery?: VisualDateQuery) {
      if (databaseName !== 'travel-life-import-v1.db' || !await canUseSource()) throw new VisualPlaceError('ACCESS');
      const db = await open();
      await ensureNativeImportSchema(db);
      const stamp = await candidateShadowStamp(db);
      if (stamp?.state !== 'connected') throw new VisualPlaceError('ACCESS');
      const dated = dateQuery ? await visualDateOffer(db, stamp, dateQuery) : null;
      const offers = dateQuery ? (dated ? [dated] : []) : await eligibleVisualOffers(db, stamp);
      for (const offer of offers) {
        if (!dateQuery && await db.getFirstAsync('SELECT 1 FROM visual_place_review WHERE cluster_key = ?', offer.key)) continue;
        if (!await canUseSource() || !sameShadowStamp(await candidateShadowStamp(db), stamp)) throw new VisualPlaceError('HISTORY_STALE');
        const token = Object.freeze({});
        visualPlaceOffers.set(token, { stamp, offer });
        return { token, observedPeriod: dateQuery ? `${offer.start} – ${offer.end}` : monthRangeLabel(offer.start, offer.end, Number(offer.start.slice(0, 4)), Number(offer.end.slice(0, 4))), hasMore: offer.hasMore,
          references: offer.photos.map((photo, index) => ({ id: `photo-${index + 1}`, sourceRef: photo.source_ref })) };
      }
      return null;
    },
    async verifyVisualPlaceOffer(token: object) {
      const selection = visualPlaceOffers.get(token);
      return !!selection && sameShadowStamp(await candidateShadowStamp(await open()), selection.stamp);
    },
    async reviewVisualPlaceOffer(token: object, decision: { kind: 'dismiss' } | { kind: 'confirm'; selectedIds: readonly string[]; placeId: string; correction?: { id: string; name: string } },
      canUseSource: () => Promise<boolean>, signal: AbortSignal) {
      const selection = visualPlaceOffers.get(token);
      if (databaseName !== 'travel-life-import-v1.db' || !selection || signal.aborted || !await canUseSource()) throw new VisualPlaceError('HISTORY_STALE');
      const { stamp, offer } = selection;
      const writer = await openProjectionWriter();
      const selected = decision.kind === 'confirm' ? decision.selectedIds.map((id) => offer.photos.find((_, index) => id === `photo-${index + 1}`)) : [];
      if (decision.kind === 'confirm' && (decision.placeId !== ewhaPlace.id || (offer.dateQuery && decision.correction)
        || selected.length < 1 || selected.length > maximumVisualPhotos
        || selected.some((photo) => !photo) || new Set(selected).size !== selected.length)) throw new VisualPlaceError('HISTORY_CONSENT');
      if (decision.kind === 'dismiss' && offer.dateQuery) throw new VisualPlaceError('HISTORY_CONSENT');
      const corrected = decision.kind === 'confirm' && decision.correction
        ? searchOwnerPlaces(decision.correction.name, 32).find((place) => place.id === decision.correction?.id) : null;
      if (decision.kind === 'confirm' && decision.correction && !corrected) throw new VisualPlaceError('HISTORY_CONSENT');
      const place = corrected ?? { id: ewhaPlace.id, name: ewhaPlace.label, context: ewhaPlace.locality, latitude: 37.56, longitude: 126.94 };
      const checked = selected.filter((photo): photo is VisualEvidence => Boolean(photo)).sort((a, b) => a.captured_at_millis - b.captured_at_millis);
      const checkReceipt = async (db: Database, manualId: string) => {
        const owner = await db.getFirstAsync<{ owner_label: string; owner_context: string }>('SELECT owner_label, owner_context FROM manual_journey WHERE manual_id = ?', manualId);
        const album = await visualAlbumRows(db, manualId, stamp.run ?? 0);
        return owner?.owner_label === place.name && owner.owner_context === place.context && album.rows.length === checked.length
          && album.rows.every((row, index) => row.evidence_id === checked[index].evidence_id && row.source_ref === checked[index].source_ref);
      };
      const manualId = await runOwnedTransaction(writer, { kind: 'foreground', signal }, async (db) => {
        if (signal.aborted || !await canUseSource() || !sameShadowStamp(await candidateShadowStamp(db), stamp)) throw new VisualPlaceError('HISTORY_STALE');
        const existing = await db.getFirstAsync<{ manual_id: string | null; decision: string; place_id: string | null }>('SELECT manual_id, decision, place_id FROM visual_place_review WHERE cluster_key = ?', offer.key);
        if (existing) {
          if (decision.kind === 'dismiss' && existing.decision === 'dismissed') return null;
          if (decision.kind === 'confirm' && existing.manual_id && existing.place_id === place.id && await checkReceipt(db, existing.manual_id)) return existing.manual_id;
          throw new VisualPlaceError('HISTORY_STALE');
        }
        if (decision.kind === 'dismiss') {
          await db.runAsync("INSERT INTO visual_place_review (cluster_key, decision) VALUES (?, 'dismissed')", offer.key);
          return null;
        }
        const current = offer.dateQuery ? await visualDateOffer(db, stamp, offer.dateQuery)
          : (await eligibleVisualOffers(db, stamp)).find((item) => item.key === offer.key);
        if (current?.key !== offer.key || checked.some((photo) => !current.photos.some((item) => item.evidence_id === photo.evidence_id && item.source_ref === photo.source_ref))) throw new VisualPlaceError('HISTORY_STALE');
        const start = offer.dateQuery?.start ?? checked[0].captured_day;
        const end = offer.dateQuery?.end ?? checked.at(-1)!.captured_day;
        const id = `visual-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        // This rounded public campus reference is an owner-entered map anchor.
        const anchor = coarseMapAnchor(place.latitude, place.longitude)!;
        await db.runAsync(`INSERT INTO manual_journey (manual_id, command_key, owner_label, owner_context, latitude, longitude, date_kind, date_start, date_end, created_at_millis)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, id, id, place.name, place.context, anchor.latitude, anchor.longitude, start === end ? 'exact' : 'approximate', start, end, Date.now());
        for (const [index, photo] of checked.entries()) await db.runAsync('INSERT INTO visual_place_album (manual_id, slot, evidence_id, source_ref) VALUES (?, ?, ?, ?)', id, index + 1, photo.evidence_id, photo.source_ref);
        await db.runAsync("INSERT INTO visual_place_review (cluster_key, manual_id, place_id, decision) VALUES (?, ?, ?, 'confirmed')", offer.key, id, place.id);
        if (signal.aborted || !await canUseSource()) throw new VisualPlaceError('HISTORY_STALE');
        return id;
      });
      return { manualId, verify: async () => {
        if (!await canUseSource() || !sameShadowStamp(await candidateShadowStamp(await open()), stamp)) return false;
        return manualId === null
          ? Boolean(await (await open()).getFirstAsync("SELECT 1 FROM visual_place_review WHERE cluster_key = ? AND decision = 'dismissed'", offer.key))
          : checkReceipt(await open(), manualId);
      } };
    },
    async loadUncertainMemories(displayId: string, expectedSnapshotToken: number, query = '', page = 0) {
      const db = await open();
      const selected = displayedJourneys.get(displayId);
      if (!selected || selected.runId !== expectedSnapshotToken || !Number.isInteger(page) || page < 0 || query.length > 10 || !/^[0-9-]*$/.test(query)) throw new Error('Uncertain memory review is unavailable. Reload the journey before continuing.');
      const lifecycle = await db.getFirstAsync<{ state: string }>('SELECT state FROM private_record_lifecycle WHERE record_id = 1');
      const completed = await db.getFirstAsync<{ run_id: number }>("SELECT MAX(run_id) AS run_id FROM reconstruction_run WHERE status = 'complete'");
      if (lifecycle?.state !== 'connected' || completed?.run_id !== expectedSnapshotToken) throw new Error('Review is stale. Reload the journey before continuing.');
      await assertPrivacyVisible(db, displayId, selected);
      const privateFilter = await privacyFilter(db, selected.runId);
      const rows = (await db.getAllAsync<{ evidence_id: string; captured_day: string | null; availability: 'available' | 'unavailable' | 'unknown'; has_location: number; suggestion_count: number; selected_primary: number }>(`WITH memberships AS (
          SELECT child_id AS evidence_id, parent_id AS journey_id, link_kind
          FROM reconstruction_link WHERE run_id = ? AND link_kind LIKE 'membership:%'
        ) SELECT evidence.evidence_id, evidence.captured_day, evidence.availability,
          CASE WHEN evidence.latitude IS NULL OR evidence.longitude IS NULL THEN 0 ELSE 1 END AS has_location,
          COUNT(DISTINCT memberships.journey_id) AS suggestion_count,
          MAX(CASE WHEN memberships.journey_id = ? AND memberships.link_kind = 'membership:owner:owner-primary' THEN 1 ELSE 0 END) AS selected_primary
        FROM canonical_evidence evidence LEFT JOIN memberships ON memberships.evidence_id = evidence.evidence_id
        WHERE evidence.captured_day LIKE ?
          AND NOT EXISTS (SELECT 1 FROM reconstruction_link support WHERE support.run_id = ? AND support.link_kind = 'visit-support' AND support.child_id = evidence.evidence_id)
        GROUP BY evidence.evidence_id
        ORDER BY evidence.captured_day IS NULL, evidence.captured_day, evidence.evidence_id
        LIMIT 13 OFFSET ?`, selected.runId, selected.journeyId, `${query}%`, selected.runId, page * 12)) ?? [];
      const memories = rows.filter((row) => !privateFilter.protectedEvidence.has(row.evidence_id)).slice(0, 12).map((row, index) => {
        const id = `uncertain-memory-${page * 12 + index + 1}`;
        displayedMemories.set(`${displayId}:${id}`, { evidenceId: row.evidence_id, availability: row.availability });
        return {
          id, capturedDay: row.captured_day, availability: row.availability,
          locationState: row.has_location ? 'Location metadata available' : 'Location metadata unavailable',
          association: row.suggestion_count ? `Suggested by ${row.suggestion_count} ${row.suggestion_count === 1 ? 'journey' : 'journeys'}; separate from destination support.` : 'No journey suggestion; separate from destination support.',
          membershipState: row.selected_primary ? 'primary' as const : row.suggestion_count ? 'suggested' as const : 'unassigned' as const,
        };
      });
      await assertPrivacyReadCurrent(db, privateFilter.revision);
      return { memories, hasMore: rows.length > 12 };
    },
    /** An owner may abandon a withheld correction, but remaps are never accepted implicitly. */
    async discardJourneyCorrectionPending(displayId: string, expectedSnapshotToken: number, commandKey: string, nowMillis = Date.now()) {
      const db = await open();
      const selected = displayedJourneys.get(displayId);
      const pending = displayedPendingRemaps.get(displayId);
      if (!selected || !pending || pending.runId !== expectedSnapshotToken || selected.runId !== expectedSnapshotToken) throw new Error('Pending correction is unavailable. Reload the journey before saving.');
      if (!commandKey || commandKey.length > 200) throw new Error('A correction command key is required.');
      await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
      try {
        const lifecycle = await db.getFirstAsync<{ state: string }>('SELECT state FROM private_record_lifecycle WHERE record_id = 1');
        const completed = await db.getFirstAsync<{ run_id: number }>("SELECT MAX(run_id) AS run_id FROM reconstruction_run WHERE status = 'complete'");
        if (lifecycle?.state !== 'connected' || completed?.run_id !== expectedSnapshotToken) throw new Error('Review is stale. Reload the journey before saving.');
        const candidate = await db.getFirstAsync<{ revision_id: string }>(pending.kind === 'journey'
          ? "SELECT revision_id FROM journey_correction_candidate WHERE candidate_id = ? AND revision_id = ? AND state = 'pending_remap'"
          : "SELECT revision_id FROM journey_memory_correction_candidate WHERE candidate_id = ? AND revision_id = ? AND state = 'pending_remap'", pending.candidateId, pending.revisionId);
        if (!candidate) {
          await db.execAsync('COMMIT');
          return { graph: null };
        }
        await db.runAsync(pending.kind === 'journey' ? "UPDATE journey_correction_candidate SET state = 'superseded' WHERE candidate_id = ?" : "UPDATE journey_memory_correction_candidate SET state = 'superseded' WHERE candidate_id = ?", pending.candidateId);
        await db.runAsync(pending.kind === 'journey' ? "UPDATE journey_correction_revision SET state = 'superseded' WHERE revision_id = ? AND state = 'effective'" : "UPDATE journey_memory_correction_revision SET state = 'superseded' WHERE revision_id = ? AND state = 'effective'", pending.revisionId);
        const graph = await this.rebuild(nowMillis, false, async () => true, true);
        const beforeCommit = await db.getFirstAsync<{ state: string }>('SELECT state FROM private_record_lifecycle WHERE record_id = 1');
        if (beforeCommit?.state !== 'connected') throw new Error('Private record is unavailable.');
        await db.execAsync('COMMIT');
        displayedPendingRemaps.delete(displayId);
        return { graph };
      } catch (error) { await db.execAsync('ROLLBACK'); throw error; }
    },
    /** Persist a review snapshot against canonical evidence only. A family key
     * is emitted only after its complete persisted tuple has been verified. */
    async verifySuggestedMergeReceipt(pair: import('@/reveal/types').JourneyMergePair, commandKey: string) {
      const db = await open();
      const published = await loadPublishedRun(db);
      if (!published || published.run_id === pair.generation) return false;
      const receipt = await db.getFirstAsync<{ journey_id: string; reviewed_snapshot_json: string; structural_boundary_json: string }>(`
        SELECT r.journey_id, r.reviewed_snapshot_json, r.structural_boundary_json
        FROM journey_correction_revision r
        JOIN journey_correction_application a ON a.revision_id = r.revision_id
        WHERE a.run_id = ? AND a.application_state = 'effective'
          AND r.action = 'merge' AND r.state = 'effective' AND r.source_run_id = ? AND r.command_key = ?
      `, published.run_id, pair.generation, commandKey);
      if (!receipt || opaqueJourneyDisplayId(receipt.journey_id) !== pair.leftId
        || JSON.parse(receipt.reviewed_snapshot_json).mergePeer !== pair.rightId) return false;
      const boundary = JSON.parse(receipt.structural_boundary_json) as { left: string[]; right: string[] };
      const expected = candidatePartition([boundary.left.map((key) => key.slice(2)), boundary.right.map((key) => key.slice(2))]);
      const successors = await db.getAllAsync<{ journey_id: string }>(`
        SELECT DISTINCT q.journey_id FROM reconstruction_trip_qualification q
        JOIN reconstruction_link j ON j.run_id = q.run_id AND j.link_kind = 'journey-visit' AND j.parent_id = q.journey_id
        JOIN reconstruction_link s ON s.run_id = j.run_id AND s.link_kind = 'visit-support' AND s.parent_id = j.child_id
        WHERE q.run_id = ? AND q.classification IN ('AUTO_CONFIRMED', 'USER_CONFIRMED') AND s.child_id = ?
      `, published.run_id, boundary.left[0]?.slice(2) ?? '');
      if (successors.length !== 1 || await candidateCommittedPartition(db, published.run_id, successors[0].journey_id) !== expected) return false;
      await assertPrivacyReadCurrent(db, pair.privacyRevision);
      return (await loadPublishedRun(db))?.run_id === published.run_id;
    },
    async saveJourneyCorrection(displayId: string, action: JourneyCorrectionAction, expectedSnapshotToken: number, reviewedSnapshot: JourneyDetail, commandKey: string, payloadOrNowMillis?: OwnerJourneyClaim | OwnerJourneyPlace | StructuralSplit | StructuralMerge | VisitRemoval | number, suppliedNowMillis = Date.now()) {
      const selected = displayedJourneys.get(displayId);
      const nowMillis = typeof payloadOrNowMillis === 'number' ? payloadOrNowMillis : suppliedNowMillis;
      const claim = action === 'claim' && typeof payloadOrNowMillis === 'object' ? payloadOrNowMillis as OwnerJourneyClaim : undefined;
      const place = action === 'place' && typeof payloadOrNowMillis === 'object' ? payloadOrNowMillis as OwnerJourneyPlace : undefined;
      const split = action === 'split' && typeof payloadOrNowMillis === 'object' ? payloadOrNowMillis as StructuralSplit : undefined;
      const merge = action === 'merge' && typeof payloadOrNowMillis === 'object' ? payloadOrNowMillis as StructuralMerge : undefined;
      const removal = action === 'remove-visit' && typeof payloadOrNowMillis === 'object' ? payloadOrNowMillis as VisitRemoval : undefined;
      if (merge?.suggested && !await merge.canUseSource?.()) throw new Error('Photo access is not permitted.');
      const db = await (merge?.suggested ? openProjectionWriter() : open());
      const apply = async (db: Database) => {
        if (merge?.suggested && !await merge.canUseSource?.()) throw new Error('Photo access is not permitted.');
        if (!commandKey || commandKey.length > 200) throw new Error('A correction command key is required.');
        const committed = await db.getFirstAsync<{ revision_id: string; action: JourneyCorrectionAction; journey_id: string; source_run_id: number; reviewed_snapshot_json: string }>('SELECT revision_id, action, journey_id, source_run_id, reviewed_snapshot_json FROM journey_correction_revision WHERE command_key = ?', commandKey);
        if (committed) {
          if (merge?.suggested && (committed.action !== 'merge' || committed.source_run_id !== expectedSnapshotToken
            || opaqueJourneyDisplayId(committed.journey_id) !== displayId
            || JSON.parse(committed.reviewed_snapshot_json).mergePeer !== merge.withJourneyId)) throw new Error('Review is stale. Reload the journey before saving.');
          // A lost response retry must not create a second reconstruction run.
          // The first command already committed its graph with this revision.
          return { revisionId: committed.revision_id, state: committed.action === 'confirm' ? 'confirmed' as const : committed.action === 'reject' ? 'rejected' as const : committed.action === 'remove-visit' ? 'visit-removed' as const : committed.action === 'split' ? 'split' as const : 'claimed' as const, graph: null };
        }
        if (!selected) throw new Error('Journey is unavailable.');
        const structuralPredecessorJourneyIds = [selected.journeyId];
        const lifecycle = await db.getFirstAsync<{ state: string }>('SELECT state FROM private_record_lifecycle WHERE record_id = 1');
        const completed = await db.getFirstAsync<{ run_id: number }>("SELECT MAX(run_id) AS run_id FROM reconstruction_run WHERE status = 'complete'");
        if (lifecycle?.state !== 'connected' || selected.runId !== expectedSnapshotToken || completed?.run_id !== expectedSnapshotToken || reviewedSnapshot.id !== displayId) throw new Error('Review is stale. Reload the journey before saving.');
        const ownerClaim = action === 'claim' ? validatedOwnerClaim(claim) : undefined;
        const ownerPlace = action === 'place' ? validatedOwnerPlace(place) : undefined;
        const splitBoundary = action === 'split' ? displayedVisits.get(`${displayId}:${split?.afterVisitId ?? ''}`) : undefined;
        const removedVisit = action === 'remove-visit' ? displayedVisits.get(`${displayId}:${removal?.visitId ?? ''}`) : undefined;
        if (action === 'remove-visit' && !removedVisit) throw new Error('Choose an observed destination from this private journey.');
        if (action === 'split') {
          const selectedIndex = reviewedSnapshot.visits.findIndex((visit) => visit.id === split?.afterVisitId);
          const next = selectedIndex >= 0 ? displayedVisits.get(`${displayId}:${reviewedSnapshot.visits[selectedIndex + 1]?.id ?? ''}`) : undefined;
          if (!splitBoundary || !next || splitBoundary.ordering !== 'chronological' || next.ordering !== 'chronological' || splitBoundary.capturedAtMillis === null || next.capturedAtMillis === null || splitBoundary.capturedAtMillis >= next.capturedAtMillis) {
            throw new Error('Choose a boundary between strictly ordered observed visits.');
          }
        }
        const support = await db.getAllAsync<{ evidence_id: string; visit_id: string }>(`SELECT DISTINCT support.child_id AS evidence_id, journey.child_id AS visit_id
          FROM reconstruction_link journey JOIN reconstruction_link support
            ON support.run_id = journey.run_id AND support.link_kind = 'visit-support' AND support.parent_id = journey.child_id
          WHERE journey.run_id = ? AND journey.link_kind = 'journey-visit' AND journey.parent_id = ? ORDER BY support.child_id`, selected.runId, selected.journeyId);
        if (!support.length) throw new Error('This journey has no stable evidence support to review.');
        const canonicalRows = await db.getAllAsync<EvidenceRow>('SELECT evidence_id, captured_at_millis, captured_day, has_precise_offset, availability, latitude, longitude, reported_accuracy_meters, platform_duplicate_family_id, source_origin, support_eligible, duplicate_tuple_version, duplicate_tuple_fingerprint FROM canonical_evidence');
        const families = resolveVerifiedDuplicateFamilies(canonicalRows ?? []);
        const reviewedRows = removedVisit ? support.filter((row) => row.visit_id === removedVisit.visitId) : support;
        if (!reviewedRows.length) throw new Error('Choose a destination with stable observed support.');
        const reviewedSupport = [...new Set(reviewedRows.map((row) => families.keyForEvidence(row.evidence_id)))].sort();
        const reviewedSupportJson = JSON.stringify(reviewedSupport);
        const reviewedVisitsJson = JSON.stringify([...new Map(reviewedRows.map((row) => [row.visit_id, [] as string[]])).entries()].map(([visitId]) => [...new Set(reviewedRows.filter((row) => row.visit_id === visitId).map((row) => families.keyForEvidence(row.evidence_id)))].sort()));
        const reviewedFamilySnapshotsJson = JSON.stringify(families.snapshotsFor(reviewedSupport));
        let structuralBoundaryJson = splitBoundary ? JSON.stringify([...new Set(support.filter((row) => row.visit_id === splitBoundary.visitId).map((row) => families.keyForEvidence(row.evidence_id)))].sort()) : null;
        let exactMergedVisits: string[] | null = null;
        if (action === 'split' && structuralBoundaryJson === '[]') throw new Error('Choose a boundary with stable observed support.');
        if (action === 'merge') {
          const peer = displayedJourneys.get(merge?.withJourneyId ?? '');
          if (!peer || peer.runId !== selected.runId || peer.journeyId === selected.journeyId) throw new Error('Choose an adjacent journey from this private Atlas view.');
          if (merge?.suggested) {
            const filter = await privacyFilter(db, selected.runId);
            const pairs = await readPublishedMergePairs(db, selected.runId);
            if (filter.revision !== merge.expectedPrivacyRevision || filter.blocked.has(selected.journeyId) || filter.blocked.has(peer.journeyId)
              || (await loadPublishedRun(db))?.run_id !== selected.runId
              || !pairs.some((pair) => pair.left_id === selected.journeyId && pair.right_id === peer.journeyId)) throw new Error('Review is stale. Reload the journey before saving.');
          }
          structuralPredecessorJourneyIds.push(peer.journeyId);
          const peerSupport = await db.getAllAsync<{ evidence_id: string; visit_id: string }>(`SELECT DISTINCT support.child_id AS evidence_id, journey.child_id AS visit_id
            FROM reconstruction_link journey JOIN reconstruction_link support
              ON support.run_id = journey.run_id AND support.link_kind = 'visit-support' AND support.parent_id = journey.child_id
            WHERE journey.run_id = ? AND journey.link_kind = 'journey-visit' AND journey.parent_id = ? ORDER BY support.child_id`, peer.runId, peer.journeyId);
          const selectedVisits = [...new Map(support.map((row) => [row.visit_id, support.filter((item) => item.visit_id === row.visit_id).map((item) => `E:${item.evidence_id}`).sort()])).values()];
          const peerVisits = [...new Map(peerSupport.map((row) => [row.visit_id, peerSupport.filter((item) => item.visit_id === row.visit_id).map((item) => `E:${item.evidence_id}`).sort()])).values()];
          const ordered = await db.getAllAsync<{ journey_id: string; start_at_millis: number | null; ordering: 'chronological' | 'uncertain' }>(`SELECT journey.journey_id, MIN(evidence.captured_at_millis) AS start_at_millis,
              CASE WHEN SUM(CASE WHEN visit.ordering = 'uncertain' THEN 1 ELSE 0 END) > 0 THEN 'uncertain' ELSE 'chronological' END AS ordering
            FROM reconstruction_journey journey JOIN reconstruction_link journey_visit ON journey_visit.run_id = journey.run_id AND journey_visit.link_kind = 'journey-visit' AND journey_visit.parent_id = journey.journey_id
            JOIN reconstruction_visit visit ON visit.run_id = journey_visit.run_id AND visit.visit_id = journey_visit.child_id
            JOIN reconstruction_link visit_support ON visit_support.run_id = visit.run_id AND visit_support.link_kind = 'visit-support' AND visit_support.parent_id = visit.visit_id
            JOIN canonical_evidence evidence ON evidence.evidence_id = visit_support.child_id WHERE journey.run_id = ?
            GROUP BY journey.journey_id ORDER BY start_at_millis, journey.journey_id`, selected.runId);
          const selectedIndex = ordered.findIndex((row) => row.journey_id === selected.journeyId);
          const peerIndex = ordered.findIndex((row) => row.journey_id === peer.journeyId);
          if (selectedVisits.length !== 1 || peerVisits.length !== 1 || selectedIndex < 0 || peerIndex < 0 || Math.abs(selectedIndex - peerIndex) !== 1 || ordered[selectedIndex].ordering !== 'chronological' || ordered[peerIndex].ordering !== 'chronological') throw new Error('Merge requires two adjacent strictly ordered single-visit journeys.');
          if (merge?.suggested) exactMergedVisits = [...new Set([...support, ...peerSupport].map((row) => row.visit_id))].sort();
          structuralBoundaryJson = JSON.stringify(selectedIndex < peerIndex ? { left: selectedVisits[0], right: peerVisits[0] } : { left: peerVisits[0], right: selectedVisits[0] });
        }
        const reviewedSnapshotJson = JSON.stringify({
          title: reviewedSnapshot.title,
          observedSpan: reviewedSnapshot.observedSpan,
          visits: reviewedSnapshot.visits.map(({ label, precision, support: visitSupport }) => ({ label, precision, support: visitSupport })),
          memories: reviewedSnapshot.memories.map(({ availability, association }) => ({ availability, association })),
          uncertainty: reviewedSnapshot.uncertainty,
          ...(merge?.suggested ? { mergePeer: merge.withJourneyId } : {}),
        });
        const matchingRevisions = await db.getAllAsync<{ revision_id: string; created_at_millis: number }>(
          `SELECT DISTINCT revision.revision_id, revision.created_at_millis
           FROM journey_correction_revision revision
           LEFT JOIN journey_correction_application application ON application.revision_id = revision.revision_id
           WHERE revision.state <> 'superseded' AND revision.action = ?
             AND ((application.run_id = ? AND application.target_kind = 'journey' AND application.journey_id = ?) OR revision.reviewed_support_json = ?)
           ORDER BY revision.created_at_millis DESC`, action, selected.runId, selected.journeyId, reviewedSupportJson,
        );
        const prior = matchingRevisions[0];
        for (const revision of matchingRevisions) {
          await db.runAsync("UPDATE journey_correction_revision SET state = 'superseded' WHERE revision_id = ?", revision.revision_id);
          await db.runAsync("UPDATE journey_correction_candidate SET state = 'superseded' WHERE revision_id = ? AND state = 'pending_remap'", revision.revision_id);
        }
        const predecessorWide = action === 'split' || action === 'merge'
          ? await db.getAllAsync<JourneyCorrectionRevision>(`SELECT revision_id, action, reviewed_support_json, reviewed_visits_json
              FROM journey_correction_revision WHERE state = 'effective' AND action IN ('confirm', 'claim', 'place')
                AND journey_id IN (${structuralPredecessorJourneyIds.map(() => '?').join(', ')})`, ...structuralPredecessorJourneyIds)
          : [];
        const predecessorWideIds = predecessorWideScopeRevisions(predecessorWide);
        for (const predecessorRevisionId of predecessorWideIds) await db.runAsync("UPDATE journey_correction_revision SET state = 'superseded' WHERE revision_id = ?", predecessorRevisionId);
        if (action === 'confirm' || action === 'claim' || action === 'place') {
          await db.runAsync("UPDATE journey_correction_scope_review SET state = 'resolved' WHERE run_id = ? AND journey_id = ? AND state = 'pending_scope_review'", selected.runId, selected.journeyId);
        }
        const revisionId = `journey-review-${nowMillis}-${Math.random().toString(36).slice(2)}`;
        const correctionColumns = ['revision_id', 'action', 'source_run_id', 'journey_id', 'reviewed_support_json', 'state', 'created_at_millis', 'replaces_revision_id', 'reviewed_snapshot_json', 'reviewed_visits_json', 'reviewed_family_snapshot_json', 'command_key', 'owner_title', 'owner_date_kind', 'owner_date_start', 'owner_date_end', 'structural_boundary_json', 'owner_place_id', 'owner_place_name', 'owner_place_context', 'owner_latitude', 'owner_longitude'];
        const correctionValues = [revisionId, action, selected.runId, selected.journeyId, reviewedSupportJson, 'effective', nowMillis, prior?.revision_id ?? null, reviewedSnapshotJson, reviewedVisitsJson, reviewedFamilySnapshotsJson, commandKey, ownerClaim?.title ?? null, ownerClaim?.date?.kind ?? null, ownerClaim?.date?.kind === 'exact' ? ownerClaim.date.day : ownerClaim?.date?.kind === 'approximate' ? ownerClaim.date.startDay : null, ownerClaim?.date?.kind === 'approximate' ? ownerClaim.date.endDay : null, structuralBoundaryJson, ownerPlace?.id ?? null, ownerPlace?.name ?? null, ownerPlace?.context ?? null, ownerPlace?.anchor.latitude ?? null, ownerPlace?.anchor.longitude ?? null];
        await db.runAsync(`INSERT INTO journey_correction_revision (${correctionColumns.join(', ')}) VALUES (${correctionColumns.map(() => '?').join(', ')})`, ...correctionValues);
        // A place is an owner-controlled display override for the exact trip
        // currently on screen; it does not change its evidence, visits, or
        // grouping. Rebuilding here can rotate/split generated IDs before the
        // override is visible, incorrectly turning a valid save into a remap.
        // A later evidence-driven rebuild still remaps this immutable support
        // snapshot fail-closed, preserving the correction safety boundary.
        if (action === 'place') {
          await db.runAsync(
            `INSERT INTO journey_correction_application (revision_id, run_id, target_kind, journey_id, application_state) VALUES (?, ?, 'journey', ?, 'effective')`,
            revisionId, selected.runId, selected.journeyId,
          );
          const lifecycleBeforeCommit = await db.getFirstAsync<{ state: string }>('SELECT state FROM private_record_lifecycle WHERE record_id = 1');
          if (lifecycleBeforeCommit?.state !== 'connected') throw new Error('Private record is unavailable.');
          return { revisionId, state: 'claimed' as const, graph: null };
        }
        merge?.onStage?.('POSSIBLE_TRIP_REBUILD');
        const graph = await this.rebuild(nowMillis, false, async () => true, true, db);
        if (exactMergedVisits) {
          const expected = exactMergedVisits;
          const successor = graph.journeys.find((journey) => journey.visitIds.length === expected.length
            && [...journey.visitIds].sort().every((visit, index) => visit === expected[index]));
          const published = await loadPublishedRun(db);
          const eligible = successor && published && await db.getFirstAsync(`
            SELECT 1 FROM reconstruction_trip_qualification WHERE run_id = ? AND journey_id = ?
              AND classification IN ('AUTO_CONFIRMED', 'USER_CONFIRMED')
          `, published.run_id, successor.id);
          if (!eligible) throw new Error('Review is stale. Reload the journey before saving.');
          if (!await merge?.canUseSource?.()) throw new Error('Photo access is not permitted.');
        }
        if (predecessorWideIds.length) {
          const runId = (await db.getFirstAsync<{ run_id: number }>('SELECT MAX(run_id) AS run_id FROM reconstruction_run WHERE status = \'complete\''))?.run_id;
          if (!runId) throw new Error('Could not record structural scope review.');
          const reviewedEvidenceIds = new Set(reviewedSupport.map((key) => key.slice(2)));
          const successorJourneyIds = graph.journeys
            .filter((journey) => journey.visitIds.some((visitId) => graph.visits.find((visit) => visit.id === visitId)?.evidenceIds.some((evidenceId) => reviewedEvidenceIds.has(evidenceId))))
            .map((journey) => journey.id);
          if (!successorJourneyIds.length) throw new Error('Could not identify structural successors for scope review.');
          for (const predecessorRevisionId of predecessorWideIds) for (const successorJourneyId of successorJourneyIds) {
            await db.runAsync(`INSERT INTO journey_correction_scope_review (scope_review_id, structural_revision_id, predecessor_revision_id, run_id, journey_id, state, created_at_millis)
              VALUES (?, ?, ?, ?, ?, 'pending_scope_review', ?)`, `scope-${revisionId}-${predecessorRevisionId}-${successorJourneyId}`, revisionId, predecessorRevisionId, runId, successorJourneyId, nowMillis);
          }
        }
        const lifecycleBeforeCommit = await db.getFirstAsync<{ state: string }>('SELECT state FROM private_record_lifecycle WHERE record_id = 1');
        if (lifecycleBeforeCommit?.state !== 'connected') throw new Error('Private record is unavailable.');
        return { revisionId, state: action === 'confirm' ? 'confirmed' as const : action === 'reject' ? 'rejected' as const : action === 'remove-visit' ? 'visit-removed' as const : action === 'split' ? 'split' as const : 'claimed' as const, graph };
      };
      if (merge?.suggested) return runOwnedTransaction(db, { kind: 'foreground', onRollback: merge.onRollback }, async (writer) => {
        const result = await apply(writer);
        merge.onStage?.('POSSIBLE_TRIP_ACK');
        return result;
      });
      await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
      try {
        const result = await apply(db);
        await db.execAsync('COMMIT');
        return result;
      } catch (error) { await db.execAsync('ROLLBACK'); throw error; }
    },
    async saveJourneyMemoryCorrection(displayId: string, memoryId: string, action: MemoryCorrectionAction, expectedSnapshotToken: number, commandKey: string, nowMillis = Date.now()) {
      const db = await open();
      const selected = displayedJourneys.get(displayId);
      const memory = displayedMemories.get(`${displayId}:${memoryId}`);
      if (!selected || !memory) throw new Error('Selected memory is unavailable.');
      if (!commandKey || commandKey.length > 200) throw new Error('A correction command key is required.');
      if ((action === 'assign' || action === 'move') && memory.availability !== 'available') throw new Error('Reconnect to identify this memory before assigning it.');
      await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
      try {
        const committed = await db.getFirstAsync<{ revision_id: string }>('SELECT revision_id FROM journey_memory_correction_revision WHERE command_key = ?', commandKey);
        if (committed) { await db.execAsync('COMMIT'); return { revisionId: committed.revision_id, graph: null }; }
        const lifecycle = await db.getFirstAsync<{ state: string }>('SELECT state FROM private_record_lifecycle WHERE record_id = 1');
        const completed = await db.getFirstAsync<{ run_id: number }>("SELECT MAX(run_id) AS run_id FROM reconstruction_run WHERE status = 'complete'");
        if (lifecycle?.state !== 'connected' || selected.runId !== expectedSnapshotToken || completed?.run_id !== expectedSnapshotToken) throw new Error('Review is stale. Reload the journey before saving.');
        await assertPrivacyVisible(db, displayId, selected);
        const privateFilter = await privacyFilter(db, selected.runId);
        if (privateFilter.protectedEvidence.has(memory.evidenceId) || privateFilter.excluded.has(memory.evidenceId)) throw new Error('Selected memory is protected by a privacy choice. Review Privacy Settings.');
        const support = await db.getAllAsync<{ evidence_id: string }>(`SELECT DISTINCT support.child_id AS evidence_id FROM reconstruction_link journey JOIN reconstruction_link support ON support.run_id = journey.run_id AND support.link_kind = 'visit-support' AND support.parent_id = journey.child_id WHERE journey.run_id = ? AND journey.link_kind = 'journey-visit' AND journey.parent_id = ? ORDER BY support.child_id`, selected.runId, selected.journeyId);
        if (!support.length) throw new Error('This journey has no stable support for a memory correction.');
        const canonicalRows = await db.getAllAsync<EvidenceRow>('SELECT evidence_id, captured_at_millis, captured_day, has_precise_offset, availability, latitude, longitude, reported_accuracy_meters, platform_duplicate_family_id, source_origin, support_eligible, duplicate_tuple_version, duplicate_tuple_fingerprint FROM canonical_evidence');
        const families = resolveVerifiedDuplicateFamilies(canonicalRows ?? []);
        const reviewedSupport = [...new Set(support.map((row) => families.keyForEvidence(row.evidence_id)))].sort();
        const revisionId = `journey-memory-${nowMillis}-${Math.random().toString(36).slice(2)}`;
        await db.runAsync(`INSERT INTO journey_memory_correction_revision (revision_id, action, source_run_id, source_evidence_id, journey_id, reviewed_support_json, reviewed_family_snapshot_json, state, created_at_millis, replaces_revision_id, command_key) VALUES (?, ?, ?, ?, ?, ?, ?, 'effective', ?, NULL, ?)`, revisionId, action, selected.runId, memory.evidenceId, selected.journeyId, JSON.stringify(reviewedSupport), JSON.stringify(families.snapshotsFor(reviewedSupport)), nowMillis, commandKey);
        const graph = await this.rebuild(nowMillis, false, async () => true, true);
        const beforeCommit = await db.getFirstAsync<{ state: string }>('SELECT state FROM private_record_lifecycle WHERE record_id = 1');
        if (beforeCommit?.state !== 'connected') throw new Error('Private record is unavailable.');
        await db.execAsync('COMMIT');
        return { revisionId, graph };
      } catch (error) { await db.execAsync('ROLLBACK'); throw error; }
    },
    async markJourneyCorrectionPending(revisionId: string) { await recordPendingCorrectionRemap(revisionId); },
    /** Reads only coarse map anchors and journey state from the committed run.
     * Source/evidence IDs, dates, and raw coordinates stay inside this query. */
    async loadDurableReveal(): Promise<DurableRevealRecord> {
      let stage: DurableRevealStage = 'DURABLE_OPEN';
      const profile = createAtlasPhaseProfile('ATLAS_DURABLE_READ_PROFILE', stage);
      let succeeded = false;
      let db: Database | null = null;
      try {
        db = await open();
        // Atlas includes owner-entered journeys, so this is also a valid first
        // entry point on a device that has not opened the import repository.
        stage = 'DURABLE_SCHEMA'; profile.next(stage);
        await ensureNativeImportSchema(db);
        stage = 'DURABLE_LIFECYCLE_READ'; profile.next(stage);
        const lifecycle = await db.getFirstAsync<{ state: string }>('SELECT state FROM private_record_lifecycle WHERE record_id = 1');
        if (lifecycle?.state !== 'connected') throw new Error('Private record is not connected.');
        stage = 'DURABLE_RUN_READ'; profile.next(stage);
        const completed = await loadPublishedRun(db);
        const privateFilter = await privacyFilter(db, completed?.run_id ?? 0);
        if (!completed?.run_id) {
          stage = 'DURABLE_MANUAL_READ'; profile.next(stage);
          const manualRows = await db.getAllAsync<ManualRow>('SELECT manual_id, command_key, owner_label, owner_context, latitude, longitude, date_kind, date_start, date_end FROM manual_journey ORDER BY date_start DESC, manual_id DESC');
          stage = 'DURABLE_PROJECTION'; profile.next(stage);
          const manualJourneys = manualRows.filter((row) => !privateFilter.manual.has(row.manual_id)).filter((row) => typeof row.manual_id === 'string' && typeof row.owner_label === 'string' && typeof row.owner_context === 'string' && typeof row.date_start === 'string' && typeof row.date_end === 'string' && (row.date_kind === 'exact' || row.date_kind === 'approximate')).map((row) => ({ displayId: `manual:${row.manual_id}`, state: 'owner-entered' as const, anchor: coarseMapAnchor(row.latitude, row.longitude), years: [Number(row.date_start.slice(0, 4))], periodLabel: row.date_kind === 'exact' ? row.date_start : `${row.date_start} to ${row.date_end} (approximate)`, ordering: 'chronological' as const, label: `${row.owner_label} · ${row.owner_context}`, locationKind: 'owner-entered' as const }));
          await assertPrivacyReadCurrent(db, privateFilter.revision);
          if ((await loadPublishedRun(db))?.run_id !== completed?.run_id) throw new Error('Journey changed. Reopen Atlas.');
          displayedJourneys.clear();
          succeeded = true;
          return { journeys: manualJourneys, statistics: null };
        }
        stage = 'DURABLE_JOURNEY_READ'; profile.next(stage);
        const rows = await db.getAllAsync<{ journey_id: string; run_id: number; journey_state: 'inferred' | 'possible-merge'; latitude: number | null; longitude: number | null; display_ordinal: number; year: number | null; ordering: 'chronological' | 'uncertain'; first_year: number | null; last_year: number | null; first_day: string | null; last_day: string | null }>(`
        WITH journey_anchor AS (
          SELECT journey_link.parent_id AS journey_id, MIN(visit.visit_id) AS visit_id
          FROM reconstruction_link journey_link
          JOIN reconstruction_visit visit ON visit.run_id = journey_link.run_id AND visit.visit_id = journey_link.child_id
          WHERE journey_link.link_kind = 'journey-visit'
          GROUP BY journey_link.parent_id
        ), journey_metadata AS (
          SELECT journey.journey_id, journey.run_id, journey.journey_state, evidence.latitude, evidence.longitude,
            MIN(CASE WHEN canonical.captured_day GLOB '????-??-??' THEN CAST(SUBSTR(canonical.captured_day, 1, 4) AS INTEGER) END) AS first_year,
            MAX(CASE WHEN canonical.captured_day GLOB '????-??-??' THEN CAST(SUBSTR(canonical.captured_day, 1, 4) AS INTEGER) END) AS last_year,
            MIN(CASE WHEN canonical.captured_day GLOB '????-??-??' THEN canonical.captured_day END) AS first_day,
            MAX(CASE WHEN canonical.captured_day GLOB '????-??-??' THEN canonical.captured_day END) AS last_day,
            CASE WHEN SUM(CASE WHEN journey_visit_row.ordering = 'uncertain' THEN 1 ELSE 0 END) > 0 THEN 'uncertain' ELSE 'chronological' END AS ordering
          FROM reconstruction_journey journey
          JOIN reconstruction_trip_qualification qualification ON qualification.run_id = journey.run_id AND qualification.journey_id = journey.journey_id
          LEFT JOIN journey_anchor anchor ON anchor.journey_id = journey.journey_id
          LEFT JOIN reconstruction_visit visit ON visit.run_id = journey.run_id AND visit.visit_id = anchor.visit_id
          LEFT JOIN reconstruction_place place ON place.run_id = journey.run_id AND place.place_id = visit.place_id
          LEFT JOIN canonical_evidence evidence ON evidence.evidence_id = place.representative_evidence_id
          LEFT JOIN reconstruction_link journey_visit ON journey_visit.run_id = journey.run_id AND journey_visit.link_kind = 'journey-visit' AND journey_visit.parent_id = journey.journey_id
          LEFT JOIN reconstruction_visit journey_visit_row ON journey_visit_row.run_id = journey_visit.run_id AND journey_visit_row.visit_id = journey_visit.child_id
          LEFT JOIN reconstruction_link visit_support ON visit_support.run_id = journey.run_id AND visit_support.link_kind = 'visit-support' AND visit_support.parent_id = journey_visit.child_id
          LEFT JOIN canonical_evidence canonical ON canonical.evidence_id = visit_support.child_id
          WHERE journey.run_id = ? AND qualification.classification IN ('AUTO_CONFIRMED', 'USER_CONFIRMED')
          GROUP BY journey.journey_id
        ), numbered_journeys AS (
          SELECT *,
            ROW_NUMBER() OVER (ORDER BY first_day IS NULL, first_day DESC, journey_id DESC) AS display_ordinal
          FROM journey_metadata
        ), journey_years AS (
          SELECT DISTINCT journey_visit.parent_id AS journey_id, CAST(SUBSTR(canonical.captured_day, 1, 4) AS INTEGER) AS year
          FROM numbered_journeys
          JOIN reconstruction_link journey_visit ON journey_visit.run_id = numbered_journeys.run_id AND journey_visit.parent_id = numbered_journeys.journey_id
          JOIN reconstruction_link visit_support ON visit_support.run_id = journey_visit.run_id AND visit_support.link_kind = 'visit-support' AND visit_support.parent_id = journey_visit.child_id
          JOIN canonical_evidence canonical ON canonical.evidence_id = visit_support.child_id
          WHERE journey_visit.link_kind = 'journey-visit' AND canonical.captured_day GLOB '????-??-??'
        )
        SELECT numbered_journeys.journey_id, numbered_journeys.run_id, numbered_journeys.journey_state, numbered_journeys.latitude, numbered_journeys.longitude,
          numbered_journeys.display_ordinal, journey_years.year,
          CASE WHEN numbered_journeys.first_day IS NULL THEN 'uncertain' ELSE numbered_journeys.ordering END AS ordering,
          numbered_journeys.first_year, numbered_journeys.last_year, numbered_journeys.first_day, numbered_journeys.last_day
        FROM numbered_journeys LEFT JOIN journey_years ON journey_years.journey_id = numbered_journeys.journey_id
        ORDER BY numbered_journeys.display_ordinal, journey_years.year
      `, completed.run_id);
        const mergeRows = rows.length > 1 ? await readPublishedMergePairs(db, completed.run_id) : [];
        stage = 'DURABLE_MANUAL_READ'; profile.next(stage);
        const manualRows = await db.getAllAsync<ManualRow>('SELECT manual_id, command_key, owner_label, owner_context, latitude, longitude, date_kind, date_start, date_end FROM manual_journey ORDER BY date_start DESC, manual_id DESC');
        stage = 'DURABLE_PROJECTION'; profile.next(stage);
        // sortDay rides along only to interleave with reconstructed journeys
        // below by actual date; it never reaches the returned DurableRevealJourney.
        const manualJourneys = manualRows.filter((row) => !privateFilter.manual.has(row.manual_id)).filter((row) => typeof row.manual_id === 'string' && typeof row.owner_label === 'string' && typeof row.owner_context === 'string' && typeof row.date_start === 'string' && typeof row.date_end === 'string' && (row.date_kind === 'exact' || row.date_kind === 'approximate')).map((row) => ({ sortDay: row.date_start, journey: { displayId: `manual:${row.manual_id}`, state: 'owner-entered' as const, anchor: coarseMapAnchor(row.latitude, row.longitude), years: [Number(row.date_start.slice(0, 4))], periodLabel: row.date_kind === 'exact' ? row.date_start : `${row.date_start} to ${row.date_end} (approximate)`, ordering: 'chronological' as const, label: `${row.owner_label} · ${row.owner_context}`, locationKind: 'owner-entered' as const } }));
        stage = 'DURABLE_COUNTRY_READ'; profile.next(stage);
        const countryRows = await db.getAllAsync<{ journey_id: string; country_code: string }>(`
        SELECT DISTINCT journey_link.parent_id AS journey_id, place.country_code
        FROM reconstruction_link journey_link
        JOIN reconstruction_visit visit ON visit.run_id = journey_link.run_id AND visit.visit_id = journey_link.child_id
        JOIN reconstruction_place place ON place.run_id = visit.run_id AND place.place_id = visit.place_id
        JOIN reconstruction_trip_qualification qualification ON qualification.run_id = journey_link.run_id AND qualification.journey_id = journey_link.parent_id
        WHERE journey_link.run_id = ? AND journey_link.link_kind = 'journey-visit'
          AND qualification.classification IN ('AUTO_CONFIRMED', 'USER_CONFIRMED')
          AND place.country_dataset_version = ? AND place.country_code IS NOT NULL
      `, completed.run_id, NATURAL_EARTH_ADMIN_0_DATASET_VERSION);
        stage = 'DURABLE_OWNER_PLACE_READ'; profile.next(stage);
        const ownerPlaceRows = await db.getAllAsync<{ journey_id: string; owner_place_name: string; owner_place_context: string; owner_latitude: number; owner_longitude: number }>(`
        SELECT application.journey_id, revision.owner_place_name, revision.owner_place_context, revision.owner_latitude, revision.owner_longitude
        FROM journey_correction_application application
        JOIN journey_correction_revision revision ON revision.revision_id = application.revision_id
        WHERE application.run_id = ? AND application.target_kind = 'journey'
          AND revision.action = 'place' AND revision.state = 'effective'
        ORDER BY revision.created_at_millis DESC`, completed.run_id);
        const ownerPlaceByJourney = new Map<string, { name: string; context: string; latitude: number; longitude: number }>();
        for (const row of ownerPlaceRows) {
          if (!ownerPlaceByJourney.has(row.journey_id) && row.owner_place_name && row.owner_place_context && Number.isFinite(row.owner_latitude) && Number.isFinite(row.owner_longitude)) {
            ownerPlaceByJourney.set(row.journey_id, { name: row.owner_place_name, context: row.owner_place_context, latitude: row.owner_latitude, longitude: row.owner_longitude });
          }
        }
        const labelsByJourney = new Map<string, string[]>();
        for (const row of countryRows) {
          const name = countryDisplayName(row.country_code);
          if (name) labelsByJourney.set(row.journey_id, [...new Set([...(labelsByJourney.get(row.journey_id) ?? []), name])].sort());
        }
        stage = 'DURABLE_STATISTICS_READ'; profile.next(stage);
        const statistics = await db.getFirstAsync<{ journey_count: number; place_count: number; country_count: number; resolved_count: number }>(`
        WITH qualified_destinations AS (
          SELECT DISTINCT visit.place_id
          FROM reconstruction_link journey_visit
          JOIN reconstruction_trip_qualification qualification
            ON qualification.run_id = journey_visit.run_id AND qualification.journey_id = journey_visit.parent_id
          JOIN reconstruction_visit visit
            ON visit.run_id = journey_visit.run_id AND visit.visit_id = journey_visit.child_id
          WHERE journey_visit.run_id = ? AND journey_visit.link_kind = 'journey-visit'
            AND qualification.classification IN ('AUTO_CONFIRMED', 'USER_CONFIRMED')
            AND journey_visit.parent_id NOT IN (SELECT value FROM json_each(?))
        )
        SELECT
          (SELECT COUNT(*) FROM reconstruction_trip_qualification WHERE run_id = ? AND classification IN ('AUTO_CONFIRMED', 'USER_CONFIRMED') AND journey_id NOT IN (SELECT value FROM json_each(?))) AS journey_count,
          (SELECT COUNT(*) FROM qualified_destinations) AS place_count,
          (SELECT COUNT(DISTINCT place.country_code) FROM qualified_destinations destination JOIN reconstruction_place place ON place.run_id = ? AND place.place_id = destination.place_id WHERE place.country_code IS NOT NULL AND place.country_dataset_version = ?) AS country_count,
          (SELECT COUNT(*) FROM qualified_destinations destination JOIN reconstruction_place place ON place.run_id = ? AND place.place_id = destination.place_id WHERE place.country_dataset_version = ?) AS resolved_count
      `, completed.run_id, JSON.stringify([...privateFilter.blocked]), completed.run_id, JSON.stringify([...privateFilter.blocked]), completed.run_id, NATURAL_EARTH_ADMIN_0_DATASET_VERSION, completed.run_id, NATURAL_EARTH_ADMIN_0_DATASET_VERSION);
        stage = 'DURABLE_DIAGNOSTICS_READ'; profile.next(stage);
        const diagnostics = await db.getFirstAsync<{
          assessed: number; supported: number; places: number; visits: number;
          missing_day: number; invalid_day: number; unavailable: number;
          duplicate_conflict: number; insufficient_location: number; excluded: number;
        }>(`
        SELECT
          COUNT(*) AS assessed,
          COALESCE(SUM(CASE WHEN disposition_state = 'supported' THEN 1 ELSE 0 END), 0) AS supported,
          (SELECT COUNT(*) FROM reconstruction_place WHERE run_id = ?) AS places,
          (SELECT COUNT(*) FROM reconstruction_visit WHERE run_id = ?) AS visits,
          COALESCE(SUM(CASE WHEN reasons_json = '["missing-capture-date"]' THEN 1 ELSE 0 END), 0) AS missing_day,
          COALESCE(SUM(CASE WHEN reasons_json = '["invalid-capture-day"]' THEN 1 ELSE 0 END), 0) AS invalid_day,
          COALESCE(SUM(CASE WHEN reasons_json = '["source-unavailable"]' THEN 1 ELSE 0 END), 0) AS unavailable,
          COALESCE(SUM(CASE WHEN reasons_json = '["duplicate-family-conflict"]' THEN 1 ELSE 0 END), 0) AS duplicate_conflict,
          COALESCE(SUM(CASE WHEN reasons_json = '["insufficient-location-support"]' THEN 1 ELSE 0 END), 0) AS insufficient_location,
          COALESCE(SUM(CASE WHEN reasons_json = '["owner-excluded"]' THEN 1 ELSE 0 END), 0) AS excluded
        FROM reconstruction_disposition WHERE run_id = ?
      `, completed.run_id, completed.run_id, completed.run_id);
        const journeys = new Map<string, DurableRevealRecord['journeys'][number]>();
        const destinationLabels = await readDestinationLabels(db, completed.run_id, null, (destinationStage) => {
          stage = destinationStage;
          profile.next(stage);
        });
        const pendingReviewJourneys = new Set<string>();
        stage = 'DURABLE_CORRECTION_READ'; profile.next(stage);
        const pendingCandidates = (await db.getAllAsync<{ revision_id: string; reviewed_support_json: string; reviewed_family_snapshot_json: string | null }>(
          `SELECT candidate.revision_id, revision.reviewed_support_json, revision.reviewed_family_snapshot_json
         FROM journey_correction_candidate candidate
         JOIN journey_correction_revision revision ON revision.revision_id = candidate.revision_id
         WHERE candidate.state = 'pending_remap'`,
        )) ?? [];
        if (pendingCandidates.length) {
          stage = 'DURABLE_FAMILY_READ'; profile.next(stage);
          const familyRows = await db.getAllAsync<EvidenceRow>('SELECT evidence_id, captured_at_millis, captured_day, has_precise_offset, availability, latitude, longitude, reported_accuracy_meters, platform_duplicate_family_id, source_origin, support_eligible, duplicate_tuple_version, duplicate_tuple_fingerprint FROM canonical_evidence');
          const families = resolveVerifiedDuplicateFamilies(familyRows ?? []);
          stage = 'DURABLE_SUPPORT_READ'; profile.next(stage);
          const supportRows = await db.getAllAsync<{ journey_id: string; evidence_id: string }>(`
          SELECT DISTINCT journey.parent_id AS journey_id, support.child_id AS evidence_id
          FROM reconstruction_link journey
          JOIN reconstruction_link support ON support.run_id = journey.run_id
            AND support.link_kind = 'visit-support' AND support.parent_id = journey.child_id
          WHERE journey.run_id = ? AND journey.link_kind = 'journey-visit'`, completed.run_id);
          const journeysByEvidence = new Map<string, Set<string>>();
          for (const support of supportRows) {
            const ids = journeysByEvidence.get(support.evidence_id) ?? new Set<string>();
            ids.add(support.journey_id); journeysByEvidence.set(support.evidence_id, ids);
          }
          for (const candidate of pendingCandidates) {
            try {
              const reviewed = JSON.parse(candidate.reviewed_support_json) as unknown;
              if (!Array.isArray(reviewed) || !reviewed.every((key): key is string => typeof key === 'string')) continue;
              const snapshots = correctionFamilySnapshots(candidate.reviewed_family_snapshot_json, candidate.revision_id);
              for (const key of reviewed) for (const journeyId of journeysByEvidence.get(resolveReviewedSupportKey(key, candidate.revision_id, snapshots, families)) ?? []) pendingReviewJourneys.add(journeyId);
            } catch {
              // A malformed candidate remains protected but cannot be attached to
              // a current journey without a verified support mapping.
            }
          }
        }
        stage = 'DURABLE_PROJECTION'; profile.next(stage);
        const nextDisplayedJourneys = new Map<string, { runId: number; journeyId: string }>();
        const periods = new Map<string, { first: string | null; last: string | null }>();
        const periodCounts = new Map<string, number>();
        for (const row of rows) {
          if (privateFilter.blocked.has(row.journey_id)) continue;
          const displayId = opaqueJourneyDisplayId(row.journey_id);
          nextDisplayedJourneys.set(displayId, { runId: row.run_id, journeyId: row.journey_id });
          const existing = journeys.get(displayId);
          if (existing) { if (row.year !== null) existing.years.push(row.year); continue; }
          const names = labelsByJourney.get(row.journey_id) ?? [];
          const supportedLabel = destinationLabels.get(row.journey_id);
          const ownerPlace = ownerPlaceByJourney.get(row.journey_id);
          const label = ownerPlace ? `${ownerPlace.name}, ${ownerPlace.context}` : supportedLabel && supportedLabel !== 'Private journey' ? supportedLabel : names.length === 1 ? names[0] : names.length === 2 ? `${names[0]} & ${names[1]}` : names.length > 2 ? 'Multi-country trip' : 'Private journey';
          const periodLabel = monthRangeLabel(row.first_day, row.last_day, row.first_year, row.last_year);
          const periodKey = JSON.stringify([label, periodLabel]);
          periods.set(displayId, { first: row.first_day, last: row.last_day });
          periodCounts.set(periodKey, (periodCounts.get(periodKey) ?? 0) + 1);
          journeys.set(displayId, { displayId, state: row.journey_state, anchor: ownerPlace ? coarseMapAnchor(ownerPlace.latitude, ownerPlace.longitude) : coarseMapAnchor(row.latitude, row.longitude), years: row.year === null ? [] : [row.year], periodLabel, ordering: row.ordering, label, locationKind: ownerPlace ? 'owner-confirmed' : 'inferred', needsReview: pendingReviewJourneys.has(row.journey_id) });
        }
        for (const journey of journeys.values()) {
          if ((periodCounts.get(JSON.stringify([journey.label, journey.periodLabel])) ?? 0) < 2) continue;
          const period = periods.get(journey.displayId);
          if (!period) continue;
          const first = observedDayLabel(period.first);
          const last = observedDayLabel(period.last);
          if (first && last) journey.periodLabel = first === last ? first : `${first} – ${last}`;
        }
        await assertPrivacyReadCurrent(db, privateFilter.revision);
        if ((await loadPublishedRun(db))?.run_id !== completed.run_id) throw new Error('Journey changed. Reopen Atlas.');
        displayedJourneys.clear();
        for (const [id, journey] of nextDisplayedJourneys) displayedJourneys.set(id, journey);
        succeeded = true;
        const mergePairs = mergeRows.flatMap(({ left_id, right_id }) => {
          const leftId = opaqueJourneyDisplayId(left_id);
          const rightId = opaqueJourneyDisplayId(right_id);
          const left = journeys.get(leftId);
          const right = journeys.get(rightId);
          return left && right && !left.needsReview && !right.needsReview
            ? [{ leftId, rightId, generation: completed.run_id, privacyRevision: privateFilter.revision }] : [];
        });
        // Interleave by actual date (newest first) instead of always listing
        // every manual journey after every reconstructed one — a trip
        // confirmed yesterday belongs near the top, not at the bottom just
        // because its evidence came from an owner assertion. An undated
        // reconstructed journey (first_day null) still sorts last, as before.
        const orderedJourneys = [
          ...[...journeys.values()].map((journey) => ({ sortDay: periods.get(journey.displayId)?.first ?? null, journey })),
          ...manualJourneys,
        ].sort((a, b) => a.sortDay === b.sortDay ? 0 : a.sortDay === null ? 1 : b.sortDay === null ? -1 : b.sortDay.localeCompare(a.sortDay))
          .map(({ journey }) => journey);
        return { journeys: orderedJourneys, ...(mergePairs.length ? { mergePairs } : {}), statistics: statistics ? { journeyCount: statistics.journey_count, placeCount: statistics.place_count, supportedCountryCount: statistics.country_count, countryStatus: statistics.resolved_count === statistics.place_count ? 'supported' : 'unavailable' } : null,
          diagnostics: !privateFilter.policies.length && diagnostics ? { assessed: diagnostics.assessed, supported: diagnostics.supported, places: diagnostics.places, visits: diagnostics.visits, missingDay: diagnostics.missing_day, invalidDay: diagnostics.invalid_day, unavailable: diagnostics.unavailable, duplicateConflict: diagnostics.duplicate_conflict, insufficientLocation: diagnostics.insufficient_location, excluded: diagnostics.excluded } : null };
      } catch (error) {
        if (db && stage === 'DURABLE_MANUAL_READ' && error instanceof Error && error.message.toLowerCase().includes('no such column')) {
          try {
            // Only row presence is inspected. No owner-entered value leaves
            // SQLite, and this diagnostic path never repairs or writes data.
            const manualCount = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM manual_journey');
            if (manualCount?.count === 0) stage = 'DURABLE_MANUAL_EMPTY_LAYOUT';
            else if (manualCount && manualCount.count > 0) stage = 'DURABLE_MANUAL_RETAINED_LAYOUT';
          } catch {
            // A failed optional probe must not mask the original read error.
          }
        }
        throw new DurableRevealStageError(stage, error);
      } finally {
        profile.finish(succeeded);
      }
    },
    /** CAP-3 (detector-v1-2.md): the owner's real Possible-trips card list.
     * `locatedCount` is informational only (the `few-photos` sentence's
     * {n}); it approximates `qualifyTripOutcomeV12`'s own `reliable.length`
     * from the already Home-filtered `visit-support` rows (H-3's graph-level
     * half, closed 2026-11-20) rather than threading a new persisted field
     * through the engine for one display count. */
    async loadPossibleTrips(): Promise<PossibleTripSummary[]> {
      const correlationId = createDiagnosticCorrelationId();
      const report = (reasonCode: AppDiagnosticEvent['reasonCode'], durableOutcome: AppDiagnosticEvent['durableOutcome'], retryable = false) =>
        recordAppDiagnostic({ operation: 'POSSIBLE_TRIP_REVIEW', stage: 'POSSIBLE_TRIPS_LIST_READ', reasonCode, durableOutcome, retryable, correlationId });
      report('START', 'unchanged');
      try {
        const db = await open();
        await ensureNativeImportSchema(db);
        const completed = await loadPublishedRun(db);
        if (!completed?.run_id) { report('COMPLETE', 'complete'); return []; }
        const privateFilter = await privacyFilter(db, completed.run_id);
        const rows = await db.getAllAsync<{ journey_id: string; reasons_json: string; first_year: number | null; last_year: number | null; first_day: string | null; last_day: string | null; located_count: number }>(`
          WITH journey_metadata AS (
            SELECT journey.journey_id, qualification.reasons_json,
              MIN(CASE WHEN canonical.captured_day GLOB '????-??-??' THEN CAST(SUBSTR(canonical.captured_day, 1, 4) AS INTEGER) END) AS first_year,
              MAX(CASE WHEN canonical.captured_day GLOB '????-??-??' THEN CAST(SUBSTR(canonical.captured_day, 1, 4) AS INTEGER) END) AS last_year,
              MIN(CASE WHEN canonical.captured_day GLOB '????-??-??' THEN canonical.captured_day END) AS first_day,
              MAX(CASE WHEN canonical.captured_day GLOB '????-??-??' THEN canonical.captured_day END) AS last_day,
              SUM(CASE WHEN canonical.media_type <> 'video' AND canonical.availability = 'available'
                AND canonical.latitude IS NOT NULL AND canonical.longitude IS NOT NULL
                AND (canonical.reported_accuracy_meters IS NULL OR canonical.reported_accuracy_meters <= 1000)
                AND (canonical.source_origin IS NULL OR canonical.source_origin NOT IN ('screenshot', 'download', 'unknown', 'messaging'))
                THEN 1 ELSE 0 END) AS located_count
            FROM reconstruction_journey journey
            JOIN reconstruction_trip_qualification qualification ON qualification.run_id = journey.run_id AND qualification.journey_id = journey.journey_id
            LEFT JOIN reconstruction_link journey_visit ON journey_visit.run_id = journey.run_id AND journey_visit.link_kind = 'journey-visit' AND journey_visit.parent_id = journey.journey_id
            LEFT JOIN reconstruction_link visit_support ON visit_support.run_id = journey.run_id AND visit_support.link_kind = 'visit-support' AND visit_support.parent_id = journey_visit.child_id
            LEFT JOIN canonical_evidence canonical ON canonical.evidence_id = visit_support.child_id
            WHERE journey.run_id = ? AND qualification.classification = 'SUGGESTED'
            GROUP BY journey.journey_id
          )
          SELECT journey_id, reasons_json, first_year, last_year, first_day, last_day, located_count
          FROM journey_metadata
          ORDER BY first_day IS NULL, first_day DESC, journey_id DESC
        `, completed.run_id);
        const summaries: PossibleTripSummary[] = [];
        for (const row of rows) {
          if (privateFilter.blocked.has(row.journey_id)) continue;
          let reasonCode: TripOutcomeReasonCode | null = null;
          try {
            const reasons = JSON.parse(row.reasons_json) as unknown;
            if (Array.isArray(reasons) && typeof reasons[0] === 'string') reasonCode = reasons[0] as TripOutcomeReasonCode;
          } catch {
            // A malformed row is skipped, never shown with a fabricated reason.
          }
          if (!reasonCode) continue;
          const displayId = opaqueJourneyDisplayId(row.journey_id);
          displayedJourneys.set(displayId, { runId: completed.run_id, journeyId: row.journey_id });
          summaries.push({ displayId, periodLabel: monthRangeLabel(row.first_day, row.last_day, row.first_year, row.last_year), reasonCode, locatedCount: row.located_count });
        }
        await assertPrivacyReadCurrent(db, privateFilter.revision);
        if ((await loadPublishedRun(db))?.run_id !== completed.run_id) throw new Error('Journey changed. Reopen Atlas.');
        report('COMPLETE', 'complete');
        return summaries;
      } catch (error) {
        const reason = classifyAppDiagnosticError(error);
        report(reason, reason === 'HISTORY_STALE' ? 'unchanged' : 'failed', reason === 'DATABASE_BUSY' || reason === 'NATIVE_HANDLE');
        throw error;
      }
    },
    async rebuild(nowMillis = Date.now(), consumeQueuedChanges = false, canUseSource: () => Promise<boolean> = async () => true, transactionAlreadyOpen = false, ownedDatabase?: Database): Promise<ReconstructionGraph> {
      const profile = createAtlasPhaseProfile('ATLAS_REBUILD_PROFILE', 'REBUILD_OPEN');
      let succeeded = false;
      try {
        const db = ownedDatabase ?? await (transactionAlreadyOpen ? open() : openProjectionWriter());
        // Catch-up can arrive before a durable-reveal read has had a chance to
        // gate a retained device through the additive import schema. Do that
        // once before this direct writer begins; never attempt a migration
        // inside a caller-owned correction transaction.
        profile.next('REBUILD_SCHEMA');
        if (!transactionAlreadyOpen) await ensureNativeImportSchema(db);
        profile.next('REBUILD_BEGIN');
        if (!transactionAlreadyOpen) await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
        try {
          profile.next('REBUILD_INPUT');
          const lifecycle = await db.getFirstAsync<{ state: string }>('SELECT state FROM private_record_lifecycle WHERE record_id = 1');
          if (lifecycle?.state !== 'connected') throw new Error('Private record is not connected.');
          let queueSnapshot = 0;
          let snapshotRevision = 0;
          if (consumeQueuedChanges) {
            if (!await canUseSource()) throw new Error('Photo access is not permitted.');
            snapshotRevision = ((await db.getFirstAsync<{ snapshot_revision: number }>('SELECT snapshot_revision FROM reconciliation_checkpoint WHERE record_id = 1'))?.snapshot_revision ?? 0) + 1;
            await db.runAsync('INSERT INTO reconciliation_queue_snapshot (snapshot_revision, asset_id, change_kind, source_revision) SELECT ?, asset_id, change_kind, source_revision FROM maintenance_change_queue', snapshotRevision);
            queueSnapshot = (await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM reconciliation_queue_snapshot WHERE snapshot_revision = ?', snapshotRevision))?.count ?? 0;
            await db.runAsync('INSERT INTO reconciliation_checkpoint (record_id, snapshot_revision, status, started_at_millis, message) VALUES (?, ?, ?, ?, ?) ON CONFLICT(record_id) DO UPDATE SET snapshot_revision=excluded.snapshot_revision, status=excluded.status, started_at_millis=excluded.started_at_millis, message=excluded.message', 1, snapshotRevision, 'running', nowMillis, 'Reconciling local journey updates.');
            await db.runAsync("UPDATE reconciliation_state SET status = 'running', message = 'Reconciling local journey updates.' WHERE record_id = 1");
          }
          const previousJourneyIds = new Set((await db.getAllAsync<{ journey_id: string }>('SELECT journey_id FROM reconstruction_journey')).map((row) => row.journey_id));
          const rows = await db.getAllAsync<EvidenceRow>('SELECT evidence_id, media_type, captured_at_millis, captured_day, has_precise_offset, availability, latitude, longitude, reported_accuracy_meters, platform_duplicate_family_id, source_origin, support_eligible, duplicate_tuple_version, duplicate_tuple_fingerprint FROM canonical_evidence');
          const excluded = new Set((await db.getAllAsync<{ target_id: string }>(`SELECT current.target_id FROM correction_overlays current
            JOIN (SELECT target_id, MAX(revision) AS revision FROM correction_overlays WHERE target_kind = 'evidence' AND correction_scope = 'inclusion' GROUP BY target_id) latest
            ON latest.target_id = current.target_id AND latest.revision = current.revision
            WHERE current.target_kind = 'evidence' AND current.correction_scope = 'inclusion' AND current.owner_action = 'remove'`)).map((row) => row.target_id));
          // History corrections and owner-entered/confirmed records are already
          // durable, but M2.1 has no projection mapper for their semantics yet.
          // Keep the prior complete graph and queue checkpoint pending rather
          // than silently rebuilding around an owner decision.
          if (consumeQueuedChanges) {
            const protectedHistory = await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) AS count FROM correction_overlays
              WHERE target_kind = 'history'`);
            if ((protectedHistory?.count ?? 0) > 0) throw new Error('History corrections need owner review before local reconciliation.');
          }
          const privateFilter = await privacyFilter(db, 0);
          for (const id of privateFilter.excluded) excluded.add(id);
          const configuredHomeAreas = await db.getAllAsync<{ area_id: string; latitude: number; longitude: number; effective_start_day: string | null; effective_end_day: string | null; radius_meters: number }>(
            'SELECT area_id, latitude, longitude, effective_start_day, effective_end_day, radius_meters FROM configured_home_area ORDER BY area_id',
          );
          const storedCorrections = await db.getAllAsync<JourneyCorrectionRevision>(`SELECT revision_id, action, source_run_id, reviewed_support_json, reviewed_visits_json, reviewed_family_snapshot_json, structural_boundary_json
            FROM journey_correction_revision WHERE state = 'effective'`);
          const storedMemoryCorrections = await db.getAllAsync<MemoryCorrectionRevision>(`SELECT revision_id, action, source_evidence_id, reviewed_support_json, reviewed_family_snapshot_json, created_at_millis
            FROM journey_memory_correction_revision WHERE state = 'effective' ORDER BY created_at_millis, revision_id`);
          const baseline = await projectCanonicalHistory({rows,excluded,privateFilter,configuredHomeAreas,storedCorrections,storedMemoryCorrections},profile,async (mappedCorrections) => {
          for (const correction of mappedCorrections) await db.runAsync(
            "UPDATE journey_memory_correction_candidate SET state = 'resolved' WHERE revision_id = ? AND state = 'pending_remap'", correction.revision_id,
          );
          });
          const { evidence, homeAreas, corrections, memoryCorrections, memoryMatches, finalMatches, pendingFinalRemaps } = baseline;
          const mediaByEvidence = new Map(rows.map((row) => [row.evidence_id, row.media_type ?? 'image'] as const));
          // AI clue layer (decision 0022, CAP-2/M11.1). No producer exists yet
          // (CAP-4/5/6), so `clues` is always empty in production today; this
          // wiring just stops being a second place that would need to change
          // once one does. A clue is ignored for a subject the owner already
          // corrected on this rebuild (same support-key convention as
          // `candidate-projection.ts`'s own `supportKey`). Ordered the same
          // way `loadClues()` orders its own identical SELECT, so a
          // "first clue wins" tie-break never depends on SQLite's incidental
          // row order across the two readers of this table. Read before the
          // local-recovery block below (found by the 2026-11-20 code review)
          // so its own "reliable"/"confirmed" checks can be clue-aware too,
          // not just the main per-journey qualification loop further down.
          const clueRows = await db.getAllAsync<ClueRow>(
            `SELECT clue_id, kind, subject_json, value_json, strength, independence_key, producer_id, producer_version,
               evidence_revision, home_revision, correction_revision, state, created_at_millis FROM travel_clue
             ORDER BY created_at_millis, clue_id`,
          );
          const clues = clueRows.map(clueFromRow).filter((clue): clue is ClueRecord => clue !== null);
          // Resolved through the same family identity `baseline.families`
          // already computes for the rebuild, closing the 2026-11-20 code
          // review's known gap (clue-contract.md): a correction's `F:` key
          // only names a family as it stood when the owner reviewed it, so
          // matching that raw key alone misses a clue whose subject key
          // reflects the same evidence after it was later regrouped.
          // `reviewed_family_snapshot_json`'s own `memberIds` names the
          // exact evidence the owner corrected regardless of family drift;
          // re-deriving each member's *current* key closes that gap without
          // the stricter, remap-throwing `resolveReviewedSupportKey` —
          // correctedKeys only ever makes a clue less usable, so a
          // best-effort match is the safe direction here (unlike
          // re-applying a correction itself, this never needs to fail
          // closed). The raw key stays in the set too, for a legacy row
          // with no snapshot.
          const correctedKeys = new Set<string>();
          const addCorrectedKey = (key: string, snapshots: Record<string, FamilySnapshot>) => {
            correctedKeys.add(key);
            if (key.startsWith('E:')) { correctedKeys.add(baseline.families.keyForEvidence(key.slice(2))); return; }
            if (!key.startsWith('F:')) return;
            for (const memberId of snapshots[key]?.memberIds ?? []) correctedKeys.add(baseline.families.keyForEvidence(memberId));
          };
          for (const correction of corrections) {
            let snapshots: Record<string, FamilySnapshot> = {};
            try { snapshots = correctionFamilySnapshots(correction.reviewed_family_snapshot_json, correction.revision_id); }
            catch { /* no usable snapshot: addCorrectedKey still adds the raw key below */ }
            try { for (const key of JSON.parse(correction.reviewed_support_json) as unknown[]) if (typeof key === 'string') addCorrectedKey(key, snapshots); }
            catch { /* malformed legacy row: never guess which keys it covered */ }
          }
          for (const correction of memoryCorrections) {
            let snapshots: Record<string, FamilySnapshot> = {};
            try { snapshots = correctionFamilySnapshots(correction.reviewed_family_snapshot_json, correction.revision_id); }
            catch { /* no usable snapshot: addCorrectedKey still adds the raw key below */ }
            try { for (const key of JSON.parse(correction.reviewed_support_json) as unknown[]) if (typeof key === 'string') addCorrectedKey(key, snapshots); }
            catch { /* malformed legacy row: never guess which keys it covered */ }
          }
          let graph = baseline.graph;
          let policy: string = RECONSTRUCTION_RULE_VERSION;
          let verifyRecoverySource: (() => Promise<boolean>) | undefined;
          let recoveryStage: LocalRecoveryStageError['stage'] = 'CANDIDATE_INPUT_READ';
          try {
            if (databaseName === 'travel-life-import-v1.db') {
              const prior = await db.getFirstAsync<{ rule_version: string }>("SELECT rule_version FROM reconstruction_run WHERE status = 'complete' ORDER BY run_id DESC LIMIT 1");
              const retainedRecovery = prior?.rule_version === LOCAL_RECOVERY_PROJECTION_VERSION;
              if (retainedRecovery || options?.enableLocalRecovery) {
                profile.next('REBUILD_PROCESSING');
                const full = await db.getFirstAsync("SELECT 1 FROM import_checkpoint WHERE scope = 'full' AND status = 'complete'");
                const replay = await readReplayRecoveryProtection(db);
                const canReadRecoverySource = options?.canUseRecoverySource ?? (consumeQueuedChanges ? canUseSource : async () => true);
                if (full && !replay.ambiguous && await canReadRecoverySource()) {
                  recoveryStage = 'CANDIDATE_CLASSIFY';
                  // Clue-aware (CAP-2/M11.1, found by the 2026-11-20 code
                  // review): this narrower "reliable" check must agree with
                  // the main per-journey qualification below on the same
                  // journey, the same reason `candidate-projection.ts`'s
                  // check was switched from v1.1 to v1.2 during the M10.3
                  // review.
                  const candidate = projectCandidateFromCanonical(baseline, mediaByEvidence, undefined, 'recovery', clues, correctedKeys);
                  const visitById = new Map(graph.visits.map((visit) => [visit.id, visit]));
                  const evidenceById = new Map(evidence.map((item) => [item.id, item]));
                  candidate.mergeSuggestions = candidate.mergeSuggestions.filter(({ left, right }) => {
                    if (left.visitIds.length !== 1 || right.visitIds.length !== 1
                      || visitById.get(left.visitIds[0])?.order !== 'ordered' || visitById.get(right.visitIds[0])?.order !== 'ordered') return false;
                    const lastLeft = left.supportIds.reduce((latest, id) => Math.max(latest, evidenceById.get(id)?.capturedAtMillis ?? Infinity), -Infinity);
                    const firstRight = right.supportIds.reduce((earliest, id) => Math.min(earliest, evidenceById.get(id)?.capturedAtMillis ?? -Infinity), Infinity);
                    return firstRight - lastLeft > 72 * 60 * 60 * 1000;
                  });
                  const recovered = projectLocalRecoveryGraph({ baseline, candidate, mediaByEvidence,
                    protectedJourneyIds: replay.ids, withheldEvidence: new Set([...excluded, ...privateFilter.protectedEvidence]), clues, correctedKeys });
                  recoveryStage = 'CANDIDATE_READBACK';
                  if (!await canReadRecoverySource()) throw new Error('Photo access is not permitted.');
                  graph = recovered.graph;
                  if (retainedRecovery || recovered.pairs.length) {
                    policy = recovered.policyVersion;
                    verifyRecoverySource = canReadRecoverySource;
                  }
                } else if (retainedRecovery) {
                  throw new Error(replay.ambiguous ? 'Replay choices need owner review before recovery rebuild.' : 'Photo access is not permitted.');
                }
                if (retainedRecovery && replay.ids.size) {
                  const nextIds = new Set(graph.journeys.map(({ id }) => id));
                  if ([...replay.ids].some((id) => previousJourneyIds.has(id) && !nextIds.has(id))) throw new Error('Replay choices need owner review before recovery rebuild.');
                }
              }
            }
          } catch (error) {
            throw new LocalRecoveryStageError(recoveryStage, error);
          }
          profile.next('REBUILD_PERSISTENCE');
          const evidenceRevision = (await db.getFirstAsync<{ canonical_evidence_revision: number | null }>('SELECT canonical_evidence_revision FROM private_history_record WHERE record_id = 1'))?.canonical_evidence_revision ?? 0;
          const correctionRevision = (await db.getFirstAsync<{ revision: number | null }>('SELECT MAX(revision) AS revision FROM correction_overlays'))?.revision ?? 0;
          const revision = Math.max(evidenceRevision, correctionRevision);
          await db.runAsync('INSERT INTO reconstruction_run (rule_version, evidence_revision, status, completed_at_millis, home_revision) VALUES (?, ?, ?, ?, (SELECT revision FROM home_projection_context WHERE record_id = 1))', policy, revision, 'complete', nowMillis);
          const runId = (await db.getFirstAsync<{ run_id: number }>('SELECT MAX(run_id) AS run_id FROM reconstruction_run'))?.run_id;
          if (runId === undefined) throw new Error('Could not create reconstruction run.');
          for (const correction of corrections) {
            const targetKind = correction.action === 'reject' || correction.action === 'split' || correction.action === 'merge' ? 'grouping-constraint' : 'journey';
            const journeyId = targetKind === 'journey' ? finalMatches.get(correction.revision_id) : null;
            if (targetKind === 'journey' && !journeyId) continue;
            await db.runAsync(
              `INSERT INTO journey_correction_application (revision_id, run_id, target_kind, journey_id, application_state) VALUES (?, ?, ?, ?, 'effective')`,
              correction.revision_id, runId, targetKind, journeyId ?? null,
            );
          }
          for (const correction of memoryCorrections) {
            await db.runAsync(
              `INSERT INTO journey_memory_correction_application (revision_id, run_id, journey_id, application_state) VALUES (?, ?, ?, 'effective')`,
              correction.revision_id, runId, memoryMatches.get(correction.revision_id) ?? null,
            );
          }
          for (const correction of pendingFinalRemaps) {
            const existing = await db.getFirstAsync<{ candidate_id: string }>(
              "SELECT candidate_id FROM journey_correction_candidate WHERE revision_id = ? AND state = 'pending_remap' LIMIT 1",
              correction.revision_id,
            );
            if (!existing) await db.runAsync(
              `INSERT INTO journey_correction_candidate (candidate_id, revision_id, base_run_id, state, reason, created_at_millis)
               VALUES (?, ?, ?, 'pending_remap', ?, ?)`,
              `candidate-${correction.revision_id}-${nowMillis}-${Math.random().toString(36).slice(2)}`,
              correction.revision_id, correction.source_run_id ?? runId,
              'Reviewed support now spans more than one rebuilt journey.', nowMillis,
            );
          }
          for (const correction of corrections.filter((candidate) => finalMatches.has(candidate.revision_id))) await db.runAsync(
            "UPDATE journey_correction_candidate SET state = 'resolved' WHERE revision_id = ? AND state = 'pending_remap'",
            correction.revision_id,
          );
          await db.runAsync('DELETE FROM reconstruction_trip_qualification'); await db.runAsync('DELETE FROM reconstruction_disposition'); await db.runAsync('DELETE FROM reconstruction_link'); await db.runAsync('DELETE FROM reconstruction_journey'); await db.runAsync('DELETE FROM reconstruction_visit'); await db.runAsync('DELETE FROM reconstruction_place');
          const evidenceById = new Map(evidence.map((item) => [item.id, item]));
          const links = reconstructionRowWriter(db, 'reconstruction_link (run_id, link_kind, parent_id, child_id)', 4);
          for (const place of graph.places) {
            const countryCode = resolvePlaceCountryCode(place, evidenceById);
            await db.runAsync('INSERT INTO reconstruction_place (place_id, run_id, representative_evidence_id, uncertainty_json, country_code, country_dataset_version) VALUES (?, ?, ?, ?, ?, ?)', place.id, runId, place.representativeId, JSON.stringify(place.uncertainty), countryCode, NATURAL_EARTH_ADMIN_0_DATASET_VERSION);
            for (const evidenceId of place.memberIds) await links.add([runId, 'place-support', place.id, evidenceId]);
          }
          for (const visit of graph.visits) {
            await db.runAsync('INSERT INTO reconstruction_visit (visit_id, run_id, place_id, ordering) VALUES (?, ?, ?, ?)', visit.id, runId, visit.placeId, visit.order);
            for (const evidenceId of visit.evidenceIds) {
              // H-3's graph-level half (detector-v1-2.md, closed 2026-11-20):
              // a Home-covered photo is never trip support, cover or album
              // media. `qualifyTripOutcomeV12` already excludes it from
              // classification, but every other reader of `visit-support`
              // (readDestinationLabels' title, loadJourneyDetail/
              // loadJourneyMediaPage's cover and album) read the unfiltered
              // link rows this loop writes. `visit-support` is fully
              // rewritten every rebuild (DELETE above), never accumulated,
              // so filtering here — the one place it is generated — makes
              // every one of those ~20 readers agree without touching
              // correction/replay matching's own exact-support semantics,
              // which never legitimately included Home evidence as
              // "support" to begin with. An owner's explicit manual
              // addition is a separate `membership:owner:%` link kind,
              // untouched by this.
              if (evidenceById.get(evidenceId)?.configuredHomeAreaId) continue;
              await links.add([runId, 'visit-support', visit.id, evidenceId]);
            }
          }
          const confirmedJourneyIds = new Set(corrections.filter((correction) => correction.action === 'confirm').map((correction) => finalMatches.get(correction.revision_id)).filter((id): id is string => Boolean(id)));
          profile.next('REBUILD_QUALIFY');
          // trip-detector-v1.2 (decision 0021): one outcome rule for every
          // journey, built once per rebuild so frequent-place (F-1) can see
          // every other journey's episode start/place without recomputing
          // the whole graph per journey.
          const frequentPlaceContext = buildFrequentPlaceContext(graphJourneyEpisodeMarkers(graph, evidenceById));
          // Shared once per rebuild so each journey's qualification is
          // O(its own evidence), not O(the whole library) (found by the
          // M10.3 code review, 2026-11-19).
          const v12Lookups = buildV12CandidateLookups(graph, evidence);
          for (const journey of graph.journeys) {
            await db.runAsync('INSERT INTO reconstruction_journey (journey_id, run_id, journey_state) VALUES (?, ?, ?)', journey.id, runId, journey.state);
            const ownerConfirmed = confirmedJourneyIds.has(journey.id);
            const qualification = ownerConfirmed
              ? { classification: 'USER_CONFIRMED' as const, score: 0, path: null, reasons: ['owner-confirmed'] }
              : (() => { const outcome = qualifyGraphJourneyWithClues(graph, journey.id, evidence, mediaByEvidence, homeAreas, clues, correctedKeys, frequentPlaceContext, v12Lookups);
                  return { classification: outcome.classification, score: outcome.diagnosticScore, path: null, reasons: outcome.reasons }; })();
            await db.runAsync(
              'INSERT INTO reconstruction_trip_qualification (run_id, journey_id, classification, score, qualification_path, reasons_json) VALUES (?, ?, ?, ?, ?, ?)',
              runId, journey.id, qualification.classification, qualification.score, qualification.path,
              JSON.stringify(qualification.reasons),
            );
            // M10.2's device-aggregate read (delivery-and-diagnostics.md):
            // bucketed, content-free per-journey classification counts —
            // never the journey id, place or date, only the closed reason
            // code; a no-op unless phase profiling is enabled.
            profile.classification(rebuildClassificationReasonCode(qualification.reasons as (TripOutcomeReasonCode | 'owner-confirmed')[]));
            for (const visitId of journey.visitIds) await links.add([runId, 'journey-visit', journey.id, visitId]);
          }
          for (const membership of graph.memberships) await links.add([runId, `membership:${membership.state}:${membership.reason}`, membership.journeyId, membership.evidenceId]);
          for (const merge of graph.possibleMerges) await links.add([runId, `possible-merge:${merge.reason}`, merge.fromJourneyId, merge.toJourneyId]);
          await links.flush();
          const dispositions = reconstructionRowWriter(db, 'reconstruction_disposition (run_id, evidence_id, disposition_state, reasons_json)', 4);
          for (const disposition of graph.dispositions) await dispositions.add([runId, disposition.evidenceId, disposition.state, JSON.stringify(disposition.reasons)]);
          await dispositions.flush();
          profile.next('REBUILD_ACK');
          if (consumeQueuedChanges) {
            const derivedIds = new Set([...graph.places, ...graph.visits, ...graph.journeys].map((item) => item.id));
            const overlays = await db.getAllAsync<{ overlay_id: string; target_id: string; identity_lineage_id: string | null }>(`SELECT overlay.overlay_id, overlay.target_id, overlay.identity_lineage_id FROM correction_overlays overlay
              JOIN inferred_history history ON history.history_id = overlay.target_id
              WHERE overlay.target_kind = 'history' AND history.history_state = 'inferred'`);
            await db.runAsync('DELETE FROM reconciliation_unresolved_remap');
            for (const overlay of overlays) if (!derivedIds.has(overlay.target_id)) await db.runAsync(
              'INSERT INTO reconciliation_unresolved_remap (overlay_id, target_id, identity_lineage_id, reason) VALUES (?, ?, ?, ?)',
              overlay.overlay_id, overlay.target_id, overlay.identity_lineage_id, 'The inferred target changed and needs owner review.',
            );
            // Acknowledge only the immutable snapshot. A subsequent producer can
            // add a changed revision while this transaction is pending; it is not
            // covered by this deletion and remains durable for the next pass.
            await db.runAsync(`DELETE FROM maintenance_change_queue WHERE EXISTS (
              SELECT 1 FROM reconciliation_queue_snapshot snapshot
              WHERE snapshot.snapshot_revision = ? AND snapshot.asset_id = maintenance_change_queue.asset_id
                AND snapshot.change_kind = maintenance_change_queue.change_kind
                AND snapshot.source_revision = maintenance_change_queue.source_revision
            )`, snapshotRevision);
            await db.runAsync('DELETE FROM reconciliation_queue_snapshot WHERE snapshot_revision = ?', snapshotRevision);
            const lifecycleBeforeAck = await db.getFirstAsync<{ state: string }>('SELECT state FROM private_record_lifecycle WHERE record_id = 1');
            if (lifecycleBeforeAck?.state !== 'connected') throw new Error('Private record is not connected.');
            if (!await canUseSource()) throw new Error('Photo access is not permitted.');
            await db.runAsync('UPDATE reconciliation_checkpoint SET status = ?, message = ? WHERE record_id = 1', 'complete', 'Complete local checkpoint.',);
            const newJourneyCount = graph.journeys.filter((journey) => !previousJourneyIds.has(journey.id)).length;
            const updatedJourneyCount = graph.journeys.filter((journey) => previousJourneyIds.has(journey.id)).length;
            await db.runAsync(
              "UPDATE reconciliation_state SET status = 'complete', last_checked_at_millis = ?, last_updated_at_millis = ?, new_journey_count = ?, updated_journey_count = ?, message = ? WHERE record_id = 1",
              nowMillis, nowMillis, queueSnapshot ? newJourneyCount : 0, queueSnapshot ? updatedJourneyCount : 0,
              queueSnapshot ? 'Local inferred journey updates are ready for review. They remain private and unpublished.' : 'No local journey updates were waiting.',
            );
          }
          profile.next('REBUILD_COMMIT');
          if (verifyRecoverySource) {
            try {
              if (!await verifyRecoverySource()) throw new Error('Photo access is not permitted.');
            } catch (error) { throw new LocalRecoveryStageError('CANDIDATE_READBACK', error); }
          }
          if (!transactionAlreadyOpen) await db.execAsync('COMMIT');
          succeeded = true;
          return graph;
        } catch (error) {
          if (!transactionAlreadyOpen) await db.execAsync('ROLLBACK');
          throw error;
        }
      } finally {
        profile.finish(succeeded);
      }
    },
    async reconcileQueued(nowMillis = Date.now(), canUseSource: () => Promise<boolean> = async () => true) {
      let token: number | null = null;
      let primaryFailure: unknown = null;
      let stage: ReconciliationStage = 'LEASE_OPEN';
      try {
        // This path reads versioned maintenance/reconciliation lease tables
        // before it delegates to rebuild. Gate it here, rather than relying
        // on the later rebuild gate after a retained local record has already
        // failed a lease read.
        await ensureNativeImportSchema(await open());
        token = await acquireLease(nowMillis, (next) => { stage = next; });
        if (token === null) throw new Error('Local reconciliation is already running; queued changes remain pending.');
        stage = 'QUEUE_READ';
        const queued = (await (await open()).getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM maintenance_change_queue'))?.count ?? 0;
        if (queued === 0) {
          await saveNoQueuedOutcome(nowMillis);
          return { graph: { ruleVersion: RECONSTRUCTION_RULE_VERSION, places: [], visits: [], journeys: [], possibleMerges: [], dispositions: [], memberships: [] } as ReconstructionGraph, newJourneyCount: 0, updatedJourneyCount: 0 };
        }
        stage = 'REBUILD';
        const graph = await this.rebuild(nowMillis, true, canUseSource);
        stage = 'OUTCOME_READ';
        const outcome = await (await open()).getFirstAsync<{ new_journey_count: number; updated_journey_count: number }>(
          'SELECT new_journey_count, updated_journey_count FROM reconciliation_state WHERE record_id = 1',
        );
        return { graph, newJourneyCount: outcome?.new_journey_count ?? 0, updatedJourneyCount: outcome?.updated_journey_count ?? 0 };
      } catch (error) {
        // A fresh reconciliation or maintenance lease is expected contention,
        // not a failed run. Preserve the prior result without writing outcome state.
        if (error instanceof Error && error.message.includes('already running')) throw error;
        primaryFailure = reconciliationStageError(stage, error);
        const sourceError = error instanceof ReconciliationStageError ? error.originalError : error;
        const restricted = sourceError instanceof Error && (sourceError.message.includes('not connected') || sourceError.message.includes('not permitted'));
        const pending = sourceError instanceof Error && (sourceError.message.includes('need owner review') || sourceError.message.includes('needs owner remap'));
        try {
          stage = 'OUTCOME_SAVE';
          if (sourceError instanceof JourneyCorrectionRemapRequiredError) await recordPendingCorrectionRemap(sourceError.revisionId);
          await saveOutcome(restricted ? 'restricted' : pending ? 'pending' : 'error', restricted ? 'Local journey updates are waiting for connected private access.' : pending ? 'An owner correction needs review before queued local changes can be reconciled.' : 'Local journey reconciliation did not finish. Queued changes remain pending.');
        } catch {
          // The original reconstruction failure is more useful than a best-effort status-write failure.
        }
        throw primaryFailure;
      } finally {
        if (token !== null) {
          try {
            await releaseLease(token);
          } catch (error) {
            if (primaryFailure === null) throw reconciliationStageError('LEASE_RELEASE', error);
          }
        }
      }
    },
  };
}
