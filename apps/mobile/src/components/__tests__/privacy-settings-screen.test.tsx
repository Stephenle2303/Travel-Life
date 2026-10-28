import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Button, Text } from 'react-native';
import { useEffect } from 'react';

import { PrivacySettingsScreen } from '@/components/privacy-settings-screen';
import { PhotoAccessProvider, usePhotoAccess } from '@/photo-access/provider';
import type { PhotoAccessAdapter } from '@/photo-access/types';
import type { ImportRepository } from '@/import-record';
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
  it('offers a private existing-place home-base setup without asking for coordinates', async () => {
    const view = await render(<PhotoAccessProvider adapter={adapter} repository={lifecycleRepository()}><PrivacySettingsScreen /></PhotoAccessProvider>);
    await waitFor(() => expect(view.getByText('Home bases')).toBeOnTheScreen());
    expect(view.getByText(/Choose a private journey, review its photos and videos/)).toBeOnTheScreen();
    expect(view.queryByLabelText(/latitude|longitude|coordinate/i)).toBeNull();
  });

  it('shows a migrated Home base as unnamed instead of inventing a locality', async () => {
    const view = await render(<PhotoAccessProvider adapter={adapter} repository={namedHomeRepository()}><PrivacySettingsScreen /></PhotoAccessProvider>);
    await waitFor(() => expect(view.getByText('Unnamed home base')).toBeOnTheScreen());
    expect(view.getByText(/Within 50 km/)).toBeOnTheScreen();
    expect(view.getByRole('button', { name: 'Rename unnamed Home base' })).toBeOnTheScreen();
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
    await waitFor(() => expect(view.getByRole('button', { name: 'Review Observed trip for a home base' })).toBeOnTheScreen());
    expect(view.queryByRole('button', { name: /Review Kyoto/ })).toBeNull();
  });

  it('keeps local history when the owner cancels the deletion confirmation', async () => {
    const view = await render(
      <PhotoAccessProvider adapter={adapter} repository={lifecycleRepository()}>
        <PrivacySettingsScreen />
      </PhotoAccessProvider>,
    );

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

    await waitFor(() => expect(view.getByText('Private record controls')).toBeOnTheScreen());
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
});
