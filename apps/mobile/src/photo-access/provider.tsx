import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';

import { HistoryRecordController, type LifecycleSnapshot } from '@/history-record';
import { PhotoAccessController, initialPhotoAccess } from './controller';
import { nativePhotoAccess } from './native-adapter';
import type { OwnerPreview, PhotoAccessAdapter, PhotoAccessSnapshot } from './types';
import { createNativeImportRepository, type ImportCoverage, type ImportRepository, type MaintenanceRepository, type ReconciliationSnapshot } from '@/import-record';
import { MaintenanceController, createExpoScheduler, type MaintenanceView } from '@/maintenance';
import { createNativeReconstructionRepository, ReconstructionController, type ReconstructionView } from '@/reconstruction';
import { AiProposalController, type AiReviewView } from '@/ai';
import type { DurableRevealRecord, JourneyDetail } from '@/reveal/types';

export function isCurrentDurableRevealRead(readGeneration: number, currentGeneration: number) {
  return readGeneration === currentGeneration;
}
export function canPublishJourneyDetail(readGeneration: number, currentGeneration: number, lifecycle: LifecycleSnapshot['state']) {
  return readGeneration === currentGeneration && lifecycle === 'connected';
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
  loadJourneyDetail(displayId: string): Promise<{ detail: JourneyDetail; previews: OwnerPreview[] }>;
  reconstructionController: ReconstructionController;
  aiReview: AiReviewView;
  aiProposalController: AiProposalController;
};

const PhotoAccessContext = createContext<PhotoAccessContextValue | null>(null);

export function PhotoAccessProvider({ children, adapter = nativePhotoAccess, repository }: PropsWithChildren<{ adapter?: PhotoAccessAdapter; repository?: ImportRepository }>) {
  const [snapshot, setSnapshot] = useState(initialPhotoAccess);
  const [importCoverage, setImportCoverage] = useState<ImportCoverage>({ scope: null, accessible: null, scanned: 0, geotagged: 0, unavailable: 0, status: 'idle', message: null });
  const [privateRecord, setPrivateRecord] = useState<LifecycleSnapshot>({ state: 'deleted', message: null });
  const [maintenance, setMaintenance] = useState<MaintenanceView>({ enabled: false, status: 'disabled', lastCheckedAtMillis: null, lastUpdatedAtMillis: null, message: null, checkpoint: null });
  const [reconciliation, setReconciliation] = useState<ReconciliationSnapshot>({ status: 'idle', pendingCount: 0, lastCheckedAtMillis: null, lastUpdatedAtMillis: null, newJourneyCount: 0, updatedJourneyCount: 0, message: null });
  const [reconstruction, setReconstruction] = useState<ReconstructionView>({ status: 'idle', graph: null, message: null });
  const [durableReveal, setDurableReveal] = useState<DurableRevealRecord | null>(null);
  const [durableRevealGate] = useState(() => new DurableRevealGate());
  const [aiReview, setAiReview] = useState<AiReviewView>({ status: 'idle', message: 'Optional AI suggestions are not requested.', proposals: [] });
  const [sharedRepository] = useState(() => repository ?? (adapter === nativePhotoAccess ? createNativeImportRepository() : unavailableRepository()));
  const [durableMaintenanceRepository] = useState(() => maintenanceRepository(sharedRepository));
  const [nativeReconstructionRepository] = useState(() => createNativeReconstructionRepository());
  const [reconstructionController] = useState(() => new ReconstructionController(nativeReconstructionRepository, (view) => {
    setReconstruction(view);
    if (view.status === 'complete') {
      const generation = durableRevealGate.next();
      void nativeReconstructionRepository.loadDurableReveal().then((record) => {
        if (durableRevealGate.isCurrent(generation)) setDurableReveal(record);
      }).catch(() => {});
    }
  }));
  const currentSourcePermitted = async () => {
    const access = await adapter.inspect();
    return access?.scope === 'full' || access?.scope === 'limited';
  };
  const [maintenanceController] = useState(() => new MaintenanceController(durableMaintenanceRepository, adapter, createExpoScheduler(), setMaintenance, () => Date.now(), async () => {
    await reconstructionController.reconcile(currentSourcePermitted);
    if (durableMaintenanceRepository.loadReconciliation) setReconciliation(await durableMaintenanceRepository.loadReconciliation());
  }));
  // M2.3 intentionally ships with the server kill switch off. This local-safe
  // transport still lets the owner see the skipped outcome without a network call.
  const [aiProposalController] = useState(() => new AiProposalController({ request: async () => ({ status: 'skipped', reason: 'disabled', usage: { inputTokens: null, outputTokens: null } }) }, setAiReview));
  const [controller] = useState(() => new PhotoAccessController(adapter, setSnapshot, setImportCoverage, sharedRepository, async () => {
    // Import completion makes the owner control available; it never enables it.
    await maintenanceController.refresh();
    await reconstructionController.rebuild();
  }));
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
    if (durableMaintenanceRepository.loadReconciliation) void durableMaintenanceRepository.loadReconciliation().then(setReconciliation);
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

  useEffect(() => {
    if (privateRecord.state !== 'connected' || adapter !== nativePhotoAccess) return;
    const generation = durableRevealGate.next();
    void nativeReconstructionRepository.loadDurableReveal().then((record) => {
      if (durableRevealGate.isCurrent(generation)) setDurableReveal(record);
    }).catch(() => {});
  }, [adapter, durableRevealGate, nativeReconstructionRepository, privateRecord.state]);

  useEffect(() => {
    if (privateRecord.state === 'connected') reconstructionController.resume();
    else reconstructionController.clear();
  }, [privateRecord, reconstructionController]);

  const catchUpHistory = async () => {
    await reconstructionController.reconcile(currentSourcePermitted);
    if (durableMaintenanceRepository.loadReconciliation) setReconciliation(await durableMaintenanceRepository.loadReconciliation());
  };
  const loadJourneyDetail = async (displayId: string) => {
    const generation = durableRevealGate.next();
    const result = await nativeReconstructionRepository.loadJourneyDetail(displayId);
    if (!canPublishJourneyDetail(generation, durableRevealGate.current(), privateRecord.state)) throw new Error('Journey is no longer available.');
    // Preserve placeholder slots: JourneyDetailScreen pairs previews with memories
    // by index, and a missing first asset must not shift a later preview upward.
    const previews = adapter.resolveOwnerPreviews ? await adapter.resolveOwnerPreviews(result.previewSourceRefs, 4) : [];
    if (!canPublishJourneyDetail(generation, durableRevealGate.current(), privateRecord.state)) throw new Error('Journey is no longer available.');
    return { detail: result.detail, previews };
  };
  return <PhotoAccessContext.Provider value={{ snapshot, controller, importCoverage, privateRecord, privateRecordController, maintenance, maintenanceController, reconciliation, catchUpHistory, reconstruction, durableReveal, loadJourneyDetail, reconstructionController, aiReview, aiProposalController }}>{children}</PhotoAccessContext.Provider>;
}

export function usePhotoAccess() {
  const value = useContext(PhotoAccessContext);
  if (!value) throw new Error('PhotoAccessProvider is required');
  return value;
}
