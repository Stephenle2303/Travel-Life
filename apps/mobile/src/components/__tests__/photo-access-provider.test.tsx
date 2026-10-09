import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { ImportScreen } from '@/components/mobile-screens';
import { PhotoAccessProvider } from '@/photo-access/provider';
import type { PermissionSnapshot, PhotoAccessAdapter } from '@/photo-access/types';
import type { ImportRepository } from '@/import-record';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }));

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
};

describe('photo access provider and Import screen', () => {
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
});
