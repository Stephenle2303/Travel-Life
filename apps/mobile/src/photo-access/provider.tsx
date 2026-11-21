import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { RecognizableComparisonLimitError, type RecognizableReveal, type RecognizableShadowPreview } from '@/reconstruction/recognizable-shadow-types';
import { isRecognizableRevealEnabled, isReconstructionPreviewEnabled } from '@/navigation/app-contract';
import { replayPreparationDiagnostics } from '@/replay/preparation-diagnostics';
import { AccountMediaError } from '@/account/media-cache';
import { ReplayEditSession } from '@/replay/edit-session';
import { replayThumbnails } from '@/replay/thumbnail-service';
import { type ReplayMutation } from '@/replay/draft-repository-contract';
import { AppState, Platform } from 'react-native';

import { HistoryRecordController, type LifecycleSnapshot } from '@/history-record';
import { PhotoAccessController, PreparationAccessError, initialPhotoAccess } from './controller';
import { nativePhotoAccess } from './native-adapter';
import type { OwnerPreview, PhotoAccessAdapter, PhotoAccessSnapshot } from './types';
import { createNativeImportRepository, type ImportCoverage, type ImportRepository, type MaintenanceRepository, type ReconciliationSnapshot, type ManualJourneyInput } from '@/import-record';
import { MaintenanceController, createExpoScheduler, type MaintenanceView } from '@/maintenance';
import { createNativeReconstructionRepository, ReconstructionController, type ReconstructionView } from '@/reconstruction';
import { durableRevealFailureStage, type CandidateShadowReviewResult } from '@/reconstruction/repository';
import { AiProposalController, type AiReviewView } from '@/ai';
import { nativeVisualRecognition } from '@/visual-place/native-signage';
import { nativeRegionalPackLoader } from '@/visual-place/native-regional-packs';
import { VisualPlaceError, visualDiagnostic, visualLifecycle, type AutomaticVisualDiscovery, type VisualStage } from '@/visual-place/recovery';
import { nativeCaptureMetadataReader } from '@/travel-window/native-capture-metadata';
import { createTravelWindowStorage } from '@/travel-window/storage';
import { createAutomaticTravelWindowDiscovery, type AutomaticTravelWindowDiscovery } from '@/travel-window/production-discovery';
import { isVisualLocality, resolveVisualPlace } from '@/visual-place/place-catalog';
import { isVisualPartialPreviewEnabled, visualDiscoveryTextAttempts, type DiscoveryPhoto, type QualifiedVisualAlbum } from '@/visual-place/discovery';
import { associateVisualAlbum, qualifyVisualTrip, resolveVisualPendingPlace, usesVisualCitySupport } from '@/visual-place/trip-recovery';
import { NativeTransactionWithdrawnError } from '@/database/native-transaction';
import { classifyAppDiagnosticError, createDiagnosticCorrelationId, JourneyPreviewBoundaryError, recordAppDiagnostic, type AppDiagnosticEvent, type JourneyPreviewStage } from '@/diagnostics/app-diagnostics';
import type { DurableRevealRecord, JourneyDetail, JourneyMediaPage, JourneyMergePair } from '@/reveal/types';
import type { JourneyPrivacyReview, JourneyPrivacyPolicy } from '@/history-record/privacy';
import { createExportManifest, orderedReplayGroups, planPrivateReplay } from '@/replay/selection';
import { ReplayController, replayChapterIdentity, replayManifestIdentity } from '@/replay/controller';
import { ReplayDraftStaleError } from '@/replay/draft-error';
import { assembleReplayChapters, munimReplayRenderer, renderReplayChapter, ReplayPreparationError, replayFailureStage, shareReplayArtifact, verifyReplayOutput, type ReplayArtifact, type ReplayRenderProgress } from '@/replay/renderer';
import type { ReplayManifestInput, ReplayPreparedChapterRecord, ReplayPreparedPreview, ReplayRenderSource, ReplaySoundtrack } from '@/replay/types';
import * as FileSystem from 'expo-file-system/legacy';
import { accountSyncEnabled } from '@/account/history-sync-native';
import { suspendLocalHistorySync } from '@/account/history-store';

class PrivacyCommandRuntime {
  private tail: Promise<unknown> = Promise.resolve();
  mutating = false;
  run<T>(command: () => Promise<T>): Promise<T> {
    const result = this.tail.then(command);
    this.tail = result.catch(() => undefined);
    return result;
  }
}

class PrivacyReadCancelledError extends Error {}
class PreparationPublicationSkipped extends Error {}

class RecognizableReadError extends Error {
  constructor(readonly reason: 'ACCESS' | 'HISTORY_STALE' | 'SKIPPED' | 'MEDIA_VERIFY') { super('Trip evidence could not be verified.'); }
}

async function resolveRecognizableMedia(adapter: PhotoAccessAdapter, refs: string[], verify: () => Promise<void>) {
  await verify();
  const previews = refs.length && adapter.resolveOwnerPreviews ? await adapter.resolveOwnerPreviews(refs, refs.length) : [];
  if (adapter.resolveOwnerPreviews && previews.length !== refs.length) throw new RecognizableReadError('MEDIA_VERIFY');
  await verify();
  return previews;
}

/** Durable cache records are local metadata, not authority to resolve paths. */
function isReplayCacheFileKey(value: string) {
  return /^(?:replay|chapter)-[a-z0-9]+-[a-z0-9]+\.mp4$/.test(value);
}

export function isCurrentDurableRevealRead(readGeneration: number, currentGeneration: number) {
  return readGeneration === currentGeneration;
}
export function canPublishJourneyDetail(readGeneration: number, currentGeneration: number, lifecycle: LifecycleSnapshot['state']) {
  return readGeneration === currentGeneration && lifecycle === 'connected';
}

/** A saved place is applied only when both local read models identify this exact trip. */
export function hasVerifiedOwnerPlace(displayId: string, place: NonNullable<JourneyDetail['ownerPlace']>, detail: JourneyDetail, durable: DurableRevealRecord | null) {
  const confirmed = detail.ownerPlace;
  const samePlace = confirmed?.id === place.id && confirmed.name === place.name && confirmed.context === place.context;
  const projected = durable?.journeys.find((journey) => journey.displayId === displayId);
  return Boolean(samePlace && projected?.locationKind === 'owner-confirmed' && projected.label === `${place.name}, ${place.context}`
    && projected.anchor?.latitude === confirmed?.anchor.latitude && projected.anchor?.longitude === confirmed?.anchor.longitude);
}

/** Find the unique durable successor for a saved place when reconstruction rotates an opaque display id. */
export function verifiedOwnerPlaceDisplayId(previousDisplayId: string, place: NonNullable<JourneyDetail['ownerPlace']>, durable: DurableRevealRecord | null) {
  const sameCoarseAnchor = (anchor: NonNullable<DurableRevealRecord['journeys'][number]['anchor']>) =>
    Math.round(anchor.latitude * 10) === Math.round(place.anchor.latitude * 10)
    && Math.round(anchor.longitude * 10) === Math.round(place.anchor.longitude * 10);
  const matches = durable?.journeys.filter((journey) => journey.locationKind === 'owner-confirmed'
    && journey.label === `${place.name}, ${place.context}`
    && journey.anchor !== null && sameCoarseAnchor(journey.anchor)) ?? [];
  if (matches.some((journey) => journey.displayId === previousDisplayId)) return previousDisplayId;
  return matches.length === 1 ? matches[0].displayId : null;
}

class DurableRevealGate {
  private generation = 0;
  next() { this.generation += 1; return this.generation; }
  invalidate() { this.generation += 1; }
  isCurrent(readGeneration: number) { return isCurrentDurableRevealRead(readGeneration, this.generation); }
  current() { return this.generation; }
}

function maintenanceRepository(repository: ImportRepository): MaintenanceRepository {
  if ('loadMaintenance' in repository) return repository as MaintenanceRepository;
  // Existing test/web repositories deliberately have no durable scheduler state.
  // They surface maintenance as unavailable rather than inventing persistence.
  return {
    ...repository,
    loadMaintenance: async () => ({ enabled: false, status: 'restricted', lastCheckedAtMillis: null, lastUpdatedAtMillis: null, message: 'Automatic maintenance is unavailable in this runtime.' }),
    saveMaintenance: async () => {},
    getMaintenanceCheckpoint: async () => null,
    reconcileMaintenancePage: async () => {},
    completeMaintenanceRun: async () => {},
    pauseMaintenance: async () => {},
    acquireMaintenanceLease: async () => null,
    renewMaintenanceLease: async () => false,
    releaseMaintenanceLease: async () => {},
    loadReconciliation: async () => ({ status: 'restricted', pendingCount: 0, lastCheckedAtMillis: null, lastUpdatedAtMillis: null, newJourneyCount: 0, updatedJourneyCount: 0, message: 'Local reconciliation is unavailable in this runtime.' }),
  };
}

// A custom adapter is used by the web/Jest shell. It must not open native
// SQLite merely to render a private empty state.
function unavailableRepository(): ImportRepository {
  return {
    getCheckpoint: async () => null, loadCoverage: async () => null, commitPage: async () => {},
    getPrivateRecordLifecycle: async () => ({ state: 'deleted' }), connectPrivateRecord: async () => {},
    disconnectPrivateRecord: async () => {}, deleteLocalHistory: async () => {}, saveCorrectionOverlay: async () => {},
  };
}

type PhotoAccessContextValue = {
  snapshot: PhotoAccessSnapshot;
  controller: PhotoAccessController;
  importCoverage: ImportCoverage;
  privateRecord: LifecycleSnapshot;
  privateRecordController: HistoryRecordController;
  maintenance: MaintenanceView;
  maintenanceController: MaintenanceController;
  reconciliation: ReconciliationSnapshot;
  catchUpHistory(): Promise<void>;
  reconstruction: ReconstructionView;
  durableReveal: DurableRevealRecord | null;
  reviewJourneyPrivacy(displayId: string): Promise<JourneyPrivacyReview>;
  saveJourneyPrivacy(reviewId: string, action: 'hide' | 'exclude', commandKey: string, displayId: string): Promise<void>;
  loadJourneyPrivacyPolicies(): Promise<JourneyPrivacyPolicy[]>;
  restoreJourneyPrivacy(policyId: string, revision: number, commandKey: string): Promise<void>;
  loadJourneyEligibility(displayId: string, snapshotToken: number, purpose: import('@/reveal/types').PrivateSelectionPurpose, privacyRevision?: number): Promise<import('@/reveal/types').JourneyEligibility>;
  loadReplayManifestInput(correlationId?: string): Promise<import('@/replay/types').ReplayManifestInput>;
  loadReplayEditorPreviewPage(memoryKeys: readonly string[], snapshotToken: number, privacyRevision: number, onBatch?: (items: readonly { key: string; available: boolean; previewUri?: string }[]) => void): Promise<readonly { key: string; available: boolean; previewUri?: string }[]>;
  loadPreparedReplay(): Promise<ReplayPreparedPreview | null>;
  replayEditSession?: ReplayEditSession;
  saveReplayDraft(memoryKeys: readonly string[], snapshotToken: number, privacyRevision: number, direction: import('@/replay/types').ReplayDirection, soundtrack?: import('@/replay/types').ReplaySoundtrack, expectedWorkingRevision?: number, includedGroupKeys?: readonly string[], autoGroupKeys?: readonly string[]): Promise<void>;
  stageReplayWorkingDraft(memoryKeys: readonly string[], snapshotToken: number, privacyRevision: number, direction: import('@/replay/types').ReplayDirection, soundtrack: import('@/replay/types').ReplaySoundtrack, expectedWorkingRevision?: number, includedGroupKeys?: readonly string[], autoGroupKeys?: readonly string[], mutation?: ReplayMutation): Promise<number>;
  resetReplayDraft(snapshotToken: number, privacyRevision: number): Promise<void>;
  preparePrivateReplay(selectedMemoryKeys?: readonly string[], onProgress?: ReplayRenderProgress, music?: import('@/replay/types').ReplaySoundtrack, onFirstTripReady?: (preview: ReplayPreparedPreview) => void, selectedGroupKeys?: readonly string[], correlationId?: string): Promise<ReplayPreparedPreview>;
  exportPrivateReplay(uri: string): Promise<'unavailable' | 'invalid' | 'handoff-failed' | 'closed'>;
  discardPrivateReplay(uri: string, options?: { preserveFile?: boolean }): Promise<void>;
  findManualJourneyOverlaps(input: ManualJourneyInput): Promise<{ id: string; label: string; editable: boolean }[]>;
  createManualJourney(input: ManualJourneyInput): Promise<string>;
  removeManualJourney(displayId: string): Promise<void>;
  loadJourneyDetail(displayId: string): Promise<{ detail: JourneyDetail; previews: OwnerPreview[]; snapshotToken: number }>;
  confirmTimelineMerge?(pair: JourneyMergePair, detail: JourneyDetail, commandKey: string): Promise<'applied' | 'pending'>;
  loadJourneyMediaPage?(displayId: string, snapshotToken: number, page: number): Promise<{ page: JourneyMediaPage; previews: OwnerPreview[] }>;
  inspectJourneyMedia?(displayId: string, snapshotToken: number, itemId: string, previewUri: string | null): Promise<string>;
  loadRecognizableShadowPreview?(signal?: AbortSignal): Promise<RecognizableShadowPreview>;
  loadRecognizableReveal?(signal?: AbortSignal): Promise<RecognizableReveal | null>;
  readRecognizableTrip?(token: object, id: string, signal?: AbortSignal): Promise<{ previews: OwnerPreview[] } | null>;
  playRecognizableTrip?(token: object, id: string, signal?: AbortSignal, correlationId?: string): Promise<ReplayPreparedPreview | null>;
  discardRecognizableTripPreview?(uri: string, correlationId?: string): Promise<void>;
  reviewRecognizableTrip?(token: object, id: string, decision: 'keep' | 'reject', commandKey: string, signal?: AbortSignal): Promise<CandidateShadowReviewResult>;
  loadUncertainMemories(displayId: string, snapshotToken: number, query: string, page: number): Promise<{ memories: { id: string; capturedDay: string | null; availability: 'available' | 'unavailable' | 'unknown'; locationState: string; association: string; membershipState: 'suggested' | 'primary' | 'unassigned' | 'rejected' }[]; hasMore: boolean }>;
  /** CAP-3 (detector-v1-2.md): the real Possible-trips card list. */
  loadPossibleTrips(): Promise<import('@/reconstruction/types').PossibleTripSummary[]>;
  saveJourneyCorrection(displayId: string, action: 'confirm' | 'reject' | 'claim' | 'place' | 'split' | 'merge' | 'remove-visit', snapshotToken: number, snapshot: JourneyDetail, commandKey: string, payload?: NonNullable<JourneyDetail['ownerClaim']> | NonNullable<JourneyDetail['ownerPlace']> | { afterVisitId: string } | { withJourneyId: string } | { visitId: string }): Promise<'applied' | 'pending'>;
  saveJourneyMemoryCorrection(displayId: string, memoryId: string, action: 'assign' | 'move' | 'reject' | 'unassign', snapshotToken: number, commandKey: string): Promise<'applied' | 'pending'>;
  discardJourneyCorrectionPending(displayId: string, snapshotToken: number, commandKey: string): Promise<'applied' | 'pending'>;
  retryJourneyCorrectionProjection(): Promise<boolean>;
  homeBases: { id: string; label: string | null; origin: 'observed-area' | 'legacy' | 'manual-pin'; effectiveStartDay: string | null; effectiveEndDay: string | null; radiusMeters: number }[];
  saveConfiguredHomeArea(displayId: string, visitId: string, ownerLabel: string, effectiveStartDay: string | null, effectiveEndDay: string | null): Promise<void>;
  saveDirectHome?(area: import('@/import-record/types').ConfiguredHomeArea, replacing?: string): Promise<void>;
  renameConfiguredHomeArea(id: string, ownerLabel: string): Promise<void>;
  removeConfiguredHomeArea(id: string): Promise<void>;
  reconstructionController: ReconstructionController;
  aiReview: AiReviewView;
  aiProposalController: AiProposalController;
  visualDiscovery?: AutomaticVisualDiscovery;
  /** GPS-less trip discovery (decision 0019/0020). Independent of visualDiscovery and the reconstruction engine. */
  travelWindowDiscovery?: AutomaticTravelWindowDiscovery;
};

type OptionalRepositoryMethods = 'loadCandidateShadowSnapshot' | 'verifyCandidateShadowSnapshot' | 'readCandidateShadowMedia' | 'saveCandidateShadowDecision' | 'loadJourneyMediaInspection' | 'hasPendingHomeProjection' | 'verifyJourneyMediaSnapshot' | 'hasReplayMapping' | 'reconcileReplayMutation' | 'findManualJourneyOverlaps' | 'createManualJourney' | 'removeManualJourney' | 'reviewJourneyPrivacy' | 'saveJourneyPrivacy' | 'loadJourneyPrivacyPolicies' | 'restoreJourneyPrivacy' | 'loadJourneyEligibility' | 'loadReplayManifestInput' | 'loadReplayEditorPreviewPage' | 'saveReplayDraft' | 'stageReplayWorkingDraft' | 'resetReplayDraft' | 'saveReplayPreparedArtifact' | 'applyJourneyPrivacyToRecord' | 'loadPossibleTrips' | 'runCluePass'
  | 'loadVisualPlaceOffer' | 'verifyVisualPlaceOffer' | 'reviewVisualPlaceOffer'
  | 'loadVisualDiscoveryEnabled' | 'setVisualDiscoveryEnabled' | 'loadVisualDiscoveryPage' | 'loadVisualDiscoveryAlbum' | 'verifyVisualDiscovery' | 'checkpointVisualDiscovery' | 'reviewVisualDiscovery';
type ReconstructionRepositoryProp = Omit<ReturnType<typeof createNativeReconstructionRepository>, OptionalRepositoryMethods | 'verifySuggestedMergeReceipt'>
  & Partial<Pick<ReturnType<typeof createNativeReconstructionRepository>, 'verifySuggestedMergeReceipt'>>
  & Partial<Pick<ReturnType<typeof createNativeReconstructionRepository>, OptionalRepositoryMethods>>;

