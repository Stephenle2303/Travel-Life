import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Button, Text } from 'react-native';
import { useEffect } from 'react';

import { PrivacySettingsScreen } from '@/components/privacy-settings-screen';
import { PhotoAccessProvider, usePhotoAccess } from '@/photo-access/provider';
import type { PhotoAccessAdapter } from '@/photo-access/types';
import type { ImportRepository } from '@/import-record';
import type { ConfiguredHomeArea } from '@/import-record/types';
import type { ReconstructionGraph } from '@/reconstruction';

jest.mock('expo-video', () => ({
  useVideoPlayer: (_source: unknown, setup: (player: { muted: boolean; volume: number; loop: boolean; play(): void; pause(): void }) => void) => {
    const player = { muted: true, volume: 0, loop: false, play: jest.fn(), pause: jest.fn() };
    setup(player); return player;
  },
  VideoView: () => null,
}));

const adapter: PhotoAccessAdapter = {
  inspect: async () => ({ scope: 'full', canAskAgain: false }),
  request: async () => ({ scope: 'full', canAskAgain: false }),
  readPage: async () => 0,
  readMetadataPage: async () => [],
  readSelectedMetadata: async () => [],
  manageLimited: async () => {},
  select: async () => ({ canceled: true }),
};

function lifecycleRepository(): ImportRepository {
  let state: 'connected' | 'disconnected' | 'deleted' = 'connected';
  return {
    getCheckpoint: async () => null,
    loadCoverage: async () => null,
    commitPage: async () => {},
    getPrivateRecordLifecycle: async () => ({ state }),
    connectPrivateRecord: async () => { state = 'connected'; },
    disconnectPrivateRecord: async () => { state = 'disconnected'; },
    deleteLocalHistory: async () => { state = 'deleted'; },
    saveCorrectionOverlay: async () => {},
  };
}

function namedHomeRepository(): ImportRepository {
  return {
    ...lifecycleRepository(),
    loadConfiguredHomeAreas: async () => [{ id: 'legacy-home', label: null, origin: 'legacy' as const, latitude: 10.2, longitude: 105.7, effectiveStartDay: null, effectiveEndDay: null, radiusMeters: 50_000 }],
  };
}

function AiLifecycleHarness() {
  const { aiReview, aiProposalController, privateRecordController } = usePhotoAccess();
  return <>
    <Button accessibilityLabel="set AI review" onPress={() => aiProposalController.showDisabledPreview()} title="set AI review" />
    <Button accessibilityLabel="disconnect lifecycle" onPress={() => void privateRecordController.disconnect()} title="disconnect lifecycle" />
    <Button accessibilityLabel="delete lifecycle" onPress={() => void privateRecordController.delete()} title="delete lifecycle" />
    <Text>{aiReview.status}</Text>
  </>;
}

function HomeSetupHarness({ graph }: { graph: ReconstructionGraph }) {
  const { reconstructionController } = usePhotoAccess();
  useEffect(() => { reconstructionController.publishCommitted(graph); }, [graph, reconstructionController]);
  return <PrivacySettingsScreen />;
}

