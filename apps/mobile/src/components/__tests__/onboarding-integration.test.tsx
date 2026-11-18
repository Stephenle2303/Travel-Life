import { useEffect, useState } from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Button, Linking, Text } from 'react-native';
import EntryScreen from '@/app/index';
import { EmptyAtlasScreen, ImportScreen } from '@/components/mobile-screens';
import { PhotoAccessProvider, usePhotoAccess } from '@/photo-access/provider';
import type { MaintenanceRepository, PreparationIntent, ImportCheckpoint, MaintenanceSnapshot } from '@/import-record/types';
import type { PhotoAccessAdapter } from '@/photo-access/types';
import type { ReconstructionGraph } from '@/reconstruction';
import type { DurableRevealRecord } from '@/reveal/types';
import * as homePlaceSearch from '@/reconstruction/home-place-search';

let mockMarker: string | null = null;
const mockRouter = { push: jest.fn(), replace: jest.fn(), dismissTo: jest.fn() };
const mockRegister = jest.fn(async () => {});
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'synthetic-home-command' }));
jest.mock('expo-secure-store', () => ({ getItemAsync: async () => mockMarker, setItemAsync: async (_key: string, value: string) => { mockMarker = value; } }));
jest.mock('@/maintenance/scheduler', () => ({ createExpoScheduler: () => ({ isAvailable: async () => true, register: () => mockRegister(), unregister: async () => {} }) }));
jest.mock('expo-video', () => ({
  useVideoPlayer: (_source: unknown, setup: (player: Record<string, unknown>) => void) => { const player = { play: jest.fn(), pause: jest.fn(), addListener: () => ({ remove: jest.fn() }) }; setup(player); return player; },
  VideoView: () => null,
}));

function fixture() {
  let intent: PreparationIntent | null = null;
  let checkpoint: ImportCheckpoint | null = null;
  let maintenance: MaintenanceSnapshot = { enabled: false, status: 'disabled', lastCheckedAtMillis: null, lastUpdatedAtMillis: null, message: null };
  const repository: MaintenanceRepository = {
    getCheckpoint: async () => checkpoint, loadCoverage: async () => checkpoint,
    commitPage: async (next) => { checkpoint = next; },
    loadPreparationIntent: async () => intent, savePreparationIntent: async (next) => { intent = next; },
    getPrivateRecordLifecycle: async () => ({ state: 'connected' }), connectPrivateRecord: async () => {}, disconnectPrivateRecord: async () => {}, deleteLocalHistory: async () => {}, saveCorrectionOverlay: async () => {},
    loadMaintenance: async () => maintenance, saveMaintenance: jest.fn(async (next) => { maintenance = next; }), getMaintenanceCheckpoint: async () => null,
    reconcileMaintenancePage: async () => {}, completeMaintenanceRun: async () => {}, pauseMaintenance: async () => {}, acquireMaintenanceLease: async () => null, renewMaintenanceLease: async () => false, releaseMaintenanceLease: async () => {},
  };
  const adapter: PhotoAccessAdapter = {
    inspect: jest.fn(async () => ({ scope: 'full' as const, canAskAgain: false })), request: jest.fn(async () => null),
    readPage: jest.fn(async () => 0), readMetadataPage: jest.fn(async () => []), readSelectedMetadata: jest.fn(async () => []), manageLimited: async () => {}, select: jest.fn(async () => ({ canceled: true as const })),
  };
  const graph: ReconstructionGraph = { ruleVersion: 'reconstruction-v1', places: [], visits: [], journeys: [], possibleMerges: [], dispositions: [], memberships: [] };
  const native = {
    loadDurableReveal: jest.fn(async (): Promise<DurableRevealRecord> => ({ journeys: [] })),
    loadJourneyDetail: async () => ({ detail: null as never, previewSourceRefs: [], snapshotToken: 1 }),
    loadJourneyMediaPage: async () => ({ items: [], previewSourceRefs: [], hasMore: false }), loadUncertainMemories: async () => ({ memories: [], hasMore: false }),
    saveJourneyCorrection: async () => ({ revisionId: 'synthetic', state: 'confirmed' as const, graph }), saveJourneyMemoryCorrection: async () => ({ revisionId: 'synthetic', graph }), discardJourneyCorrectionPending: async () => ({ graph }), markJourneyCorrectionPending: async () => {}, saveConfiguredHomeAreaFromJourney: async () => {},
    rebuild: jest.fn(async () => graph), reconcileQueued: async () => ({ graph, newJourneyCount: 0, updatedJourneyCount: 0 }),
  };
  return { repository, adapter, native, maintenance: () => maintenance };
}

