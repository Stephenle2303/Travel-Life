import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { useVideoPlayer } from 'expo-video';
import { RecognizableAtlasExperience } from '@/components/recognizable-atlas-experience';
import { atlasObservationGeoJson } from '@/components/maplibre-atlas-map.native';
import { isRecognizableRevealEnabled } from '@/navigation/app-contract';
import type { RecognizableReveal } from '@/reconstruction/recognizable-shadow-types';

let mockFocused = true;
let mockScope: 'full' | 'limited' = 'full';
let mockAccount = false;
let mockFirstReveal = true;
const mockDismissFirst = jest.fn();
const mockLoad = jest.fn<Promise<RecognizableReveal | null>, [AbortSignal?]>();
const mockPlay = jest.fn();
const mockRead = jest.fn();
const mockReview = jest.fn();
const mockDiscard = jest.fn();
const mockBaseline = { journeys: [] };

jest.mock('expo-router', () => ({
  useFocusEffect: (effect: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    const focused = mockFocused;
    useEffect(() => (focused ? effect() : undefined), [effect, focused]);
  },
}));
jest.mock('expo-video', () => ({ useVideoPlayer: jest.fn(), VideoView: () => null }));
jest.mock('@/photo-access/provider', () => ({ usePhotoAccess: () => ({
  controller: { isAccountRecord: mockAccount, hasFirstRecognizableReveal: mockFirstReveal, dismissFirstRecognizableReveal: mockDismissFirst },
  privateRecord: { state: 'connected', pendingAction: null },
  snapshot: { scope: mockScope },
  durableReveal: mockBaseline,
  loadRecognizableReveal: mockLoad,
  playRecognizableTrip: mockPlay,
  readRecognizableTrip: mockRead,
  reviewRecognizableTrip: mockReview,
  discardRecognizableTripPreview: mockDiscard,
}) }));

const featured = { id: 'synthetic-featured', title: 'Recognizable outing', observedPeriod: 'January 2026', coverUri: null, canPlay: true };
const possible = { id: 'synthetic-possible', title: 'Nearby outing', observedPeriod: 'February 2026', coverUri: null, reason: 'limited-photos' as const, canReview: true, canReject: true };
const result: RecognizableReveal = { token: {}, featured, possible: [possible], observed: [{ latitude: 15, longitude: 80 }] };
const handlers = { onImport: jest.fn(), onRetry: jest.fn(), onCatchUp: jest.fn(), onManualEntry: jest.fn(), onReplay: jest.fn() };
const model = { state: 'sparse' as const, journeys: [], coverage: 'Local coverage', message: 'No reliable saved journeys',
  replay: { eligible: false, reason: 'No eligible journeys' }, statistics: null };
const atlas = () => <RecognizableAtlasExperience model={model} {...handlers} />;

