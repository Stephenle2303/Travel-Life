import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { EmptyAtlasScreen, ImportScreen } from '@/components/mobile-screens';
import { canPublishJourneyDetail, hasVerifiedOwnerPlace, isCurrentDurableRevealRead, PhotoAccessProvider, usePhotoAccess, verifiedOwnerPlaceDisplayId } from '@/photo-access/provider';
import type { PermissionSnapshot, PhotoAccessAdapter } from '@/photo-access/types';
import type { ImportRepository } from '@/import-record';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }));
jest.mock('expo-video', () => ({
  useVideoPlayer: (_source: unknown, setup: (player: { muted: boolean; volume: number; loop: boolean; play(): void; pause(): void }) => void) => {
    const player = { muted: true, volume: 0, loop: false, play: jest.fn(), pause: jest.fn() };
    setup(player); return player;
  },
  VideoView: () => null,
}));

function adapterFor(permission: PermissionSnapshot | null, count = 0): PhotoAccessAdapter {
  return {
    inspect: async () => permission,
    request: async () => permission,
    readPage: async () => count,
    readMetadataPage: async () => [],
    readSelectedMetadata: async () => [],
    manageLimited: async () => {},
    select: async () => ({ canceled: true }),
  };
}

const emptyRepository: ImportRepository = {
  getCheckpoint: async () => null,
  loadCoverage: async () => null,
  commitPage: async () => {},
  getPrivateRecordLifecycle: async () => ({ state: 'connected' }),
  connectPrivateRecord: async () => {},
  disconnectPrivateRecord: async () => {},
  deleteLocalHistory: async () => {},
  saveCorrectionOverlay: async () => {},
};

