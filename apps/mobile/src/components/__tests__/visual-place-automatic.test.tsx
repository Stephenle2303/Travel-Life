import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { VisualDiscoverySetting, VisualPlaceRecovery } from '@/components/visual-place-recovery';
import { ewhaPlace, type AutomaticVisualDiscovery, type AutomaticVisualProposal } from '@/visual-place/recovery';
import { resolveVisualPlace } from '@/visual-place/place-catalog';

jest.mock('expo-router', () => ({
  useFocusEffect: (effect: () => void) => jest.requireActual('react').useEffect(effect, [effect]),
}));

const proposal = {
  token: {}, observedPeriod: '2025-06-01 – 2025-06-06', place: ewhaPlace,
  covers: [{ id: 'photo-1', uri: 'file:///synthetic-one' }],
  stops: [ewhaPlace], count: 13, correction: false,
};
function fixture(enabled: boolean, offer: AutomaticVisualProposal = proposal): AutomaticVisualDiscovery {
  return {
    enabled, settingBusy: false, settingFailed: false,
    setEnabled: jest.fn(async () => {}),
    discover: jest.fn().mockResolvedValueOnce({ proposal: offer, more: false }).mockResolvedValue({ proposal: null, more: false }),
    loadAlbum: jest.fn().mockResolvedValueOnce({ photos: proposal.covers, hasMore: true })
      .mockResolvedValueOnce({ photos: [{ id: 'photo-13', uri: 'file:///synthetic-last' }], hasMore: false }),
    review: jest.fn(async () => true),
  };
}

it('offers a private trip automatically, without dates, selected photos or an Analyze action', async () => {
  const previous = AppState.currentState;
  AppState.currentState = 'active';
  try {
    const discovery = fixture(true);
    const view = await render(<VisualPlaceRecovery discovery={discovery} version={{}} />);
    expect(discovery.discover).toHaveBeenCalledWith(expect.anything());
    expect(discovery.review).not.toHaveBeenCalled();
    await view.findByText('You may be missing a trip');
    expect(view.getByText('Ewha Womans University · Seoul, South Korea')).toBeOnTheScreen();
    expect(view.getByText(proposal.observedPeriod)).toBeOnTheScreen();
    expect(view.getByLabelText('Suggested trip photo 1')).toBeOnTheScreen();
    expect(view.queryByLabelText('Trip start date')).toBeNull();
    expect(view.queryByText(/Analyze/)).toBeNull();
    expect(view.queryByText('Confirm trip')).toBeNull();
    await fireEvent.press(view.getByText('Review trip photos'));
    await fireEvent.press(await view.findByText('Next photos'));
    await waitFor(() => expect(discovery.loadAlbum).toHaveBeenCalledWith(proposal.token, 1, expect.anything()));
    await fireEvent.press(await view.findByText('Confirm trip'));
    await waitFor(() => expect(discovery.review).toHaveBeenCalledWith(proposal.token, 'confirm', expect.anything()));
  } finally {
    AppState.currentState = previous;
  }
});

it('shows a pending place only in the opened review while confirmation uses the same proposal token', async () => {
  const previous = AppState.currentState;
  AppState.currentState = 'active';
  try {
    const discovery = fixture(true, { ...proposal, place: resolveVisualPlace('locality-seoul')!,
      stops: [ewhaPlace, resolveVisualPlace('namsan-seoul-tower')!], pendingPlace: resolveVisualPlace('nami-island')! });
    const view = await render(<VisualPlaceRecovery discovery={discovery} version={{}} />);
    await view.findByText('Seoul · South Korea');
    expect(view.queryByText(/Nami Island/)).toBeNull();
    expect(discovery.review).not.toHaveBeenCalled();
    await fireEvent.press(view.getByText('Review trip photos'));
    expect(await view.findByText('Possible stop · Nami Island')).toBeOnTheScreen();
    expect(view.getByText('Ewha Womans University · N Seoul Tower')).toBeOnTheScreen();
    expect(view.getByText('13 photos. Capture locations are unknown.')).toBeOnTheScreen();
    await fireEvent.press(view.getByText('Hide trip details'));
    expect(view.queryByText(/Nami Island/)).toBeNull();
    await fireEvent.press(view.getByText('Review trip photos'));
    await fireEvent.press(await view.findByText('Confirm trip'));
    expect(discovery.review).toHaveBeenCalledTimes(1);
    expect(discovery.review).toHaveBeenCalledWith(proposal.token, 'confirm', expect.anything());
  } finally {
    AppState.currentState = previous;
  }
});

it('requires feature-level enablement and withholds a proposal when disabled', async () => {
  const previous = AppState.currentState;
  AppState.currentState = 'active';
  try {
    const discovery = fixture(false);
    const version = {};
    const view = await render(<VisualPlaceRecovery discovery={discovery} version={version} />);
    expect(discovery.discover).not.toHaveBeenCalled();
    expect(view.queryByText('Possible trips')).toBeNull();
    const settings = await render(<VisualDiscoverySetting discovery={discovery} />);
    await fireEvent.press(settings.getByText('Allow on-device trip discovery'));
    expect(discovery.setEnabled).toHaveBeenCalledWith(true);
    const enabled = { ...discovery, enabled: true };
    await view.rerender(<VisualPlaceRecovery discovery={enabled} version={version} />);
    await view.findByText('Possible trips');
    await settings.rerender(<VisualDiscoverySetting discovery={enabled} />);
    await fireEvent.press(settings.getByText('Turn off trip discovery'));
    expect(discovery.setEnabled).toHaveBeenCalledWith(false);
    await view.rerender(<VisualPlaceRecovery discovery={discovery} version={version} />);
    expect(view.queryByText('Possible trips')).toBeNull();
  } finally {
    AppState.currentState = previous;
  }
});

it('retries the failed album page and withholds confirmation until the retry resolves', async () => {
  const previous = AppState.currentState;
  AppState.currentState = 'active';
  try {
    const discovery = fixture(true);
    const loadAlbum = jest.fn().mockResolvedValueOnce({ photos: proposal.covers, hasMore: true })
      .mockResolvedValueOnce(null).mockResolvedValueOnce({ photos: proposal.covers, hasMore: false });
    const view = await render(<VisualPlaceRecovery discovery={{ ...discovery, loadAlbum }} version={{}} />);
    await fireEvent.press(await view.findByText('Review trip photos'));
    await fireEvent.press(await view.findByText('Next photos'));
    await fireEvent.press(await view.findByText('Confirm trip'));
    expect(discovery.review).not.toHaveBeenCalled();
    await fireEvent.press(await view.findByText('Try again'));
    await waitFor(() => expect(loadAlbum.mock.calls.map(([, page]) => page)).toEqual([0, 1, 1]));
    await fireEvent.press(await view.findByText('Confirm trip'));
    expect(discovery.review).toHaveBeenCalledTimes(1);
  } finally {
    AppState.currentState = previous;
  }
});