describe('gated Local Atlas experience', () => {
  const originalAppState = AppState.currentState;
  beforeEach(() => {
    AppState.currentState = 'active';
    mockScope = 'full'; mockAccount = false; mockFocused = true; mockFirstReveal = true;
    mockLoad.mockReset().mockResolvedValue(result);
    mockPlay.mockReset().mockResolvedValue(null);
    mockRead.mockReset().mockResolvedValue({ previews: [] });
    mockReview.mockReset().mockResolvedValue('applied');
    mockDiscard.mockReset().mockResolvedValue(undefined);
    mockDismissFirst.mockClear();
  });
  afterEach(() => {
    AppState.currentState = originalAppState;
    jest.restoreAllMocks();
  });

  it('gives observation-only points no journey target', () => {
    expect(atlasObservationGeoJson(result.observed)).toEqual({ type: 'FeatureCollection', features: [
      { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [80, 15] } },
    ] });
  });

  it('requires a separate explicit development gate for interactive review', () => {
    const originalFlag = process.env.EXPO_PUBLIC_TRAVEL_LIFE_RECOGNIZABLE_REVEAL;
    const runtime = globalThis as typeof globalThis & { __DEV__: boolean };
    const originalDev = runtime.__DEV__;
    try {
      runtime.__DEV__ = true;
      delete process.env.EXPO_PUBLIC_TRAVEL_LIFE_RECOGNIZABLE_REVEAL;
      expect(isRecognizableRevealEnabled()).toBe(false);
      process.env.EXPO_PUBLIC_TRAVEL_LIFE_RECOGNIZABLE_REVEAL = 'true';
      expect(isRecognizableRevealEnabled()).toBe(true);
      runtime.__DEV__ = false;
      expect(isRecognizableRevealEnabled()).toBe(false);
    } finally {
      if (originalFlag === undefined) delete process.env.EXPO_PUBLIC_TRAVEL_LIFE_RECOGNIZABLE_REVEAL;
      else process.env.EXPO_PUBLIC_TRAVEL_LIFE_RECOGNIZABLE_REVEAL = originalFlag;
      runtime.__DEV__ = originalDev;
    }
  });

  it('offers the first trip on the Map and keeps provisional cards outside the committed Timeline count', async () => {
    const view = await render(atlas());
    expect(await view.findByText(featured.title)).toBeOnTheScreen();
    expect(view.getByText(possible.title)).toBeOnTheScreen();
    await fireEvent.press(view.getByRole('button', { name: 'Play this trip' }));
    expect(mockPlay).toHaveBeenCalledWith(result.token, featured.id, expect.any(AbortSignal), expect.any(String));
    expect(await view.findByText('Trip playback is unavailable.')).toBeOnTheScreen();
    await fireEvent.press(view.getByRole('button', { name: 'Open trip' }));
    expect(await view.findByText('No trip media is available.')).toBeOnTheScreen();
    await fireEvent.press(view.getByRole('button', { name: 'Close trip' }));
    const timeline = view.getAllByRole('button', { name: 'Open Timeline' }).at(-1)!;
    await fireEvent.press(timeline);
    expect(mockDismissFirst).toHaveBeenCalledTimes(1);
    expect(view.getByText('Journeys · 0')).toBeOnTheScreen();
    expect(view.getByText(possible.title)).toBeOnTheScreen();
    expect(view.queryByRole('button', { name: 'Replay' })).toBeNull();
  });

  it('uses the same command to reconcile an unacknowledged review and waits for refreshed cards', async () => {
    mockFirstReveal = false;
    mockReview.mockResolvedValueOnce('unknown');
    mockLoad.mockResolvedValueOnce(result).mockResolvedValue({ ...result, token: {}, possible: [] });
    const view = await render(atlas());
    expect(await view.findByText(possible.title)).toBeOnTheScreen();
    expect(view.queryByText(featured.title)).toBeNull();
    await fireEvent.press(view.getByRole('button', { name: `Review possible trip ${possible.title}` }));
    await fireEvent.press(view.getByRole('button', { name: 'Keep as a trip' }));
    expect(await view.findByRole('button', { name: 'Check again' })).toBeOnTheScreen();
    expect(view.getByText(possible.title)).toBeOnTheScreen();
    await fireEvent.press(view.getByRole('button', { name: 'Check again' }));
    await waitFor(() => expect(view.queryByText(possible.title)).toBeNull());
    expect(mockReview.mock.calls[0].slice(0, 4)).toEqual(mockReview.mock.calls[1].slice(0, 4));
    expect(mockLoad).toHaveBeenCalledTimes(2);
  });

  it('classifies a player failure with its action correlation and discards the failed temporary video', async () => {
    const preview = { uri: 'file:///synthetic-private-output', renderedMemoryCount: 1, omittedMemoryCount: 0, durationSeconds: 5 };
    const log = jest.spyOn(console, 'info').mockImplementation(() => {});
    let statusChange!: (value: { status: string; error?: { message: string } }) => void;
    jest.mocked(useVideoPlayer).mockReturnValue({ status: 'readyToPlay',
      addListener: (_event: string, listener: typeof statusChange) => { statusChange = listener; return { remove: jest.fn() }; },
    } as unknown as ReturnType<typeof useVideoPlayer>);
    mockPlay.mockResolvedValue(preview);
    const view = await render(atlas());
    await fireEvent.press(await view.findByRole('button', { name: 'Play this trip' }));
    await waitFor(() => expect(statusChange).toBeDefined());
    await act(async () => { statusChange({ status: 'error', error: { message: 'PRIVATE_PLAYER_SENTINEL' } }); });
    expect(view.getByText('Trip playback is unavailable.')).toBeOnTheScreen();
    const correlationId = mockPlay.mock.calls[0][3];
    expect(log.mock.calls).toEqual(expect.arrayContaining([[expect.any(String), expect.objectContaining({
      operation: 'REPLAY_RENDER', stage: 'REPLAY_HANDOFF', reasonCode: 'MEDIA_DECODE', correlationId,
    })]]));
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/PRIVATE_PLAYER_SENTINEL|synthetic-private-output/);
    expect(mockDiscard).toHaveBeenCalledWith(preview.uri, correlationId);
    expect(view.getByRole('button', { name: 'Open trip' })).toBeOnTheScreen();
  });

  it('drops a late load on blur and does not reuse private cards after a scope change or background', async () => {
    let finish!: (value: RecognizableReveal) => void;
    let setAppState!: (value: AppStateStatus) => void;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((event, listener) => {
      if (event === 'change') setAppState = listener;
      return { remove: jest.fn() };
    });
    mockLoad.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const view = await render(atlas());
    await waitFor(() => expect(mockLoad).toHaveBeenCalledTimes(1));
    const signal = mockLoad.mock.calls[0][0];
    mockFocused = false;
    await view.rerender(atlas());
    expect(signal?.aborted).toBe(true);
    await act(async () => { finish(result); });
    expect(view.queryByText(featured.title)).toBeNull();
    mockFocused = true;
    await view.rerender(atlas());
    expect(await view.findByText(featured.title)).toBeOnTheScreen();
    await act(async () => { setAppState('background'); });
    expect(view.queryByText(possible.title)).toBeNull();
    mockScope = 'limited';
    await view.rerender(atlas());
    await act(async () => { setAppState('active'); });
    expect(view.queryByText(featured.title)).toBeNull();
    mockScope = 'full'; mockAccount = true;
    await view.rerender(atlas());
    expect(view.queryByText(possible.title)).toBeNull();
    expect(mockLoad).toHaveBeenCalledTimes(2);
  });
});