describe('private record settings', () => {
  it('replaces a legacy Home by typed place after exact readback, retaining its dates and radius', async () => {
    let stored: ConfiguredHomeArea = {
      id: 'legacy-home', label: null, origin: 'legacy', latitude: 10.2, longitude: 105.7,
      effectiveStartDay: '2019-02-04', effectiveEndDay: '2020-04-18', radiusMeters: 50_000,
    };
    let failReadback = false;
    const saveConfiguredHomeArea = jest.fn(async (area: ConfiguredHomeArea) => { stored = area; failReadback = true; });
    const repository: ImportRepository = {
      ...lifecycleRepository(),
      saveConfiguredHomeArea,
      loadConfiguredHomeAreas: async () => {
        if (failReadback) { failReadback = false; throw new Error('PRIVATE_HOME_POINT SQL error'); }
        return [stored];
      },
    };
    const graph = { ruleVersion: 'reconstruction-v1' as const, places: [], visits: [], journeys: [], possibleMerges: [], dispositions: [], memberships: [] };
    const rebuild = jest.fn(async () => graph);
    const reconstructionRepository = {
      loadDurableReveal: async () => ({ journeys: [] }),
      loadJourneyDetail: async () => ({ detail: null as never, previewSourceRefs: [], snapshotToken: 1 }),
      loadJourneyMediaPage: async () => ({ items: [], previewSourceRefs: [], hasMore: false }),
      loadUncertainMemories: async () => ({ memories: [], hasMore: false }),
      saveJourneyCorrection: async () => ({ revisionId: 'review', state: 'confirmed' as const, graph }),
      saveJourneyMemoryCorrection: async () => ({ revisionId: 'memory', graph }),
      discardJourneyCorrectionPending: async () => ({ graph }), markJourneyCorrectionPending: async () => {},
      saveConfiguredHomeAreaFromJourney: async () => {}, rebuild, reconcileQueued: async () => ({ graph, newJourneyCount: 0, updatedJourneyCount: 0 }),
    };
    const log = jest.spyOn(console, 'info').mockImplementation(() => {});
    try {
      const view = await render(<PhotoAccessProvider adapter={adapter} repository={repository} reconstructionRepository={reconstructionRepository}><PrivacySettingsScreen /></PhotoAccessProvider>);
      await fireEvent.press(view.getByRole('button', { name: 'Home bases' }));
      await fireEvent.press(await view.findByRole('button', { name: 'Edit area for unnamed Home base' }));
      await fireEvent.changeText(view.getByLabelText('Search for a city, province, district, ward or commune'), 'Sa Dec Dong Thap');
      expect(stored).toMatchObject({ latitude: 10.2, longitude: 105.7, origin: 'legacy' });
      await fireEvent.press(view.getByRole('button', { name: /^Sa Đéc · City/ }));
      // Editing a Home saved with exact days keeps those days until the owner changes the field (home-setup.md).
      expect(view.getByRole('button', { name: 'From · Feb 2019' })).toBeOnTheScreen();
      expect(view.getByRole('button', { name: 'Until · Apr 2020' })).toBeOnTheScreen();
      await fireEvent.press(view.getByRole('button', { name: 'Save Home base' }));
      expect(await view.findByText(/Couldn't verify your Home setup/)).toBeOnTheScreen();
      expect(rebuild).not.toHaveBeenCalled();
      expect(log).toHaveBeenCalledWith('[Travel Life diagnostic]', expect.objectContaining({
        operation: 'ONBOARDING_SETUP', stage: 'HOME_COMMAND_READBACK', durableOutcome: 'complete',
      }));
      expect(JSON.stringify(log.mock.calls)).not.toContain('PRIVATE_HOME_POINT');
      await fireEvent.press(view.getByRole('button', { name: 'Check again' }));
      expect(await view.findByText(/Home base saved\. Your updated local history is ready in Atlas/)).toBeOnTheScreen();
      expect(saveConfiguredHomeArea).toHaveBeenCalledTimes(1);
      expect(stored).toMatchObject({ id: 'legacy-home', label: 'Sa Đéc', latitude: 10.29085, longitude: 105.75635,
        effectiveStartDay: '2019-02-04', effectiveEndDay: '2020-04-18', radiusMeters: 50_000 });
      expect(rebuild).toHaveBeenCalledTimes(1);
    } finally { log.mockRestore(); }
  });

  it('saves an owner-typed Home radius (M10.10, decision 0023) and shows the dry-run preview before saving', async () => {
    let stored: ConfiguredHomeArea = {
      id: 'legacy-home', label: null, origin: 'legacy', latitude: 10.2, longitude: 105.7,
      effectiveStartDay: null, effectiveEndDay: null, radiusMeters: 50_000,
    };
    const saveConfiguredHomeArea = jest.fn(async (area: ConfiguredHomeArea) => { stored = area; });
    const repository: ImportRepository = {
      ...lifecycleRepository(),
      saveConfiguredHomeArea,
      loadConfiguredHomeAreas: async () => [stored],
    };
    const graph = { ruleVersion: 'reconstruction-v1' as const, places: [], visits: [], journeys: [], possibleMerges: [], dispositions: [], memberships: [] };
    const previewHomeAreaRadius = jest.fn(async (_areaId: string, radiusMeters: number) =>
      radiusMeters >= 200_000 ? { atlasCount: 24, reviewCount: 6, hiddenCount: 40 } : { atlasCount: 10, reviewCount: 20, hiddenCount: 40 });
    const reconstructionRepository = {
      loadDurableReveal: async () => ({ journeys: [] }),
      loadJourneyDetail: async () => ({ detail: null as never, previewSourceRefs: [], snapshotToken: 1 }),
      loadJourneyMediaPage: async () => ({ items: [], previewSourceRefs: [], hasMore: false }),
      loadUncertainMemories: async () => ({ memories: [], hasMore: false }),
      saveJourneyCorrection: async () => ({ revisionId: 'review', state: 'confirmed' as const, graph }),
      saveJourneyMemoryCorrection: async () => ({ revisionId: 'memory', graph }),
      discardJourneyCorrectionPending: async () => ({ graph }), markJourneyCorrectionPending: async () => {},
      saveConfiguredHomeAreaFromJourney: async () => {}, rebuild: async () => graph, reconcileQueued: async () => ({ graph, newJourneyCount: 0, updatedJourneyCount: 0 }),
      previewHomeAreaRadius,
    };
    const view = await render(<PhotoAccessProvider adapter={adapter} repository={repository} reconstructionRepository={reconstructionRepository}><PrivacySettingsScreen /></PhotoAccessProvider>);
    await fireEvent.press(view.getByRole('button', { name: 'Home bases' }));
    await fireEvent.press(await view.findByRole('button', { name: 'Edit area for unnamed Home base' }));
    await fireEvent.changeText(view.getByLabelText('Search for a city, province, district, ward or commune'), 'Sa Dec Dong Thap');
    await fireEvent.press(view.getByRole('button', { name: /^Sa Đéc · City/ }));
    // Defaults to the area's own saved radius (50 km), not the 20 km onboarding default.
    expect(view.getByLabelText('Home radius in kilometers').props.value).toBe('50');
    await waitFor(() => expect(previewHomeAreaRadius).toHaveBeenCalledWith('legacy-home', 50_000));
    expect(await view.findByText('10 trips on Atlas · 20 to review · 40 hidden')).toBeOnTheScreen();
    await fireEvent.changeText(view.getByLabelText('Home radius in kilometers'), '250');
    await waitFor(() => expect(previewHomeAreaRadius).toHaveBeenCalledWith('legacy-home', 250_000));
    expect(await view.findByText('24 trips on Atlas · 6 to review · 40 hidden')).toBeOnTheScreen();
    await fireEvent.press(view.getByRole('button', { name: 'Save Home base' }));
    await waitFor(() => expect(saveConfiguredHomeArea).toHaveBeenCalledTimes(1));
    expect(stored).toMatchObject({ id: 'legacy-home', radiusMeters: 250_000 });
  });

  it('refuses an out-of-range Home radius with a short message and disables Save', async () => {
    const repository: ImportRepository = {
      ...lifecycleRepository(),
      loadConfiguredHomeAreas: async () => [{ id: 'legacy-home', label: null, origin: 'legacy', latitude: 10.2, longitude: 105.7, effectiveStartDay: null, effectiveEndDay: null, radiusMeters: 50_000 }],
    };
    const view = await render(<PhotoAccessProvider adapter={adapter} repository={repository}><PrivacySettingsScreen /></PhotoAccessProvider>);
    await fireEvent.press(view.getByRole('button', { name: 'Home bases' }));
    await fireEvent.press(await view.findByRole('button', { name: 'Edit area for unnamed Home base' }));
    await fireEvent.changeText(view.getByLabelText('Search for a city, province, district, ward or commune'), 'Sa Dec Dong Thap');
    await fireEvent.press(view.getByRole('button', { name: /^Sa Đéc · City/ }));
    await fireEvent.changeText(view.getByLabelText('Home radius in kilometers'), '301');
    expect(view.getByText('Radius must be a number above 0 and at most 300 km.')).toBeOnTheScreen();
    expect(view.getByRole('button', { name: 'Save Home base' })).toBeDisabled();
  });

  it('hides a previously-fetched preview once the radius becomes out of range (code-review finding, 2026-11-23)', async () => {
    const repository: ImportRepository = {
      ...lifecycleRepository(),
      loadConfiguredHomeAreas: async () => [{ id: 'legacy-home', label: null, origin: 'legacy', latitude: 10.2, longitude: 105.7, effectiveStartDay: null, effectiveEndDay: null, radiusMeters: 50_000 }],
    };
    const graph = { ruleVersion: 'reconstruction-v1' as const, places: [], visits: [], journeys: [], possibleMerges: [], dispositions: [], memberships: [] };
    const reconstructionRepository = {
      loadDurableReveal: async () => ({ journeys: [] }),
      loadJourneyDetail: async () => ({ detail: null as never, previewSourceRefs: [], snapshotToken: 1 }),
      loadJourneyMediaPage: async () => ({ items: [], previewSourceRefs: [], hasMore: false }),
      loadUncertainMemories: async () => ({ memories: [], hasMore: false }),
      saveJourneyCorrection: async () => ({ revisionId: 'review', state: 'confirmed' as const, graph }),
      saveJourneyMemoryCorrection: async () => ({ revisionId: 'memory', graph }),
      discardJourneyCorrectionPending: async () => ({ graph }), markJourneyCorrectionPending: async () => {},
      saveConfiguredHomeAreaFromJourney: async () => {}, rebuild: async () => graph, reconcileQueued: async () => ({ graph, newJourneyCount: 0, updatedJourneyCount: 0 }),
      previewHomeAreaRadius: async () => ({ atlasCount: 10, reviewCount: 20, hiddenCount: 40 }),
    };
    const view = await render(<PhotoAccessProvider adapter={adapter} repository={repository} reconstructionRepository={reconstructionRepository}><PrivacySettingsScreen /></PhotoAccessProvider>);
    await fireEvent.press(view.getByRole('button', { name: 'Home bases' }));
    await fireEvent.press(await view.findByRole('button', { name: 'Edit area for unnamed Home base' }));
    await fireEvent.changeText(view.getByLabelText('Search for a city, province, district, ward or commune'), 'Sa Dec Dong Thap');
    await fireEvent.press(view.getByRole('button', { name: /^Sa Đéc · City/ }));
    expect(await view.findByText('10 trips on Atlas · 20 to review · 40 hidden')).toBeOnTheScreen();
    await fireEvent.changeText(view.getByLabelText('Home radius in kilometers'), '301');
    await waitFor(() => expect(view.queryByText('10 trips on Atlas · 20 to review · 40 hidden')).toBeNull());
    expect(view.getByText('Radius must be a number above 0 and at most 300 km.')).toBeOnTheScreen();
  });

  it('shows the v1.2/v1.3 comparison and switches, then offers to roll back (M10.12, decision 0023)', async () => {
    const graph = { ruleVersion: 'reconstruction-v1' as const, places: [], visits: [], journeys: [], possibleMerges: [], dispositions: [], memberships: [] };
    let active: 'trip-detector-v1.2' | 'trip-detector-v1.3' = 'trip-detector-v1.2';
    const setDetectorPolicy = jest.fn(async (ruleVersion: 'trip-detector-v1.2' | 'trip-detector-v1.3') => { active = ruleVersion; });
    const compareDetectorPolicy = jest.fn(async () => active === 'trip-detector-v1.2'
      ? { activePolicy: 'trip-detector-v1.2' as const, candidatePolicy: 'trip-detector-v1.3' as const,
          active: { atlasCount: 24, reviewCount: 38, hiddenCount: 14 }, candidate: { atlasCount: 30, reviewCount: 6, hiddenCount: 40 },
          gainedCount: 8, lostCount: 2, changedCount: 3, unchangedCount: 63 }
      : { activePolicy: 'trip-detector-v1.3' as const, candidatePolicy: 'trip-detector-v1.2' as const,
          active: { atlasCount: 30, reviewCount: 6, hiddenCount: 40 }, candidate: { atlasCount: 24, reviewCount: 38, hiddenCount: 14 },
          gainedCount: 2, lostCount: 8, changedCount: 3, unchangedCount: 63 });
    const reconstructionRepository = {
      loadDurableReveal: async () => ({ journeys: [] }),
      loadJourneyDetail: async () => ({ detail: null as never, previewSourceRefs: [], snapshotToken: 1 }),
      loadJourneyMediaPage: async () => ({ items: [], previewSourceRefs: [], hasMore: false }),
      loadUncertainMemories: async () => ({ memories: [], hasMore: false }),
      saveJourneyCorrection: async () => ({ revisionId: 'review', state: 'confirmed' as const, graph }),
      saveJourneyMemoryCorrection: async () => ({ revisionId: 'memory', graph }),
      discardJourneyCorrectionPending: async () => ({ graph }), markJourneyCorrectionPending: async () => {},
      saveConfiguredHomeAreaFromJourney: async () => {}, rebuild: async () => graph, reconcileQueued: async () => ({ graph, newJourneyCount: 0, updatedJourneyCount: 0 }),
      compareDetectorPolicy,
    };
    const repository: ImportRepository = { ...lifecycleRepository(), setDetectorPolicy };
    const view = await render(<PhotoAccessProvider adapter={adapter} repository={repository} reconstructionRepository={reconstructionRepository}><PrivacySettingsScreen /></PhotoAccessProvider>);
    await fireEvent.press(view.getByRole('button', { name: 'Trip detection' }));
    expect(await view.findByText('Right now, with the current trip rules: 24 on Atlas · 38 to review · 14 hidden')).toBeOnTheScreen();
    expect(view.getByText('With the new trip rules: 30 on Atlas · 6 to review · 40 hidden')).toBeOnTheScreen();
    expect(view.getByText('8 trips would move onto Atlas, 2 would move off, 3 would otherwise change.')).toBeOnTheScreen();
    await fireEvent.press(view.getByRole('button', { name: 'Switch to the new trip rules' }));
    expect(setDetectorPolicy).toHaveBeenCalledWith('trip-detector-v1.3');
    expect(await view.findByText('Right now, with the new trip rules: 30 on Atlas · 6 to review · 40 hidden')).toBeOnTheScreen();
    expect(view.getByText('With the current trip rules: 24 on Atlas · 38 to review · 14 hidden')).toBeOnTheScreen();
    expect(view.getByRole('button', { name: 'Switch back to the previous trip rules' })).toBeOnTheScreen();
  });

  it('reverts the stored policy and refreshes the comparison when the post-switch rebuild fails (code-review finding, 2026-11-23)', async () => {
    const graph = { ruleVersion: 'reconstruction-v1' as const, places: [], visits: [], journeys: [], possibleMerges: [], dispositions: [], memberships: [] };
    let active: 'trip-detector-v1.2' | 'trip-detector-v1.3' = 'trip-detector-v1.2';
    const loadDetectorPolicy = jest.fn(async () => active);
    const setDetectorPolicy = jest.fn(async (ruleVersion: 'trip-detector-v1.2' | 'trip-detector-v1.3') => { active = ruleVersion; });
    const compareDetectorPolicy = jest.fn(async () => ({
      activePolicy: active, candidatePolicy: active === 'trip-detector-v1.2' ? ('trip-detector-v1.3' as const) : ('trip-detector-v1.2' as const),
      active: { atlasCount: 24, reviewCount: 38, hiddenCount: 14 }, candidate: { atlasCount: 30, reviewCount: 6, hiddenCount: 40 },
      gainedCount: 8, lostCount: 2, changedCount: 3, unchangedCount: 63,
    }));
    const reconstructionRepository = {
      loadDurableReveal: async () => ({ journeys: [] }),
      loadJourneyDetail: async () => ({ detail: null as never, previewSourceRefs: [], snapshotToken: 1 }),
      loadJourneyMediaPage: async () => ({ items: [], previewSourceRefs: [], hasMore: false }),
      loadUncertainMemories: async () => ({ memories: [], hasMore: false }),
      saveJourneyCorrection: async () => ({ revisionId: 'review', state: 'confirmed' as const, graph }),
      saveJourneyMemoryCorrection: async () => ({ revisionId: 'memory', graph }),
      discardJourneyCorrectionPending: async () => ({ graph }), markJourneyCorrectionPending: async () => {},
      saveConfiguredHomeAreaFromJourney: async () => {},
      // The rebuild that follows a policy switch fails.
      rebuild: async () => { throw new Error('database is locked: synthetic-detector-rebuild-failure'); },
      reconcileQueued: async () => ({ graph, newJourneyCount: 0, updatedJourneyCount: 0 }),
      compareDetectorPolicy,
    };
    const repository: ImportRepository = { ...lifecycleRepository(), loadDetectorPolicy, setDetectorPolicy };
    const view = await render(<PhotoAccessProvider adapter={adapter} repository={repository} reconstructionRepository={reconstructionRepository}><PrivacySettingsScreen /></PhotoAccessProvider>);
    await fireEvent.press(view.getByRole('button', { name: 'Trip detection' }));
    await view.findByRole('button', { name: 'Switch to the new trip rules' });
    await fireEvent.press(view.getByRole('button', { name: 'Switch to the new trip rules' }));
    await waitFor(() => expect(view.getByText('Switching trip rules did not complete. Try again.')).toBeOnTheScreen());
    // Reverted: setDetectorPolicy is called once to switch, once to revert
    // back, in that order — and the stored policy ends up unchanged.
    expect(setDetectorPolicy.mock.calls.map(([version]) => version)).toEqual(['trip-detector-v1.3', 'trip-detector-v1.2']);
    expect(active).toBe('trip-detector-v1.2');
    // The comparison is re-read rather than left showing a stale/assumed state.
    expect(view.getByRole('button', { name: 'Switch to the new trip rules' })).toBeOnTheScreen();
  });

  it('offers a private existing-place home-base setup without asking for coordinates', async () => {
    const view = await render(<PhotoAccessProvider adapter={adapter} repository={lifecycleRepository()}><PrivacySettingsScreen /></PhotoAccessProvider>);
    await fireEvent.press(view.getByRole('button', { name: 'Home bases' }));
    await waitFor(() => expect(view.getByText('Home bases')).toBeOnTheScreen());
    expect(view.getByText(/Choose a private journey, review its photos and videos/)).toBeOnTheScreen();
    expect(view.queryByLabelText(/latitude|longitude|coordinate/i)).toBeNull();
  });

  it('shows a migrated Home base as unnamed instead of inventing a locality', async () => {
    const view = await render(<PhotoAccessProvider adapter={adapter} repository={namedHomeRepository()}><PrivacySettingsScreen /></PhotoAccessProvider>);
    await fireEvent.press(view.getByRole('button', { name: 'Home bases' }));
    await waitFor(() => expect(view.getByText('Unnamed home base')).toBeOnTheScreen());
    expect(view.getByText(/Within 50 km/)).toBeOnTheScreen();
    expect(view.getByRole('button', { name: 'Rename unnamed Home base' })).toBeOnTheScreen();
  });

  it('refuses to remove the last Home base (H-4) without calling the repository', async () => {
    const deleteConfiguredHomeArea = jest.fn(async () => {});
    const repository: ImportRepository = { ...namedHomeRepository(), deleteConfiguredHomeArea };
    const view = await render(<PhotoAccessProvider adapter={adapter} repository={repository}><PrivacySettingsScreen /></PhotoAccessProvider>);
    await fireEvent.press(view.getByRole('button', { name: 'Home bases' }));
    await fireEvent.press(await view.findByRole('button', { name: 'Remove unnamed Home base' }));
    expect(await view.findByText(/Add another Home base before removing this one/)).toBeOnTheScreen();
    expect(view.queryByRole('button', { name: 'Confirm remove Home base' })).toBeNull();
    expect(deleteConfiguredHomeArea).not.toHaveBeenCalled();
  });

  it('refuses to remove the last Home base even when called directly, bypassing the Settings UI gate', async () => {
    const deleteConfiguredHomeArea = jest.fn(async () => {});
    const repository: ImportRepository = { ...namedHomeRepository(), deleteConfiguredHomeArea };
    let access!: ReturnType<typeof usePhotoAccess>;
    const Harness = () => { const value = usePhotoAccess(); useEffect(() => { access = value; }, [value]); return null; };
    await render(<PhotoAccessProvider adapter={adapter} repository={repository}><Harness /></PhotoAccessProvider>);
    await waitFor(() => expect(access.homeBases).toHaveLength(1));

    await expect(access.removeConfiguredHomeArea('legacy-home')).rejects.toThrow('At least one Home base is required.');

    expect(deleteConfiguredHomeArea).not.toHaveBeenCalled();
  });

  it('removes a Home base once another one exists', async () => {
    let areas: ConfiguredHomeArea[] = [
      { id: 'home-a', label: 'Home A', origin: 'manual-pin', latitude: 10.2, longitude: 105.7, effectiveStartDay: null, effectiveEndDay: null, radiusMeters: 20_000 },
      { id: 'home-b', label: 'Home B', origin: 'manual-pin', latitude: 11.2, longitude: 106.7, effectiveStartDay: null, effectiveEndDay: null, radiusMeters: 20_000 },
    ];
    const graph = { ruleVersion: 'reconstruction-v1' as const, places: [], visits: [], journeys: [], possibleMerges: [], dispositions: [], memberships: [] };
    const repository: ImportRepository = {
      ...lifecycleRepository(),
      loadConfiguredHomeAreas: async () => areas,
      deleteConfiguredHomeArea: jest.fn(async (id: string) => { areas = areas.filter((area) => area.id !== id); }),
    };
    const reconstructionRepository = {
      loadDurableReveal: async () => ({ journeys: [] }),
      loadJourneyDetail: async () => ({ detail: null as never, previewSourceRefs: [], snapshotToken: 1 }),
      loadJourneyMediaPage: async () => ({ items: [], previewSourceRefs: [], hasMore: false }),
      loadUncertainMemories: async () => ({ memories: [], hasMore: false }),
      saveJourneyCorrection: async () => ({ revisionId: 'review', state: 'confirmed' as const, graph }),
      saveJourneyMemoryCorrection: async () => ({ revisionId: 'memory', graph }),
      discardJourneyCorrectionPending: async () => ({ graph }), markJourneyCorrectionPending: async () => {},
      saveConfiguredHomeAreaFromJourney: async () => {}, rebuild: async () => graph, reconcileQueued: async () => ({ graph, newJourneyCount: 0, updatedJourneyCount: 0 }),
    };
    const view = await render(<PhotoAccessProvider adapter={adapter} repository={repository} reconstructionRepository={reconstructionRepository}><PrivacySettingsScreen /></PhotoAccessProvider>);
    await fireEvent.press(view.getByRole('button', { name: 'Home bases' }));
    await fireEvent.press(await view.findByRole('button', { name: 'Remove Home A' }));
    await fireEvent.press(view.getByRole('button', { name: 'Confirm remove Home base' }));
    expect(await view.findByText(/Home base removed/)).toBeOnTheScreen();
    expect(view.queryByText('Home A')).toBeNull();
    expect(view.getByText('Home B')).toBeOnTheScreen();
  });

  it('requires reviewing a journey and selecting its observed area before saving a home base', async () => {
    const graph = { ruleVersion: 'reconstruction-v1' as const, places: [], visits: [], journeys: [], possibleMerges: [], dispositions: [], memberships: [] };
    const saveConfiguredHomeAreaFromJourney = jest.fn(async () => {});
    const reconstructionRepository = {
      loadDurableReveal: async () => ({ journeys: [{ displayId: 'journey-1', state: 'inferred' as const, anchor: { latitude: 10.8, longitude: 106.6 }, years: [2024], periodLabel: 'April 2024', ordering: 'chronological' as const, label: 'Vietnam' }], statistics: null }),
      loadJourneyDetail: async () => ({ detail: { id: 'journey-1', title: 'Vietnam', observedSpan: 'Observed April 2024', visits: [{ id: 'visit-home', label: 'Observed area', precision: 'Chronological', support: '2 photos' }], memories: [{ id: 'memory-1', availability: 'unavailable' as const, association: 'Associated local media' }], uncertainty: [] }, previewSourceRefs: [null], snapshotToken: 1 }),
      loadJourneyMediaPage: async () => ({ items: [], previewSourceRefs: [], hasMore: false }),
      loadUncertainMemories: async () => ({ memories: [], hasMore: false }),
      saveJourneyCorrection: async () => ({ revisionId: 'review', state: 'confirmed' as const, graph }),
      saveJourneyMemoryCorrection: async () => ({ revisionId: 'memory', graph: null }),
      discardJourneyCorrectionPending: async () => ({ graph: null }),
      markJourneyCorrectionPending: async () => {},
      saveConfiguredHomeAreaFromJourney,
      rebuild: async () => graph,
      reconcileQueued: async () => ({ graph, newJourneyCount: 0, updatedJourneyCount: 0 }),
    };
    const view = await render(<PhotoAccessProvider adapter={adapter} repository={lifecycleRepository()} reconstructionRepository={reconstructionRepository}><HomeSetupHarness graph={graph} /></PhotoAccessProvider>);
    await fireEvent.press(view.getByRole('button', { name: 'Home bases' }));
    await waitFor(() => expect(view.getByRole('button', { name: 'Review Vietnam for a home base' })).toBeOnTheScreen());
    await fireEvent.press(view.getByRole('button', { name: 'Review Vietnam for a home base' }));
    await waitFor(() => expect(view.getByText('Review this journey')).toBeOnTheScreen());
    expect(view.getByRole('button', { name: 'Save home base' })).toBeDisabled();
    await fireEvent.press(view.getByRole('button', { name: 'Choose observed area Observed area' }));
    await fireEvent.changeText(view.getByLabelText('New Home base name'), 'Sa Dec, Dong Thap');
    await fireEvent.press(view.getByRole('button', { name: 'Save home base' }));
    await waitFor(() => expect(saveConfiguredHomeAreaFromJourney).toHaveBeenCalledWith('journey-1', 'home:journey-1:visit-home', 'visit-home', 'Sa Dec, Dong Thap', null, null));
    expect(view.getByText(/Home base saved\. Your updated local history is ready in Atlas/)).toBeOnTheScreen();
  });

  it('does not offer an owner-entered coarse anchor as an observed Home-base area', async () => {
    const graph = { ruleVersion: 'reconstruction-v1' as const, places: [], visits: [], journeys: [], possibleMerges: [], dispositions: [], memberships: [] };
    const reconstructionRepository = {
      loadDurableReveal: async () => ({ journeys: [{ displayId: 'journey-observed', state: 'inferred' as const, anchor: { latitude: 13.7, longitude: 100.5 }, years: [2023], periodLabel: '2023', ordering: 'chronological' as const, label: 'Observed trip' }, { displayId: 'manual:kyoto', state: 'owner-entered' as const, anchor: { latitude: 35.7, longitude: 139.7 }, years: [2024], periodLabel: '2024-04-01', ordering: 'chronological' as const, label: 'Kyoto · Japan', locationKind: 'owner-entered' as const }], statistics: null }),
      loadJourneyDetail: async () => ({ detail: { id: 'manual:kyoto', title: 'Kyoto', observedSpan: 'Owner-entered', visits: [], memories: [], uncertainty: [], ownerEntered: true }, previewSourceRefs: [], snapshotToken: 0 }),
      loadJourneyMediaPage: async () => ({ items: [], previewSourceRefs: [], hasMore: false }), loadUncertainMemories: async () => ({ memories: [], hasMore: false }),
      saveJourneyCorrection: async () => ({ revisionId: 'review', state: 'confirmed' as const, graph }), saveJourneyMemoryCorrection: async () => ({ revisionId: 'memory', graph: null }), discardJourneyCorrectionPending: async () => ({ graph: null }), markJourneyCorrectionPending: async () => {}, saveConfiguredHomeAreaFromJourney: async () => {}, rebuild: async () => graph, reconcileQueued: async () => ({ graph, newJourneyCount: 0, updatedJourneyCount: 0 }),
    };
    const view = await render(<PhotoAccessProvider adapter={adapter} repository={lifecycleRepository()} reconstructionRepository={reconstructionRepository}><HomeSetupHarness graph={graph} /></PhotoAccessProvider>);
    await fireEvent.press(view.getByRole('button', { name: 'Home bases' }));
    await waitFor(() => expect(view.getByRole('button', { name: 'Review Observed trip for a home base' })).toBeOnTheScreen());
    expect(view.queryByRole('button', { name: /Review Kyoto/ })).toBeNull();
  });

  it('keeps local history when the owner cancels the deletion confirmation', async () => {
    const view = await render(
      <PhotoAccessProvider adapter={adapter} repository={lifecycleRepository()}>
        <PrivacySettingsScreen />
      </PhotoAccessProvider>,
    );
    await fireEvent.press(view.getByRole('button', { name: 'Privacy & data' }));

    await waitFor(() => expect(view.getByRole('button', { name: 'Delete local history' })).toBeOnTheScreen());
    await fireEvent.press(view.getByRole('button', { name: 'Delete local history' }));
    await fireEvent.press(view.getByRole('button', { name: 'Cancel delete local history' }));

    expect(view.queryByText('Delete private history from this device?')).toBeNull();
    expect(view.getByRole('button', { name: 'Disconnect photo source' })).toBeOnTheScreen();
  });

  it('keeps disconnect distinct from confirmed local-history deletion', async () => {
    const view = await render(
      <PhotoAccessProvider adapter={adapter} repository={lifecycleRepository()}>
        <PrivacySettingsScreen />
      </PhotoAccessProvider>,
    );
    await fireEvent.press(view.getByRole('button', { name: 'Privacy & data' }));

    await waitFor(() => expect(view.getByText('Privacy & data')).toBeOnTheScreen());
    expect(view.getByText(/Normal device backups may restore this private record/)).toBeOnTheScreen();

    await fireEvent.press(view.getByRole('button', { name: 'Disconnect photo source' }));
    await waitFor(() => expect(view.getByText(/Photo-source reads and maintenance are stopped/)).toBeOnTheScreen());
    expect(view.getByRole('button', { name: 'Reconnect private record' })).toBeOnTheScreen();

    await fireEvent.press(view.getByRole('button', { name: 'Delete local history' }));
    expect(view.getByText('Delete private history from this device?')).toBeOnTheScreen();
    await fireEvent.press(view.getByRole('button', { name: 'Confirm delete local history' }));
    await waitFor(() => expect(view.getByText('Local history was deleted. Remote link access removal is confirmed. Original photos and saved recipient copies were not changed.')).toBeOnTheScreen());
    expect(view.getByRole('button', { name: 'Start a new private record' })).toBeOnTheScreen();
  });

  it('keeps private-record failures and deletion progress beside the lifecycle controls', async () => {
    let releaseDelete!: () => void;
    const pendingDelete = new Promise<void>((resolve) => { releaseDelete = resolve; });
    const repository: ImportRepository = {
      ...lifecycleRepository(),
      connectPrivateRecord: async () => { throw new Error('sqlite'); },
      deleteLocalHistory: async () => pendingDelete,
    };
    const view = await render(<PhotoAccessProvider adapter={adapter} repository={repository}><PrivacySettingsScreen /></PhotoAccessProvider>);
    await fireEvent.press(view.getByRole('button', { name: 'Privacy & data' }));
    await waitFor(() => expect(view.getByRole('button', { name: 'Disconnect photo source' })).toBeOnTheScreen());
    await fireEvent.press(view.getByRole('button', { name: 'Disconnect photo source' }));
    await waitFor(() => expect(view.getByRole('button', { name: 'Reconnect private record' })).toBeOnTheScreen());
    await fireEvent.press(view.getByRole('button', { name: 'Reconnect private record' }));
    await waitFor(() => expect(view.getByText(/could not be opened.*Retry/)).toBeOnTheScreen());
    await fireEvent.press(view.getByRole('button', { name: 'Delete local history' }));
    await fireEvent.press(view.getByRole('button', { name: 'Confirm delete local history' }));
    await waitFor(() => expect(view.getByText('Deleting local history from this device…')).toBeOnTheScreen());
    releaseDelete();
    await waitFor(() => expect(view.getByRole('button', { name: 'Start a new private record' })).toBeOnTheScreen());
  });

  it('clears transient AI review state for disconnect and deletion', async () => {
    const view = await render(<PhotoAccessProvider adapter={adapter} repository={lifecycleRepository()}><AiLifecycleHarness /></PhotoAccessProvider>);
    await fireEvent.press(view.getByRole('button', { name: 'set AI review' }));
    expect(view.getByText('skipped')).toBeOnTheScreen();
    await fireEvent.press(view.getByRole('button', { name: 'disconnect lifecycle' }));
    await waitFor(() => expect(view.getByText('idle')).toBeOnTheScreen());
    await fireEvent.press(view.getByRole('button', { name: 'set AI review' }));
    await fireEvent.press(view.getByRole('button', { name: 'delete lifecycle' }));
    await waitFor(() => expect(view.getByText('idle')).toBeOnTheScreen());
  });

  describe('CAP-7 "What Travel Life learned"', () => {
    it('lists a learned preference in plain language and removes it without a raw rule kind ever showing', async () => {
      const removePersonalRule = jest.fn(async () => {});
      const repository: ImportRepository = {
        ...lifecycleRepository(),
        loadPersonalRules: async () => [{ ruleId: 'pair-preference:clue-1', kind: 'pair-preference', scope: { clueId: 'clue-1' }, createdAtMillis: 1000 }],
        removePersonalRule,
      };
      const view = await render(<PhotoAccessProvider adapter={adapter} repository={repository}><PrivacySettingsScreen /></PhotoAccessProvider>);
      await fireEvent.press(view.getByRole('button', { name: 'What Travel Life learned' }));
      await waitFor(() => expect(view.getByText(/won't suggest merging them again/i)).toBeOnTheScreen());
      expect(view.queryByText(/pair-preference/)).toBeNull();
      await fireEvent.press(view.getByRole('button', { name: 'Remove this learned preference' }));
      await waitFor(() => expect(removePersonalRule).toHaveBeenCalledWith('pair-preference:clue-1'));
      await waitFor(() => expect(view.queryByText(/won't suggest merging them again/i)).toBeNull());
    });

    it('shows an empty-state message rather than a blank screen when nothing has been learned yet', async () => {
      const view = await render(<PhotoAccessProvider adapter={adapter} repository={{ ...lifecycleRepository(), loadPersonalRules: async () => [] }}><PrivacySettingsScreen /></PhotoAccessProvider>);
      await fireEvent.press(view.getByRole('button', { name: 'What Travel Life learned' }));
      await waitFor(() => expect(view.getByText(/hasn't learned any preferences yet/i)).toBeOnTheScreen());
    });
  });
});
