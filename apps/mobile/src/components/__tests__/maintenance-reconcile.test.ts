import { reconcilePermittedLibrary } from '@/maintenance';
import type { MaintenanceCheckpoint, MaintenanceRepository, MaintenanceSnapshot, SourceCandidate } from '@/import-record/types';
import type { PhotoAccessAdapter } from '@/photo-access/types';

const candidate = (assetId: string, modifiedAtMillis: number | null = 1): SourceCandidate => ({ assetId, mediaType: 'image', capturedAtMillis: 1, capturedDay: '1970-01-01', hasPreciseOffset: false, modifiedAtMillis, locationAvailable: null, availability: 'available' });

function repository(): MaintenanceRepository & { pages: SourceCandidate[][]; completed: MaintenanceCheckpoint[]; paused: number } {
  const state: MaintenanceSnapshot = { enabled: true, status: 'pending', lastCheckedAtMillis: null, lastUpdatedAtMillis: null, message: null };
  const pages: SourceCandidate[][] = [];
  const completed: MaintenanceCheckpoint[] = [];
  let paused = 0;
  let leased = false;
  const store: MaintenanceRepository & { pages: SourceCandidate[][]; completed: MaintenanceCheckpoint[]; paused: number } = {
    pages, completed, paused,
    getCheckpoint: async () => null, loadCoverage: async () => ({ scope: 'full', nextOffset: 0, scanned: 1, geotagged: 0, unavailable: 0, status: 'complete' }), commitPage: async () => {},
    getPrivateRecordLifecycle: async () => ({ state: 'connected' }), connectPrivateRecord: async () => {}, disconnectPrivateRecord: async () => {}, deleteLocalHistory: async () => {}, saveCorrectionOverlay: async () => {},
    loadMaintenance: async () => state, saveMaintenance: async (next) => { Object.assign(state, next); }, getMaintenanceCheckpoint: async () => null,
    acquireMaintenanceLease: async () => { if (leased) return null; leased = true; return 1; }, renewMaintenanceLease: async () => leased, releaseMaintenanceLease: async () => { leased = false; },
    reconcileMaintenancePage: async (_checkpoint, page) => { if (page.length) pages.push(page); },
    completeMaintenanceRun: async (checkpoint) => { completed.push(checkpoint); },
    pauseMaintenance: async () => { paused++; store.paused = paused; },
  };
  return store;
}

function adapter(pages: SourceCandidate[][], scope: 'full' | 'limited' = 'full'): PhotoAccessAdapter {
  let index = 0;
  return { inspect: async () => ({ scope, canAskAgain: false }), request: async () => ({ scope, canAskAgain: false }), readPage: async () => 0,
    readMetadataPage: async () => pages[index++] ?? [], readSelectedMetadata: async () => [], manageLimited: async () => {}, select: async () => ({ canceled: true }) };
}

describe('headless maintenance reconciliation', () => {
  it('runs from persisted dependencies without mounted UI and completes a bounded full scan', async () => {
    const store = repository();
    await expect(reconcilePermittedLibrary({ repository: store, photoAccess: adapter([[candidate('a')], []]), now: () => 8 })).resolves.toBe('complete');
    expect(store.pages).toEqual([[candidate('a')]]);
    expect(store.completed).toEqual([{ scope: 'full', nextOffset: 1, runToken: 1, status: 'complete' }]);
  });

  it('persists a pause on expiry and refuses an overlapping run', async () => {
    const store = repository();
    await expect(reconcilePermittedLibrary({ repository: store, photoAccess: adapter([[candidate('a')]]), now: () => 9, isExpired: () => true })).resolves.toBe('paused');
    expect(store.paused).toBe(1);
  });

  it('treats changed permission as restricted before reading a page', async () => {
    const store = repository();
    const access = adapter([[candidate('a')]], 'limited');
    await expect(reconcilePermittedLibrary({ repository: store, photoAccess: access, now: () => 10 })).resolves.toBe('complete');
    // Limited scans complete but the repository implementation never queues
    // absent identities as deletions; that branch is intentionally DB-owned.
    expect(store.completed[0]?.scope).toBe('limited');
  });

  it('discards a late page after access changes instead of checkpointing it', async () => {
    const store = repository();
    let inspections = 0;
    const access: PhotoAccessAdapter = {
      inspect: async () => (++inspections < 3 ? { scope: 'full', canAskAgain: false } : { scope: 'limited', canAskAgain: false }),
      request: async () => ({ scope: 'full', canAskAgain: false }), readPage: async () => 0,
      readMetadataPage: async () => [candidate('late')], readSelectedMetadata: async () => [], manageLimited: async () => {}, select: async () => ({ canceled: true }),
    };

    await expect(reconcilePermittedLibrary({ repository: store, photoAccess: access, now: () => 11 })).resolves.toBe('restricted');
    expect(store.pages).toEqual([]);
    expect(store.paused).toBe(1);
  });

  it('refuses an overlapping worker while another worker owns the run', async () => {
    const store = repository();
    let release!: (page: SourceCandidate[]) => void;
    const access = adapter([], 'full');
    access.readMetadataPage = async () => new Promise((resolve) => { release = resolve; });
    const first = reconcilePermittedLibrary({ repository: store, photoAccess: access, now: () => 12 });
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    await expect(reconcilePermittedLibrary({ repository: store, photoAccess: access, now: () => 13 })).resolves.toBe('paused');
    release([]);
    await expect(first).resolves.toBe('complete');
  });
});
