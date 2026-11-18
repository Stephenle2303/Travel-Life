import { render, userEvent } from '@testing-library/react-native';
import { useState } from 'react';
import { useRouter, type Href } from 'expo-router';

import NotFoundRoute from '@/app/+not-found';
import EmptyAtlasRoute from '@/app/history';
import ImportRoute from '@/app/import';
import WelcomeRoute from '@/app/index';
import LandingRoute from '@/app/welcome';
import * as SecureStore from 'expo-secure-store';
import TrustRoute from '@/app/trust';
import SettingsRoute from '@/app/settings';
import { EmptyAtlasScreen, ImportScreen, NotFoundScreen, PrivacySettingsScreen, ReplayAvailabilityScreen, TrustScreen } from '@/components/mobile-screens';
import { WelcomeScreen } from '@/components/welcome-screen';
import { appRoutes, type AppRoute } from '@/navigation/app-contract';
import { PhotoAccessProvider } from '@/photo-access/provider';
import type { PhotoAccessAdapter } from '@/photo-access/types';

jest.mock('expo-router', () => ({ useRouter: jest.fn(), Redirect: () => null }));
jest.mock('expo-secure-store', () => ({ getItemAsync: async () => null, setItemAsync: async () => {} }));
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

function OwnerFlow() {
  const [route, setRoute] = useState<AppRoute>(appRoutes.welcome);
  useRouterMock.mockReturnValue({ push: (next: Href) => setRoute(next as AppRoute), replace: (next: Href) => setRoute(next as AppRoute), dismissTo: (next: Href) => setRoute(next as AppRoute) } as ReturnType<typeof useRouter>);

  if (route === appRoutes.welcome) return <WelcomeScreen />;
  if (route === appRoutes.trust) return <TrustScreen />;
  if (route === appRoutes.import) return <ImportScreen />;
  if (route === appRoutes.atlas) return <EmptyAtlasScreen />;
  if (route === appRoutes.landing) return <LandingRoute />;
  return <TrustScreen />;
}

describe('private first-run navigation', () => {
  it('returns from Atlas through Home to landing and directly back without photo setup', async () => {
    const presentationWrite = jest.spyOn(SecureStore, 'setItemAsync');
    const view = await render(<PhotoAccessProvider adapter={unavailableAdapter}><OwnerFlow /></PhotoAccessProvider>);
    const user = userEvent.setup();
    await user.press(view.getByRole('button', { name: 'Explore my travel life' }));
    await user.press(view.getByRole('button', { name: 'Not now' }));
    const setupWrites = presentationWrite.mock.calls.length;
    await user.press(view.getByRole('button', { name: 'Home' }));
    expect(view.getByText(/Your travels/)).toBeOnTheScreen();
    await user.press(view.getByRole('button', { name: 'View my Atlas' }));
    expect(view.getByText('Your Atlas')).toBeOnTheScreen();
    expect(view.queryByText('Find your journeys in your photos')).toBeNull();
    expect(presentationWrite).toHaveBeenCalledTimes(setupWrites);
    presentationWrite.mockRestore();
  });
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('takes an owner from Welcome through photo choice to an honest empty Atlas without fetching or prompting on Welcome', async () => {
    const fetchMock = jest.fn();
    globalThis.fetch = fetchMock as typeof fetch;
    const view = await render(<PhotoAccessProvider adapter={unavailableAdapter}><OwnerFlow /></PhotoAccessProvider>);

    expect(view.getByText(/Your travels/)).toBeOnTheScreen();
    expect(view.getByText(/Illustrative footage/)).toBeOnTheScreen();
    expect(view.getByRole('button', { name: 'Explore my travel life' })).toBeOnTheScreen();
    const user = userEvent.setup();
    await user.press(view.getByRole('button', { name: 'Explore my travel life' }));
    expect(view.getByText('Find your journeys in your photos')).toBeOnTheScreen();
    await user.press(view.getByRole('button', { name: 'Not now' }));
    expect(view.getByText('Your Atlas')).toBeOnTheScreen();
    expect(view.getByText(/Access is limited/)).toBeOnTheScreen();
    expect(view.queryByText('Nothing on this screen is a travel claim, map, or inferred history.')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('allows direct entry to the empty Atlas without an account or permission prompt', async () => {
    useRouterMock.mockReturnValue({ push: jest.fn() } as unknown as ReturnType<typeof useRouter>);
    const view = await render(<PhotoAccessProvider adapter={unavailableAdapter}><EmptyAtlasRoute /></PhotoAccessProvider>);

    expect(view.getByText('Your Atlas')).toBeOnTheScreen();
    expect(view.getByText(/Access is limited/)).toBeOnTheScreen();
    expect(view.getByRole('button', { name: 'Import or reconnect photos' })).toBeOnTheScreen();
    expect(view.queryByText(/sign in|create account|allow photos/i)).toBeNull();
  });

  it('keeps a direct Replay route unavailable until the private reveal is eligible', async () => {
    useRouterMock.mockReturnValue({ push: jest.fn(), replace: jest.fn() } as unknown as ReturnType<typeof useRouter>);
    const view = await render(<PhotoAccessProvider adapter={unavailableAdapter}><ReplayAvailabilityScreen /></PhotoAccessProvider>);
    expect(view.getByText('Replay is unavailable.')).toBeOnTheScreen();
    expect(view.getByText(/Replay is unavailable until local access is restored/)).toBeOnTheScreen();
  });

  it('renders a recoverable screen for an unknown route', async () => {
    const dismissTo = jest.fn();
    useRouterMock.mockReturnValue({ push: jest.fn(), replace: jest.fn(), dismissTo } as unknown as ReturnType<typeof useRouter>);
    const view = await render(<NotFoundRoute />);

    expect(view.getByText('Route not found.')).toBeOnTheScreen();
    const user = userEvent.setup();
    await user.press(view.getByRole('button', { name: 'Back to Atlas' }));
    expect(dismissTo).toHaveBeenCalledWith(appRoutes.atlas);
  });

  it('keeps route modules attached to their screen components', () => {
    expect(typeof WelcomeRoute).toBe('function');
    expect(typeof TrustRoute).toBe('function');
    expect(ImportRoute).toBe(ImportScreen);
    expect(EmptyAtlasRoute).toBe(EmptyAtlasScreen);
    expect(SettingsRoute).toBe(PrivacySettingsScreen);
    expect(NotFoundRoute).toBe(NotFoundScreen);
  });
});
