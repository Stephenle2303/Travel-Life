import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Button, Text } from 'react-native';

import { PrivacySettingsScreen } from '@/components/privacy-settings-screen';
import { PhotoAccessProvider, usePhotoAccess } from '@/photo-access/provider';
import type { PhotoAccessAdapter } from '@/photo-access/types';
import type { ImportRepository } from '@/import-record';

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

function AiLifecycleHarness() {
  const { aiReview, aiProposalController, privateRecordController } = usePhotoAccess();
  return <>
    <Button accessibilityLabel="set AI review" onPress={() => aiProposalController.showDisabledPreview()} title="set AI review" />
    <Button accessibilityLabel="disconnect lifecycle" onPress={() => void privateRecordController.disconnect()} title="disconnect lifecycle" />
    <Button accessibilityLabel="delete lifecycle" onPress={() => void privateRecordController.delete()} title="delete lifecycle" />
    <Text>{aiReview.status}</Text>
  </>;
}

describe('private record settings', () => {
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
    await waitFor(() => expect(view.getByText(/Local history was deleted from this device/)).toBeOnTheScreen());
    expect(view.getByRole('button', { name: 'Start a new private record' })).toBeOnTheScreen();
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
