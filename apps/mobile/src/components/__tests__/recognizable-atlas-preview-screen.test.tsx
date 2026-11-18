import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { RecognizableAtlasPreviewScreen } from '@/components/recognizable-atlas-preview-screen';
import { RecognizableComparisonLimitError, type RecognizableShadowPreview } from '@/reconstruction/recognizable-shadow-types';

let mockFocused = true;
let mockAccount = false;
let mockScope = 'full';
const mockLoad = jest.fn<Promise<RecognizableShadowPreview>, [AbortSignal?]>();
const mockDismissTo = jest.fn();
const runtime = globalThis as typeof globalThis & { __DEV__: boolean };

jest.mock('expo-router', () => ({
  useRouter: () => ({ dismissTo: mockDismissTo }),
  useFocusEffect: (effect: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    const focused = mockFocused;
    useEffect(() => (focused ? effect() : undefined), [effect, focused]);
  },
}));

jest.mock('@/photo-access/provider', () => ({
  usePhotoAccess: () => ({
    controller: { isAccountRecord: mockAccount },
    privateRecord: { state: 'connected', pendingAction: null },
    snapshot: { scope: mockScope },
    durableReveal: null,
    loadRecognizableShadowPreview: mockLoad,
  }),
}));

const preview: RecognizableShadowPreview = {
  policyVersion: 'synthetic-shadow',
  reliable: [{ id: 'reliable', title: 'Verified outing', observedPeriod: 'January 2026', coverUri: 'file:///synthetic-authorized-cover' }],
  possible: [{ id: 'possible', title: 'Possible outing', observedPeriod: 'February 2026', coverUri: null, reason: 'limited-photos' }],
};

describe('development reconstruction comparison route', () => {
  const originalFlag = process.env.EXPO_PUBLIC_TRAVEL_LIFE_RECONSTRUCTION_PREVIEW;
  const originalDev = runtime.__DEV__;
  const originalAppState = AppState.currentState;
  beforeEach(() => {
    process.env.EXPO_PUBLIC_TRAVEL_LIFE_RECONSTRUCTION_PREVIEW = 'true';
    runtime.__DEV__ = true;
    AppState.currentState = 'active';
    mockAccount = false;
    mockScope = 'full';
    mockFocused = true;
    mockLoad.mockReset().mockResolvedValue(preview);
    mockDismissTo.mockClear();
  });
  afterEach(() => {
    if (originalFlag === undefined) delete process.env.EXPO_PUBLIC_TRAVEL_LIFE_RECONSTRUCTION_PREVIEW;
    else process.env.EXPO_PUBLIC_TRAVEL_LIFE_RECONSTRUCTION_PREVIEW = originalFlag;
    runtime.__DEV__ = originalDev;
    AppState.currentState = originalAppState;
    jest.restoreAllMocks();
  });

  it('shows authorized covers and read-only candidate sections only under explicit development opt-in', async () => {
    const screen = await render(<RecognizableAtlasPreviewScreen />);
    expect(await screen.findByText('Verified outing')).toBeOnTheScreen();
    expect(screen.getByLabelText('Trip photo preview')).toBeOnTheScreen();
    expect(screen.getByText('Possible trips')).toBeOnTheScreen();
    expect(screen.getByText('Possible outing')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Play this trip' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Keep as a trip' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Back to Settings' }));
    expect(mockDismissTo).toHaveBeenCalledWith('/settings');
  });

  it.each(['missing flag', 'release build', 'Account scope', 'limited photos'])('does not load evidence with %s', async (condition) => {
    if (condition === 'missing flag') delete process.env.EXPO_PUBLIC_TRAVEL_LIFE_RECONSTRUCTION_PREVIEW;
    if (condition === 'release build') runtime.__DEV__ = false;
    if (condition === 'Account scope') mockAccount = true;
    if (condition === 'limited photos') mockScope = 'limited';
    const screen = await render(<RecognizableAtlasPreviewScreen />);
    expect(screen.queryByText('Verified outing')).toBeNull();
    expect(mockLoad).not.toHaveBeenCalled();
  });

  it('explains the comparison size limit without offering the same retry', async () => {
    mockLoad.mockRejectedValue(new RecognizableComparisonLimitError());
    const screen = await render(<RecognizableAtlasPreviewScreen />);
    expect(await screen.findByText(/supports up to 24,000 photo and video records/)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Back to Settings' })).toBeOnTheScreen();
  });

  it('shows both observed periods and the verified baseline relationship without a write action', async () => {
    mockLoad.mockResolvedValue({
      ...preview,
      separatePairs: [
        { id: 'pair', left: { title: 'Vietnam', observedPeriod: 'January 2, 2025' },
          right: { title: 'Taiwan', observedPeriod: 'January 4, 2025' }, baselineGrouping: 'joined' },
        { id: 'unmatched', left: { title: 'First outing', observedPeriod: 'January 6, 2025' },
          right: { title: 'Second outing', observedPeriod: 'January 8, 2025' }, baselineGrouping: 'unmatched' },
      ],
    });
    const screen = await render(<RecognizableAtlasPreviewScreen />);
    expect(await screen.findByText('Candidate groups kept separate')).toBeOnTheScreen();
    expect(screen.getByText('Vietnam · January 2, 2025')).toBeOnTheScreen();
    expect(screen.getByText('Taiwan · January 4, 2025')).toBeOnTheScreen();
    expect(screen.getByText('Baseline groups this evidence together.')).toBeOnTheScreen();
    expect(screen.getByText('Exact baseline grouping could not be matched.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /merge|separate/i })).toBeNull();
  });

  it('drops pending work on blur and visible evidence on background, then reads again on foreground', async () => {
    let finish!: (value: RecognizableShadowPreview) => void;
    let appStateChanged!: (value: AppStateStatus) => void;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
      appStateChanged = listener;
      return { remove: jest.fn() };
    });
    mockLoad.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const screen = await render(<RecognizableAtlasPreviewScreen />);
    await waitFor(() => expect(mockLoad).toHaveBeenCalledTimes(1));
    const request = mockLoad.mock.calls[0][0];
    mockFocused = false;
    await screen.rerender(<RecognizableAtlasPreviewScreen />);
    expect(request?.aborted).toBe(true);
    await act(async () => { finish(preview); });
    expect(screen.queryByText('Verified outing')).toBeNull();
    mockFocused = true;
    await screen.rerender(<RecognizableAtlasPreviewScreen />);
    expect(await screen.findByText('Verified outing')).toBeOnTheScreen();
    await act(async () => { appStateChanged('background'); });
    expect(screen.queryByText('Verified outing')).toBeNull();
    await act(async () => { appStateChanged('active'); });
    expect(await screen.findByText('Verified outing')).toBeOnTheScreen();
    expect(mockLoad).toHaveBeenCalledTimes(3);
  });
});