describe('photo access provider and Import screen', () => {
  it('requires both final detail and durable Atlas projection before reporting a place as applied', () => {
    const place = { id: 'phu-quoc', name: 'Phú Quốc', context: 'Kiên Giang, Vietnam', anchor: { latitude: 10.2, longitude: 103.9 } };
    const detail = { id: 'trip', title: 'Phú Quốc', observedSpan: 'Observed', visits: [], memories: [], uncertainty: [], ownerPlace: place };
    expect(hasVerifiedOwnerPlace('trip', place, detail, { journeys: [{ displayId: 'trip', state: 'inferred', anchor: place.anchor, years: [], periodLabel: '2022', ordering: 'chronological', label: 'Phú Quốc, Kiên Giang, Vietnam', locationKind: 'owner-confirmed' }] })).toBe(true);
    expect(hasVerifiedOwnerPlace('trip', place, detail, { journeys: [{ displayId: 'trip', state: 'inferred', anchor: place.anchor, years: [], periodLabel: '2022', ordering: 'chronological', label: 'Old place', locationKind: 'owner-confirmed' }] })).toBe(false);
    expect(verifiedOwnerPlaceDisplayId('old-trip', place, { journeys: [{ displayId: 'final-trip', state: 'inferred', anchor: { latitude: 10.2, longitude: 103.9 }, years: [], periodLabel: '2022', ordering: 'chronological', label: 'Phú Quốc, Kiên Giang, Vietnam', locationKind: 'owner-confirmed' }] })).toBe('final-trip');
    expect(verifiedOwnerPlaceDisplayId('old-trip', place, { journeys: [
      { displayId: 'final-trip-a', state: 'inferred', anchor: place.anchor, years: [], periodLabel: '2022', ordering: 'chronological', label: 'Phú Quốc, Kiên Giang, Vietnam', locationKind: 'owner-confirmed' },
      { displayId: 'final-trip-b', state: 'inferred', anchor: place.anchor, years: [], periodLabel: '2023', ordering: 'chronological', label: 'Phú Quốc, Kiên Giang, Vietnam', locationKind: 'owner-confirmed' },
    ] })).toBeNull();
  });
  it('shows a recoverable status when the startup reconciliation read is locked', async () => {
    let access!: ReturnType<typeof usePhotoAccess>;
    const repository = {
      ...emptyRepository,
      loadMaintenance: async () => ({ enabled: false, status: 'disabled' as const, lastCheckedAtMillis: null, lastUpdatedAtMillis: null, message: null }),
      getMaintenanceCheckpoint: async () => null,
      loadReconciliation: async () => { throw new Error('database is locked'); },
    };
    const Harness = () => { access = usePhotoAccess(); return null; };
    await render(<PhotoAccessProvider adapter={adapterFor({ scope: 'full', canAskAgain: false })} repository={repository}><Harness /></PhotoAccessProvider>);
    await waitFor(() => expect(access.reconciliation).toMatchObject({ status: 'error', message: 'Local update status could not be read. Retry when ready.' }));
  });

  it('rejects mounted detail and preview reads after lifecycle invalidation', async () => {
    let access!: ReturnType<typeof usePhotoAccess>;
    let releaseDetail!: (value: { detail: never; previewSourceRefs: string[]; snapshotToken: number }) => void;
    let releasePreview!: (value: []) => void;
    const detail = new Promise<{ detail: never; previewSourceRefs: string[]; snapshotToken: number }>((resolve) => { releaseDetail = resolve; });
    const preview = new Promise<[]>((resolve) => { releasePreview = resolve; });
    const reconstructionRepository = {
      loadDurableReveal: async () => ({ journeys: [], statistics: null }), loadJourneyDetail: jest.fn(() => detail),
      loadJourneyMediaPage: async () => ({ items: [], previewSourceRefs: [], hasMore: false }),
      loadUncertainMemories: async () => ({ memories: [], hasMore: false }),
      saveJourneyCorrection: async () => ({ revisionId: 'review', state: 'confirmed' as const, graph: { ruleVersion: 'reconstruction-v1' as const, places: [], visits: [], journeys: [], possibleMerges: [], dispositions: [], memberships: [] } }),
      saveJourneyMemoryCorrection: async () => ({ revisionId: 'memory-review', graph: null }),
      discardJourneyCorrectionPending: async () => ({ graph: null }),
      markJourneyCorrectionPending: async () => {},
      saveConfiguredHomeAreaFromJourney: async () => {},
      rebuild: async () => ({ ruleVersion: 'reconstruction-v1' as const, places: [], visits: [], journeys: [], possibleMerges: [], dispositions: [], memberships: [] }), reconcileQueued: async () => ({ graph: { ruleVersion: 'reconstruction-v1' as const, places: [], visits: [], journeys: [], possibleMerges: [], dispositions: [], memberships: [] }, newJourneyCount: 0, updatedJourneyCount: 0 }),
    };
    const adapter: PhotoAccessAdapter = { ...adapterFor({ scope: 'full', canAskAgain: false }), resolveOwnerPreviews: jest.fn(() => preview) };
    const Harness = () => { access = usePhotoAccess(); return null; };
    await render(<PhotoAccessProvider adapter={adapter} repository={emptyRepository} reconstructionRepository={reconstructionRepository}><Harness /></PhotoAccessProvider>);
    await waitFor(() => expect(access.privateRecord.state).toBe('connected'));
    const pendingDetail = access.loadJourneyDetail('opaque');
    const rejectedDetail = expect(pendingDetail).rejects.toThrow('no longer available');
    await act(async () => { await access.privateRecordController.disconnect(); releaseDetail({ detail: null as never, previewSourceRefs: [], snapshotToken: 1 }); });
    await rejectedDetail;
    await act(async () => { await access.privateRecordController.reconnect(); });
    await waitFor(() => expect(access.privateRecord.state).toBe('connected'));
    reconstructionRepository.loadJourneyDetail.mockResolvedValueOnce({ detail: null as never, previewSourceRefs: [], snapshotToken: 1 });
    const pendingPreview = access.loadJourneyDetail('opaque');
    await waitFor(() => expect(adapter.resolveOwnerPreviews).toHaveBeenCalled());
    const rejectedPreview = expect(pendingPreview).rejects.toThrow('no longer available');
    await act(async () => { await access.privateRecordController.disconnect(); releasePreview([]); });
    await rejectedPreview;
  });
  it('publishes the projection that was committed with a revision-bound decision', async () => {
    let access!: ReturnType<typeof usePhotoAccess>;
    const graph = { ruleVersion: 'reconstruction-v1' as const, places: [], visits: [], journeys: [], possibleMerges: [], dispositions: [], memberships: [] };
    const reconstructionRepository = {
      loadDurableReveal: jest.fn(async () => ({ journeys: [], statistics: null })),
      loadJourneyDetail: async () => ({ detail: null as never, previewSourceRefs: [], snapshotToken: 7 }),
      loadJourneyMediaPage: async () => ({ items: [], previewSourceRefs: [], hasMore: false }),
      loadUncertainMemories: async () => ({ memories: [], hasMore: false }),
      saveJourneyCorrection: jest.fn(async () => ({ revisionId: 'revision-1', state: 'rejected' as const, graph })),
      saveJourneyMemoryCorrection: jest.fn(async () => ({ revisionId: 'memory-review', graph })),
      discardJourneyCorrectionPending: jest.fn(async () => ({ graph })),
      markJourneyCorrectionPending: jest.fn(async () => {}),
      saveConfiguredHomeAreaFromJourney: async () => {},
      rebuild: jest.fn(async () => graph),
      reconcileQueued: async () => ({ graph, newJourneyCount: 0, updatedJourneyCount: 0 }),
    };
    const Harness = () => { access = usePhotoAccess(); return null; };
    await render(<PhotoAccessProvider adapter={adapterFor({ scope: 'full', canAskAgain: false })} repository={emptyRepository} reconstructionRepository={reconstructionRepository}><Harness /></PhotoAccessProvider>);
    await waitFor(() => expect(access.privateRecord.state).toBe('connected'));
    let result!: 'applied' | 'pending';
    const snapshot = { id: 'opaque', title: 'Private journey', observedSpan: 'Observed 2024-01-01', visits: [], memories: [], uncertainty: [] };
    await act(async () => { result = await access.saveJourneyCorrection('opaque', 'reject', 7, snapshot, 'command-reject'); });
    expect(reconstructionRepository.saveJourneyCorrection).toHaveBeenCalledWith('opaque', 'reject', 7, snapshot, 'command-reject');
    expect(reconstructionRepository.rebuild).not.toHaveBeenCalled();
    // The success state is withheld until the redacted Atlas cache has been
    // refreshed from the same completed projection.
    expect(reconstructionRepository.loadDurableReveal).toHaveBeenCalledTimes(2);
    expect(result).toBe('applied');
    expect(reconstructionRepository.markJourneyCorrectionPending).not.toHaveBeenCalled();
  });
  it('does not start a second projection transaction after a saved decision', async () => {
    let access!: ReturnType<typeof usePhotoAccess>;
    const graph = { ruleVersion: 'reconstruction-v1' as const, places: [], visits: [], journeys: [], possibleMerges: [], dispositions: [], memberships: [] };
    const reconstructionRepository = {
      loadDurableReveal: async () => ({ journeys: [], statistics: null }),
      loadJourneyDetail: async () => ({ detail: null as never, previewSourceRefs: [], snapshotToken: 7 }),
      loadJourneyMediaPage: async () => ({ items: [], previewSourceRefs: [], hasMore: false }),
      loadUncertainMemories: async () => ({ memories: [], hasMore: false }),
      saveJourneyCorrection: jest.fn(async () => ({ revisionId: 'revision-2', state: 'confirmed' as const, graph })),
      saveJourneyMemoryCorrection: jest.fn(async () => ({ revisionId: 'memory-review', graph })),
      discardJourneyCorrectionPending: jest.fn(async () => ({ graph })),
      markJourneyCorrectionPending: jest.fn(async () => {}),
      saveConfiguredHomeAreaFromJourney: async () => {},
      rebuild: jest.fn().mockRejectedValue(new Error('must not run')),
      reconcileQueued: async () => ({ graph, newJourneyCount: 0, updatedJourneyCount: 0 }),
    };
    const Harness = () => { access = usePhotoAccess(); return null; };
    await render(<PhotoAccessProvider adapter={adapterFor({ scope: 'full', canAskAgain: false })} repository={emptyRepository} reconstructionRepository={reconstructionRepository}><Harness /></PhotoAccessProvider>);
    await waitFor(() => expect(access.privateRecord.state).toBe('connected'));
    let result!: 'applied' | 'pending';
    const snapshot = { id: 'opaque', title: 'Private journey', observedSpan: 'Observed 2024-01-01', visits: [], memories: [], uncertainty: [] };
    await act(async () => { result = await access.saveJourneyCorrection('opaque', 'confirm', 7, snapshot, 'command-confirm'); });
    expect(result).toBe('applied');
    expect(reconstructionRepository.rebuild).not.toHaveBeenCalled();
    expect(reconstructionRepository.markJourneyCorrectionPending).not.toHaveBeenCalled();
  });
  it('rejects a durable reveal read that completed after a lifecycle invalidation', () => {
    expect(isCurrentDurableRevealRead(4, 4)).toBe(true);
    expect(isCurrentDurableRevealRead(4, 5)).toBe(false);
  });
  it('rejects a deferred detail and preview result after lifecycle invalidation', async () => {
    let releaseDetail!: () => void; let releasePreview!: () => void;
    const detail = new Promise<void>((resolve) => { releaseDetail = resolve; });
    const preview = new Promise<void>((resolve) => { releasePreview = resolve; });
    const generation = 7;
    const completed = Promise.all([detail, preview]).then(() => canPublishJourneyDetail(generation, generation + 1, 'deleted'));
    releaseDetail(); releasePreview();
    await expect(completed).resolves.toBe(false);
  });
  it('rechecks and updates a finished limited count on foreground return', async () => {
    let activeListener: ((state: AppStateStatus) => void) | undefined;
    const subscription = { remove: jest.fn() };
    const appStateSpy = jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
      activeListener = listener as (state: AppStateStatus) => void;
      return subscription as ReturnType<typeof AppState.addEventListener>;
    });
    let currentCount = 4;
    const adapter: PhotoAccessAdapter = { ...adapterFor({ scope: 'limited', canAskAgain: false }), readPage: async () => currentCount };
    try {
      const view = await render(<PhotoAccessProvider adapter={adapter} repository={emptyRepository}><ImportScreen /></PhotoAccessProvider>);
      await waitFor(() => expect(view.getByText(/Limited photo-library access granted/)).toBeOnTheScreen());
      await fireEvent.press(view.getByRole('button', { name: 'Recheck accessible photos' }));
      await waitFor(() => expect(view.getByText(/4 device-visible photos and videos observed/)).toBeOnTheScreen());

      currentCount = 7;
      await act(async () => { activeListener?.('active'); });
      await waitFor(() => expect(view.getByText(/7 device-visible photos and videos observed/)).toBeOnTheScreen());
      expect(view.getByRole('button', { name: 'Manage limited selection' })).toBeOnTheScreen();
    } finally {
      appStateSpy.mockRestore();
    }
  });

  it('hides native picker on unavailable runtime and explains blocked initial access', async () => {
    const unavailable = await render(<PhotoAccessProvider adapter={adapterFor(null)} repository={emptyRepository}><ImportScreen /></PhotoAccessProvider>);
    await waitFor(() => expect(unavailable.getByText(/Native photo-library access is unavailable/)).toBeOnTheScreen());
    expect(unavailable.queryByRole('button', { name: 'Select photos and videos' })).toBeNull();
    await unavailable.unmount();

    const blocked = await render(<PhotoAccessProvider adapter={adapterFor({ scope: 'unasked', canAskAgain: false })} repository={emptyRepository}><ImportScreen /></PhotoAccessProvider>);
    await waitFor(() => expect(blocked.getByText(/Photo access cannot be requested here/)).toBeOnTheScreen());
    expect(blocked.queryByRole('button', { name: 'Allow full photo library' })).toBeNull();
    expect(blocked.getByRole('button', { name: 'Select photos and videos' })).toBeOnTheScreen();
    await blocked.unmount();
  });

  it('starts a local metadata import and exposes completed coverage without a journey claim', async () => {
    const view = await render(<PhotoAccessProvider adapter={adapterFor({ scope: 'full', canAskAgain: false })} repository={emptyRepository}><ImportScreen /></PhotoAccessProvider>);
    await waitFor(() => expect(view.getByRole('button', { name: 'Start metadata import' })).toBeOnTheScreen());

    await fireEvent.press(view.getByRole('button', { name: 'Start metadata import' }));

    await waitFor(() => expect(view.getByText(/Metadata import completed for the current accessible scope/)).toBeOnTheScreen());
    expect(view.getByText(/not lifetime coverage/)).toBeOnTheScreen();
  });

  it('keeps explicit local import and Atlas recovery controls available after a recoverable failure', async () => {
    const repository: ImportRepository = { ...emptyRepository, loadCoverage: async () => ({ scope: 'full', nextOffset: 0, scanned: 1, geotagged: 1, unavailable: 0, status: 'paused' }) };
    const importView = await render(<PhotoAccessProvider adapter={adapterFor({ scope: 'full', canAskAgain: false })} repository={repository}><ImportScreen /></PhotoAccessProvider>);
    await waitFor(() => expect(importView.getByRole('button', { name: 'Resume metadata import' })).toBeOnTheScreen());
    await importView.unmount();
    const atlasView = await render(<PhotoAccessProvider adapter={adapterFor({ scope: 'full', canAskAgain: false })} repository={emptyRepository}><EmptyAtlasScreen /></PhotoAccessProvider>);
    await waitFor(() => expect(atlasView.getByRole('button', { name: 'Import or reconnect photos' })).toBeOnTheScreen());
  });
});
