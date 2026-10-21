import { createContext, useCallback, useContext, useEffect, useState, type PropsWithChildren } from 'react';
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

type ReconstructionRepositoryProp = Omit<ReturnType<typeof createNativeReconstructionRepository>, 'findManualJourneyOverlaps' | 'createManualJourney'>
  & Partial<Pick<ReturnType<typeof createNativeReconstructionRepository>, 'findManualJourneyOverlaps' | 'createManualJourney'>>;

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
  const [aiReview, setAiReview] = useState<AiReviewView>({ status: 'idle', message: 'Optional AI suggestions are not requested.', proposals: [] });
  const [sharedRepository] = useState(() => repository ?? (adapter === nativePhotoAccess ? createNativeImportRepository() : unavailableRepository()));
  const [durableMaintenanceRepository] = useState(() => maintenanceRepository(sharedRepository));
  const [nativeReconstructionRepository] = useState(() => reconstructionRepository ? {
    ...reconstructionRepository,
    findManualJourneyOverlaps: reconstructionRepository.findManualJourneyOverlaps ?? (async () => []),
    createManualJourney: reconstructionRepository.createManualJourney ?? (async () => { throw new Error('Manual journeys are unavailable in this runtime.'); }),
  } : createNativeReconstructionRepository());
  const [durablePublicationRuntime] = useState(() => new DurablePublicationRuntime());
  const refreshDurableReveal = useCallback(async () => {
    if (!durablePublicationRuntime.isConnected) throw new Error('Private record is unavailable.');
    const generation = durableRevealGate.next();
    const record = await nativeReconstructionRepository.loadDurableReveal();
    if (!durablePublicationRuntime.isConnected || !canPublishJourneyDetail(generation, durableRevealGate.current(), 'connected')) throw new Error('Private record is unavailable.');
    setDurableReveal(record);
  }, [durablePublicationRuntime, durableRevealGate, nativeReconstructionRepository]);
  useEffect(() => {
    durablePublicationRuntime.setLifecycle(privateRecord.state);
  }, [durablePublicationRuntime, privateRecord.state]);
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
      if (canPublishJourneyDetail(generation, durableRevealGate.current(), privateRecord.state)) setDurableReveal(record);
    }).catch((error) => {
      if (canPublishJourneyDetail(generation, durableRevealGate.current(), privateRecord.state)) {
        recordAppDiagnostic({ operation: 'ATLAS_DURABLE_READ', reasonCode: classifyAppDiagnosticError(error), stage: durableRevealFailureStage(error), retryable: true, durableOutcome: 'unchanged', correlationId: createDiagnosticCorrelationId() });
        setReconstruction((current) => ({ ...current, status: 'error', message: 'The local Atlas could not be read. Try again when ready.' }));
      }
    });
  }, [durableRevealGate, nativeReconstructionRepository, privateRecord.state]);
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
    if (!canPublishJourneyDetail(generation, durableRevealGate.current(), privateRecord.state)) throw new Error('Journey is no longer available.');
    // Preserve placeholder slots: JourneyDetailScreen pairs previews with memories
    // by index, and a missing first asset must not shift a later preview upward.
    const previews = adapter.resolveOwnerPreviews ? await adapter.resolveOwnerPreviews(result.previewSourceRefs, 4) : [];
    if (!canPublishJourneyDetail(generation, durableRevealGate.current(), privateRecord.state)) throw new Error('Journey is no longer available.');
    return { detail: result.detail, previews, snapshotToken: result.snapshotToken };
  }, [adapter, durableRevealGate, nativeReconstructionRepository, privateRecord.state]);
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
    if (!canPublishJourneyDetail(generation, durableRevealGate.current(), privateRecord.state)) throw new Error('Gallery is no longer available.');
    const previews = adapter.resolveOwnerPreviews ? await adapter.resolveOwnerPreviews(result.previewSourceRefs, result.previewSourceRefs.length) : [];
    if (!canPublishJourneyDetail(generation, durableRevealGate.current(), privateRecord.state)) throw new Error('Gallery is no longer available.');
    return { page: { items: result.items, hasMore: result.hasMore }, previews };
  }, [adapter, durableRevealGate, nativeReconstructionRepository, privateRecord.state]);
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
    if (privateRecord.state !== 'connected') throw new Error('Private record is unavailable.');
    return nativeReconstructionRepository.loadUncertainMemories(displayId, snapshotToken, query, page);
  }, [nativeReconstructionRepository, privateRecord.state]);
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
  return <PhotoAccessContext.Provider value={{ snapshot, controller, importCoverage, privateRecord, privateRecordController, maintenance, maintenanceController, reconciliation, catchUpHistory, reconstruction, durableReveal, findManualJourneyOverlaps, createManualJourney, homeBases, loadJourneyDetail, loadJourneyMediaPage, loadUncertainMemories, saveJourneyCorrection, saveJourneyMemoryCorrection, discardJourneyCorrectionPending, retryJourneyCorrectionProjection, saveConfiguredHomeArea, renameConfiguredHomeArea, removeConfiguredHomeArea, reconstructionController, aiReview, aiProposalController }}>{children}</PhotoAccessContext.Provider>;
}

export function usePhotoAccess() {
  const value = useContext(PhotoAccessContext);
  if (!value) throw new Error('PhotoAccessProvider is required');
  return value;
}