/** Opening Edit must not decode every candidate original before the owner can act. */
const REPLAY_EDITOR_INITIAL_PREVIEW_LIMIT = 48;
const BUNDLED_REPLAY_SOUNDTRACK: ReplaySoundtrack = { kind: 'bundled', revision: 'happy-moments-1.4' };

function recordJourneyPreviewFailure(correlationId: string, stage: JourneyPreviewStage, error: unknown) {
  const reasonCode = error instanceof VisualPlaceError ? error.reason : classifyAppDiagnosticError(error);
  recordAppDiagnostic({ operation: 'ATLAS_PREVIEW', stage, reasonCode,
    durableOutcome: reasonCode === 'ACCESS' ? 'restricted' : reasonCode === 'HISTORY_STALE' ? 'skipped' : 'unchanged',
    retryable: reasonCode === 'DATABASE_BUSY' || reasonCode === 'NATIVE_HANDLE' || reasonCode === 'UNKNOWN', correlationId });
}

/** Closed draft-save cause safe for the editor to explain without native data. */
export class ReplayDraftSaveError extends ReplayPreparationError {
  constructor(readonly reason: 'scope' | 'revision' | 'branch' | 'unknown') { super('REPLAY_STALE'); }
}

function replayDraftStaleReason(error: unknown): 'scope' | 'revision' | 'branch' | 'unknown' | null {
  if (error instanceof ReplayDraftStaleError) return error.reason;
  if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'REPLAY_DRAFT_STALE') return null;
  const reason = 'reason' in error ? error.reason : null;
  return reason === 'scope' || reason === 'revision' || reason === 'branch' ? reason : 'unknown';
}

/** Never emit arbitrary native fields: only these fixed guard categories. */
function replayDraftDiagnosticReason(error: unknown) {
  const guard = error && typeof error === 'object' && 'guard' in error ? error.guard : null;
  switch (guard) {
    case 'scope': return 'REPLAY_SCOPE_INVALID' as const;
    case 'mapping': return 'REPLAY_MAPPING_INVALID' as const;
    case 'memory': return 'REPLAY_MEMORY_MAPPING' as const;
    case 'group': return 'REPLAY_GROUP_MAPPING' as const;
    case 'automatic': return 'REPLAY_AUTOMATIC_SCOPE' as const;
    case 'receipt': return 'REPLAY_RECEIPT_CONFLICT' as const;
    case 'revision': return 'REPLAY_REVISION_CONFLICT' as const;
    case 'branch': return 'REPLAY_BRANCH_CONFLICT' as const;
    default: return 'SAVE_FAILED' as const;
  }
}

/**
 * A committed included-trip list is the owner’s explicit Replay scope. Keep it
 * authoritative even if a caller supplies an older group projection whose
 * eligibility flags have not yet caught up with that saved draft.
 */
export function replayCompositionGroups(input: ReplayManifestInput) {
  if (!input.includedGroupKeys) return input.groups;
  const included = new Set(input.includedGroupKeys);
  return input.groups.map((group) => ({ ...group, eligible: group.eligible && included.has(group.key) }));
}

type ReplayDraftCommitRequest = Readonly<{
  memoryKeys: readonly string[];
  snapshotToken: number;
  privacyRevision: number;
  direction: import('@/replay/types').ReplayDirection;
  soundtrack?: ReplaySoundtrack;
  includedGroupKeys?: readonly string[];
  autoGroupKeys?: readonly string[];
}>;

function sameReplayKeySet(left: readonly string[], right: readonly string[]) {
  if (left.length !== right.length) return false;
  const expected = new Set(left);
  return expected.size === right.length && right.every((key) => expected.has(key));
}

function sameReplaySoundtrack(left: ReplaySoundtrack, right: ReplaySoundtrack) {
  return left.kind === right.kind
    && left.revision === right.revision
    && (left.kind !== 'custom' || right.kind !== 'custom' || left.localUri === right.localUri);
}

/**
 * Update Replay is a durable owner commit, never a best-effort render request.
 * Re-read the committed manifest before rendering so a stale/mixed write cannot
 * silently restore an excluded trip or discard a manual media choice.
 */
export function replayDraftMatchesCommittedManifest(input: ReplayManifestInput, request: ReplayDraftCommitRequest) {
  if (input.snapshotToken !== request.snapshotToken || input.privacyRevision !== request.privacyRevision
    || input.direction !== request.direction || !sameReplaySoundtrack(input.soundtrack ?? BUNDLED_REPLAY_SOUNDTRACK, request.soundtrack ?? BUNDLED_REPLAY_SOUNDTRACK)) return false;

  const expectedIncluded = request.includedGroupKeys ?? input.groups.filter((group) => group.eligible).map((group) => group.key);
  const expectedAutomatic = request.autoGroupKeys ?? expectedIncluded;
  const actualIncluded = input.includedGroupKeys ?? input.groups.filter((group) => group.eligible).map((group) => group.key);
  const actualAutomatic = input.autoGroupKeys ?? actualIncluded;
  if (!sameReplayKeySet(actualIncluded, expectedIncluded) || !sameReplayKeySet(actualAutomatic, expectedAutomatic)) return false;

  const selected = new Set(request.memoryKeys);
  const automatic = new Set(expectedAutomatic);
  const included = new Set(expectedIncluded);
  for (const group of input.groups) {
    // Automatic groups are deliberately re-planned by the renderer. Excluded
    // groups have no playback contribution, so their retained edit history is
    // immaterial to this commit. Every included manual group must round-trip
    // its exact selected media set.
    if (!included.has(group.key) || automatic.has(group.key)) continue;
    const expected = input.memories.filter((memory) => memory.groupKey === group.key && selected.has(memory.key)).map((memory) => memory.key);
    const actual = input.memories.filter((memory) => memory.groupKey === group.key && memory.intent === 'keep').map((memory) => memory.key);
    if (!sameReplayKeySet(actual, expected)) return false;
  }
  return true;
}

function replayWorkingDraftMatchesCommitRequest(input: ReplayManifestInput, request: ReplayDraftCommitRequest) {
  const working = input.workingDraft;
  if (!working || input.snapshotToken !== request.snapshotToken || input.privacyRevision !== request.privacyRevision) return false;
  const expectedIncluded = request.includedGroupKeys ?? input.groups.filter((group) => group.eligible).map((group) => group.key);
  const expectedAutomatic = request.autoGroupKeys ?? expectedIncluded;
  return sameReplayKeySet(working.memoryKeys, request.memoryKeys)
    && sameReplayKeySet(working.includedGroupKeys, expectedIncluded)
    && sameReplayKeySet(working.autoGroupKeys, expectedAutomatic)
    && working.direction === request.direction
    && sameReplaySoundtrack(working.soundtrack, request.soundtrack ?? BUNDLED_REPLAY_SOUNDTRACK);
}

/**
 * A prepared replay belongs to the committed composition, not to the moment a
 * photo provider happens to answer a local preview request. Preview availability
 * is intentionally volatile (and, for Edit, resolved in bounded pages), while
 * the stored MP4 remains a valid private replay of the same committed scope.
 */
export function preparedReplayCacheIdentity(input: ReplayManifestInput, music: ReplaySoundtrack = BUNDLED_REPLAY_SOUNDTRACK) {
  const direction = input.direction ?? 'oldest-first';
  const compositionMemories = input.memories.map((memory) => ({ ...memory, available: true }));
  const plan = planPrivateReplay(replayCompositionGroups(input), compositionMemories, undefined, direction, input.autoGroupKeys);
  if (!plan.groups.length) return null;
  return replayManifestIdentity({ ...createExportManifest(input.snapshotToken, plan.groups, plan.memories, direction), music });
}

/** Compatibility check for cache records written before composition-v2. */
function legacyPreparedReplayIdentity(input: ReplayManifestInput, resolvedAvailable: readonly boolean[], music: ReplaySoundtrack) {
  const direction = input.direction ?? 'oldest-first';
  const memories = input.memories.map((memory, index) => ({ ...memory, available: resolvedAvailable[index] === true }));
  const plan = planPrivateReplay(replayCompositionGroups(input), memories, undefined, direction, input.autoGroupKeys);
  if (!plan.groups.length) return null;
  return replayManifestIdentity({ ...createExportManifest(input.snapshotToken, plan.groups, plan.memories, direction), music });
}

function durableRevealFailureMessage(error: unknown) {
  switch (classifyAppDiagnosticError(error)) {
    case 'DATABASE_BUSY': return 'Local storage is busy while the committed Atlas is reloaded. Your last completed Atlas was kept.';
    case 'SCHEMA': return 'Local Atlas storage needs a safe schema recovery. Your last completed Atlas was kept.';
    case 'NATIVE_HANDLE': return 'The local Atlas connection needs recovery. Your last completed Atlas was kept.';
    case 'ACCESS': return 'Reconnect your private record before the Atlas can be reloaded.';
    default: return 'The committed local Atlas could not be reloaded. Your last completed Atlas was kept.';
  }
}

const PhotoAccessContext = createContext<PhotoAccessContextValue | null>(null);

class DurablePublicationRuntime {
  private connected = false;
  setLifecycle(state: LifecycleSnapshot['state']) { this.connected = state === 'connected'; }
  get isConnected() { return this.connected; }
}