let access: ReturnType<typeof usePhotoAccess>;
function Controls() {
  const value = usePhotoAccess();
  useEffect(() => { access = value; }, [value]);
  const [task, setTask] = useState(false);
  return <>
    <Button title="Choose library" onPress={() => void value.controller.choosePhotos('library')} />
    <Button title="Open independent task" onPress={() => setTask(true)} />
    <Text>{task ? 'Independent task stays open' : 'Atlas destination'}</Text>
    <Text testID="published-labels">{value.durableReveal?.journeys.map((journey) => journey.label).join(',') || 'No published journeys'}</Text>
    {!task && <EmptyAtlasScreen />}
  </>;
}

beforeEach(() => { mockMarker = null; jest.clearAllMocks(); });

describe('mounted entry resolver', () => {
  it.each([
    ['started', '/import'], ['atlas', '/history'],
  ] as const)('replaces %s entry with its resolved destination', async (disposition, destination) => {
    mockMarker = JSON.stringify({ version: 1, disposition, updatesOffer: false });
    const h = fixture();
    const view = await render(<PhotoAccessProvider adapter={h.adapter} repository={h.repository} reconstructionRepository={h.native}><EntryScreen /></PhotoAccessProvider>);
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith(destination));
    expect(view.queryByRole('button', { name: 'Explore my travel life' })).toBeNull();
    expect(h.adapter.readMetadataPage).not.toHaveBeenCalled();
  });

  it('shows Welcome only after fresh state is resolved without scanning', async () => {
    const h = fixture();
    const view = await render(<PhotoAccessProvider adapter={h.adapter} repository={h.repository} reconstructionRepository={h.native}><EntryScreen /></PhotoAccessProvider>);
    await waitFor(() => expect(view.getByRole('button', { name: 'Explore my travel life' })).toBeOnTheScreen());
    expect(mockRouter.replace).not.toHaveBeenCalled(); expect(h.adapter.readMetadataPage).not.toHaveBeenCalled();
  });

  it('shows recoverable bootstrap failure instead of Welcome or private content', async () => {
    mockMarker = 'null';
    const h = fixture();
    const view = await render(<PhotoAccessProvider adapter={h.adapter} repository={h.repository} reconstructionRepository={h.native}><EntryScreen /></PhotoAccessProvider>);
    await waitFor(() => expect(view.getByText("Couldn't open your Atlas.")).toBeOnTheScreen());
    expect(view.getByRole('button', { name: 'Try again' })).toBeOnTheScreen();
    expect(view.queryByRole('button', { name: 'Explore my travel life' })).toBeNull();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
});

describe('mounted preparation publication and update consent', () => {
  it('publishes only authorized candidate cards and discards a stale cover read', async () => {
    const old = process.env.EXPO_PUBLIC_TRAVEL_LIFE_RECONSTRUCTION_PREVIEW;
    process.env.EXPO_PUBLIC_TRAVEL_LIFE_RECONSTRUCTION_PREVIEW = 'true';
    const h = fixture();
    const verify = jest.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const load = jest.fn(async ({ canUseSource }: { canUseSource(): boolean | Promise<boolean> }) => {
      expect(await canUseSource()).toBe(true);
      return { status: 'complete' as const, policyVersion: 'recognizable-travel-shadow-v1' as const, token: {},
        cards: [{ id: 'opaque-card', title: 'Synthetic trip', observedPeriod: '2026',
          coverRefs: ['PRIVATE_SOURCE_REF'], state: 'reliable' as const, reasons: [] }] };
    });
    h.adapter.resolveOwnerPreviews = jest.fn(async () => [{ uri: 'file:///synthetic-cover', availability: 'available' as const, kind: 'photo' as const }]);
    const native = { ...h.native, loadCandidateShadowSnapshot: load, verifyCandidateShadowSnapshot: verify };
    const log = jest.spyOn(console, 'info').mockImplementation(() => {});
    try {
      await render(<PhotoAccessProvider adapter={h.adapter} repository={h.repository} reconstructionRepository={native}><Controls /></PhotoAccessProvider>);
      await waitFor(() => expect(access.privateRecord.state).toBe('connected'));
      const preview = await access.loadRecognizableShadowPreview?.();
      expect(preview?.reliable).toEqual([{ id: 'opaque-card', title: 'Synthetic trip', observedPeriod: '2026', coverUri: 'file:///synthetic-cover' }]);
      expect(JSON.stringify(preview)).not.toContain('PRIVATE_SOURCE_REF');
      await expect(access.loadRecognizableShadowPreview?.()).rejects.toThrow('could not be verified');
      expect(log).toHaveBeenCalledWith('[Travel Life diagnostic]', expect.objectContaining({
        operation: 'ATLAS_PREVIEW', stage: 'PREVIEW_MEDIA', reasonCode: 'HISTORY_STALE',
      }));
      expect(JSON.stringify(log.mock.calls)).not.toContain('PRIVATE_SOURCE_REF');
    } finally {
      log.mockRestore();
      if (old === undefined) delete process.env.EXPO_PUBLIC_TRAVEL_LIFE_RECONSTRUCTION_PREVIEW;
      else process.env.EXPO_PUBLIC_TRAVEL_LIFE_RECONSTRUCTION_PREVIEW = old;
    }
  });

  it('reports selected-media metadata and resolved-reference mismatches without private values', async () => {
    const h = fixture();
    const native = { ...h.native,
      loadJourneyMediaInspection: async () => ({ reference: 'PRIVATE_REFERENCE', evidence: { latitude: 10, longitude: 20 }, privacyRevision: 4 }),
      verifyJourneyMediaSnapshot: async () => true,
    };
    const inspect = jest.fn().mockResolvedValueOnce({ uri: 'file:///PRIVATE_FIRST', location: { latitude: 11, longitude: 20 } })
      .mockResolvedValueOnce({ uri: 'file:///PRIVATE_SECOND', location: { latitude: 10, longitude: 20 } });
    h.adapter.inspectOwnerMedia = inspect;
    const log = jest.spyOn(console, 'info').mockImplementation(() => {});
    try {
      await render(<PhotoAccessProvider adapter={h.adapter} repository={h.repository} reconstructionRepository={native}><Controls /></PhotoAccessProvider>);
      await waitFor(() => expect(access.privateRecord.state).toBe('connected'));
      await expect(access.inspectJourneyMedia?.('PRIVATE_TRIP', 7, 'media-1', 'file:///PRIVATE_TILE'))
        .resolves.toContain('metadata differs');
      await expect(access.inspectJourneyMedia?.('PRIVATE_TRIP', 7, 'media-1', 'file:///PRIVATE_TILE'))
        .resolves.toContain('preview reference differs');
      expect(log).toHaveBeenCalledWith('[Travel Life diagnostic]', expect.objectContaining({ operation: 'JOURNEY_MEDIA_INSPECT',
        stage: 'MEDIA_ORIGINAL_CHECK', reasonCode: 'MEDIA_METADATA_MISMATCH' }));
      expect(log).toHaveBeenCalledWith('[Travel Life diagnostic]', expect.objectContaining({ operation: 'JOURNEY_MEDIA_INSPECT',
        stage: 'MEDIA_SLOT_CHECK', reasonCode: 'MEDIA_ASSET_MISMATCH' }));
      expect(JSON.stringify(log.mock.calls)).not.toContain('PRIVATE_');
    } finally { log.mockRestore(); }
  });

  it('waits for the explicit Home skip before presenting photo access', async () => {
    const h = fixture();
    let disposition: 'skipped' | null = null;
    h.repository.loadHomeSetup = async () => disposition;
    h.repository.saveHomeSetup = jest.fn(async () => { disposition = 'skipped'; });
    const view = await render(<PhotoAccessProvider adapter={h.adapter} repository={h.repository} reconstructionRepository={h.native}><ImportScreen /></PhotoAccessProvider>);
    await waitFor(() => expect(view.getByText('Where do you live?')).toBeOnTheScreen());
    expect(view.queryByRole('button', { name: 'Use photo library' })).toBeNull();
    expect(h.adapter.inspect).not.toHaveBeenCalled();
    expect(h.adapter.readMetadataPage).not.toHaveBeenCalled();
    await fireEvent.press(view.getByRole('button', { name: 'Skip for now' }));
    await waitFor(() => expect(view.getByRole('button', { name: 'Use photo library' })).toBeOnTheScreen());
    expect(h.repository.saveHomeSetup).toHaveBeenCalledWith(expect.any(String), []);
    expect(h.native.rebuild).not.toHaveBeenCalled();
  });

  it('saves a dated offline Home result before photo access without coordinates or a map', async () => {
    const h = fixture();
    let disposition: 'saved' | null = null;
    h.repository.loadHomeSetup = async () => disposition;
    h.repository.saveHomeSetup = jest.fn(async () => { disposition = 'saved'; });
    const view = await render(<PhotoAccessProvider adapter={h.adapter} repository={h.repository} reconstructionRepository={h.native}><ImportScreen /></PhotoAccessProvider>);
    const input = await view.findByLabelText('Search for a city, province, district, ward or commune');
    await fireEvent.changeText(input, 'Sa Dec Dong Thap');
    expect(view.queryByLabelText(/latitude|longitude/i)).toBeNull();
    expect(view.queryByRole('button', { name: 'Add this Home base' })).toBeNull();
    await fireEvent.press(view.getByRole('button', { name: /^Sa Đéc · City/ }));
    expect(view.getByRole('button', { name: 'Add this Home base' })).toBeDisabled();
    await fireEvent.press(view.getByRole('button', { name: 'Choose dates' }));
    await fireEvent.changeText(view.getByLabelText('From date YYYY-MM or YYYY-MM-DD'), '2020-02-03');
    await fireEvent.changeText(view.getByLabelText('Until date YYYY-MM or YYYY-MM-DD'), '2020-02');
    await fireEvent.press(view.getByRole('button', { name: 'Add this Home base' }));
    await fireEvent.press(view.getByRole('button', { name: 'Continue' }));
    expect(await view.findByRole('button', { name: 'Use photo library' })).toBeOnTheScreen();
    expect(h.repository.saveHomeSetup).toHaveBeenCalledWith(expect.any(String), [expect.objectContaining({
      label: 'Sa Đéc', latitude: 10.29085, longitude: 105.75635, radiusMeters: 20_000,
      effectiveStartDay: '2020-02-03', effectiveEndDay: '2020-02-29',
    })]);
    expect(h.adapter.readMetadataPage).not.toHaveBeenCalled();
  });

  it('keeps Home setup skippable when the offline index fails without logging the query', async () => {
    const h = fixture();
    let disposition: 'skipped' | null = null;
    h.repository.loadHomeSetup = async () => disposition;
    h.repository.saveHomeSetup = jest.fn(async () => { disposition = 'skipped'; });
    const log = jest.spyOn(console, 'info').mockImplementation(() => {});
    const search = jest.spyOn(homePlaceSearch, 'searchHomePlaces').mockImplementation((query) => {
      if (!query) return [];
      throw new Error('PRIVATE_OFFLINE_HOME_INDEX');
    });
    try {
      const view = await render(<PhotoAccessProvider adapter={h.adapter} repository={h.repository} reconstructionRepository={h.native}><ImportScreen /></PhotoAccessProvider>);
      const input = await view.findByLabelText('Search for a city, province, district, ward or commune');
      await fireEvent.changeText(input, 'PRIVATE_HOME_QUERY');
      expect(await view.findByText('Offline place search is unavailable.')).toBeOnTheScreen();
      expect(view.queryByText('PRIVATE_OFFLINE_HOME_INDEX')).toBeNull();
      expect(log).toHaveBeenCalledWith('[Travel Life diagnostic]', expect.objectContaining({
        operation: 'ONBOARDING_SETUP', stage: 'HOME_SEARCH_INDEX', reasonCode: 'UNKNOWN',
        durableOutcome: 'unchanged', retryable: false,
      }));
      expect(JSON.stringify(log.mock.calls)).not.toMatch(/PRIVATE_OFFLINE_HOME_INDEX|PRIVATE_HOME_QUERY/);
      await fireEvent.press(view.getByRole('button', { name: 'Skip for now' }));
      await fireEvent.press(view.getByRole('button', { name: 'Discard and skip' }));
      expect(await view.findByRole('button', { name: 'Use photo library' })).toBeOnTheScreen();
      expect(h.repository.saveHomeSetup).toHaveBeenCalledWith(expect.any(String), []);
    } finally { search.mockRestore(); log.mockRestore(); }
  });

  it('classifies device-settings failure without rendering or logging native content', async () => {
    const h = fixture();
    (h.adapter.inspect as jest.Mock).mockResolvedValue({ scope: 'denied', canAskAgain: false });
    const open = jest.spyOn(Linking, 'openSettings').mockRejectedValue(new Error('synthetic-private-native-settings'));
    const log = jest.spyOn(console, 'info').mockImplementation(() => {});
    try {
      const view = await render(<PhotoAccessProvider adapter={h.adapter} repository={h.repository} reconstructionRepository={h.native}><ImportScreen /></PhotoAccessProvider>);
      await waitFor(() => expect(view.getByRole('button', { name: 'Open settings' })).toBeOnTheScreen());
      await fireEvent.press(view.getByRole('button', { name: 'Open settings' }));
      await waitFor(() => expect(view.getByText('Device settings are unavailable.')).toBeOnTheScreen());
      expect(log).toHaveBeenCalledWith('[Travel Life diagnostic]', expect.objectContaining({ operation: 'ONBOARDING_SETUP', stage: 'ACCESS_SETTINGS', reasonCode: 'UNKNOWN', durableOutcome: 'unchanged' }));
      expect(JSON.stringify(log.mock.calls)).not.toContain('synthetic-private-native-settings');
      expect(JSON.stringify(view.toJSON())).not.toContain('synthetic-private-native-settings');
    } finally { open.mockRestore(); log.mockRestore(); }
  });

  it('classifies corrupt invitation state and keeps the Atlas without enrolling updates', async () => {
    const h = fixture();
    const log = jest.spyOn(console, 'info').mockImplementation(() => {});
    try {
      const view = await render(<PhotoAccessProvider adapter={h.adapter} repository={h.repository} reconstructionRepository={h.native}><Controls /></PhotoAccessProvider>);
      await waitFor(() => expect(access.durableReveal).not.toBeNull());
      let release!: (record: DurableRevealRecord) => void;
      h.native.loadDurableReveal.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
      await fireEvent.press(view.getByRole('button', { name: 'Choose library' }));
      await waitFor(() => expect(access.controller.preparation).toBe('publishing'));
      mockMarker = 'synthetic-private-invalid-preference';
      await act(async () => { release({ journeys: [] }); await access.controller.whenImportIdle(); });
      await waitFor(() => expect(log).toHaveBeenCalledWith('[Travel Life diagnostic]', expect.objectContaining({ operation: 'ONBOARDING_UPDATES', stage: 'UPDATE_OFFER_READ', reasonCode: 'SCHEMA', durableOutcome: 'unchanged' })));
      expect(view.getByText('Your Atlas')).toBeOnTheScreen();
      expect(mockRegister).not.toHaveBeenCalled();
      expect(JSON.stringify(log.mock.calls)).not.toContain('synthetic-private-invalid-preference');
    } finally { log.mockRestore(); }
  });

  it('withholds a delayed real provider publication after interruption and keeps another task open', async () => {
    const h = fixture();
    const view = await render(<PhotoAccessProvider adapter={h.adapter} repository={h.repository} reconstructionRepository={h.native}><Controls /></PhotoAccessProvider>);
    await waitFor(() => expect(access.privateRecord.state).toBe('connected'));
    await waitFor(() => expect(h.native.loadDurableReveal).toHaveBeenCalled());
    await waitFor(() => expect(access.durableReveal).not.toBeNull());
    let release!: (record: DurableRevealRecord) => void;
    h.native.loadDurableReveal.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    await fireEvent.press(view.getByRole('button', { name: 'Choose library' }));
    await waitFor(() => expect(access.controller.preparation).toBe('publishing'));
    const activity = view.getByRole('progressbar', { name: 'Finishing your Atlas…' });
    expect(activity.props.accessibilityValue?.now).toBeUndefined();
    await fireEvent.press(view.getByRole('button', { name: 'Open independent task' }));
    await act(async () => {
      access.controller.interrupt();
      release({ journeys: [{ displayId: 'synthetic-new', state: 'inferred', anchor: null, years: [2024], periodLabel: '2024', ordering: 'chronological', label: 'Synthetic late result' }] });
      await access.controller.whenImportIdle();
    });
    expect(view.getByText('Independent task stays open')).toBeOnTheScreen();
    expect(view.getByTestId('published-labels')).toHaveTextContent('No published journeys');
    expect(mockRouter.push).not.toHaveBeenCalled(); expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('persists Later through remount without enrolling updates', async () => {
    const h = fixture();
    const tree = <PhotoAccessProvider adapter={h.adapter} repository={h.repository} reconstructionRepository={h.native}><Controls /></PhotoAccessProvider>;
    const view = await render(tree);
    await waitFor(() => expect(access.privateRecord.state).toBe('connected'));
    await fireEvent.press(view.getByRole('button', { name: 'Choose library' }));
    await waitFor(() => expect(view.getByRole('button', { name: 'Later' })).toBeOnTheScreen());
    await fireEvent.press(view.getByRole('button', { name: 'Later' }));
    await waitFor(() => expect(view.queryByRole('button', { name: 'Later' })).toBeNull());
    expect(h.maintenance().enabled).toBe(false); expect(mockRegister).not.toHaveBeenCalled();
    await view.unmount();
    const next = await render(tree);
    await waitFor(() => expect(access.controller.preparation).toBe('complete'));
    expect(next.queryByRole('button', { name: 'Later' })).toBeNull();
  });

  it('enables recurring updates only after explicit Turn on', async () => {
    const h = fixture();
    const view = await render(<PhotoAccessProvider adapter={h.adapter} repository={h.repository} reconstructionRepository={h.native}><Controls /></PhotoAccessProvider>);
    await waitFor(() => expect(access.privateRecord.state).toBe('connected'));
    await fireEvent.press(view.getByRole('button', { name: 'Choose library' }));
    await waitFor(() => expect(view.getByRole('button', { name: 'Turn on' })).toBeOnTheScreen());
    expect(view.getByRole('button', { name: 'Turn on' })).toHaveStyle({ backgroundColor: 'transparent' });
    const rendered = JSON.stringify(view.toJSON());
    expect(rendered.indexOf('Your Atlas')).toBeLessThan(rendered.indexOf('Keep your Atlas up to date'));
    expect(mockRegister).not.toHaveBeenCalled(); expect(h.maintenance().enabled).toBe(false);
    await fireEvent.press(view.getByRole('button', { name: 'Turn on' }));
    await waitFor(() => expect(h.maintenance().enabled).toBe(true));
    expect(mockRegister).toHaveBeenCalledTimes(1);
  });

  it('retains explicit recovery and an independent picker after unavailable inspection', async () => {
    const h = fixture(); (h.adapter.inspect as jest.Mock).mockResolvedValue(null);
    const view = await render(<PhotoAccessProvider adapter={h.adapter} repository={h.repository} reconstructionRepository={h.native}><ImportScreen /></PhotoAccessProvider>);
    await waitFor(() => expect(view.getByRole('button', { name: 'Recheck photo access' })).toBeOnTheScreen());
    expect(view.getByRole('button', { name: 'Choose some photos' })).toBeOnTheScreen();
    await fireEvent.press(view.getByRole('button', { name: 'Choose some photos' }));
    expect(h.adapter.select).toHaveBeenCalledTimes(1); expect(h.adapter.readMetadataPage).not.toHaveBeenCalled();
  });
});
