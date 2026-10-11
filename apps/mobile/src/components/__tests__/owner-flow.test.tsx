import { render, userEvent } from '@testing-library/react-native';
import { useState } from 'react';
import { useRouter, type Href } from 'expo-router';

import NotFoundRoute from '@/app/+not-found';
import EmptyAtlasRoute from '@/app/history';
import ImportRoute from '@/app/import';
import WelcomeRoute from '@/app/index';
import TrustRoute from '@/app/trust';
import SettingsRoute from '@/app/settings';
import { EmptyAtlasScreen, ImportScreen, NotFoundScreen, PrivacySettingsScreen, TrustScreen } from '@/components/mobile-screens';
import { WelcomeScreen } from '@/components/welcome-screen';
import { appRoutes, type AppRoute } from '@/navigation/app-contract';
import { PhotoAccessProvider } from '@/photo-access/provider';
import type { PhotoAccessAdapter } from '@/photo-access/types';
import type { ImportRepository } from '@/import-record';

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('expo-video', () => ({
  useVideoPlayer: (_source: unknown, setup: (player: Record<string, unknown>) => void) => {
    const player = { play: jest.fn(), pause: jest.fn(), addListener: () => ({ remove: jest.fn() }) };
    setup(player);
    return player;
  },
  VideoView: () => null,
}));

const useRouterMock = useRouter as jest.MockedFunction<typeof useRouter>;
const unavailableAdapter: PhotoAccessAdapter = {
  inspect: async () => null,
  request: async () => null,
  readPage: async () => { throw new Error('unavailable'); },
  readMetadataPage: async () => { throw new Error('unavailable'); },
  readSelectedMetadata: async () => [],
  manageLimited: async () => {},
  select: async () => ({ canceled: true }),
};
const connectedRepository: ImportRepository = { getCheckpoint: async () => null, loadCoverage: async () => null, commitPage: async () => {}, getPrivateRecordLifecycle: async () => ({ state: 'connected' }), connectPrivateRecord: async () => {}, disconnectPrivateRecord: async () => {}, deleteLocalHistory: async () => {}, saveCorrectionOverlay: async () => {} };

function OwnerFlow() {
  const [route, setRoute] = useState<AppRoute>(appRoutes.welcome);
  useRouterMock.mockReturnValue({ push: (next: Href) => setRoute(next as AppRoute) } as ReturnType<typeof useRouter>);

  if (route === appRoutes.welcome) return <WelcomeScreen />;
  if (route === appRoutes.trust) return <TrustScreen />;
  if (route === appRoutes.import) return <ImportScreen />;
  if (route === appRoutes.atlas) return <EmptyAtlasScreen />;
  return <TrustScreen />;
}

describe('private first-run navigation', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('takes an owner from Welcome through Trust and Import to an honest empty Atlas without fetching or prompting on Welcome', async () => {
    const fetchMock = jest.fn();
    globalThis.fetch = fetchMock as typeof fetch;
    const view = await render(<PhotoAccessProvider adapter={unavailableAdapter}><OwnerFlow /></PhotoAccessProvider>);

    expect(view.getByText(/Your travels/)).toBeOnTheScreen();
    expect(view.getByText(/Illustrative footage/)).toBeOnTheScreen();
    expect(view.getByRole('button', { name: 'Set up private reveal' })).toBeOnTheScreen();
    const user = userEvent.setup();
    await user.press(view.getByRole('button', { name: 'Set up private reveal' }));
    expect(view.getByText('Your travel life, held with care.')).toBeOnTheScreen();
    await user.press(view.getByRole('button', { name: 'Continue to import' }));
    expect(view.getByText('Choose what this device can share.')).toBeOnTheScreen();
    await user.press(view.getByRole('button', { name: 'View empty Atlas' }));
    expect(view.getByText('No private record yet.')).toBeOnTheScreen();
    expect(view.getByText('Nothing on this screen is a travel claim, map, or inferred history.')).toBeOnTheScreen();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('allows direct entry to the empty Atlas without an account or permission prompt', async () => {
    useRouterMock.mockReturnValue({ push: jest.fn() } as unknown as ReturnType<typeof useRouter>);
    const view = await render(<PhotoAccessProvider adapter={unavailableAdapter}><EmptyAtlasRoute /></PhotoAccessProvider>);

    expect(view.getByText('No private record yet.')).toBeOnTheScreen();
    expect(view.getByRole('button', { name: 'Import photos' })).toBeOnTheScreen();
    expect(view.queryByText(/sign in|create account|allow photos/i)).toBeNull();
  });

  it('renders the connected Atlas disabled-AI fallback without a network request', async () => {
    useRouterMock.mockReturnValue({ push: jest.fn() } as unknown as ReturnType<typeof useRouter>);
    const view = await render(<PhotoAccessProvider adapter={unavailableAdapter} repository={connectedRepository}><EmptyAtlasScreen /></PhotoAccessProvider>);
    const user = userEvent.setup();
    await user.press(view.getByRole('button', { name: 'Request optional AI suggestion' }));
    expect(view.getByText('Optional AI is unavailable right now. Your local draft remains available.')).toBeOnTheScreen();
  });

  it('renders a recoverable screen for an unknown route', async () => {
    const dismissTo = jest.fn();
    useRouterMock.mockReturnValue({ push: jest.fn(), replace: jest.fn(), dismissTo } as unknown as ReturnType<typeof useRouter>);
    const view = await render(<NotFoundRoute />);

    expect(view.getByText('Route not found.')).toBeOnTheScreen();
    const user = userEvent.setup();
    await user.press(view.getByRole('button', { name: 'Return home' }));
    expect(dismissTo).toHaveBeenCalledWith(appRoutes.welcome);
  });

  it('keeps route modules attached to their screen components', () => {
    expect(WelcomeRoute).toBe(WelcomeScreen);
    expect(TrustRoute).toBe(TrustScreen);
    expect(ImportRoute).toBe(ImportScreen);
    expect(EmptyAtlasRoute).toBe(EmptyAtlasScreen);
    expect(SettingsRoute).toBe(PrivacySettingsScreen);
    expect(NotFoundRoute).toBe(NotFoundScreen);
  });
});
