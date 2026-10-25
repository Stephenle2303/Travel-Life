import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';

import { HistoryRecordController, type LifecycleSnapshot } from '@/history-record';
import { PhotoAccessController, initialPhotoAccess } from './controller';
import { nativePhotoAccess } from './native-adapter';
import type { OwnerPreview, PhotoAccessAdapter, PhotoAccessSnapshot } from './types';
import { createNativeImportRepository, type ImportCoverage, type ImportRepository, type MaintenanceRepository, type ReconciliationSnapshot, type ManualJourneyInput } from '@/import-record';
import { MaintenanceController, createExpoScheduler, type MaintenanceView } from '@/maintenance';
import { createNativeReconstructionRepository, ReconstructionController, type ReconstructionView } from '@/reconstruction';
import { durableRevealFailureStage } from '@/reconstruction/repository';
import { AiProposalController, type AiReviewView } from '@/ai';
import { classifyAppDiagnosticError, createDiagnosticCorrelationId, recordAppDiagnostic } from '@/diagnostics/app-diagnostics';
import type { DurableRevealRecord, JourneyDetail, JourneyMediaPage } from '@/reveal/types';
import type { JourneyPrivacyReview, JourneyPrivacyPolicy } from '@/history-record/privacy';
import { createExportManifest, orderedReplayGroups, planPrivateReplay } from '@/replay/selection';
import { ReplayController, replayManifestIdentity } from '@/replay/controller';
import { ReplayDraftStaleError } from '@/replay/draft-error';
import { munimReplayRenderer, ReplayPreparationError, shareReplayArtifact, verifyReplayOutput, type ReplayArtifact, type ReplayRenderProgress } from '@/replay/renderer';
import type { ReplayManifestInput, ReplayPreparedPreview, ReplayRenderSource, ReplaySoundtrack } from '@/replay/types';
import * as FileSystem from 'expo-file-system/legacy';

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
  loadReplayManifestInput(): Promise<import('@/replay/types').ReplayManifestInput>;
  loadReplayEditorPreviewPage(memoryKeys: readonly string[], snapshotToken: number, privacyRevision: number): Promise<readonly { key: string; available: boolean; previewUri?: string }[]>;
  loadPreparedReplay(): Promise<ReplayPreparedPreview | null>;
  saveReplayDraft(memoryKeys: readonly string[], snapshotToken: number, privacyRevision: number, direction: import('@/replay/types').ReplayDirection, soundtrack?: import('@/replay/types').ReplaySoundtrack, expectedWorkingRevision?: number, includedGroupKeys?: readonly string[], autoGroupKeys?: readonly string[]): Promise<void>;
  stageReplayWorkingDraft(memoryKeys: readonly string[], snapshotToken: number, privacyRevision: number, direction: import('@/replay/types').ReplayDirection, soundtrack: import('@/replay/types').ReplaySoundtrack, expectedWorkingRevision?: number, includedGroupKeys?: readonly string[], autoGroupKeys?: readonly string[]): Promise<number>;
  resetReplayDraft(snapshotToken: number, privacyRevision: number): Promise<void>;
  preparePrivateReplay(selectedMemoryKeys?: readonly string[], onProgress?: ReplayRenderProgress, music?: import('@/replay/types').ReplaySoundtrack): Promise<ReplayPreparedPreview>;
  exportPrivateReplay(uri: string): Promise<'unavailable' | 'closed'>;
  discardPrivateReplay(uri: string): Promise<void>;
  findManualJourneyOverlaps(input: ManualJourneyInput): Promise<{ id: string; label: string; editable: boolean }[]>;
  createManualJourney(input: ManualJourneyInput): Promise<string>;
  loadJourneyDetail(displayId: string): Promise<{ detail: JourneyDetail; previews: OwnerPreview[]; snapshotToken: number }>;
  loadJourneyMediaPage?(displayId: string, snapshotToken: number, page: number): Promise<{ page: JourneyMediaPage; previews: OwnerPreview[] }>;
  loadUncertainMemories(displayId: string, snapshotToken: number, query: string, page: number): Promise<{ memories: { id: string; capturedDay: string | null; availability: 'available' | 'unavailable' | 'unknown'; locationState: string; association: string; membershipState: 'suggested' | 'primary' | 'unassigned' | 'rejected' }[]; hasMore: boolean }>;
  saveJourneyCorrection(displayId: string, action: 'confirm' | 'reject' | 'claim' | 'place' | 'split' | 'merge' | 'remove-visit', snapshotToken: number, snapshot: JourneyDetail, commandKey: string, payload?: NonNullable<JourneyDetail['ownerClaim']> | NonNullable<JourneyDetail['ownerPlace']> | { afterVisitId: string } | { withJourneyId: string } | { visitId: string }): Promise<'applied' | 'pending'>;
  saveJourneyMemoryCorrection(displayId: string, memoryId: string, action: 'assign' | 'move' | 'reject' | 'unassign', snapshotToken: number, commandKey: string): Promise<'applied' | 'pending'>;
  discardJourneyCorrectionPending(displayId: string, snapshotToken: number, commandKey: string): Promise<'applied' | 'pending'>;
  retryJourneyCorrectionProjection(): Promise<boolean>;
  homeBases: { id: string; label: string | null; origin: 'observed-area' | 'legacy'; effectiveStartDay: string | null; effectiveEndDay: string | null; radiusMeters: number }[];
  saveConfiguredHomeArea(displayId: string, visitId: string, ownerLabel: string, effectiveStartDay: string | null, effectiveEndDay: string | null): Promise<void>;
  renameConfiguredHomeArea(id: string, ownerLabel: string): Promise<void>;
  removeConfiguredHomeArea(id: string): Promise<void>;
  reconstructionController: ReconstructionController;
  aiReview: AiReviewView;
  aiProposalController: AiProposalController;
};