export function PhotoAccessProvider({ children, adapter = nativePhotoAccess, repository, reconstructionRepository, bindingCorrelationId }: PropsWithChildren<{ adapter?: PhotoAccessAdapter; repository?: ImportRepository; reconstructionRepository?: ReconstructionRepositoryProp; bindingCorrelationId?: string }>) {
  useEffect(() => {
    if (!bindingCorrelationId) return;
    recordAppDiagnostic({ operation: 'HISTORY_TRANSFER', stage: adapter.accountAuthorized ? 'HISTORY_CONSUMER_ACCOUNT' : 'HISTORY_CONSUMER_LOCAL', reasonCode: 'COMPLETE', retryable: false, durableOutcome: 'complete', correlationId: bindingCorrelationId });
    return () => recordAppDiagnostic({ operation: 'HISTORY_TRANSFER', stage: 'HISTORY_CONSUMER_UNMOUNT', reasonCode: 'SKIPPED', retryable: false, durableOutcome: 'skipped', correlationId: bindingCorrelationId });
  }, [adapter, bindingCorrelationId]);
  const [snapshot, setSnapshot] = useState(initialPhotoAccess);
  const [importCoverage, setImportCoverage] = useState<ImportCoverage>({ scope: null, accessible: null, scanned: 0, geotagged: 0, unavailable: 0, status: 'idle', message: null });
  const [privateRecord, setPrivateRecord] = useState<LifecycleSnapshot>({ state: 'deleted', message: null, pendingAction: null });
  const [maintenance, setMaintenance] = useState<MaintenanceView>({ enabled: false, status: 'disabled', lastCheckedAtMillis: null, lastUpdatedAtMillis: null, message: null, checkpoint: null });
  const [reconciliation, setReconciliation] = useState<ReconciliationSnapshot>({ status: 'idle', pendingCount: 0, lastCheckedAtMillis: null, lastUpdatedAtMillis: null, newJourneyCount: 0, updatedJourneyCount: 0, message: null });
  const [reconstruction, setReconstruction] = useState<ReconstructionView>({ status: 'idle', graph: null, message: null });
  const [durableReveal, setDurableReveal] = useState<DurableRevealRecord | null>(null);
  const [homeBases, setHomeBases] = useState<PhotoAccessContextValue['homeBases']>([]);
  const [durableRevealGate] = useState(() => new DurableRevealGate());
  const [privacyRuntime] = useState(() => new PrivacyCommandRuntime());
  const [aiReview, setAiReview] = useState<AiReviewView>({ status: 'idle', message: 'Optional AI suggestions are not requested.', proposals: [] });
  const [visualRecognition] = useState(() => nativeVisualRecognition());
  const [travelWindowCaptureReader] = useState(() => nativeCaptureMetadataReader());
  const [travelWindowStorage] = useState(() => createTravelWindowStorage());
  const [loadRegionalStarter] = useState(() => nativeRegionalPackLoader());
  const [visualSetting, setVisualSetting] = useState({ enabled: false, busy: false, failed: false });
  const visualPermission = useRef(false);
  const visualSettingRequest = useRef(false);
  const visualRunning = useRef(false);
  const replayArtifacts = useRef(new Map<string, ReplayArtifact>());
  const recognizableArtifacts = useRef(new Map<string, { artifact: ReplayArtifact; correlationId: string }>());
  const replayController = useRef(new ReplayController(munimReplayRenderer));
  const clearReplayArtifacts = useCallback(async () => {
    replayController.current.invalidate();
    const artifacts = [...replayArtifacts.current.values()];
    replayArtifacts.current.clear();
    await Promise.all(artifacts.map((artifact) => munimReplayRenderer.dispose?.(artifact)));
  }, []);
  const [sharedRepository] = useState(() => repository ?? (adapter === nativePhotoAccess ? createNativeImportRepository() : unavailableRepository()));
  const [durableMaintenanceRepository] = useState(() => maintenanceRepository(sharedRepository));
  const [nativeReconstructionRepository] = useState(() => reconstructionRepository ? {
    ...reconstructionRepository,
    findManualJourneyOverlaps: reconstructionRepository.findManualJourneyOverlaps ?? (async () => []),
    createManualJourney: reconstructionRepository.createManualJourney ?? (async () => { throw new Error('Manual journeys are unavailable in this runtime.'); }),
    removeManualJourney: reconstructionRepository.removeManualJourney ?? (async () => { throw new Error('Manual journeys are unavailable in this runtime.'); }),
  } : __DEV__ && process.env.EXPO_PUBLIC_TRAVEL_LIFE_LOCAL_RECOVERY === 'true' ? createNativeReconstructionRepository({
    databaseName: 'travel-life-import-v1.db',
    enableLocalRecovery: true,
    canUseRecoverySource: async () => (await adapter.inspect())?.scope === 'full',
  }) : createNativeReconstructionRepository());
  const [durablePublicationRuntime] = useState(() => new DurablePublicationRuntime());
  const refreshDurableReveal = useCallback(async (canPublish: () => Promise<boolean> = async () => true) => {
    if (!durablePublicationRuntime.isConnected || privacyRuntime.mutating) throw new Error('Private record is unavailable.');
    const generation = durableRevealGate.next();
    const record = await nativeReconstructionRepository.loadDurableReveal();
    if (!await canPublish()) throw new PreparationPublicationSkipped();
    if (!durablePublicationRuntime.isConnected || privacyRuntime.mutating || !canPublishJourneyDetail(generation, durableRevealGate.current(), 'connected')) throw new Error('Private record is unavailable.');
    setDurableReveal(record);
  }, [durablePublicationRuntime, durableRevealGate, nativeReconstructionRepository, privacyRuntime]);
  useEffect(() => {
    durablePublicationRuntime.setLifecycle(privateRecord.state);
    return () => durablePublicationRuntime.setLifecycle('deleted');
  }, [durablePublicationRuntime, privateRecord.state]);
  useEffect(() => {
    if (privateRecord.state !== 'connected') { replayThumbnails.invalidate(); void clearReplayArtifacts(); }
  }, [clearReplayArtifacts, privateRecord.state]);
  const [reconstructionController] = useState(() => new ReconstructionController(nativeReconstructionRepository, (view) => {
    setReconstruction(view);
  }));
  const currentSourcePermitted = async () => {
    if (adapter.accountAuthorized) return adapter.accountAuthorized();
    const access = await adapter.inspect();
    return access?.scope === 'full' || access?.scope === 'limited';
  };
  const [maintenanceController] = useState(() => new MaintenanceController(durableMaintenanceRepository, adapter, createExpoScheduler(), setMaintenance, () => Date.now(), async () => {
    await reconstructionController.reconcile(currentSourcePermitted, 'MAINTENANCE_RECONCILIATION');
    await refreshDurableReveal();
    if (durableMaintenanceRepository.loadReconciliation) setReconciliation(await durableMaintenanceRepository.loadReconciliation());
  }));
  // M2.3 intentionally ships with the server kill switch off. This local-safe
  // transport still lets the owner see the skipped outcome without a network call.
  const [aiProposalController] = useState(() => new AiProposalController({ request: async () => ({ status: 'skipped', reason: 'disabled', usage: { inputTokens: null, outputTokens: null } }) }, setAiReview));
  const [controller] = useState(() => new PhotoAccessController(adapter, setSnapshot, setImportCoverage, sharedRepository, async (correlationId, readOnly, publishing, canPublish) => {
    // Import completion makes the owner control available; it never enables it.
    await maintenanceController.refresh();
    if (!readOnly) {
      const result = await reconstructionController.rebuild(correlationId);
      if (result.status !== 'complete') return false;
      await publishing?.();
    }
    try { await refreshDurableReveal(canPublish); }
    catch (error) {
      if (error instanceof PreparationPublicationSkipped) {
        recordAppDiagnostic({ operation: 'ONBOARDING_RUN', stage: 'RUN_ACCESS_INSPECT', reasonCode: 'SKIPPED', retryable: false, durableOutcome: 'skipped', correlationId: correlationId ?? createDiagnosticCorrelationId() });
        return false;
      }
      recordAppDiagnostic({ operation: error instanceof PreparationAccessError ? 'ONBOARDING_RUN' : 'ATLAS_DURABLE_READ', stage: error instanceof PreparationAccessError ? error.stage : durableRevealFailureStage(error), reasonCode: classifyAppDiagnosticError(error), retryable: true, durableOutcome: 'unknown', correlationId: correlationId ?? createDiagnosticCorrelationId() });
      return false;
    }
    return true;
  }, () => maintenanceController.whenIdle()));
  const [privateRecordController] = useState(() => new HistoryRecordController(
    sharedRepository,
    async () => {
      if(accountSyncEnabled&&!adapter.accountAuthorized){
        try{await suspendLocalHistorySync();}
        catch{recordAppDiagnostic({operation:'HISTORY_TRANSFER',stage:'HISTORY_STAGE',reasonCode:'HISTORY_STORAGE',retryable:true,durableOutcome:'unknown',correlationId:createDiagnosticCorrelationId()});throw new Error('Account catch-up could not be paused.');}
      }
      replayThumbnails.invalidate(); durableRevealGate.invalidate(); await controller.stopImport(); await maintenanceController.stopForLifecycle(); reconstructionController.clear(); setDurableReveal(null); aiProposalController.clear();
    },
    (next) => { controller.setLifecyclePending(next.pendingAction !== null); setPrivateRecord(next); },
    () => controller.clearDeletedRecord(),
    async () => 'complete' as const,
  ));

  useEffect(() => {
    const currentReplayController = replayController.current;
    const currentReplayArtifacts = replayArtifacts.current;
    let active = true;
    const resumeExistingSource = async () => {
      try {
        if (await controller.requiresHomeSetup() || !active) return;
      } catch { return; /* Startup owns the recoverable Home read state. */ }
      await controller.refresh();
      if (active) await maintenanceController.refresh();
      if (active) await controller.resumePreparation();
      if (!active || controller.isAccountRecord || !nativeReconstructionRepository.hasPendingHomeProjection) return;
      const correlationId = createDiagnosticCorrelationId();
      try {
        if (await nativeReconstructionRepository.hasPendingHomeProjection() && active) {
          const result = await reconstructionController.rebuild(correlationId);
          if (result.status === 'complete' && active) await refreshDurableReveal();
        }
      } catch (error) {
        recordAppDiagnostic({ operation: 'ATLAS_REBUILD', stage: 'HOME_CONTEXT_READ', reasonCode: classifyAppDiagnosticError(error), retryable: true, durableOutcome: 'unchanged', correlationId });
      }
    };
    void resumeExistingSource();
    void privateRecordController.refresh();
    if (durableMaintenanceRepository.loadReconciliation) void durableMaintenanceRepository.loadReconciliation().then(setReconciliation).catch((error) => {
      recordAppDiagnostic({ operation: 'MAINTENANCE_RECONCILIATION', reasonCode: classifyAppDiagnosticError(error), stage: null, retryable: true, durableOutcome: 'failed', correlationId: createDiagnosticCorrelationId() });
      setReconciliation((current) => ({ ...current, status: 'error', message: 'Local update status could not be read. Retry when ready.' }));
    });
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void resumeExistingSource();
        void privateRecordController.refresh();
        void maintenanceController.catchUp();
      }
      else controller.interrupt();
    });
    return () => {
      active = false;
      replayThumbnails.invalidate();
      controller.dispose();
      subscription?.remove();
      currentReplayController.cancel();
      const artifacts = [...currentReplayArtifacts.values()];
      currentReplayArtifacts.clear();
      void Promise.all(artifacts.map((artifact) => munimReplayRenderer.dispose?.(artifact)));
    };
  }, [controller, privateRecordController, maintenanceController, durableMaintenanceRepository, nativeReconstructionRepository, reconstructionController, refreshDurableReveal]);

  useEffect(() => {
    if (maintenance.enabled && (snapshot.scope === 'revoked' || snapshot.scope === 'unavailable' || snapshot.scope === 'denied')) {
      void maintenanceController.stopForLifecycle();
    }
  }, [maintenance.enabled, maintenanceController, snapshot.scope]);

  const refreshHomeBases = useCallback(async () => {
    const areas = await sharedRepository.loadConfiguredHomeAreas?.() ?? [];
    setHomeBases(areas.map(({ id, label, origin, effectiveStartDay, effectiveEndDay, radiusMeters }) => ({ id, label, origin, effectiveStartDay, effectiveEndDay, radiusMeters })));
  }, [sharedRepository]);

  useEffect(() => {
    if (privateRecord.state !== 'connected') return;
    const generation = durableRevealGate.next();
    void nativeReconstructionRepository.loadDurableReveal().then((record) => {
      if (!privacyRuntime.mutating && canPublishJourneyDetail(generation, durableRevealGate.current(), privateRecord.state)) setDurableReveal(record);
    }).catch((error) => {
      if (!privacyRuntime.mutating && canPublishJourneyDetail(generation, durableRevealGate.current(), privateRecord.state)) {
        recordAppDiagnostic({ operation: 'ATLAS_DURABLE_READ', reasonCode: classifyAppDiagnosticError(error), stage: durableRevealFailureStage(error), retryable: true, durableOutcome: 'unchanged', correlationId: createDiagnosticCorrelationId() });
        setReconstruction((current) => ({ ...current, status: 'error', message: 'The local Atlas could not be read. Try again when ready.' }));
      }
    });
  }, [durableRevealGate, nativeReconstructionRepository, privateRecord.state, privacyRuntime]);
  useEffect(() => {
    if (privateRecord.state !== 'connected') return;
    let active = true;
    void (async () => {
      try {
        const areas = await sharedRepository.loadConfiguredHomeAreas?.() ?? [];
        if (active) setHomeBases(areas.map(({ id, label, origin, effectiveStartDay, effectiveEndDay, radiusMeters }) => ({ id, label, origin, effectiveStartDay, effectiveEndDay, radiusMeters })));
      } catch { /* Home bases remain unavailable until the next local refresh. */ }
    })();
    return () => { active = false; };
  }, [privateRecord.state, sharedRepository]);

  useEffect(() => {
    if (privateRecord.state === 'connected') reconstructionController.resume();
    else reconstructionController.clear();
  }, [privateRecord, reconstructionController]);

  const catchUpHistory = async () => {
    // App activation can enqueue local maintenance just before the owner taps
    // Atlas catch-up. Let that single-runtime writer finish before requesting
    // the reconstruction lease, rather than racing for SQLite's write lock.
    reconstructionController.acknowledgeQueuedMaintenanceWait();
    await maintenanceController.whenIdle();
    await reconstructionController.reconcile(currentSourcePermitted, 'ATLAS_CATCH_UP');
    // Reconciliation publishes its own fixed failure state. A follow-up
    // durable read cannot improve that failure and must not overwrite its
    // correction/busy diagnosis with a generic Atlas-read error.
    if (reconstructionController.view.status !== 'complete') return;
    try {
      await refreshDurableReveal();
    } catch (error) {
      // Preserve the last committed projection. The fixed copy is safe for
      // Atlas; raw SQLite/native errors never cross this boundary.
      recordAppDiagnostic({ operation: 'ATLAS_DURABLE_READ', reasonCode: classifyAppDiagnosticError(error), stage: durableRevealFailureStage(error), retryable: true, durableOutcome: 'unchanged', correlationId: createDiagnosticCorrelationId() });
      setReconstruction((current) => ({ ...current, status: 'error', message: durableRevealFailureMessage(error) }));
      return;
    }
    if (durableMaintenanceRepository.loadReconciliation) {
      try {
        setReconciliation(await durableMaintenanceRepository.loadReconciliation());
      } catch (error) {
        recordAppDiagnostic({ operation: 'MAINTENANCE_RECONCILIATION', reasonCode: classifyAppDiagnosticError(error), stage: null, retryable: true, durableOutcome: 'unchanged', correlationId: createDiagnosticCorrelationId() });
        setReconciliation((current) => ({ ...current, status: 'error', message: 'Local update status could not be read. Retry when ready.' }));
      }
    }
  };
  const loadRecognizableShadowPreview = useCallback(async (signal?: AbortSignal): Promise<RecognizableShadowPreview> => {
    const load = nativeReconstructionRepository.loadCandidateShadowSnapshot;
    const verify = nativeReconstructionRepository.verifyCandidateShadowSnapshot;
    if (!isReconstructionPreviewEnabled() || !load || !verify) {
      throw new Error('Reconstruction preview is unavailable.');
    }
    const generation = durableRevealGate.current();
    const current = () => !signal?.aborted && durablePublicationRuntime.isConnected && !privacyRuntime.mutating
      && generation === durableRevealGate.current() && !controller.isAccountRecord;
    const canUseSource = async () => {
      if (!current()) return false;
      const permission = await adapter.inspect();
      return current() && permission?.scope === 'full';
    };
    const correlationId = createDiagnosticCorrelationId();
    const result = await load.call(nativeReconstructionRepository, { canUseSource, correlationId, limit: 12, signal });
    if (result.status === 'too-large' && current()) throw new RecognizableComparisonLimitError();
    if (result.status !== 'complete' || !current()) throw new Error('Reconstruction preview is unavailable for this history.');
    const refs = [...new Set(result.cards.flatMap((card) => card.coverRefs.slice(0, 2)))];
    try {
      if (!await canUseSource()) {
        const stale = !current();
        recordAppDiagnostic({ operation: 'ATLAS_PREVIEW', stage: 'PREVIEW_MEDIA', reasonCode: stale ? 'HISTORY_STALE' : 'ACCESS', retryable: false,
          durableOutcome: stale ? 'skipped' : 'restricted', correlationId });
        throw new PrivacyReadCancelledError();
      }
      const previews = refs.length && adapter.resolveOwnerPreviews ? await adapter.resolveOwnerPreviews(refs, refs.length) : [];
      if (!current() || !await verify.call(nativeReconstructionRepository, result.token, canUseSource) || !current()) {
        recordAppDiagnostic({ operation: 'ATLAS_PREVIEW', stage: 'PREVIEW_MEDIA', reasonCode: 'HISTORY_STALE', retryable: false, durableOutcome: 'skipped', correlationId });
        throw new PrivacyReadCancelledError();
      }
      const uriByRef = new Map(refs.map((ref, index) => [ref, previews[index]?.availability === 'available' ? previews[index].uri : null]));
      const presentation = (card: typeof result.cards[number]) => ({
        id: card.id, title: card.title, observedPeriod: card.observedPeriod,
        coverUri: card.coverRefs.slice(0, 2).map((ref) => uriByRef.get(ref)).find(Boolean) ?? null,
      });
      return {
        policyVersion: result.policyVersion,
        comparison: result.comparison,
        separatePairs: result.separatePairs,
        reliable: result.cards.filter((card) => card.state === 'reliable').map(presentation),
        possible: result.cards.filter((card) => card.state === 'possible').map((card) => ({
          ...presentation(card), reason: card.reasons.includes('uncertain-boundary') ? 'uncertain-boundary' : 'limited-photos',
        })),
      };
    } catch (error) {
      if (!(error instanceof PrivacyReadCancelledError)) {
        recordAppDiagnostic({ operation: 'ATLAS_PREVIEW', stage: 'PREVIEW_MEDIA', reasonCode: classifyAppDiagnosticError(error), retryable: true, durableOutcome: 'unchanged', correlationId });
      }
      throw new Error('Reconstruction preview could not be verified.');
    }
  }, [adapter, controller, durablePublicationRuntime, durableRevealGate, nativeReconstructionRepository, privacyRuntime]);
  const recognizableScope = useCallback((signal?: AbortSignal) => {
    const generation = durableRevealGate.current();
    const active = () => !signal?.aborted && isRecognizableRevealEnabled() && AppState.currentState === 'active'
      && durablePublicationRuntime.isConnected && !privacyRuntime.mutating && !controller.isAccountRecord
      && (controller.preparationScope === null || controller.preparationScope === 'full')
      && (importCoverage.scope === null || importCoverage.scope === 'full');
    const current = () => active() && generation === durableRevealGate.current();
    const access = async () => active() && (await adapter.inspect())?.scope === 'full' && active();
    const canUseSource = async () => current() && await access() && current();
    const verify = async (token: object) => {
      if (signal?.aborted) throw new RecognizableReadError('SKIPPED');
      if (!current()) throw new RecognizableReadError('HISTORY_STALE');
      if (!await canUseSource()) throw new RecognizableReadError(current() ? 'ACCESS' : 'HISTORY_STALE');
      if (!await nativeReconstructionRepository.verifyCandidateShadowSnapshot?.(token, canUseSource) || !current()) {
        throw new RecognizableReadError(signal?.aborted ? 'SKIPPED' : 'HISTORY_STALE');
      }
    };
    return { active, access, current, canUseSource, verify };
  }, [adapter, controller, durablePublicationRuntime, durableRevealGate, importCoverage.scope, nativeReconstructionRepository, privacyRuntime]);
  useEffect(() => {
    const read = nativeReconstructionRepository.loadVisualDiscoveryEnabled;
    if (!visualRecognition || !read || controller.isAccountRecord || privateRecord.state !== 'connected') {
      visualPermission.current = false;
      setVisualSetting({ enabled: false, busy: false, failed: false });
      return;
    }
    let current = true;
    const correlationId = createDiagnosticCorrelationId();
    visualLifecycle(correlationId, 'CONSENT_CHECK', 'START');
    void read().then((enabled) => {
      if (!current || visualSettingRequest.current) return;
      visualPermission.current = enabled;
      setVisualSetting({ enabled, busy: false, failed: false });
      visualLifecycle(correlationId, 'CONSENT_CHECK', 'COMPLETE');
    }).catch((error) => {
      visualDiagnostic(correlationId, 'CONSENT_CHECK', error);
      if (current && !visualSettingRequest.current) setVisualSetting({ enabled: false, busy: false, failed: true });
    });
    return () => { current = false; visualPermission.current = false; };
  }, [controller, nativeReconstructionRepository, privateRecord.state, visualRecognition]);

  const travelWindowDiscovery = useMemo<AutomaticTravelWindowDiscovery | undefined>(() => {
    if (controller.isAccountRecord || privateRecord.state !== 'connected') return undefined;
    const resolve = adapter.resolveOwnerPreviews;
    const discovery = createAutomaticTravelWindowDiscovery({
      read: travelWindowCaptureReader, storage: travelWindowStorage, enabled: true,
      resolvePreviews: resolve ? (assetIds, limit) => resolve.call(adapter, assetIds, limit) : null,
    });
    if (!discovery) return undefined;
    return {
      ...discovery,
      // The confirmed trip's own manual_journey (storage.ts) is otherwise
      // invisible until something re-fetches the Atlas — matching how
      // createManualJourney and visual-place's own review() already refresh
      // after a successful confirm, never after a dismiss or a failure.
      async confirm(token, place, signal) {
        const saved = await discovery.confirm(token, place, signal);
        if (saved) await refreshDurableReveal().catch(() => {});
        return saved;
      },
    };
  }, [adapter, controller.isAccountRecord, privateRecord.state, refreshDurableReveal, travelWindowCaptureReader, travelWindowStorage]);

  const visualDiscovery = useMemo<AutomaticVisualDiscovery | undefined>(() => {
    const { loadVisualDiscoveryPage, loadVisualDiscoveryAlbum, verifyVisualDiscovery, checkpointVisualDiscovery, reviewVisualDiscovery, setVisualDiscoveryEnabled } = nativeReconstructionRepository;
    if (!visualRecognition || !loadVisualDiscoveryPage || !loadVisualDiscoveryAlbum || !verifyVisualDiscovery || !checkpointVisualDiscovery
      || !reviewVisualDiscovery || !setVisualDiscoveryEnabled || controller.isAccountRecord) return undefined;
    const localActive = () => durablePublicationRuntime.isConnected && !controller.isAccountRecord && AppState.currentState === 'active';
    const access = (signal: AbortSignal, generation: number) => async () => {
      const check = () => {
        if (signal.aborted || AppState.currentState !== 'active') throw new VisualPlaceError('SKIPPED');
        if (!visualPermission.current) throw new VisualPlaceError('HISTORY_CONSENT');
        if (!localActive()) throw new VisualPlaceError('ACCESS');
        if (privacyRuntime.mutating || durableRevealGate.current() !== generation) throw new VisualPlaceError('HISTORY_STALE');
      };
      check();
      if ((await adapter.inspect())?.scope !== 'full') throw new VisualPlaceError('ACCESS');
      check();
      return true;
    };
    const resolvePhotos = async (items: readonly DiscoveryPhoto[], verify: () => Promise<void>) => {
      const resolve = adapter.resolveOwnerPreviews;
      if (!resolve) throw new VisualPlaceError('MEDIA_UNAVAILABLE');
      const photos: { id: string; uri: string }[] = [];
      for (const item of items) {
        await verify();
        const [preview] = await resolve.call(adapter, [item.source_ref], 1);
        await verify();
        if (preview?.kind === 'photo' && preview.availability === 'available' && /^(?:file:\/\/\/|content:\/\/)/.test(preview.uri ?? '')) {
          photos.push({ id: item.evidence_id, uri: preview.uri! });
        }
      }
      return photos;
    };
    const withdrawal = (error: unknown) => error instanceof NativeTransactionWithdrawnError ? new VisualPlaceError('SKIPPED') : error;
    return {
      enabled: visualSetting.enabled,
      settingBusy: visualSetting.busy,
      settingFailed: visualSetting.failed,
      async setEnabled(enabled) {
        if (visualSettingRequest.current) return;
        visualSettingRequest.current = true;
        // Withdraw media authority immediately, before waiting on the writer.
        visualPermission.current = false;
        setVisualSetting({ enabled: false, busy: true, failed: false });
        const correlationId = createDiagnosticCorrelationId();
        let stage: VisualStage = 'CONSENT_CHECK';
        try {
          if (!localActive() || (enabled && (await adapter.inspect())?.scope !== 'full')) throw new VisualPlaceError('ACCESS');
          stage = 'CONSENT_WRITE';
          visualLifecycle(correlationId, stage, 'START');
          await setVisualDiscoveryEnabled(enabled, localActive);
          visualPermission.current = enabled;
          setVisualSetting({ enabled, busy: false, failed: false });
          visualLifecycle(correlationId, stage, 'COMPLETE', 'complete');
        } catch (error) {
          visualDiagnostic(correlationId, stage, withdrawal(error), stage === 'CONSENT_WRITE' ? 'unknown' : undefined);
          setVisualSetting({ enabled: false, busy: false, failed: true });
        } finally {
          visualSettingRequest.current = false;
        }
      },
      async discover(signal) {
        const correlationId = createDiagnosticCorrelationId();
        const canAccess = access(signal, durableRevealGate.current());
        const partialPreview = isVisualPartialPreviewEnabled();
        const none = { proposal: null, more: false };
        let stage: VisualStage = 'CONSENT_CHECK';
        let acknowledge = false;
        if (visualRunning.current) {
          visualDiagnostic(correlationId, stage, new VisualPlaceError('ALREADY_RUNNING'));
          return { proposal: null, more: true };
        }
        visualRunning.current = true;
        try {
          await canAccess();
          const packs = await loadRegionalStarter?.({ signal, correlationId, verify: async () => { await canAccess(); } });
          if (loadRegionalStarter && !packs) return none;
          stage = 'HINT_ELIGIBILITY';
          visualLifecycle(correlationId, stage, 'START');
          const onProposalRead = () => {
            visualLifecycle(correlationId, stage, 'COMPLETE');
            stage = 'PROPOSAL_READBACK';
            visualLifecycle(correlationId, stage, 'START');
          };
          let page = packs ? await loadVisualDiscoveryPage(canAccess, onProposalRead, undefined, packs.release)
            : await loadVisualDiscoveryPage(canAccess, onProposalRead);
          if (page.kind !== 'proposal') {
            visualLifecycle(correlationId, stage, 'COMPLETE');
            if (page.kind === 'done') return none;
            const { candidate, token } = page;
            const verify = () => verifyVisualDiscovery(token, canAccess);
            let result: QualifiedVisualAlbum | null = null;
            if (candidate) {
              stage = 'MEDIA_SCOPE';
              visualLifecycle(correlationId, stage, 'START');
              const representatives = Platform.OS === 'android' ? candidate.representatives
                : candidate.representatives.slice(0, visualDiscoveryTextAttempts);
              const photos = await resolvePhotos(representatives, verify);
              if (photos.length < 4) {
                visualDiagnostic(correlationId, stage, new VisualPlaceError('MEDIA_UNAVAILABLE'));
              } else {
                visualLifecycle(correlationId, stage, 'COMPLETE');
                const analyzedIds = new Set(photos.map(({ id }) => id));
                const analyzed = representatives.filter(({ evidence_id }) => analyzedIds.has(evidence_id));
                // Missing previews still mark capture-session continuity for routing.
                const regional = packs && { packs, samples: representatives.map((photo) => ({ id: photo.evidence_id,
                  family: photo.family, capturedAtMillis: photo.captured_at_millis })) };
                const recognition = await visualRecognition({ token, observedPeriod: '', photos },
                  { approvedOnDeviceAnalysis: true, selectedIds: photos.map((photo) => photo.id) },
                  async () => { await verify(); return true; }, signal,
                  { correlationId, ...(regional ? { regional } : {}) });
                if (recognition.status === 'recognized') {
                  stage = 'TRIP_QUALIFY';
                  visualLifecycle(correlationId, stage, 'START');
                  await verify();
                  const trip = qualifyVisualTrip(analyzed, recognition.observations, partialPreview, candidate.representatives);
                  if (!trip) visualDiagnostic(correlationId, stage, new VisualPlaceError('VISUAL_EPISODE_SUPPORT'));
                  else {
                    visualLifecycle(correlationId, stage, 'COMPLETE');
                    stage = 'ALBUM_ASSOCIATE';
                    visualLifecycle(correlationId, stage, 'START');
                    result = associateVisualAlbum(trip);
                    if (!result) visualDiagnostic(correlationId, stage, new VisualPlaceError('VISUAL_ALBUM_SUPPORT'));
                    else visualLifecycle(correlationId, stage, 'COMPLETE');
                  }
                  if (!result && recognition.retryRegionalPack) return none;
                } else if (recognition.status !== 'inconclusive') {
                  return none;
                }
              }
            }
            stage = 'PROPOSAL_STAGE';
            visualLifecycle(correlationId, stage, 'START');
            const saved = await checkpointVisualDiscovery(token, result, canAccess, signal, () => { acknowledge = true; });
            acknowledge = false;
            visualLifecycle(correlationId, stage, 'COMPLETE', 'complete');
            const immediate = partialPreview || packs || (result && usesVisualCitySupport(result.placeId, result.stops));
            if (!immediate || !saved.staged) return { proposal: null, more: saved.staged || saved.more };
            stage = 'PROPOSAL_READBACK';
            visualLifecycle(correlationId, stage, 'START');
            page = packs ? await loadVisualDiscoveryPage(canAccess, undefined, token, packs.release)
              : await loadVisualDiscoveryPage(canAccess, undefined, token);
            if (page.kind !== 'proposal') throw new VisualPlaceError('HISTORY_STALE');
          }
          stage = 'PROPOSAL_READBACK';
          const { token, proposal } = page;
          const place = resolveVisualPlace(proposal.placeId);
          const pendingPlace = resolveVisualPendingPlace(proposal.placeId, proposal.stops, proposal.pendingPlaceIds, partialPreview);
          if (!place) throw new VisualPlaceError('MEDIA_SCHEMA');
          const stopIds = new Set(proposal.stops.map((stop) => stop.placeId).filter((id) => !isVisualLocality(id)));
          const stops = [...stopIds].map((id) => resolveVisualPlace(id)!);
          visualLifecycle(correlationId, stage, 'COMPLETE');
          stage = 'MEDIA_SCOPE';
          visualLifecycle(correlationId, stage, 'START');
          const verify = () => verifyVisualDiscovery(token, canAccess);
          const byId = new Map(proposal.photos.map((photo) => [photo.evidence_id, photo]));
          const covers = await resolvePhotos(proposal.coverIds.map((id) => byId.get(id)!), verify);
          // Withhold the card when even one of its exact representatives cannot open.
          if (covers.length !== proposal.coverIds.length) throw new VisualPlaceError('MEDIA_UNAVAILABLE');
          await verify();
          visualLifecycle(correlationId, stage, 'COMPLETE');
          const { start, end } = proposal;
          const observedPeriod = start === end ? start : `${start} – ${end}`;
          return { proposal: { token, observedPeriod, place, stops, covers,
            count: proposal.photos.length, correction: proposal.correctionId !== null, pendingPlace }, more: false };
        } catch (error) {
          visualDiagnostic(correlationId, stage, withdrawal(error), acknowledge ? 'unknown' : undefined);
          return none;
        } finally {
          visualRunning.current = false;
        }
      },
      async loadAlbum(token, page, signal) {
        const correlationId = createDiagnosticCorrelationId();
        const canAccess = access(signal, durableRevealGate.current());
        let stage: VisualStage = 'ALBUM_ASSOCIATE';
        try {
          visualLifecycle(correlationId, stage, 'START');
          const result = await loadVisualDiscoveryAlbum(token, page, canAccess);
          visualLifecycle(correlationId, stage, 'COMPLETE');
          stage = 'MEDIA_SCOPE';
          visualLifecycle(correlationId, stage, 'START');
          const verify = () => verifyVisualDiscovery(token, canAccess);
          const photos = await resolvePhotos(result.photos, verify);
          if (photos.length !== result.photos.length) throw new VisualPlaceError('MEDIA_UNAVAILABLE');
          await verify();
          visualLifecycle(correlationId, stage, 'COMPLETE');
          return { photos, hasMore: result.hasMore };
        } catch (error) {
          visualDiagnostic(correlationId, stage, withdrawal(error));
          return null;
        }
      },
      async review(token, decision, signal) {
        const correlationId = createDiagnosticCorrelationId();
        const canAccess = access(signal, durableRevealGate.current());
        const reviewBoundary: { stage: VisualStage } = { stage: 'REVIEW_COMMIT' };
        try {
          visualLifecycle(correlationId, reviewBoundary.stage, 'START');
          const reviewed = await reviewVisualDiscovery(token, decision, canAccess, signal, () => {
            reviewBoundary.stage = 'REVIEW_READBACK';
            visualLifecycle(correlationId, reviewBoundary.stage, 'START');
          });
          if (reviewed.manualId) {
            await refreshDurableReveal(() => access(signal, durableRevealGate.current())());
          }
          visualLifecycle(correlationId, 'REVIEW_READBACK', 'COMPLETE', 'complete');
          return true;
        } catch (error) {
          visualDiagnostic(correlationId, reviewBoundary.stage, withdrawal(error), reviewBoundary.stage === 'REVIEW_READBACK' ? 'unknown' : undefined);
          return false;
        }
      },
    };
  }, [adapter, controller, durablePublicationRuntime, durableRevealGate, nativeReconstructionRepository, privacyRuntime,
    refreshDurableReveal, loadRegionalStarter, visualRecognition, visualSetting]);

  const loadRecognizableReveal = useCallback(async (signal?: AbortSignal): Promise<RecognizableReveal | null> => {
    const scope = recognizableScope(signal);
    if (!scope.current()) return null;
    const correlationId = createDiagnosticCorrelationId();
    let stage: 'PREVIEW_READ' | 'PREVIEW_MEDIA' = 'PREVIEW_READ';
    const report = (reason: AppDiagnosticEvent['reasonCode']) => recordAppDiagnostic({ operation: 'ATLAS_PREVIEW', stage,
      reasonCode: reason, retryable: reason === 'DATABASE_BUSY' || reason === 'NATIVE_HANDLE' || reason === 'UNKNOWN',
      durableOutcome: reason === 'SKIPPED' || reason === 'HISTORY_STALE' ? 'skipped' : reason === 'ACCESS' ? 'restricted' : 'unchanged', correlationId });
    try {
      const result = await nativeReconstructionRepository.loadCandidateShadowSnapshot?.({ canUseSource: scope.canUseSource, signal, correlationId, limit: 24, purpose: 'reveal' });
      if (result?.status !== 'complete') return null;
      stage = 'PREVIEW_MEDIA'; report('START');
      const refs = [...new Set(result.cards.flatMap((card) => card.coverRefs))];
      const previews = await resolveRecognizableMedia(adapter, refs, () => scope.verify(result.token));
      const previewByRef = new Map(refs.map((ref, index) => [ref, previews[index]?.availability === 'available' ? previews[index] : undefined]));
      const toCard = (card: typeof result.cards[number]) => ({ id: card.id, title: card.title, observedPeriod: card.observedPeriod,
        coverUri: card.coverRefs.map((ref) => previewByRef.get(ref)).find((preview) => preview?.kind === 'photo' && preview.uri)?.uri ?? null });
      const reliable = result.cards.filter((card) => card.state === 'reliable').map((card) => ({ ...toCard(card),
        canPlay: card.coverRefs.some((ref) => Boolean(previewByRef.get(ref)?.uri)) }));
      const featured = reliable.find((card) => card.coverUri !== null) ?? reliable.find((card) => card.canPlay) ?? reliable[0] ?? null;
      const possible = result.cards.filter((card) => card.state === 'possible').map((card) => ({ ...toCard(card),
        reason: card.reasons.includes('uncertain-boundary') ? 'uncertain-boundary' as const : 'limited-photos' as const,
        canReview: card.canReview ?? false, canReject: card.canReject ?? false }));
      report(refs.length && !previews.some((preview) => preview.availability === 'available' && preview.uri) ? 'MEDIA_UNAVAILABLE' : 'COMPLETE');
      return { token: result.token, featured, possible, observed: result.observed ?? [] };
    } catch (error) {
      report(error instanceof RecognizableReadError ? error.reason : classifyAppDiagnosticError(error));
      return null;
    }
  }, [adapter, nativeReconstructionRepository, recognizableScope]);
  const readRecognizableTrip = useCallback(async (token: object, id: string, signal?: AbortSignal) => {
    const scope = recognizableScope(signal);
    const correlationId = createDiagnosticCorrelationId();
    let stage: 'PREVIEW_READ' | 'PREVIEW_MEDIA' = 'PREVIEW_READ';
    const report = (reason: AppDiagnosticEvent['reasonCode']) => recordAppDiagnostic({ operation: 'ATLAS_PREVIEW', stage,
      reasonCode: reason, retryable: reason === 'DATABASE_BUSY' || reason === 'NATIVE_HANDLE' || reason === 'UNKNOWN',
      durableOutcome: reason === 'SKIPPED' || reason === 'HISTORY_STALE' ? 'skipped' : reason === 'ACCESS' ? 'restricted' : 'unchanged', correlationId });
    report('START');
    try {
      await scope.verify(token);
      const entry = await nativeReconstructionRepository.readCandidateShadowMedia?.(token, id, scope.canUseSource);
      if (!entry) throw new RecognizableReadError('HISTORY_STALE');
      stage = 'PREVIEW_MEDIA'; report('START');
      const previews = await resolveRecognizableMedia(adapter, entry.refs, () => scope.verify(token));
      report(previews.some((preview) => preview.availability === 'available' && preview.uri) ? 'COMPLETE' : 'MEDIA_UNAVAILABLE');
      return { previews };
    } catch (error) {
      report(error instanceof RecognizableReadError ? error.reason : classifyAppDiagnosticError(error));
      return null;
    }
  }, [adapter, nativeReconstructionRepository, recognizableScope]);
  const disposeRecognizableArtifact = useCallback(async (artifact: ReplayArtifact, correlationId: string) => {
    try { await munimReplayRenderer.dispose?.(artifact); return true; }
    catch (error) {
      recordAppDiagnostic({ operation: 'REPLAY_RENDER', stage: 'REPLAY_OUTPUT_CLEANUP', reasonCode: classifyAppDiagnosticError(error),
        retryable: true, durableOutcome: 'unknown', correlationId });
      return false;
    }
  }, []);
  const discardRecognizableTripPreview = useCallback(async (uri: string, correlationId?: string) => {
    const entry = recognizableArtifacts.current.get(uri);
    if (!entry) return;
    if (await disposeRecognizableArtifact(entry.artifact, correlationId ?? entry.correlationId)) recognizableArtifacts.current.delete(uri);
  }, [disposeRecognizableArtifact]);
  useEffect(() => {
    const artifacts = recognizableArtifacts.current;
    return () => { for (const uri of artifacts.keys()) void discardRecognizableTripPreview(uri); };
  }, [discardRecognizableTripPreview, privateRecord.state]);
  const playRecognizableTrip = useCallback(async (token: object, id: string, signal?: AbortSignal, correlationId = createDiagnosticCorrelationId()): Promise<ReplayPreparedPreview | null> => {
    const scope = recognizableScope(signal);
    let stage: AppDiagnosticEvent['stage'] = 'REPLAY_ELIGIBILITY';
    let artifact: ReplayArtifact | undefined;
    const report = (reason: AppDiagnosticEvent['reasonCode']) => recordAppDiagnostic({ operation: 'REPLAY_RENDER', stage,
      reasonCode: reason, retryable: reason === 'DATABASE_BUSY' || reason === 'NATIVE_HANDLE' || reason === 'UNKNOWN' || reason === 'MEDIA_ENCODE',
      durableOutcome: reason === 'SKIPPED' || reason === 'HISTORY_STALE' ? 'skipped' : reason === 'ACCESS' ? 'restricted' : 'unchanged', correlationId });
    const enter = (next: typeof stage) => { stage = next; report('START'); };
    try {
      enter('REPLAY_ELIGIBILITY'); await scope.verify(token);
      enter('REPLAY_MANIFEST');
      const entry = await nativeReconstructionRepository.readCandidateShadowMedia?.(token, id, scope.canUseSource);
      if (!entry || entry.card.state !== 'reliable') throw new RecognizableReadError('HISTORY_STALE');
      enter('REPLAY_PREVIEWS');
      const previews = await resolveRecognizableMedia(adapter, entry.refs, () => scope.verify(token));
      const groupKey = 'featured-trip';
      const sources: ReplayRenderSource[] = previews.flatMap((preview, index) => preview.availability === 'available' && preview.uri
        ? [{ groupKey, memoryKey: `trip-memory-${index + 1}`, kind: preview.kind, uri: preview.uri }] : []);
      if (!sources.length) { report('MEDIA_UNAVAILABLE'); return null; }
      const manifest = createExportManifest(entry.run, [{ key: groupKey, label: entry.card.title, inferred: true, eligible: true, orderCertain: false }],
        sources.map((source) => ({ key: source.memoryKey, groupKey, kind: source.kind, available: true, eligible: true })));
      enter('REPLAY_ENCODE');
      artifact = await munimReplayRenderer.render(manifest, sources, signal ?? new AbortController().signal);
      recognizableArtifacts.current.set(artifact.uri, { artifact, correlationId });
      enter('REPLAY_OUTPUT_VERIFY');
      // The renderer has verified the temporary output. This check establishes
      // that its exact candidate, permission and private record still match.
      await scope.verify(token);
      report('COMPLETE');
      return { uri: artifact.uri, durationSeconds: artifact.manifest.durationSeconds, renderedMemoryCount: sources.length, omittedMemoryCount: entry.refs.length - sources.length };
    } catch (error) {
      const failure = error instanceof ReplayPreparationError ? error.stage : null;
      if (failure === 'REPLAY_DECODE' || failure === 'REPLAY_ENCODE') stage = failure;
      if (failure === 'REPLAY_OUTPUT') stage = 'REPLAY_OUTPUT_VERIFY';
      const reason = signal?.aborted || failure === 'REPLAY_STALE' ? 'SKIPPED'
        : error instanceof RecognizableReadError ? stage === 'REPLAY_OUTPUT_VERIFY' && error.reason === 'ACCESS' ? 'HISTORY_STALE' : error.reason : failure === 'REPLAY_ACCESS' ? 'ACCESS'
          : failure === 'REPLAY_DECODE' ? 'MEDIA_DECODE' : failure === 'REPLAY_ENCODE' ? 'MEDIA_ENCODE'
            : failure === 'REPLAY_OUTPUT' ? 'MEDIA_VERIFY' : failure === 'REPLAY_UNAVAILABLE' ? 'MEDIA_UNAVAILABLE' : classifyAppDiagnosticError(error);
      report(reason);
      if (artifact) await discardRecognizableTripPreview(artifact.uri, correlationId);
      return null;
    }
  }, [adapter, discardRecognizableTripPreview, nativeReconstructionRepository, recognizableScope]);
  const reviewRecognizableTrip = useCallback(async (token: object, id: string, decision: 'keep' | 'reject', commandKey: string, signal?: AbortSignal): Promise<CandidateShadowReviewResult> => {
    const correlationId = createDiagnosticCorrelationId();
    const scope = recognizableScope(signal);
    const save = nativeReconstructionRepository.saveCandidateShadowDecision;
    if (!scope.current() || !save) {
      recordAppDiagnostic({ operation: 'POSSIBLE_TRIP_REVIEW', stage: 'POSSIBLE_TRIP_SAVE', reasonCode: signal?.aborted ? 'SKIPPED' : 'HISTORY_STALE',
        retryable: false, durableOutcome: 'skipped', correlationId });
      return 'stale';
    }
    const result = await save.call(nativeReconstructionRepository, token, id, decision, commandKey, { canUseSource: scope.canUseSource, signal, correlationId });
    if (result !== 'applied' || decision === 'reject') return result;
    const stage = 'POSSIBLE_TRIP_PUBLISH';
    recordAppDiagnostic({ operation: 'POSSIBLE_TRIP_REVIEW', stage, reasonCode: 'START', retryable: false, durableOutcome: 'unchanged', correlationId });
    try {
      await refreshDurableReveal(scope.access);
      recordAppDiagnostic({ operation: 'POSSIBLE_TRIP_REVIEW', stage, reasonCode: 'COMPLETE', retryable: false, durableOutcome: 'complete', correlationId });
      return 'applied';
    } catch (error) {
      const stale = !scope.active() || error instanceof PreparationPublicationSkipped;
      recordAppDiagnostic({ operation: 'POSSIBLE_TRIP_REVIEW', stage,
        reasonCode: stale ? 'HISTORY_STALE' : classifyAppDiagnosticError(error), retryable: !stale,
        durableOutcome: stale ? 'skipped' : 'unknown', correlationId });
      return stale ? 'stale' : 'unknown';
    }
  }, [nativeReconstructionRepository, recognizableScope, refreshDurableReveal]);
  const loadJourneyDetail = useCallback(async (displayId: string) => {
    let stage: JourneyPreviewStage = 'PREVIEW_SCOPE';
    const visual = displayId.startsWith('manual:visual-');
    const correlationId = visual ? createDiagnosticCorrelationId() : null;
    try {
      if (privacyRuntime.mutating || privateRecord.state !== 'connected') throw new Error('Journey preview scope changed.');
      // Multiple Atlas cards resolve their private covers concurrently. A detail
      // read is not a replacement for another detail read, so only a real
      // lifecycle invalidation may make it stale.
      const generation = durableRevealGate.current();
      const result = await nativeReconstructionRepository.loadJourneyDetail(displayId, (next) => { stage = next; });
      if (privacyRuntime.mutating || !canPublishJourneyDetail(generation, durableRevealGate.current(), privateRecord.state)) throw new Error('Journey preview scope changed.');
      // Preserve placeholder slots: JourneyDetailScreen pairs previews with memories
      // by index, and a missing first asset must not shift a later preview upward.
      stage = 'PREVIEW_MEDIA';
      const previews = adapter.resolveOwnerPreviews ? await adapter.resolveOwnerPreviews(result.previewSourceRefs, 4) : [];
      stage = 'PREVIEW_VERIFY';
      if (result.privacyRevision !== undefined && nativeReconstructionRepository.verifyJourneyMediaSnapshot
        && !await nativeReconstructionRepository.verifyJourneyMediaSnapshot(displayId, result.snapshotToken, result.privacyRevision)) {
        throw new Error('Journey preview scope changed.');
      }
      if (privacyRuntime.mutating || !canPublishJourneyDetail(generation, durableRevealGate.current(), privateRecord.state)) throw new Error('Journey preview scope changed.');
      return { detail: result.detail, previews, snapshotToken: result.snapshotToken };
    } catch (error) {
      if (correlationId) recordJourneyPreviewFailure(correlationId, stage, error);
      throw new JourneyPreviewBoundaryError(stage, error, visual);
    }
  }, [adapter, durableRevealGate, nativeReconstructionRepository, privateRecord.state, privacyRuntime]);
  const inspectJourneyMedia = useCallback(async (displayId: string, run: number, itemId: string, previewUri: string | null) => {
    if (!__DEV__) return 'Media inspection is unavailable.';
    const operation = 'JOURNEY_MEDIA_INSPECT';
    const correlationId = createDiagnosticCorrelationId();
    let stage: 'MEDIA_ASSOCIATION_CHECK' | 'MEDIA_ORIGINAL_CHECK' | 'MEDIA_SLOT_CHECK' = 'MEDIA_ASSOCIATION_CHECK';
    const report = (reasonCode: Parameters<typeof recordAppDiagnostic>[0]['reasonCode'], message: string) => {
      recordAppDiagnostic({ operation, stage, reasonCode, retryable: false,
        durableOutcome: reasonCode === 'COMPLETE' ? 'complete' : reasonCode === 'HISTORY_STALE' ? 'skipped' : 'unchanged', correlationId });
      return message;
    };
    const slot = /^media-([1-9]\d*)$/.exec(itemId)?.[1];
    const generation = durableRevealGate.current();
    const current = () => !privacyRuntime.mutating && canPublishJourneyDetail(generation, durableRevealGate.current(), privateRecord.state);
    try {
      if (!current() || !slot) return report('HISTORY_STALE', 'Reopen the current trip before inspecting.');
      const selected = await nativeReconstructionRepository.loadJourneyMediaInspection?.(displayId, run, Number(slot));
      if (!current()) return report('HISTORY_STALE', 'Reopen the current trip before inspecting.');
      if (!selected) return report('MEDIA_UNAVAILABLE', 'The saved association could not be verified.');
      stage = 'MEDIA_ORIGINAL_CHECK';
      const original = await adapter.inspectOwnerMedia?.(selected.reference);
      if (!current() || !await nativeReconstructionRepository.verifyJourneyMediaSnapshot?.(displayId, run, selected.privacyRevision)) {
        return report('HISTORY_STALE', 'Reopen the current trip before inspecting.');
      }
      if (!original) return report('MEDIA_UNAVAILABLE', 'The original could not be compared.');
      if (!original.location || selected.evidence.latitude === null || selected.evidence.longitude === null) {
        return report('UNKNOWN', 'Comparable location metadata is unavailable.');
      }
      if (Math.abs(original.location.latitude - selected.evidence.latitude) > 0.00005
        || Math.abs(original.location.longitude - selected.evidence.longitude) > 0.00005) {
        return report('MEDIA_METADATA_MISMATCH', 'The original location metadata differs from the saved evidence.');
      }
      stage = 'MEDIA_SLOT_CHECK';
      if (!previewUri) return report('MEDIA_UNAVAILABLE', 'The preview asset is unavailable.');
      if (original.uri !== previewUri) return report('MEDIA_ASSET_MISMATCH', 'The preview reference differs from the resolved original.');
      return report('COMPLETE', 'Saved metadata and preview reference agree. Rendered pixels were not inspected.');
    } catch (error) {
      return report(classifyAppDiagnosticError(error), 'This media could not be inspected.');
    }
  }, [adapter, durableRevealGate, nativeReconstructionRepository, privateRecord.state, privacyRuntime]);
  const findManualJourneyOverlaps = useCallback(async (input: ManualJourneyInput) => {
    if (privateRecord.state !== 'connected') throw new Error('Private record is unavailable. Reconnect before adding a journey.');
    return nativeReconstructionRepository.findManualJourneyOverlaps(input);
  }, [nativeReconstructionRepository, privateRecord.state]);
  const createManualJourney = useCallback(async (input: ManualJourneyInput) => {
    if (privateRecord.state !== 'connected') throw new Error('Private record is unavailable. Reconnect before adding a journey.');
    const displayId = await nativeReconstructionRepository.createManualJourney(input);
    await refreshDurableReveal();
    const readBack = await nativeReconstructionRepository.loadJourneyDetail(displayId);
    if (!readBack.detail.ownerEntered) throw new Error('The owner-entered journey could not be verified.');
    return displayId;
  }, [nativeReconstructionRepository, privateRecord.state, refreshDurableReveal]);
  const removeManualJourney = useCallback(async (displayId: string) => {
    if (privateRecord.state !== 'connected') throw new Error('Private record is unavailable. Reconnect before removing a journey.');
    await nativeReconstructionRepository.removeManualJourney(displayId);
    // A full refreshDurableReveal() re-runs the whole Atlas read (every
    // reconstructed journey's destination labels, etc.) — needlessly slow
    // for removing one entry whose absence is already certain. Drop it
    // locally instead, matching runPrivacyCommand's own optimistic-removal
    // pattern for the same reason.
    setDurableReveal((current) => current ? { ...current, journeys: current.journeys.filter((journey) => journey.displayId !== displayId) } : current);
  }, [nativeReconstructionRepository, privateRecord.state]);
  const loadJourneyMediaPage = useCallback(async (displayId: string, snapshotToken: number, page: number) => {
    const visual = displayId.startsWith('manual:visual-');
    const correlationId = visual ? createDiagnosticCorrelationId() : null;
    let stage: JourneyPreviewStage = 'PREVIEW_SCOPE';
    // Gallery reads can run beside Timeline cover reads; preserve both until
    // the private lifecycle itself changes.
    const generation = durableRevealGate.current();
    const verify = () => {
      if (privacyRuntime.mutating || !canPublishJourneyDetail(generation, durableRevealGate.current(), privateRecord.state)) {
        throw new VisualPlaceError(privateRecord.state === 'connected' ? 'HISTORY_STALE' : 'ACCESS');
      }
    };
    try {
      verify();
      stage = 'PREVIEW_READ';
      if (correlationId) recordAppDiagnostic({ operation: 'ATLAS_PREVIEW', stage, reasonCode: 'START', retryable: false,
        durableOutcome: 'unchanged', correlationId });
      const result = visual
        ? await nativeReconstructionRepository.loadJourneyMediaPage(displayId, snapshotToken, page, (next) => { stage = next; })
        : await nativeReconstructionRepository.loadJourneyMediaPage(displayId, snapshotToken, page);
      verify();
      stage = 'PREVIEW_MEDIA';
      const previews = adapter.resolveOwnerPreviews ? await adapter.resolveOwnerPreviews(result.previewSourceRefs, result.previewSourceRefs.length) : [];
      stage = 'PREVIEW_VERIFY';
      if (result.privacyRevision !== undefined && nativeReconstructionRepository.verifyJourneyMediaSnapshot
        && !await nativeReconstructionRepository.verifyJourneyMediaSnapshot(displayId, snapshotToken, result.privacyRevision)) {
        throw new VisualPlaceError('HISTORY_STALE');
      }
      verify();
      if (correlationId) recordAppDiagnostic({ operation: 'ATLAS_PREVIEW', stage, reasonCode: 'COMPLETE', retryable: false,
        durableOutcome: 'unchanged', correlationId });
      return { page: { items: result.items, hasMore: result.hasMore }, previews };
    } catch (error) {
      if (correlationId) recordJourneyPreviewFailure(correlationId, stage, error);
      throw new JourneyPreviewBoundaryError(stage, error, visual);
    }
  }, [adapter, durableRevealGate, nativeReconstructionRepository, privateRecord.state, privacyRuntime]);
  const saveJourneyCorrection = useCallback(async (displayId: string, action: 'confirm' | 'reject' | 'claim' | 'place' | 'split' | 'merge' | 'remove-visit', snapshotToken: number, snapshot: JourneyDetail, commandKey: string, payload?: NonNullable<JourneyDetail['ownerClaim']> | NonNullable<JourneyDetail['ownerPlace']> | { afterVisitId: string } | { withJourneyId: string } | { visitId: string }) => {
    if (privateRecord.state !== 'connected') throw new Error('Private record is unavailable.');
    // Preserve the established five-argument call shape for confirm/reject.
    // Test doubles and older adapters intentionally do not receive a claim
    // placeholder; only the new claim action carries its additional payload.
    const saved = action === 'claim' || action === 'place' || action === 'split' || action === 'merge' || action === 'remove-visit'
      ? await nativeReconstructionRepository.saveJourneyCorrection(displayId, action, snapshotToken, snapshot, commandKey, payload)
      : await nativeReconstructionRepository.saveJourneyCorrection(displayId, action, snapshotToken, snapshot, commandKey);
    const projection = saved.graph ? reconstructionController.publishCommitted(saved.graph) : { status: 'complete' as const };
    if (projection.status === 'complete') {
      // A correction is not owner-visible until the redacted Atlas projection
      // is refreshed from the run that committed it. This prevents navigation
      // from showing an old cached journey after a successful rejection.
      await refreshDurableReveal();
      if (action === 'place') {
        const selectedPlace = payload as NonNullable<JourneyDetail['ownerPlace']> | undefined;
        const finalDurable = await nativeReconstructionRepository.loadDurableReveal();
        const finalDisplayId = selectedPlace ? verifiedOwnerPlaceDisplayId(displayId, selectedPlace, finalDurable) : null;
        if (!finalDisplayId) return 'pending';
        const finalDetail = await nativeReconstructionRepository.loadJourneyDetail(finalDisplayId);
        if (!hasVerifiedOwnerPlace(finalDisplayId, selectedPlace!, finalDetail.detail, finalDurable)) return 'pending';
      }
      return 'applied';
    }
    return 'pending';
  }, [nativeReconstructionRepository, privateRecord.state, reconstructionController, refreshDurableReveal]);
  const confirmTimelineMerge = useCallback(async (pair: JourneyMergePair, detail: JourneyDetail, commandKey: string) => {
    const generation = durableRevealGate.current();
    const localActive = () => AppState.currentState === 'active' && !controller.isAccountRecord && !privacyRuntime.mutating && durablePublicationRuntime.isConnected;
    const access = async () => localActive() && (await adapter.inspect())?.scope === 'full' && localActive();
    const current = async () => generation === durableRevealGate.current() && await access() && generation === durableRevealGate.current();
    let stage: 'POSSIBLE_TRIP_SAVE' | 'POSSIBLE_TRIP_REBUILD' | 'POSSIBLE_TRIP_ACK' | 'POSSIBLE_TRIP_READBACK' = 'POSSIBLE_TRIP_SAVE';
    let uncertainWrite = false;
    const enter = (next: typeof stage) => {
      stage = next;
      recordAppDiagnostic({ operation: 'POSSIBLE_TRIP_REVIEW', stage, reasonCode: 'START', retryable: false, durableOutcome: 'unchanged', correlationId: commandKey });
    };
    try {
      enter('POSSIBLE_TRIP_SAVE');
      if (!nativeReconstructionRepository.verifySuggestedMergeReceipt || !await current()) throw new Error('Journey preview scope changed.');
      const result = await nativeReconstructionRepository.saveJourneyCorrection(pair.leftId, 'merge', pair.generation, detail, commandKey,
        { withJourneyId: pair.rightId, suggested: true, expectedPrivacyRevision: pair.privacyRevision, canUseSource: current,
          onStage: (next) => { if (next === 'POSSIBLE_TRIP_ACK') uncertainWrite = true; enter(next); },
          onRollback: (outcome) => { if (outcome !== 'start') uncertainWrite = outcome === 'failed'; } });
      uncertainWrite = true;
      enter('POSSIBLE_TRIP_READBACK');
      await refreshDurableReveal(async () => await access()
        && await nativeReconstructionRepository.verifySuggestedMergeReceipt!(pair, commandKey)
        && await access());
      if (result.graph) reconstructionController.publishCommitted(result.graph);
      recordAppDiagnostic({ operation: 'POSSIBLE_TRIP_REVIEW', stage, reasonCode: 'COMPLETE', retryable: false, durableOutcome: 'complete', correlationId: commandKey });
      return 'applied' as const;
    } catch (error) {
      recordAppDiagnostic({ operation: 'POSSIBLE_TRIP_REVIEW', stage,
        reasonCode: error instanceof PreparationPublicationSkipped ? 'HISTORY_STALE' : classifyAppDiagnosticError(error),
        retryable: true, durableOutcome: uncertainWrite ? 'unknown' : 'unchanged', correlationId: commandKey });
      return 'pending' as const;
    }
  }, [adapter, controller, durablePublicationRuntime, durableRevealGate, nativeReconstructionRepository, privacyRuntime, reconstructionController, refreshDurableReveal]);
  const loadUncertainMemories = useCallback(async (displayId: string, snapshotToken: number, query: string, page: number) => {
    if (privacyRuntime.mutating || privateRecord.state !== 'connected') throw new Error('Private record is unavailable.');
    const generation = durableRevealGate.current();
    const result = await nativeReconstructionRepository.loadUncertainMemories(displayId, snapshotToken, query, page);
    if (privacyRuntime.mutating || !canPublishJourneyDetail(generation, durableRevealGate.current(), privateRecord.state)) throw new Error('Memory review is no longer available.');
    return result;
  }, [durableRevealGate, nativeReconstructionRepository, privateRecord.state, privacyRuntime]);
  // CAP-3 (detector-v1-2.md): a passive list read for the real Possible-trips
  // card. Returns an empty list rather than throwing when the record is not
  // connected, since the section simply renders nothing in that case.
  const loadPossibleTrips = useCallback(async () => {
    if (privacyRuntime.mutating || privateRecord.state !== 'connected' || !nativeReconstructionRepository.loadPossibleTrips) return [];
    return nativeReconstructionRepository.loadPossibleTrips();
  }, [nativeReconstructionRepository, privateRecord.state, privacyRuntime]);
  const saveJourneyMemoryCorrection = useCallback(async (displayId: string, memoryId: string, action: 'assign' | 'move' | 'reject' | 'unassign', snapshotToken: number, commandKey: string) => {
    if (privateRecord.state !== 'connected') throw new Error('Private record is unavailable.');
    const saved = await nativeReconstructionRepository.saveJourneyMemoryCorrection(displayId, memoryId, action, snapshotToken, commandKey);
    const projection = saved.graph ? reconstructionController.publishCommitted(saved.graph) : { status: 'complete' as const };
    if (projection.status !== 'complete') return 'pending';
    await refreshDurableReveal();
    return 'applied';
  }, [nativeReconstructionRepository, privateRecord.state, reconstructionController, refreshDurableReveal]);
  const discardJourneyCorrectionPending = useCallback(async (displayId: string, snapshotToken: number, commandKey: string) => {
    if (privateRecord.state !== 'connected') throw new Error('Private record is unavailable.');
    const saved = await nativeReconstructionRepository.discardJourneyCorrectionPending(displayId, snapshotToken, commandKey);
    const projection = saved.graph ? reconstructionController.publishCommitted(saved.graph) : { status: 'complete' as const };
    if (projection.status !== 'complete') return 'pending';
    await refreshDurableReveal();
    return 'applied';
  }, [nativeReconstructionRepository, privateRecord.state, reconstructionController, refreshDurableReveal]);
  const retryJourneyCorrectionProjection = useCallback(async () => {
    // A dev-client reload renders before the asynchronous lifecycle refresh
    // finishes. Read the durable lifecycle here so the owner-facing retry is
    // not rejected merely because React still holds its initial snapshot.
    const correlationId = createDiagnosticCorrelationId();
    recordAppDiagnostic({ operation: 'ATLAS_REVEAL_RETRY', reasonCode: 'START', stage: null, retryable: false, durableOutcome: 'unchanged', correlationId });
    // A completed metadata import itself rebuilds the projection. Do not let
    // a second owner recheck contend with those local SQLite writes.
    await controller.whenImportIdle();
    await maintenanceController.whenIdle();
    let lifecycle: Awaited<ReturnType<typeof sharedRepository.getPrivateRecordLifecycle>>;
    try {
      lifecycle = await sharedRepository.getPrivateRecordLifecycle();
    } catch (error) {
      recordAppDiagnostic({ operation: 'ATLAS_REVEAL_RETRY', reasonCode: classifyAppDiagnosticError(error), stage: null, retryable: true, durableOutcome: 'restricted', correlationId });
      setReconstruction((current) => ({ ...current, status: 'restricted', message: 'Reconnect your private record before retrying Atlas.' }));
      return false;
    }
    durablePublicationRuntime.setLifecycle(lifecycle.state);
    if (lifecycle.state !== 'connected') {
      recordAppDiagnostic({ operation: 'ATLAS_REVEAL_RETRY', reasonCode: 'RESTRICTED', stage: null, retryable: true, durableOutcome: 'restricted', correlationId });
      setReconstruction((current) => ({ ...current, status: 'restricted', message: 'Reconnect your private record before retrying Atlas.' }));
      return false;
    }
    reconstructionController.resume();
    const projection = await reconstructionController.rebuild();
    if (projection.status !== 'complete') {
      recordAppDiagnostic({ operation: 'ATLAS_REVEAL_RETRY', reasonCode: projection.status === 'failed' ? classifyAppDiagnosticError(projection.error) : 'ALREADY_RUNNING', stage: null, retryable: true, durableOutcome: projection.status === 'failed' ? 'failed' : 'unchanged', correlationId });
      return false;
    }
    try {
      await refreshDurableReveal();
      recordAppDiagnostic({ operation: 'ATLAS_REVEAL_RETRY', reasonCode: 'COMPLETE', stage: null, retryable: false, durableOutcome: 'complete', correlationId });
      return true;
    } catch (error) {
      recordAppDiagnostic({ operation: 'ATLAS_REVEAL_RETRY', reasonCode: classifyAppDiagnosticError(error), stage: durableRevealFailureStage(error), retryable: true, durableOutcome: 'failed', correlationId });
      setReconstruction((current) => ({ ...current, status: 'error', message: durableRevealFailureMessage(error) }));
      return false;
    }
  }, [controller, durablePublicationRuntime, maintenanceController, reconstructionController, refreshDurableReveal, sharedRepository]);
  const reviewJourneyPrivacy = useCallback(async (displayId: string) => {
    let stage: 'PRIVACY_REVIEW_DETAIL' | 'PRIVACY_REVIEW_SCOPE' = 'PRIVACY_REVIEW_DETAIL';
    const generation = durableRevealGate.current();
    try {
      if (privacyRuntime.mutating || privateRecord.state !== 'connected' || !nativeReconstructionRepository.reviewJourneyPrivacy) throw new PrivacyReadCancelledError();
      const loaded = await nativeReconstructionRepository.loadJourneyDetail(displayId);
      if (privacyRuntime.mutating || !canPublishJourneyDetail(generation, durableRevealGate.current(), privateRecord.state)) throw new PrivacyReadCancelledError();
      stage = 'PRIVACY_REVIEW_SCOPE';
      const review = await nativeReconstructionRepository.reviewJourneyPrivacy(displayId, loaded.snapshotToken);
      if (privacyRuntime.mutating || !canPublishJourneyDetail(generation, durableRevealGate.current(), privateRecord.state)) throw new PrivacyReadCancelledError();
      return review;
    } catch (error) {
      const cancelled = error instanceof PrivacyReadCancelledError || privacyRuntime.mutating || !canPublishJourneyDetail(generation, durableRevealGate.current(), privateRecord.state);
      recordAppDiagnostic({ operation: 'JOURNEY_PRIVACY_READ', reasonCode: cancelled ? 'LIFECYCLE' : classifyAppDiagnosticError(error), stage, retryable: !cancelled, durableOutcome: cancelled ? 'skipped' : 'failed', correlationId: createDiagnosticCorrelationId() });
      throw new Error(cancelled ? 'Privacy review changed. Reopen the journey.' : 'Privacy review could not load. Reopen the journey and try again.');
    }
  }, [durableRevealGate, nativeReconstructionRepository, privateRecord.state, privacyRuntime]);
  const loadJourneyPrivacyPolicies = useCallback(async () => {
    const generation = durableRevealGate.current();
    try {
      if (privacyRuntime.mutating || privateRecord.state !== 'connected' || !nativeReconstructionRepository.loadJourneyPrivacyPolicies) throw new PrivacyReadCancelledError();
      const policies = await nativeReconstructionRepository.loadJourneyPrivacyPolicies();
      if (privacyRuntime.mutating || !canPublishJourneyDetail(generation, durableRevealGate.current(), privateRecord.state)) throw new PrivacyReadCancelledError();
      return policies;
    } catch (error) {
      const cancelled = error instanceof PrivacyReadCancelledError || privacyRuntime.mutating || !canPublishJourneyDetail(generation, durableRevealGate.current(), privateRecord.state);
      recordAppDiagnostic({ operation: 'JOURNEY_PRIVACY_READ', reasonCode: cancelled ? 'LIFECYCLE' : classifyAppDiagnosticError(error), stage: 'PRIVACY_POLICY_LIST', retryable: !cancelled, durableOutcome: cancelled ? 'skipped' : 'failed', correlationId: createDiagnosticCorrelationId() });
      throw new Error('Private visibility controls could not load. Reopen Privacy Settings and try again.');
    }
  }, [durableRevealGate, nativeReconstructionRepository, privateRecord.state, privacyRuntime]);
  const runPrivacyCommand = useCallback(async (command: () => Promise<void>, hiddenDisplayId?: string) => privacyRuntime.run(async () => {
    try {
      await controller.whenImportIdle();
      await maintenanceController.whenIdle();
      const lifecycle = await sharedRepository.getPrivateRecordLifecycle();
      if (lifecycle.state !== 'connected') throw new Error('Private record is unavailable.');
    } catch (error) {
      recordAppDiagnostic({ operation: 'JOURNEY_PRIVACY_SAVE', reasonCode: classifyAppDiagnosticError(error), stage: null, retryable: true, durableOutcome: 'restricted', correlationId: createDiagnosticCorrelationId() });
      throw new Error('Reconnect the private record before changing a privacy choice.');
    }
    durableRevealGate.invalidate(); privacyRuntime.mutating = true; replayThumbnails.invalidate();
    await clearReplayArtifacts();
    try {
      await command();
      // Keep unrelated committed journeys browseable if the next read fails.
      // The reviewed target belongs to this exact committed run (checked in SQL).
      if (hiddenDisplayId) {
        if (nativeReconstructionRepository.applyJourneyPrivacyToRecord) {
          const prior = durableReveal ?? { journeys: [] };
          try {
            const filtered = await nativeReconstructionRepository.applyJourneyPrivacyToRecord(prior);
            setDurableReveal({ ...filtered, journeys: filtered.journeys.filter((journey) => journey.displayId !== hiddenDisplayId) });
          } catch (error) {
            setDurableReveal({ journeys: [] });
            recordAppDiagnostic({ operation: 'JOURNEY_PRIVACY_SAVE', reasonCode: classifyAppDiagnosticError(error), stage: null, retryable: true, durableOutcome: 'restricted', correlationId: createDiagnosticCorrelationId() });
          }
        } else setDurableReveal((current) => current ? { ...current, journeys: current.journeys.filter((journey) => journey.displayId !== hiddenDisplayId), statistics: null, diagnostics: null } : { journeys: [] });
      }
    } catch (error) {
      recordAppDiagnostic({ operation: 'JOURNEY_PRIVACY_SAVE', reasonCode: classifyAppDiagnosticError(error), stage: null, retryable: true, durableOutcome: 'unchanged', correlationId: createDiagnosticCorrelationId() });
      throw new Error('Privacy action could not be saved. Reopen the journey or Privacy Settings and review again.');
    } finally { privacyRuntime.mutating = false; durableRevealGate.invalidate(); }
    try { await refreshDurableReveal(); }
    catch (error) {
      recordAppDiagnostic({ operation: 'JOURNEY_PRIVACY_SAVE', reasonCode: classifyAppDiagnosticError(error), stage: durableRevealFailureStage(error), retryable: true, durableOutcome: 'failed', correlationId: createDiagnosticCorrelationId() });
      throw new Error('Privacy action was saved. The local Atlas refresh needs a retry; protected content remains withheld.');
    }
  }), [clearReplayArtifacts, controller, durableReveal, durableRevealGate, maintenanceController, nativeReconstructionRepository, privacyRuntime, refreshDurableReveal, sharedRepository]);
  const saveJourneyPrivacy = useCallback(async (reviewId: string, action: 'hide' | 'exclude', commandKey: string, displayId: string) => {
    if (!nativeReconstructionRepository.saveJourneyPrivacy) throw new Error('Privacy controls are unavailable.');
    await runPrivacyCommand(() => nativeReconstructionRepository.saveJourneyPrivacy!(reviewId, action, commandKey), displayId);
  }, [nativeReconstructionRepository, runPrivacyCommand]);
  const restoreJourneyPrivacy = useCallback(async (policyId: string, revision: number, commandKey: string) => {
    if (!nativeReconstructionRepository.restoreJourneyPrivacy) throw new Error('Privacy controls are unavailable.');
    await runPrivacyCommand(() => nativeReconstructionRepository.restoreJourneyPrivacy!(policyId, revision, commandKey));
  }, [nativeReconstructionRepository, runPrivacyCommand]);
  const loadJourneyEligibility = useCallback(async (displayId: string, snapshotToken: number, purpose: import('@/reveal/types').PrivateSelectionPurpose, privacyRevision?: number) => {
    if (privacyRuntime.mutating || !nativeReconstructionRepository.loadJourneyEligibility) return { eligible: false, reason: 'private' as const, privacyRevision: 0 };
    const generation = durableRevealGate.current();
    const result = await nativeReconstructionRepository.loadJourneyEligibility(displayId, snapshotToken, purpose, privacyRevision);
    if (privacyRuntime.mutating || !canPublishJourneyDetail(generation, durableRevealGate.current(), privateRecord.state)) return { ...result, eligible: false, reason: 'stale' as const };
    return result;
  }, [durableRevealGate, nativeReconstructionRepository, privateRecord.state, privacyRuntime]);
  const loadReplayManifestInput = useCallback(async (correlationId = createDiagnosticCorrelationId()) => {
    const diagnostic = replayPreparationDiagnostics(correlationId);
    try {
      diagnostic.enter(adapter.accountAuthorized ? 'REPLAY_ACCOUNT' : 'REPLAY_LOCAL');
      diagnostic.enter('REPLAY_ELIGIBILITY');
      if (privacyRuntime.mutating || !nativeReconstructionRepository.loadReplayManifestInput) return { snapshotToken: 0, privacyRevision: 0, groups: [], memories: [] };
      let result: import('@/replay/types').ReplayManifestInput;
      try {
        diagnostic.enter('REPLAY_MANIFEST');
        result = await nativeReconstructionRepository.loadReplayManifestInput();
      } catch (error) {
        throw diagnostic.failure(error);
      }
      // Atlas detail reads and background refreshes advance the visual read gate,
      // but do not change Replay scope. Only an actual privacy mutation or
      // lifecycle loss can invalidate this repository-snapshotted manifest.
      if (privacyRuntime.mutating || privateRecord.state !== 'connected') return { ...result, groups: [], memories: [] };
      // Replay resolves the same current local source references used by the
      // Journey album. Import-time `unknown` is not a zero-memory verdict.
      if (!result.previewSourceRefs || !adapter.resolveOwnerPreviews) {
        return result.previewSourceRefs ? { ...result, previewSourceRefs: undefined } : result;
      }
      const initialReferences = result.previewSourceRefs.slice(0, REPLAY_EDITOR_INITIAL_PREVIEW_LIMIT);
      let previews: OwnerPreview[];
      try {
        diagnostic.enter('REPLAY_PREVIEWS');
        previews = await adapter.resolveOwnerPreviews([...initialReferences], initialReferences.length);
      } catch (error) {
        throw diagnostic.failure(error);
      }
      if (privacyRuntime.mutating || privateRecord.state !== 'connected') return { ...result, groups: [], memories: [] };
      return {
        ...result,
        previewSourceRefs: undefined,
        // This transient local preview is solely for the on-device editor. It is
        // deliberately absent from durable drafts, renderer manifests and diagnostics.
        memories: result.memories.map((memory, index) => ({
          ...memory,
          // Later candidates remain browseable with their native metadata state.
          // A future page read resolves their local preview rather than decoding
          // the whole album during screen entry.
          ...(index < initialReferences.length ? { available: previews[index]?.availability === 'available' } : {}),
          ...(previews[index]?.uri ? { previewUri: previews[index]!.uri } : {}),
        })),
      };
    } catch (error) { throw diagnostic.failure(error); }
  }, [adapter, nativeReconstructionRepository, privateRecord.state, privacyRuntime]);
  const loadReplayEditorPreviewPage = useCallback(async (memoryKeys: readonly string[], snapshotToken: number, privacyRevision: number, onBatch?: (items: readonly { key: string; available: boolean; previewUri?: string }[]) => void) => {
    if (memoryKeys.length > REPLAY_EDITOR_INITIAL_PREVIEW_LIMIT || privacyRuntime.mutating || privateRecord.state !== 'connected' || !nativeReconstructionRepository.loadReplayEditorPreviewPage || !adapter.resolveOwnerPreviews) throw new ReplayPreparationError('REPLAY_STALE');
    let page: { keys: readonly string[]; previewSourceRefs: readonly (string | null)[] };
    try { page = await nativeReconstructionRepository.loadReplayEditorPreviewPage(memoryKeys, snapshotToken, privacyRevision); } catch { throw new ReplayPreparationError('REPLAY_ACCESS'); }
    let previews: OwnerPreview[];
    const batch: { key: string; available: boolean; previewUri?: string }[] = [];
    let timer: ReturnType<typeof setTimeout> | undefined;
    const publish = () => { if (timer) clearTimeout(timer); timer = undefined; if (privacyRuntime.mutating || privateRecord.state !== 'connected') { batch.length = 0; return; } if (batch.length) onBatch?.(batch.splice(0)); };
    try { previews = await adapter.resolveOwnerPreviews([...page.previewSourceRefs], page.previewSourceRefs.length, (preview, index) => {
      batch.push({ key: page.keys[index]!, available: preview.availability === 'available', ...(preview.uri ? { previewUri: preview.uri } : {}) });
      if (batch.length >= 6) publish(); else if (!timer) timer = setTimeout(publish, 50);
    }); } catch { throw new ReplayPreparationError('REPLAY_ACCESS'); } finally { publish(); }
    if (privacyRuntime.mutating || privateRecord.state !== 'connected') throw new ReplayPreparationError('REPLAY_STALE');
    return page.keys.map((key, index) => ({ key, available: previews[index]?.availability === 'available', ...(previews[index]?.uri ? { previewUri: previews[index]!.uri } : {}) }));
  }, [adapter, nativeReconstructionRepository, privateRecord.state, privacyRuntime]);
  const preparePrivateReplay = useCallback(async (selectedMemoryKeys?: readonly string[], onProgress?: ReplayRenderProgress, music: ReplaySoundtrack = BUNDLED_REPLAY_SOUNDTRACK, onFirstTripReady?: (preview: ReplayPreparedPreview) => void, selectedGroupKeys?: readonly string[], correlationId = createDiagnosticCorrelationId()): Promise<ReplayPreparedPreview> => {
    const diagnostic = replayPreparationDiagnostics(correlationId);
    try {
      diagnostic.enter(adapter.accountAuthorized ? 'REPLAY_ACCOUNT' : 'REPLAY_LOCAL');
      diagnostic.enter('REPLAY_ELIGIBILITY');
      if (privacyRuntime.mutating || privateRecord.state !== 'connected') throw new ReplayPreparationError('REPLAY_STALE');
      if (!nativeReconstructionRepository.loadReplayManifestInput || !adapter.resolveOwnerPreviews) throw new ReplayPreparationError('REPLAY_ACCESS');
      let input: import('@/replay/types').ReplayManifestInput;
      try {
        diagnostic.enter('REPLAY_MANIFEST');
        input = await nativeReconstructionRepository.loadReplayManifestInput();
      } catch (error) {
        throw diagnostic.failure(error);
      }
      if (privacyRuntime.mutating || privateRecord.state !== 'connected' || !input.previewSourceRefs) throw new ReplayPreparationError('REPLAY_STALE');
      let accountRequired:Set<string>|null=null;
      if(adapter.accountAuthorized){
        const committed=planPrivateReplay(replayCompositionGroups(input),input.memories.map(memory=>({...memory,available:true})),undefined,input.direction??'oldest-first',input.autoGroupKeys);
        const groups=selectedGroupKeys?new Set(selectedGroupKeys):null;
        accountRequired=new Set(selectedMemoryKeys&&!groups?selectedMemoryKeys:committed.memories.filter(memory=>!groups||groups.has(memory.groupKey)).map(memory=>memory.key));
      }
      if (adapter.resolveReplaySoundtrack) {
        diagnostic.enter('REPLAY_SOUNDTRACK');
        music = await adapter.resolveReplaySoundtrack(music);
      }
      let previews: OwnerPreview[];
      try {
        diagnostic.enter('REPLAY_PREVIEWS');
        previews = await adapter.resolveOwnerPreviews(input.previewSourceRefs.map((ref,index)=>!accountRequired||accountRequired.has(input.memories[index]?.key??'')?ref:null), input.previewSourceRefs.length);
      } catch (error) {
        throw diagnostic.failure(error);
      }
      if (privacyRuntime.mutating || privateRecord.state !== 'connected') throw new ReplayPreparationError('REPLAY_STALE');
      diagnostic.enter('REPLAY_ELIGIBILITY');
      const memories = input.memories.map((memory, index) => ({ ...memory, available: (!accountRequired||accountRequired.has(memory.key))&&previews[index]?.availability === 'available' && Boolean(previews[index]?.uri) }));
      const direction = input.direction ?? 'oldest-first';
      const compositionGroups = replayCompositionGroups(input);
      // An account composition cannot quietly drop committed media just because
      // a derivative was not synchronized. Card-only groups still remain valid.
      if (accountRequired) {
        if (memories.some(memory => accountRequired.has(memory.key)&&!memory.available)) throw new AccountMediaError('MEDIA_UNAVAILABLE');
      }
      const automaticPlan = planPrivateReplay(compositionGroups, memories, undefined, direction, input.autoGroupKeys);
      const selectedGroupsRequested = selectedGroupKeys ? [...new Set(selectedGroupKeys)] : undefined;
      const selectedGroupSet = new Set(selectedGroupsRequested ?? []);
      // A Share screen may intentionally resolve only a bounded set of editor
      // thumbnails. Its media list is not the committed Replay composition.
      // Once the owner has chosen trips, derive all of their media again from
      // this freshly resolved provider manifest.
      const selectedKeys = selectedGroupsRequested
        ? automaticPlan.memories.filter((memory) => selectedGroupSet.has(memory.groupKey)).map((memory) => memory.key)
        : selectedMemoryKeys ? [...new Set(selectedMemoryKeys)] : automaticPlan.memories.map((memory) => memory.key);
      if (selectedMemoryKeys) {
        const includedGroups = new Set(compositionGroups.filter((group) => group.eligible).map((group) => group.key));
        const currentCommittedKeys = new Set(memories.filter((memory) => memory.available && memory.eligible && includedGroups.has(memory.groupKey)).map((memory) => memory.key));
        // Caller order remains renderer order, but a selected export must never
        // silently recover a removed, excluded, unavailable, or newly ineligible item.
        if (selectedGroupsRequested
          ? selectedGroupsRequested.some((key) => !includedGroups.has(key)) || selectedMemoryKeys.some((key) => {
            const memory = memories.find((candidate) => candidate.key === key);
            return !memory || !currentCommittedKeys.has(key) || !selectedGroupSet.has(memory.groupKey);
          })
          : selectedKeys.some((key) => !currentCommittedKeys.has(key))) throw new ReplayPreparationError('REPLAY_STALE');
      }
      const selectedSet = new Set(selectedKeys);
      const selectedMemories = selectedKeys.map((key) => memories.find((memory) => memory.key === key)).filter((memory): memory is typeof memories[number] => Boolean(memory));
      // Automatic Replay keeps each visible Journey List item, including a
      // qualified trip whose current album has no usable media. An explicit
      // trip selection follows that same committed chapter scope, while its
      // media remains the exact owner-selected subset.
      const selectedGroups = selectedMemoryKeys
        ? orderedReplayGroups(compositionGroups, undefined, direction).filter((group) => selectedGroupsRequested ? selectedGroupsRequested.includes(group.key) : selectedMemories.some((memory) => memory.groupKey === group.key))
        : automaticPlan.groups;
      if (!selectedGroups.length || selectedMemories.length !== selectedSet.size || (selectedMemoryKeys && !selectedMemories.length && !selectedGroupsRequested?.length)) throw new ReplayPreparationError('REPLAY_ACCESS');
      const sources: ReplayRenderSource[] = selectedMemories.flatMap((memory) => {
        const index = input.memories.findIndex((candidate) => candidate.key === memory.key);
        const preview = previews[index];
        return preview?.uri ? [{ memoryKey: memory.key, groupKey: memory.groupKey, kind: preview.kind, uri: preview.uri }] : [];
      });
      if (sources.length !== selectedMemories.length) throw new ReplayPreparationError('REPLAY_ACCESS');
      const manifest = { ...createExportManifest(input.snapshotToken, selectedGroups, selectedMemories, direction), music };
      let chapterRecords: readonly ReplayPreparedChapterRecord[] | undefined;
      const createdChapterUris: string[] = [];
      diagnostic.enter('REPLAY_ENCODE');
      const artifact = selectedMemoryKeys
        ? await replayController.current.prepare(manifest, sources, onProgress)
        : await replayController.current.prepareWith(manifest, async (signal) => {
          const documentDirectory = FileSystem.documentDirectory;
          if (!documentDirectory) throw new ReplayPreparationError('REPLAY_UNAVAILABLE');
          const chapterDirectory = `${documentDirectory}replay-previews/chapters/`;
          await FileSystem.makeDirectoryAsync(chapterDirectory, { intermediates: true });
          const reusable = input.preparedArtifact?.chapters ?? [];
          const rendered: ReplayPreparedChapterRecord[] = [];
          const chapterUris: string[] = [];
          for (const [index, chapter] of (manifest.chapters ?? []).entries()) {
            if (signal.aborted) throw new ReplayPreparationError('REPLAY_STALE');
            const identity = replayChapterIdentity(manifest, chapter);
            const matching = reusable.find((record) => record.identity === identity);
            const chapterSources = sources.filter((source) => source.groupKey === chapter.groupKey && chapter.memoryKeys.includes(source.memoryKey));
            let record = matching && isReplayCacheFileKey(matching.fileKey) ? matching : undefined;
            let uri = record ? `${chapterDirectory}${record.fileKey}` : null;
            // A short moving clip has a truthful shorter chapter duration.  The
            // durable record is the verified duration for that exact visual
            // chapter; a nominal frame budget is not a reason to reject it.
            const valid = Boolean(record && uri && (await FileSystem.getInfoAsync(uri)).exists && await verifyReplayOutput(uri, record.durationSeconds, false));
            if (!valid) {
              if (uri) await FileSystem.deleteAsync(uri, { idempotent: true });
              onProgress?.({ message: `Rendering private trip ${index + 1} of ${(manifest.chapters ?? []).length}.`, completed: index, total: Math.max(1, (manifest.chapters ?? []).length + 1) });
              const chapterArtifact = await renderReplayChapter(manifest, chapter, chapterSources, signal, onProgress);
              const fileKey = `chapter-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}.mp4`;
              uri = `${chapterDirectory}${fileKey}`;
              try {
                await FileSystem.copyAsync({ from: chapterArtifact.uri, to: uri });
                const durationSeconds = chapterArtifact.manifest.durationSeconds;
                if (!(await verifyReplayOutput(uri, durationSeconds, false))) throw new ReplayPreparationError('REPLAY_OUTPUT');
                record = { identity, fileKey, durationSeconds, renderedMemoryCount: chapterSources.length };
                createdChapterUris.push(uri);
              } catch (error) {
                await FileSystem.deleteAsync(uri, { idempotent: true });
                throw error instanceof ReplayPreparationError ? error : new ReplayPreparationError('REPLAY_OUTPUT');
              } finally { await munimReplayRenderer.dispose?.(chapterArtifact); }
            }
            if (!record || !uri) throw new ReplayPreparationError('REPLAY_OUTPUT');
            rendered.push(record); chapterUris.push(uri);
            if (index === 0) onFirstTripReady?.({ uri, durationSeconds: record.durationSeconds, renderedMemoryCount: record.renderedMemoryCount, omittedMemoryCount: input.memories.length - record.renderedMemoryCount, requestIdentity: replayManifestIdentity(manifest), completedTrips: 1, totalTrips: (manifest.chapters ?? []).length });
            onProgress?.({ message: index === 0 ? 'Your first private trip is ready. Buffering the rest in order.' : `Verified private trip ${index + 1} of ${(manifest.chapters ?? []).length}.`, completed: index + 1, total: Math.max(1, (manifest.chapters ?? []).length + 1) });
          }
          chapterRecords = rendered;
          onProgress?.({ message: 'Joining and checking your private Replay.', completed: (manifest.chapters ?? []).length, total: Math.max(1, (manifest.chapters ?? []).length + 1) });
          const verifiedManifest = {
            ...manifest,
            chapters: (manifest.chapters ?? []).map((chapter, index) => ({ ...chapter, frames: Math.max(1, Math.round((rendered[index]?.durationSeconds ?? chapter.frames / 24) * 24)) })),
          };
          return assembleReplayChapters(verifiedManifest, chapterUris, signal);
        }).catch(async (error) => {
          await Promise.all(createdChapterUris.map((uri) => FileSystem.deleteAsync(uri, { idempotent: true })));
          throw error;
        });
      diagnostic.enter('REPLAY_ELIGIBILITY');
      if (privacyRuntime.mutating || privateRecord.state !== 'connected' || adapter.accountAuthorized && !await adapter.accountAuthorized()) {
        await munimReplayRenderer.dispose?.(artifact); throw new ReplayPreparationError('REPLAY_STALE');
      }
      // Sharing renders a short-lived selected copy. Only the automatic owner
      // Replay is retained across navigation and application restarts.
      if (selectedMemoryKeys) {
        replayArtifacts.current.set(artifact.uri, artifact);
        return { uri: artifact.uri, durationSeconds: artifact.manifest.durationSeconds, renderedMemoryCount: sources.length, omittedMemoryCount: input.memories.length - sources.length, requestIdentity: replayManifestIdentity(manifest), completedTrips: (manifest.chapters ?? []).length, totalTrips: (manifest.chapters ?? []).length };
      }
      const documentDirectory = FileSystem.documentDirectory;
      if (!documentDirectory || !nativeReconstructionRepository.saveReplayPreparedArtifact) {
        await munimReplayRenderer.dispose?.(artifact);
        throw new ReplayPreparationError('REPLAY_UNAVAILABLE');
      }
      diagnostic.enter('REPLAY_OUTPUT');
      const fileKey = `replay-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}.mp4`;
      const directory = `${documentDirectory}replay-previews/`;
      const persistentUri = `${directory}${fileKey}`;
      try {
        diagnostic.enter('REPLAY_OUTPUT_DIRECTORY');
        await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
        diagnostic.enter('REPLAY_OUTPUT_COPY');
        await FileSystem.copyAsync({ from: artifact.uri, to: persistentUri });
        diagnostic.enter('REPLAY_OUTPUT_VERIFY');
        const stored = await FileSystem.getInfoAsync(persistentUri);
        if (!stored.exists || !stored.size) throw new Error('Replay artifact copy failed.');
        diagnostic.enter('REPLAY_OUTPUT_IDENTITY');
        const cacheIdentity = preparedReplayCacheIdentity(input, music);
        if (!cacheIdentity) throw new Error('Replay cache composition is empty.');
        diagnostic.enter('REPLAY_OUTPUT_SAVE');
        await nativeReconstructionRepository.saveReplayPreparedArtifact({ identity: cacheIdentity, cacheVersion: 2, fileKey, durationSeconds: artifact.manifest.durationSeconds, renderedMemoryCount: sources.length, ...(chapterRecords ? { chapters: chapterRecords } : {}) }, input.snapshotToken, input.privacyRevision);
        // A completed CAS makes prior chapter bytes unreachable.  Reclaim only
        // generated basenames after the new record is durable; never resolve an
        // unvalidated draft value as a path.
        diagnostic.enter('REPLAY_OUTPUT_CLEANUP');
        const retained = new Set(chapterRecords?.map((record) => record.fileKey) ?? []);
        await Promise.all((input.preparedArtifact?.chapters ?? [])
          .filter((record) => isReplayCacheFileKey(record.fileKey) && !retained.has(record.fileKey))
          .map((record) => FileSystem.deleteAsync(`${directory}chapters/${record.fileKey}`, { idempotent: true })));
      } catch (error) {
        const failure = diagnostic.failure(error, 'REPLAY_OUTPUT');
        await Promise.allSettled([
          Promise.resolve().then(() => FileSystem.deleteAsync(persistentUri, { idempotent: true })),
          ...createdChapterUris.map(uri => Promise.resolve().then(() => FileSystem.deleteAsync(uri, { idempotent: true }))),
          Promise.resolve().then(() => munimReplayRenderer.dispose?.(artifact)),
        ]);
        throw failure;
      }
      diagnostic.enter('REPLAY_OUTPUT_CLEANUP');
      try { await munimReplayRenderer.dispose?.(artifact); } catch (error) { throw diagnostic.failure(error, 'REPLAY_OUTPUT'); }
      return { uri: persistentUri, durationSeconds: artifact.manifest.durationSeconds, renderedMemoryCount: sources.length, omittedMemoryCount: input.memories.length - sources.length, requestIdentity: replayManifestIdentity(manifest), completedTrips: (manifest.chapters ?? []).length, totalTrips: (manifest.chapters ?? []).length };
    } catch (error) { throw diagnostic.failure(error); }
  }, [adapter, nativeReconstructionRepository, privateRecord.state, privacyRuntime]);
  const saveReplayDraft = useCallback(async (memoryKeys: readonly string[], snapshotToken: number, privacyRevision: number, direction: import('@/replay/types').ReplayDirection, soundtrack?: import('@/replay/types').ReplaySoundtrack, expectedWorkingRevision?: number, includedGroupKeys?: readonly string[], autoGroupKeys?: readonly string[]) => {
    if (privacyRuntime.mutating || privateRecord.state !== 'connected' || !nativeReconstructionRepository.saveReplayDraft || !nativeReconstructionRepository.loadReplayManifestInput) throw new ReplayPreparationError('REPLAY_STALE');
    const correlationId = createDiagnosticCorrelationId();
    recordAppDiagnostic({ operation: 'REPLAY_DRAFT_SAVE', reasonCode: 'START', stage: null, retryable: false, durableOutcome: 'unchanged', correlationId });
    try {
      // The native owned-transaction gate serializes writers and promotes this
      // owner action ahead of queued background work. Waiting for an entire
      // import or maintenance run here made a one-row Replay save look stuck.
      // A development/runtime reload can retain the visible editor while the
      // native repository loses its in-memory opaque key map. Rehydrate that
      // map before this single owner-authorized mutation; this is a preflight,
      // never an automatic replay of a failed save.
      const current = await nativeReconstructionRepository.loadReplayManifestInput();
      if (current.snapshotToken !== snapshotToken || current.privacyRevision !== privacyRevision) throw new ReplayDraftStaleError('Replay draft is stale.', 'scope');
      // The editor session can survive a JavaScript/dev-runtime reload while
      // the native draft's opaque mapping and revision are rehydrated. Commit
      // only if the durable working branch still represents this exact owner
      // choice, then use its durable revision as the CAS baseline. A different
      // working composition remains a genuine conflict and is never replaced.
      let currentWorkingRevision = expectedWorkingRevision;
      if (expectedWorkingRevision !== undefined) {
        if (!replayWorkingDraftMatchesCommitRequest(current, { memoryKeys, snapshotToken, privacyRevision, direction, soundtrack, includedGroupKeys, autoGroupKeys })) throw new ReplayDraftStaleError();
        currentWorkingRevision = current.workingDraft!.revision;
      }
      await nativeReconstructionRepository.saveReplayDraft(memoryKeys, snapshotToken, privacyRevision, direction, soundtrack, currentWorkingRevision, includedGroupKeys, autoGroupKeys);
      const committed = await nativeReconstructionRepository.loadReplayManifestInput();
      if (!replayDraftMatchesCommittedManifest(committed, { memoryKeys, snapshotToken, privacyRevision, direction, soundtrack, includedGroupKeys, autoGroupKeys })) throw new ReplayDraftStaleError();
      recordAppDiagnostic({ operation: 'REPLAY_DRAFT_SAVE', reasonCode: 'COMPLETE', stage: null, retryable: false, durableOutcome: 'complete', correlationId });
    } catch (error) {
      const staleReason = replayDraftStaleReason(error);
      const stage = staleReason ? 'REPLAY_STALE' : 'REPLAY_UNAVAILABLE';
      recordAppDiagnostic({ operation: 'REPLAY_DRAFT_SAVE', reasonCode: staleReason ? replayDraftDiagnosticReason(error) : classifyAppDiagnosticError(error), stage, retryable: true, durableOutcome: 'unchanged', correlationId });
      if (staleReason) throw new ReplayDraftSaveError(staleReason);
      throw new ReplayPreparationError(stage);
    }
  }, [nativeReconstructionRepository, privateRecord.state, privacyRuntime]);
  const stageReplayWorkingDraft = useCallback(async (memoryKeys: readonly string[], snapshotToken: number, privacyRevision: number, direction: import('@/replay/types').ReplayDirection, soundtrack: import('@/replay/types').ReplaySoundtrack, expectedWorkingRevision?: number, includedGroupKeys?: readonly string[], autoGroupKeys?: readonly string[], mutation?: ReplayMutation) => {
    if (privacyRuntime.mutating || privateRecord.state !== 'connected' || !nativeReconstructionRepository.stageReplayWorkingDraft) throw new ReplayPreparationError('REPLAY_STALE');
    const correlationId = createDiagnosticCorrelationId();
    recordAppDiagnostic({ operation: 'REPLAY_DRAFT_SAVE', reasonCode: 'START', stage: null, retryable: false, durableOutcome: 'unchanged', correlationId });
    try {
      // Stage through the native foreground turn rather than waiting for a
      // whole unrelated import/maintenance lifecycle to become idle.
      // Keep native opaque Replay keys alive across a JS/dev-runtime reload
      // before making the one staged owner mutation below.
      // Restore only lost opaque mappings. The caller's CAS stays authoritative:
      // a different durable revision requires explicit owner conflict review.
      if (nativeReconstructionRepository.loadReplayManifestInput && !nativeReconstructionRepository.hasReplayMapping?.(snapshotToken, privacyRevision)) {
        const current = await nativeReconstructionRepository.loadReplayManifestInput();
        if (current.snapshotToken !== snapshotToken || current.privacyRevision !== privacyRevision) throw new ReplayDraftStaleError('Replay draft is stale.', 'scope');
      }
      const revision = await nativeReconstructionRepository.stageReplayWorkingDraft(memoryKeys, snapshotToken, privacyRevision, direction, soundtrack, expectedWorkingRevision, includedGroupKeys, autoGroupKeys, mutation);
      recordAppDiagnostic({ operation: 'REPLAY_DRAFT_SAVE', reasonCode: 'COMPLETE', stage: null, retryable: false, durableOutcome: 'complete', correlationId });
      return revision;
    } catch (error) {
      const staleReason = replayDraftStaleReason(error);
      const stage = staleReason ? 'REPLAY_STALE' : 'REPLAY_UNAVAILABLE';
      recordAppDiagnostic({ operation: 'REPLAY_DRAFT_SAVE', reasonCode: staleReason ? replayDraftDiagnosticReason(error) : classifyAppDiagnosticError(error), stage, retryable: true, durableOutcome: 'unchanged', correlationId });
      if (staleReason) throw new ReplayDraftSaveError(staleReason);
      throw new ReplayPreparationError(stage);
    }
  }, [nativeReconstructionRepository, privateRecord.state, privacyRuntime]);
  const stagePort = useRef(stageReplayWorkingDraft);
  useEffect(() => { stagePort.current = stageReplayWorkingDraft; }, [stageReplayWorkingDraft]);
  const [replayEditSession] = useState(() => new ReplayEditSession((draft, revision, mutation) => stagePort.current(draft.memoryKeys, draft.snapshotToken, draft.privacyRevision, draft.direction, draft.soundtrack, revision, draft.includedGroupKeys, draft.autoGroupKeys.filter((key) => draft.includedGroupKeys.includes(key)), mutation), (error) => replayFailureStage(error) === 'REPLAY_STALE', async (mutation, draft) => {
    if (privacyRuntime.mutating || !durablePublicationRuntime.isConnected || !nativeReconstructionRepository.reconcileReplayMutation) return { kind: 'scope-invalid' };
    return nativeReconstructionRepository.reconcileReplayMutation(mutation, draft.snapshotToken, draft.privacyRevision);
  }));
  const resetReplayDraft = useCallback(async (snapshotToken: number, privacyRevision: number) => {
    if (privacyRuntime.mutating || privateRecord.state !== 'connected' || !nativeReconstructionRepository.resetReplayDraft) throw new ReplayPreparationError('REPLAY_STALE');
    await nativeReconstructionRepository.resetReplayDraft(snapshotToken, privacyRevision);
  }, [nativeReconstructionRepository, privateRecord.state, privacyRuntime]);
  const loadPreparedReplay = useCallback(async (): Promise<ReplayPreparedPreview | null> => {
    if (privacyRuntime.mutating || privateRecord.state !== 'connected') return null;
    if (adapter.accountAuthorized && !await adapter.accountAuthorized()) return null;
    // Use the native provider-only input here, rather than the screen input
    // whose editor previews are intentionally bounded to 48. No source ref
    // leaves this provider.
    if (!nativeReconstructionRepository.loadReplayManifestInput) return null;
    let input: ReplayManifestInput;
    try { input = await nativeReconstructionRepository.loadReplayManifestInput(); } catch { return null; }
    if (privacyRuntime.mutating || privateRecord.state !== 'connected') return null;
    const cached = input.preparedArtifact;
    if (!cached || !FileSystem.documentDirectory) return null;
    const music = input.soundtrack ?? BUNDLED_REPLAY_SOUNDTRACK;
    let identityMatches = cached.identity === preparedReplayCacheIdentity(input, music);
    // Existing installs can reuse an already-rendered v1 artifact once. The
    // compatibility check resolves local handles but never invokes the video
    // renderer; newly saved records use the stable composition key above.
    if (!identityMatches && cached.cacheVersion !== 2 && input.previewSourceRefs && adapter.resolveOwnerPreviews) {
      try {
        const previews = await adapter.resolveOwnerPreviews([...input.previewSourceRefs], input.previewSourceRefs.length);
        identityMatches = cached.identity === legacyPreparedReplayIdentity(input, previews.map((preview) => preview.availability === 'available' && Boolean(preview.uri)), music);
      } catch { identityMatches = false; }
    }
    if (!identityMatches) return null;
    if (!isReplayCacheFileKey(cached.fileKey)) return null;
    const uri = `${FileSystem.documentDirectory}replay-previews/${cached.fileKey}`;
    const file = await FileSystem.getInfoAsync(uri);
    if (!file.exists || !file.size || !(await verifyReplayOutput(uri, cached.durationSeconds, Boolean(music)))) return null;
    if (adapter.accountAuthorized && !await adapter.accountAuthorized()) return null;
    return { uri, durationSeconds: cached.durationSeconds, renderedMemoryCount: cached.renderedMemoryCount, omittedMemoryCount: input.memories.length - cached.renderedMemoryCount };
  }, [adapter, nativeReconstructionRepository, privateRecord.state, privacyRuntime]);
  const exportPrivateReplay = useCallback(async (uri: string) => {
    if (recognizableArtifacts.current.has(uri)) {
      recordAppDiagnostic({ operation: 'REPLAY_EXPORT', stage: 'REPLAY_HANDOFF', reasonCode: 'ACCESS',
        retryable: false, durableOutcome: 'blocked', correlationId: createDiagnosticCorrelationId() });
      throw new ReplayPreparationError('REPLAY_ACCESS');
    }
    const artifact = replayArtifacts.current.get(uri);
    if (privacyRuntime.mutating || privateRecord.state !== 'connected') throw new ReplayPreparationError('REPLAY_STALE');
    // The share sheet is an external boundary. Refresh access immediately
    // before handing it a temporary video; a preview prepared before a denied
    // or revoked permission must not remain exportable.
    let permission: import('./types').PermissionSnapshot | null;
    try { permission = await adapter.inspect(); } catch { throw new ReplayPreparationError('REPLAY_ACCESS'); }
    const accountAuthorized = adapter.accountAuthorized ? await adapter.accountAuthorized() : false;
    if ((!accountAuthorized && (!permission || (permission.scope !== 'full' && permission.scope !== 'limited'))) || privacyRuntime.mutating || privateRecord.state !== 'connected') throw new ReplayPreparationError('REPLAY_STALE');
    let input: import('@/replay/types').ReplayManifestInput;
    try { input = nativeReconstructionRepository.loadReplayManifestInput ? await nativeReconstructionRepository.loadReplayManifestInput() : (() => { throw new ReplayPreparationError('REPLAY_STALE'); })(); } catch (error) { throw error instanceof ReplayPreparationError ? error : new ReplayPreparationError('REPLAY_ACCESS'); }
    if (privacyRuntime.mutating || privateRecord.state !== 'connected' || !input.previewSourceRefs) throw new ReplayPreparationError('REPLAY_STALE');
    let previews: OwnerPreview[];
    try { previews = adapter.resolveOwnerPreviews ? await adapter.resolveOwnerPreviews([...input.previewSourceRefs], input.previewSourceRefs.length) : []; } catch { throw new ReplayPreparationError('REPLAY_ACCESS'); }
    const included = new Set(replayCompositionGroups(input).filter((group) => group.eligible).map((group) => group.key));
    const currentMemories = new Map(input.memories.filter((memory, index) => memory.eligible && included.has(memory.groupKey) && previews[index]?.availability === 'available' && Boolean(previews[index]?.uri)).map((memory) => [memory.key, memory]));
    if (artifact && (artifact.manifest.groupKeys.some((key) => !included.has(key)) || artifact.manifest.memoryKeys.some((key) => {
      const memory = currentMemories.get(key); return !memory || !artifact.manifest.groupKeys.includes(memory.groupKey);
    }))) throw new ReplayPreparationError('REPLAY_STALE');
    if (artifact) return shareReplayArtifact(artifact);
    let file: { exists: boolean; size?: number };
    try { file = await FileSystem.getInfoAsync(uri); } catch { throw new ReplayPreparationError('REPLAY_OUTPUT'); }
    if (!file.exists || !file.size) throw new ReplayPreparationError('REPLAY_OUTPUT');
    // Recover the committed soundtrack before validation. A persisted Replay
    // may legitimately carry its one AAC track; treating every reopened
    // artifact as silent blocks a valid owner Replay at the share boundary.
    const music = input.soundtrack ?? BUNDLED_REPLAY_SOUNDTRACK;
    // The sharing boundary uses only the local path. The synthetic manifest is
    // intentionally not persisted, logged, or used for planning.
    return shareReplayArtifact({ uri, digest: 'prepared', manifest: { generation: 0, music, groupKeys: [], memoryKeys: [], durationSeconds: 0 } });
  }, [adapter, nativeReconstructionRepository, privateRecord.state, privacyRuntime]);
  const discardPrivateReplay = useCallback(async (uri: string, options?: { preserveFile?: boolean }) => {
    // Re-render invalidates the controller immediately, but its last verified
    // durable video stays playable until a replacement succeeds.
    replayController.current.invalidate();
    if (options?.preserveFile) return;
    const artifact = replayArtifacts.current.get(uri);
    replayArtifacts.current.delete(uri);
    // The renderer keeps its own exact-manifest in-memory result. Invalidate
    // it even when `uri` is a durable copy so Re-render cannot reuse it.
    if (artifact) await munimReplayRenderer.dispose?.(artifact);
    else await FileSystem.deleteAsync(uri, { idempotent: true });
  }, []);
  const saveConfiguredHomeArea = useCallback(async (displayId: string, visitId: string, ownerLabel: string, effectiveStartDay: string | null, effectiveEndDay: string | null) => {
    if (privateRecord.state !== 'connected') throw new Error('Private record is unavailable.');
    await nativeReconstructionRepository.saveConfiguredHomeAreaFromJourney(displayId, `home:${displayId}:${visitId}`, visitId, ownerLabel, effectiveStartDay, effectiveEndDay);
    durableRevealGate.invalidate();
    setDurableReveal(null);
    const projection = await reconstructionController.rebuild();
    if (projection.status !== 'complete') throw new Error('Home base saved but local history rebuild did not complete.');
    await refreshDurableReveal();
    await refreshHomeBases();
  }, [durableRevealGate, nativeReconstructionRepository, privateRecord.state, reconstructionController, refreshDurableReveal, refreshHomeBases]);
  const saveDirectHome = useCallback(async (area: import('@/import-record/types').ConfiguredHomeArea, replacing?: string) => {
    const operation = 'ONBOARDING_SETUP';
    const correlationId = createDiagnosticCorrelationId();
    const current = () => durablePublicationRuntime.isConnected && !privacyRuntime.mutating && !controller.isAccountRecord;
    if (!current() || !sharedRepository.saveConfiguredHomeArea || !sharedRepository.loadConfiguredHomeAreas) {
      recordAppDiagnostic({ operation, stage: 'HOME_SCOPE', reasonCode: 'LIFECYCLE', retryable: false, durableOutcome: 'blocked', correlationId });
      throw new Error('Home editing is unavailable in this history.');
    }
    const read = sharedRepository.loadConfiguredHomeAreas.bind(sharedRepository);
    let stage: 'HOME_SCOPE' | 'HOME_COMMAND_COMMIT' | 'HOME_COMMAND_READBACK' = 'HOME_SCOPE';
    let committed = false;
    let stale = false;
    try {
      const prior = (await read()).find((home) => home.id === (replacing ?? area.id));
      if (!current() || (replacing && !prior)) {
        stale = true;
        throw new Error('Home editing is unavailable in this history.');
      }
      const expected = prior ? { ...area, id: prior.id, radiusMeters: prior.radiusMeters } : area;
      const matches = (home: typeof area | undefined) => home?.id === expected.id && home.label === expected.label
        && home.origin === expected.origin && home.latitude === expected.latitude && home.longitude === expected.longitude
        && home.radiusMeters === expected.radiusMeters && home.effectiveStartDay === expected.effectiveStartDay
        && home.effectiveEndDay === expected.effectiveEndDay;
      stage = 'HOME_COMMAND_COMMIT';
      if (!matches(prior)) await sharedRepository.saveConfiguredHomeArea(expected);
      committed = true;
      durableRevealGate.invalidate();
      setDurableReveal(null);
      stage = 'HOME_COMMAND_READBACK';
      const areas = await read();
      if (!current() || !matches(areas.find((home) => home.id === expected.id))) {
        stale = true;
        throw new Error('Home area could not be verified.');
      }
      setHomeBases(areas.map(({ id, label, origin, effectiveStartDay, effectiveEndDay, radiusMeters }) => ({ id, label, origin, effectiveStartDay, effectiveEndDay, radiusMeters })));
    } catch (error) {
      recordAppDiagnostic({ operation, stage, reasonCode: stale ? 'HISTORY_STALE' : classifyAppDiagnosticError(error),
        retryable: !stale || committed, durableOutcome: committed ? 'complete' : stage === 'HOME_SCOPE' ? 'unchanged' : 'unknown', correlationId });
      throw new Error('Home area could not be verified.');
    }
    const result = await reconstructionController.rebuild(correlationId);
    if (result.status !== 'complete') throw new Error('Home saved. Retry the Atlas rebuild.');
    try { await refreshDurableReveal(async () => current()); }
    catch (error) {
      const active = current();
      recordAppDiagnostic({ operation: 'ATLAS_DURABLE_READ', stage: durableRevealFailureStage(error) ?? 'DURABLE_PROJECTION',
        reasonCode: active ? classifyAppDiagnosticError(error) : 'HISTORY_STALE', retryable: active, durableOutcome: 'unchanged', correlationId });
      if (active) setReconstruction((previous) => ({ ...previous, status: 'error', message: 'The updated Atlas could not be read. Try again when ready.' }));
      throw new Error('Home saved. Retry the Atlas rebuild.');
    }
  }, [controller, durablePublicationRuntime, durableRevealGate, privacyRuntime, reconstructionController, refreshDurableReveal, sharedRepository]);
  const renameConfiguredHomeArea = useCallback(async (id: string, ownerLabel: string) => {
    if (privateRecord.state !== 'connected' || !sharedRepository.renameConfiguredHomeArea) throw new Error('Home base is unavailable.');
    await sharedRepository.renameConfiguredHomeArea(id, ownerLabel);
    await refreshHomeBases();
  }, [privateRecord.state, sharedRepository, refreshHomeBases]);
  const removeConfiguredHomeArea = useCallback(async (id: string) => {
    if (privateRecord.state !== 'connected' || !sharedRepository.deleteConfiguredHomeArea) throw new Error('Home base is unavailable.');
    // H-4: at least one Home base is required, because nothing learns it.
    // Enforced here (the shared choke point every Home-removal UI calls
    // through), not in the repository: a real SQLite test deliberately
    // drives `deleteConfiguredHomeArea` to zero Home areas to exercise
    // `hasPendingHomeProjection`, so that layer stays permissive.
    if (homeBases.length <= 1) throw new Error('At least one Home base is required.');
    await sharedRepository.deleteConfiguredHomeArea(id);
    durableRevealGate.invalidate();
    setDurableReveal(null);
    await refreshHomeBases();
    const projection = await reconstructionController.rebuild();
    if (projection.status !== 'complete') throw new Error('Home base removed but local history rebuild did not complete.');
    await refreshDurableReveal();
  }, [durableRevealGate, privateRecord.state, sharedRepository, homeBases, refreshHomeBases, reconstructionController, refreshDurableReveal]);
  return <PhotoAccessContext.Provider value={{ snapshot, controller, importCoverage, privateRecord, privateRecordController, maintenance, maintenanceController, reconciliation, catchUpHistory, reconstruction, durableReveal, reviewJourneyPrivacy, saveJourneyPrivacy, loadJourneyPrivacyPolicies, restoreJourneyPrivacy, loadJourneyEligibility, loadReplayManifestInput, loadReplayEditorPreviewPage, loadPreparedReplay, replayEditSession, saveReplayDraft, stageReplayWorkingDraft, resetReplayDraft, preparePrivateReplay, exportPrivateReplay, discardPrivateReplay, findManualJourneyOverlaps, createManualJourney, removeManualJourney, homeBases, loadJourneyDetail, loadJourneyMediaPage, inspectJourneyMedia, loadRecognizableShadowPreview, loadRecognizableReveal, readRecognizableTrip, playRecognizableTrip, discardRecognizableTripPreview, reviewRecognizableTrip, loadUncertainMemories, loadPossibleTrips, confirmTimelineMerge, saveJourneyCorrection, saveJourneyMemoryCorrection, discardJourneyCorrectionPending, retryJourneyCorrectionProjection, saveConfiguredHomeArea, saveDirectHome, renameConfiguredHomeArea, removeConfiguredHomeArea, reconstructionController, aiReview, aiProposalController, visualDiscovery, travelWindowDiscovery }}>{children}</PhotoAccessContext.Provider>;
}

export function usePhotoAccess() {
  const value = useContext(PhotoAccessContext);
  if (!value) throw new Error('PhotoAccessProvider is required');
  return value;
}
