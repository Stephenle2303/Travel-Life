import { render, userEvent } from '@testing-library/react-native';
import { useState } from 'react';
import { useRouter, type Href } from 'expo-router';

import NotFoundRoute from '@/app/+not-found';
import EmptyAtlasRoute from '@/app/history';
import ImportRoute from '@/app/import';
import TrustRoute from '@/app/index';
import { EmptyAtlasScreen, ImportScreen, NotFoundScreen, TrustScreen } from '@/components/mobile-screens';
import { appRoutes, type AppRoute } from '@/navigation/app-contract';
import { PhotoAccessProvider } from '@/photo-access/provider';
import type { PhotoAccessAdapter } from '@/photo-access/types';

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));

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
  const [route, setRoute] = useState<AppRoute>(appRoutes.trust);
  useRouterMock.mockReturnValue({ push: (next: Href) => setRoute(next as AppRoute) } as ReturnType<typeof useRouter>);

  if (route === appRoutes.import) return <ImportScreen />;
  if (route === appRoutes.atlas) return <EmptyAtlasScreen />;
  return <TrustScreen />;
}

describe('private first-run navigation', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('takes an owner from Trust through Import to an honest empty Atlas without fetching', async () => {
    const fetchMock = jest.fn();
    globalThis.fetch = fetchMock as typeof fetch;
    const view = await render(<PhotoAccessProvider adapter={unavailableAdapter}><OwnerFlow /></PhotoAccessProvider>);

    expect(view.getByText('Your travel life, held with care.')).toBeOnTheScreen();
    const user = userEvent.setup();
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

  it('renders a recoverable screen for an unknown route', async () => {
    const dismissTo = jest.fn();
    useRouterMock.mockReturnValue({ push: jest.fn(), replace: jest.fn(), dismissTo } as unknown as ReturnType<typeof useRouter>);
    const view = await render(<NotFoundRoute />);

    expect(view.getByText('Route not found.')).toBeOnTheScreen();
    const user = userEvent.setup();
    await user.press(view.getByRole('button', { name: 'Return home' }));
    expect(dismissTo).toHaveBeenCalledWith(appRoutes.trust);
  });

  it('keeps route modules attached to their screen components', () => {
    expect(TrustRoute).toBe(TrustScreen);
    expect(ImportRoute).toBe(ImportScreen);
    expect(EmptyAtlasRoute).toBe(EmptyAtlasScreen);
    expect(NotFoundRoute).toBe(NotFoundScreen);
  });
});