type OptionalRepositoryMethods = 'findManualJourneyOverlaps' | 'createManualJourney' | 'reviewJourneyPrivacy' | 'saveJourneyPrivacy' | 'loadJourneyPrivacyPolicies' | 'restoreJourneyPrivacy' | 'loadJourneyEligibility' | 'loadReplayManifestInput' | 'loadReplayEditorPreviewPage' | 'saveReplayDraft' | 'stageReplayWorkingDraft' | 'resetReplayDraft' | 'saveReplayPreparedArtifact' | 'applyJourneyPrivacyToRecord';
type ReconstructionRepositoryProp = Omit<ReturnType<typeof createNativeReconstructionRepository>, OptionalRepositoryMethods>
  & Partial<Pick<ReturnType<typeof createNativeReconstructionRepository>, OptionalRepositoryMethods>>;

/** Opening Edit must not decode every candidate original before the owner can act. */
const REPLAY_EDITOR_INITIAL_PREVIEW_LIMIT = 48;
const BUNDLED_REPLAY_SOUNDTRACK: ReplaySoundtrack = { kind: 'bundled', revision: 'happy-moments-1.4' };

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

export function PhotoAccessProvider({ children, adapter = nativePhotoAccess, repository, reconstructionRepository }: PropsWithChildren<{ adapter?: PhotoAccessAdapter; repository?: ImportRepository; reconstructionRepository?: ReconstructionRepositoryProp }>) {
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
  const replayArtifacts = useRef(new Map<string, ReplayArtifact>());
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
  } : createNativeReconstructionRepository());
  const [durablePublicationRuntime] = useState(() => new DurablePublicationRuntime());
  const refreshDurableReveal = useCallback(async () => {
    if (!durablePublicationRuntime.isConnected || privacyRuntime.mutating) throw new Error('Private record is unavailable.');
    const generation = durableRevealGate.next();
    const record = await nativeReconstructionRepository.loadDurableReveal();
    if (!durablePublicationRuntime.isConnected || privacyRuntime.mutating || !canPublishJourneyDetail(generation, durableRevealGate.current(), 'connected')) throw new Error('Private record is unavailable.');
    setDurableReveal(record);
  }, [durablePublicationRuntime, durableRevealGate, nativeReconstructionRepository, privacyRuntime]);
  useEffect(() => {
    durablePublicationRuntime.setLifecycle(privateRecord.state);
  }, [durablePublicationRuntime, privateRecord.state]);
  useEffect(() => {
    if (privateRecord.state !== 'connected') void clearReplayArtifacts();
  }, [clearReplayArtifacts, privateRecord.state]);
  const [reconstructionController] = useState(() => new ReconstructionController(nativeReconstructionRepository, (view) => {
    setReconstruction(view);
  }));
  const currentSourcePermitted = async () => {
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
  const [controller] = useState(() => new PhotoAccessController(adapter, setSnapshot, setImportCoverage, sharedRepository, async () => {
    // Import completion makes the owner control available; it never enables it.
    await maintenanceController.refresh();
    const result = await reconstructionController.rebuild();
    if (result.status !== 'complete') return false;
    await refreshDurableReveal();
    return true;
  }, () => maintenanceController.whenIdle()));
  const [privateRecordController] = useState(() => new HistoryRecordController(
    sharedRepository,
    async () => { durableRevealGate.invalidate(); await controller.stopImport(); await maintenanceController.stopForLifecycle(); reconstructionController.clear(); setDurableReveal(null); aiProposalController.clear(); },
    setPrivateRecord,
    () => controller.clearDeletedRecord(),
  ));

  useEffect(() => {
    const currentReplayController = replayController.current;
    const currentReplayArtifacts = replayArtifacts.current;
    void controller.refresh();
    void privateRecordController.refresh();
    void maintenanceController.refresh();
    if (durableMaintenanceRepository.loadReconciliation) void durableMaintenanceRepository.loadReconciliation().then(setReconciliation).catch((error) => {
      recordAppDiagnostic({ operation: 'MAINTENANCE_RECONCILIATION', reasonCode: classifyAppDiagnosticError(error), stage: null, retryable: true, durableOutcome: 'failed', correlationId: createDiagnosticCorrelationId() });
      setReconciliation((current) => ({ ...current, status: 'error', message: 'Local update status could not be read. Retry when ready.' }));
    });
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void controller.refresh(!controller.isBusy);
        void privateRecordController.refresh();
        void maintenanceController.catchUp();
      }
      else controller.interrupt();
    });
    return () => {
      controller.interrupt();
      subscription?.remove();
      currentReplayController.cancel();
      const artifacts = [...currentReplayArtifacts.values()];
      currentReplayArtifacts.clear();
      void Promise.all(artifacts.map((artifact) => munimReplayRenderer.dispose?.(artifact)));
    };
  }, [controller, privateRecordController, maintenanceController, durableMaintenanceRepository]);

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
  const loadJourneyDetail = useCallback(async (displayId: string) => {
    const generation = durableRevealGate.next();
    const result = await nativeReconstructionRepository.loadJourneyDetail(displayId);
    if (privacyRuntime.mutating || !canPublishJourneyDetail(generation, durableRevealGate.current(), privateRecord.state)) throw new Error('Journey is no longer available.');
    // Preserve placeholder slots: JourneyDetailScreen pairs previews with memories
    // by index, and a missing first asset must not shift a later preview upward.
    const previews = adapter.resolveOwnerPreviews ? await adapter.resolveOwnerPreviews(result.previewSourceRefs, 4) : [];
    if (privacyRuntime.mutating || !canPublishJourneyDetail(generation, durableRevealGate.current(), privateRecord.state)) throw new Error('Journey is no longer available.');
    return { detail: result.detail, previews, snapshotToken: result.snapshotToken };
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
  const loadJourneyMediaPage = useCallback(async (displayId: string, snapshotToken: number, page: number) => {
    const generation = durableRevealGate.next();
    const result = await nativeReconstructionRepository.loadJourneyMediaPage(displayId, snapshotToken, page);
    if (privacyRuntime.mutating || !canPublishJourneyDetail(generation, durableRevealGate.current(), privateRecord.state)) throw new Error('Gallery is no longer available.');
    const previews = adapter.resolveOwnerPreviews ? await adapter.resolveOwnerPreviews(result.previewSourceRefs, result.previewSourceRefs.length) : [];
    if (privacyRuntime.mutating || !canPublishJourneyDetail(generation, durableRevealGate.current(), privateRecord.state)) throw new Error('Gallery is no longer available.');
    return { page: { items: result.items, hasMore: result.hasMore }, previews };
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
  const loadUncertainMemories = useCallback(async (displayId: string, snapshotToken: number, query: string, page: number) => {
    if (privacyRuntime.mutating || privateRecord.state !== 'connected') throw new Error('Private record is unavailable.');
    const generation = durableRevealGate.current();
    const result = await nativeReconstructionRepository.loadUncertainMemories(displayId, snapshotToken, query, page);
    if (privacyRuntime.mutating || !canPublishJourneyDetail(generation, durableRevealGate.current(), privateRecord.state)) throw new Error('Memory review is no longer available.');
    return result;
  }, [durableRevealGate, nativeReconstructionRepository, privateRecord.state, privacyRuntime]);
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
    durableRevealGate.invalidate(); privacyRuntime.mutating = true;
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
  const loadReplayManifestInput = useCallback(async () => {
    if (privacyRuntime.mutating || !nativeReconstructionRepository.loadReplayManifestInput) return { snapshotToken: 0, privacyRevision: 0, groups: [], memories: [] };
    let result: import('@/replay/types').ReplayManifestInput;
    try {
      result = await nativeReconstructionRepository.loadReplayManifestInput();
    } catch {
      // This is the screen's first Replay boundary. Keep native/SQLite details
      // in memory and report the closed local-access outcome to the screen.
      throw new ReplayPreparationError('REPLAY_ACCESS');
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
      previews = await adapter.resolveOwnerPreviews([...initialReferences], initialReferences.length);
    } catch {
      throw new ReplayPreparationError('REPLAY_ACCESS');
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
  }, [adapter, nativeReconstructionRepository, privateRecord.state, privacyRuntime]);
  const loadReplayEditorPreviewPage = useCallback(async (memoryKeys: readonly string[], snapshotToken: number, privacyRevision: number) => {
    if (memoryKeys.length > REPLAY_EDITOR_INITIAL_PREVIEW_LIMIT || privacyRuntime.mutating || privateRecord.state !== 'connected' || !nativeReconstructionRepository.loadReplayEditorPreviewPage || !adapter.resolveOwnerPreviews) throw new ReplayPreparationError('REPLAY_STALE');
    let page: { keys: readonly string[]; previewSourceRefs: readonly (string | null)[] };
    try { page = await nativeReconstructionRepository.loadReplayEditorPreviewPage(memoryKeys, snapshotToken, privacyRevision); } catch { throw new ReplayPreparationError('REPLAY_ACCESS'); }
    let previews: OwnerPreview[];
    try { previews = await adapter.resolveOwnerPreviews([...page.previewSourceRefs], page.previewSourceRefs.length); } catch { throw new ReplayPreparationError('REPLAY_ACCESS'); }
    if (privacyRuntime.mutating || privateRecord.state !== 'connected') throw new ReplayPreparationError('REPLAY_STALE');
    return page.keys.map((key, index) => ({ key, available: previews[index]?.availability === 'available', ...(previews[index]?.uri ? { previewUri: previews[index]!.uri } : {}) }));
  }, [adapter, nativeReconstructionRepository, privateRecord.state, privacyRuntime]);
  const preparePrivateReplay = useCallback(async (selectedMemoryKeys?: readonly string[], onProgress?: ReplayRenderProgress, music: ReplaySoundtrack = BUNDLED_REPLAY_SOUNDTRACK): Promise<ReplayPreparedPreview> => {
    if (privacyRuntime.mutating || privateRecord.state !== 'connected') throw new ReplayPreparationError('REPLAY_STALE');
    if (!nativeReconstructionRepository.loadReplayManifestInput || !adapter.resolveOwnerPreviews) throw new ReplayPreparationError('REPLAY_ACCESS');
    let input: import('@/replay/types').ReplayManifestInput;
    try {
      input = await nativeReconstructionRepository.loadReplayManifestInput();
    } catch {
      // The manifest reader touches the current private record only. Its
      // native failure is an access failure, never a renderer availability
      // verdict; the original exception stays in memory.
      throw new ReplayPreparationError('REPLAY_ACCESS');
    }
    if (privacyRuntime.mutating || privateRecord.state !== 'connected' || !input.previewSourceRefs) throw new ReplayPreparationError('REPLAY_STALE');
    let previews: OwnerPreview[];
    try {
      previews = await adapter.resolveOwnerPreviews([...input.previewSourceRefs], input.previewSourceRefs.length);
    } catch {
      // Keep the failing provider/native message out of UI and diagnostics.
      throw new ReplayPreparationError('REPLAY_ACCESS');
    }
    if (privacyRuntime.mutating || privateRecord.state !== 'connected') throw new ReplayPreparationError('REPLAY_STALE');
    const memories = input.memories.map((memory, index) => ({ ...memory, available: previews[index]?.availability === 'available' && Boolean(previews[index]?.uri) }));
    const direction = input.direction ?? 'oldest-first';
    const compositionGroups = replayCompositionGroups(input);
    const automaticPlan = planPrivateReplay(compositionGroups, memories, undefined, direction, input.autoGroupKeys);
    const selectedKeys = selectedMemoryKeys ? [...new Set(selectedMemoryKeys)] : automaticPlan.memories.map((memory) => memory.key);
    const selectedSet = new Set(selectedKeys);
    const selectedMemories = selectedKeys.map((key) => memories.find((memory) => memory.key === key)).filter((memory): memory is typeof memories[number] => Boolean(memory));
    // Automatic Replay keeps each visible Journey List item, including a
    // qualified trip whose current album has no usable media. The renderer
    // emits a neutral local slate for that group. Explicit sharing stays
    // exact-media-only and is rejected before it can render an empty export.
    const selectedGroups = selectedMemoryKeys
      ? orderedReplayGroups(compositionGroups, undefined, direction).filter((group) => selectedMemories.some((memory) => memory.groupKey === group.key))
      : automaticPlan.groups;
    if (!selectedGroups.length || selectedMemories.length !== selectedSet.size || (selectedMemoryKeys && !selectedMemories.length)) throw new ReplayPreparationError('REPLAY_ACCESS');
    const sources: ReplayRenderSource[] = selectedMemories.flatMap((memory) => {
      const index = input.memories.findIndex((candidate) => candidate.key === memory.key);
      const preview = previews[index];
      return preview?.uri ? [{ memoryKey: memory.key, groupKey: memory.groupKey, kind: preview.kind, uri: preview.uri }] : [];
    });
    if (sources.length !== selectedMemories.length) throw new ReplayPreparationError('REPLAY_ACCESS');
    const manifest = { ...createExportManifest(input.snapshotToken, selectedGroups, selectedMemories, direction), music };
    const artifact = await replayController.current.prepare(manifest, sources, onProgress);
    if (privacyRuntime.mutating || privateRecord.state !== 'connected') {
      await munimReplayRenderer.dispose?.(artifact); throw new ReplayPreparationError('REPLAY_STALE');
    }
    // Sharing renders a short-lived selected copy. Only the automatic owner
    // Replay is retained across navigation and application restarts.
    if (selectedMemoryKeys) {
      replayArtifacts.current.set(artifact.uri, artifact);
      return { uri: artifact.uri, durationSeconds: artifact.manifest.durationSeconds, renderedMemoryCount: sources.length, omittedMemoryCount: input.memories.length - sources.length };
    }
    const documentDirectory = FileSystem.documentDirectory;
    if (!documentDirectory || !nativeReconstructionRepository.saveReplayPreparedArtifact) {
      await munimReplayRenderer.dispose?.(artifact);
      throw new ReplayPreparationError('REPLAY_UNAVAILABLE');
    }
    const fileKey = `replay-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}.mp4`;
    const directory = `${documentDirectory}replay-previews/`;
    const persistentUri = `${directory}${fileKey}`;
    try {
      await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
      await FileSystem.copyAsync({ from: artifact.uri, to: persistentUri });
      const stored = await FileSystem.getInfoAsync(persistentUri);
      if (!stored.exists || !stored.size) throw new Error('Replay artifact copy failed.');
      const cacheIdentity = preparedReplayCacheIdentity(input, music);
      if (!cacheIdentity) throw new Error('Replay cache composition is empty.');
      await nativeReconstructionRepository.saveReplayPreparedArtifact({ identity: cacheIdentity, cacheVersion: 2, fileKey, durationSeconds: artifact.manifest.durationSeconds, renderedMemoryCount: sources.length }, input.snapshotToken, input.privacyRevision);
    } catch {
      await FileSystem.deleteAsync(persistentUri, { idempotent: true });
      await munimReplayRenderer.dispose?.(artifact);
      throw new ReplayPreparationError('REPLAY_OUTPUT');
    }
    await munimReplayRenderer.dispose?.(artifact);
    return { uri: persistentUri, durationSeconds: artifact.manifest.durationSeconds, renderedMemoryCount: sources.length, omittedMemoryCount: input.memories.length - sources.length };
  }, [adapter, nativeReconstructionRepository, privateRecord.state, privacyRuntime]);
  const saveReplayDraft = useCallback(async (memoryKeys: readonly string[], snapshotToken: number, privacyRevision: number, direction: import('@/replay/types').ReplayDirection, soundtrack?: import('@/replay/types').ReplaySoundtrack, expectedWorkingRevision?: number, includedGroupKeys?: readonly string[], autoGroupKeys?: readonly string[]) => {
    if (privacyRuntime.mutating || privateRecord.state !== 'connected' || !nativeReconstructionRepository.saveReplayDraft) throw new ReplayPreparationError('REPLAY_STALE');
    const correlationId = createDiagnosticCorrelationId();
    recordAppDiagnostic({ operation: 'REPLAY_DRAFT_SAVE', reasonCode: 'START', stage: null, retryable: false, durableOutcome: 'unchanged', correlationId });
    try {
      // Replay is an owner action, but it shares the local database with
      // foreground import and scheduled maintenance. Let their writer finish
      // instead of competing for SQLite's process-wide write lock.
      await controller.whenImportIdle();
      await maintenanceController.whenIdle();
      await nativeReconstructionRepository.saveReplayDraft(memoryKeys, snapshotToken, privacyRevision, direction, soundtrack, expectedWorkingRevision, includedGroupKeys, autoGroupKeys);
      recordAppDiagnostic({ operation: 'REPLAY_DRAFT_SAVE', reasonCode: 'COMPLETE', stage: null, retryable: false, durableOutcome: 'complete', correlationId });
    } catch (error) {
      const stage = error instanceof ReplayDraftStaleError ? 'REPLAY_STALE' : 'REPLAY_UNAVAILABLE';
      recordAppDiagnostic({ operation: 'REPLAY_DRAFT_SAVE', reasonCode: error instanceof ReplayDraftStaleError ? 'SAVE_FAILED' : classifyAppDiagnosticError(error), stage, retryable: true, durableOutcome: 'unchanged', correlationId });
      throw new ReplayPreparationError(stage);
    }
  }, [controller, maintenanceController, nativeReconstructionRepository, privateRecord.state, privacyRuntime]);
  const stageReplayWorkingDraft = useCallback(async (memoryKeys: readonly string[], snapshotToken: number, privacyRevision: number, direction: import('@/replay/types').ReplayDirection, soundtrack: import('@/replay/types').ReplaySoundtrack, expectedWorkingRevision?: number, includedGroupKeys?: readonly string[], autoGroupKeys?: readonly string[]) => {
    if (privacyRuntime.mutating || privateRecord.state !== 'connected' || !nativeReconstructionRepository.stageReplayWorkingDraft) throw new ReplayPreparationError('REPLAY_STALE');
    const correlationId = createDiagnosticCorrelationId();
    recordAppDiagnostic({ operation: 'REPLAY_DRAFT_SAVE', reasonCode: 'START', stage: null, retryable: false, durableOutcome: 'unchanged', correlationId });
    try {
      await controller.whenImportIdle();
      await maintenanceController.whenIdle();
      const revision = await nativeReconstructionRepository.stageReplayWorkingDraft(memoryKeys, snapshotToken, privacyRevision, direction, soundtrack, expectedWorkingRevision, includedGroupKeys, autoGroupKeys);
      recordAppDiagnostic({ operation: 'REPLAY_DRAFT_SAVE', reasonCode: 'COMPLETE', stage: null, retryable: false, durableOutcome: 'complete', correlationId });
      return revision;
    } catch (error) {
      const stage = error instanceof ReplayDraftStaleError ? 'REPLAY_STALE' : 'REPLAY_UNAVAILABLE';
      recordAppDiagnostic({ operation: 'REPLAY_DRAFT_SAVE', reasonCode: error instanceof ReplayDraftStaleError ? 'SAVE_FAILED' : classifyAppDiagnosticError(error), stage, retryable: true, durableOutcome: 'unchanged', correlationId });
      throw new ReplayPreparationError(stage);
    }
  }, [controller, maintenanceController, nativeReconstructionRepository, privateRecord.state, privacyRuntime]);
  const resetReplayDraft = useCallback(async (snapshotToken: number, privacyRevision: number) => {
    if (privacyRuntime.mutating || privateRecord.state !== 'connected' || !nativeReconstructionRepository.resetReplayDraft) throw new ReplayPreparationError('REPLAY_STALE');
    await nativeReconstructionRepository.resetReplayDraft(snapshotToken, privacyRevision);
  }, [nativeReconstructionRepository, privateRecord.state, privacyRuntime]);
  const loadPreparedReplay = useCallback(async (): Promise<ReplayPreparedPreview | null> => {
    if (privacyRuntime.mutating || privateRecord.state !== 'connected') return null;
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
    const uri = `${FileSystem.documentDirectory}replay-previews/${cached.fileKey}`;
    const file = await FileSystem.getInfoAsync(uri);
    if (!file.exists || !file.size || !(await verifyReplayOutput(uri, cached.durationSeconds, Boolean(music)))) return null;
    return { uri, durationSeconds: cached.durationSeconds, renderedMemoryCount: cached.renderedMemoryCount, omittedMemoryCount: input.memories.length - cached.renderedMemoryCount };
  }, [adapter, nativeReconstructionRepository, privateRecord.state, privacyRuntime]);
  const exportPrivateReplay = useCallback(async (uri: string) => {
    const artifact = replayArtifacts.current.get(uri);
    if (privacyRuntime.mutating || privateRecord.state !== 'connected') throw new Error('REPLAY_STALE');
    if (artifact) return shareReplayArtifact(artifact);
    const file = await FileSystem.getInfoAsync(uri);
    if (!file.exists || !file.size) throw new Error('REPLAY_STALE');
    // The sharing boundary uses only the local path. The synthetic manifest is
    // intentionally not persisted, logged, or used for planning.
    return shareReplayArtifact({ uri, digest: 'prepared', manifest: { generation: 0, groupKeys: [], memoryKeys: [], durationSeconds: 0 } });
  }, [privateRecord.state, privacyRuntime]);
  const discardPrivateReplay = useCallback(async (uri: string) => {
    const artifact = replayArtifacts.current.get(uri);
    replayArtifacts.current.delete(uri);
    // The renderer keeps its own exact-manifest in-memory result. Invalidate
    // it even when `uri` is a durable copy so Re-render cannot reuse it.
    replayController.current.invalidate();
    if (artifact) await munimReplayRenderer.dispose?.(artifact);
    else await FileSystem.deleteAsync(uri, { idempotent: true });
  }, []);
  const saveConfiguredHomeArea = useCallback(async (displayId: string, visitId: string, ownerLabel: string, effectiveStartDay: string | null, effectiveEndDay: string | null) => {
    if (privateRecord.state !== 'connected') throw new Error('Private record is unavailable.');
    await nativeReconstructionRepository.saveConfiguredHomeAreaFromJourney(displayId, `home:${displayId}:${visitId}`, visitId, ownerLabel, effectiveStartDay, effectiveEndDay);
    const projection = await reconstructionController.rebuild();
    if (projection.status !== 'complete') throw new Error('Home base saved but local history rebuild did not complete.');
    await refreshDurableReveal();
    await refreshHomeBases();
  }, [nativeReconstructionRepository, privateRecord.state, reconstructionController, refreshDurableReveal, refreshHomeBases]);
  const renameConfiguredHomeArea = useCallback(async (id: string, ownerLabel: string) => {
    if (privateRecord.state !== 'connected' || !sharedRepository.renameConfiguredHomeArea) throw new Error('Home base is unavailable.');
    await sharedRepository.renameConfiguredHomeArea(id, ownerLabel);
    await refreshHomeBases();
    const projection = await reconstructionController.rebuild();
    if (projection.status !== 'complete') throw new Error('Home base name saved but local history rebuild did not complete.');
    await refreshDurableReveal();
  }, [privateRecord.state, sharedRepository, refreshHomeBases, reconstructionController, refreshDurableReveal]);
  const removeConfiguredHomeArea = useCallback(async (id: string) => {
    if (privateRecord.state !== 'connected' || !sharedRepository.deleteConfiguredHomeArea) throw new Error('Home base is unavailable.');
    await sharedRepository.deleteConfiguredHomeArea(id);
    await refreshHomeBases();
    const projection = await reconstructionController.rebuild();
    if (projection.status !== 'complete') throw new Error('Home base removed but local history rebuild did not complete.');
    await refreshDurableReveal();
  }, [privateRecord.state, sharedRepository, refreshHomeBases, reconstructionController, refreshDurableReveal]);
  return <PhotoAccessContext.Provider value={{ snapshot, controller, importCoverage, privateRecord, privateRecordController, maintenance, maintenanceController, reconciliation, catchUpHistory, reconstruction, durableReveal, reviewJourneyPrivacy, saveJourneyPrivacy, loadJourneyPrivacyPolicies, restoreJourneyPrivacy, loadJourneyEligibility, loadReplayManifestInput, loadReplayEditorPreviewPage, loadPreparedReplay, saveReplayDraft, stageReplayWorkingDraft, resetReplayDraft, preparePrivateReplay, exportPrivateReplay, discardPrivateReplay, findManualJourneyOverlaps, createManualJourney, homeBases, loadJourneyDetail, loadJourneyMediaPage, loadUncertainMemories, saveJourneyCorrection, saveJourneyMemoryCorrection, discardJourneyCorrectionPending, retryJourneyCorrectionProjection, saveConfiguredHomeArea, renameConfiguredHomeArea, removeConfiguredHomeArea, reconstructionController, aiReview, aiProposalController }}>{children}</PhotoAccessContext.Provider>;
}

export function usePhotoAccess() {
  const value = useContext(PhotoAccessContext);
  if (!value) throw new Error('PhotoAccessProvider is required');
  return value;
}
