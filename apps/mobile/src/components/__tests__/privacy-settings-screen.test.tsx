import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { PrivacySettingsScreen } from '@/components/privacy-settings-screen';
import { PhotoAccessProvider } from '@/photo-access/provider';
import type { PhotoAccessAdapter } from '@/photo-access/types';
import type { ImportRepository } from '@/import-record';

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
});
