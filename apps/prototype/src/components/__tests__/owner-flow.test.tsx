import { act, fireEvent, render, within } from '@testing-library/react-native';
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { useEffect } from 'react';
import { Pressable, Text } from 'react-native';
import { router, useLocalSearchParams, usePathname } from 'expo-router';
import { groupAtlasJourneys, MapCanvas, MapErrorBoundary } from '@/components/map-canvas';
import { syntheticRecord } from '@/data/synthetic-record';
import { atlasLayoutForWidth } from '@/components/ui';
import { PrototypeProvider, usePrototype } from '@/components/prototype-provider';
import { AccessView, ImportView, JourneyDetailView, LimitedStateView, ReplayView, RevealView, ShareView, WelcomeView } from '@/components/prototype-screens';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() }, useLocalSearchParams: jest.fn(() => ({})), usePathname: jest.fn(() => '/') }));
jest.mock('expo-video', () => ({
  useVideoPlayer: () => ({ muted: true, loop: true, volume: 0, play: jest.fn(), pause: jest.fn(), addListener: () => ({ remove: jest.fn() }) }),
  VideoView: () => null,
}));

const push = router.push as jest.Mock;
const replace = router.replace as jest.Mock;
const searchParams = useLocalSearchParams as jest.Mock;
const pathname = usePathname as jest.Mock;
const withProvider = (view: React.ReactNode) => render(<PrototypeProvider>{view}</PrototypeProvider>);

beforeEach(() => { push.mockClear(); replace.mockClear(); searchParams.mockReturnValue({}); pathname.mockReturnValue('/'); });

describe('owner flow', () => {
  test('the atlas uses a stacked 390px layout and a two-zone 1440px layout', () => {
    expect(atlasLayoutForWidth(390)).toBe('stacked');
    expect(atlasLayoutForWidth(1440)).toBe('wide');
  });
  test('the visible welcome control navigates into the simulated photo-access choice', async () => {
    const welcome = await withProvider(<WelcomeView />);
    fireEvent.press(welcome.getByText('Set up private reveal'));
    expect(push).toHaveBeenCalledWith('/access');
  });

  test('the access choice explains local storage and Google Photos before simulated import', async () => {
    const access = await withProvider(<AccessView />);
    expect(access.getByText(/no operating-system permission is needed/i)).toBeTruthy();
    expect(access.getByText(/Google Photos:/i)).toBeTruthy();
    fireEvent.press(access.getByText('Allow photo-library access (simulated)'));
    expect(push).toHaveBeenCalledWith('/import');
  });

  test('the visible import control navigates into the private reveal without fetching', async () => {
    const fetchMock = jest.fn();
    const originalFetch = global.fetch;
    global.fetch = fetchMock as typeof fetch;
    const importer = await withProvider(<ImportView />);
    try {
      fireEvent.press(await importer.findByText('Start simulated scan'));
      expect(push).toHaveBeenCalledWith('/reveal');
      expect(fetchMock).not.toHaveBeenCalled();
    } finally { global.fetch = originalFetch; }
  });

  test('the rendered highlight preview lets the owner select every synthetic chapter or clear it', async () => {
    const share = await withProvider(<ShareView />);
    const preview = await share.findByTestId('highlight-preview');
    expect(within(preview).getByText(/Select at least one chapter/i)).toBeTruthy();
    await act(async () => { fireEvent.press(share.getByLabelText('Select all synthetic chapters')); });
    const allPreview = share.getByTestId('highlight-preview');
    expect(within(allPreview).getByText('Paper Lantern City')).toBeTruthy();
    expect(within(allPreview).getByText('Beacon Bay')).toBeTruthy();
    expect(within(allPreview).getByText('Cedar Isle')).toBeTruthy();
    expect(share.getByText(/All available synthetic chapters are included/i)).toBeTruthy();
    await act(async () => { fireEvent.press(share.getByLabelText('Clear selected chapters')); });
    expect(within(share.getByTestId('highlight-preview')).getByText(/Select at least one chapter/i)).toBeTruthy();
  });

  test('the reveal keeps map, timeline, year scrubber, list fallback, and actions reachable', async () => {
    const reveal = await withProvider(<RevealView />);
    expect(reveal.getByLabelText('Map view').props.accessibilityState).toEqual({ selected: true });
    expect(reveal.getByLabelText('Timeline view').props.accessibilityState).toEqual({ selected: false });
    expect(reveal.getByLabelText('Filter all years').props.accessibilityState).toEqual({ selected: true });
    expect(reveal.getByLabelText('Bundled synthetic demo geography')).toBeTruthy();
    expect(reveal.getByText('EXPLORE\nTHE WORLD')).toBeTruthy();
    expect(reveal.getByText(/Fictional demo geography and anchors only/i)).toBeTruthy();
    expect(reveal.getByLabelText('Zoom in atlas')).toBeTruthy();
    expect(reveal.getByLabelText('Fit synthetic demo geography')).toBeTruthy();
    expect(reveal.getByLabelText('Journey timeline fallback')).toBeTruthy();
    expect(reveal.getByText('Preview Travel Life Replay')).toBeTruthy();
    expect(reveal.getByText('Choose a lifetime highlight')).toBeTruthy();
  });

  test('nearby fictional anchors are grouped rather than painted as a route', () => {
    const duplicate = { ...syntheticRecord.journeys[1], id: 'beacon-2018-b', atlasAnchor: syntheticRecord.journeys[1].atlasAnchor };
    const groups = groupAtlasJourneys([syntheticRecord.journeys[1], duplicate]);
    expect(groups).toHaveLength(1);
    expect(groups[0].journeys.map((journey) => journey.id)).toEqual(['beacon-2018', 'beacon-2018-b']);
  });

  test('an unplotted fictional journey exposes a readable local Timeline recovery action', async () => {
    const onOpenTimeline = jest.fn();
    const unplotted = { ...syntheticRecord.journeys[0], atlasAnchor: undefined };
    const map = await render(<MapCanvas journeys={[]} selectedJourneyId={unplotted.id} camera={{ zoom: 1, offsetX: 0, offsetY: 0 }} onCameraChange={jest.fn()} onFit={jest.fn()} onSelect={jest.fn()} onOpenTimeline={onOpenTimeline} />);
    expect(map.getByText(/No usable fictional atlas coordinate/i)).toBeTruthy();
    fireEvent.press(map.getByLabelText('Open Timeline for unplotted journeys'));
    expect(onOpenTimeline).toHaveBeenCalledTimes(1);
  });

  test('post-import navigation keeps Atlas, Replay, Highlight and Home reachable', async () => {
    const reveal = await withProvider(<RevealView />);
    expect(reveal.getByLabelText('Atlas navigation').props.accessibilityState).toEqual({ selected: true });
    expect(reveal.getByLabelText('Replay navigation')).toBeTruthy();
    expect(reveal.getByLabelText('Highlight navigation')).toBeTruthy();
    expect(reveal.getByLabelText('Home')).toBeTruthy();
  });

  test('view, year, map selection, and card expansion stay synchronized before explicit detail navigation', async () => {
    const reveal = await withProvider(<RevealView />);
    const yearButton = reveal.getByRole('button', { name: 'Filter year 2018' });
    await act(() => { yearButton.props.onClick({ nativeEvent: {} }); });
    expect(reveal.getByLabelText('Filter year 2018').props.accessibilityState).toMatchObject({ selected: true });
    expect(reveal.queryAllByText('Paper Lantern City')).toHaveLength(0);
    expect(reveal.getAllByText('Beacon Bay').length).toBeGreaterThan(0);

    await act(() => { reveal.getByRole('button', { name: 'Timeline view' }).props.onClick({ nativeEvent: {} }); });
    expect(reveal.getByLabelText('Timeline view').props.accessibilityState).toMatchObject({ selected: true });
    const chapterButton = reveal.getByRole('button', { name: 'Expand Beacon Bay' });
    const clickTarget = {};
    await act(() => { chapterButton.props.onClick({ nativeEvent: {}, currentTarget: clickTarget, target: clickTarget }); });
    expect(reveal.getByText('Synthetic coverage: owner-reviewed demo record')).toBeTruthy();
    fireEvent.press(reveal.getByText('Open journey details'));
    expect(push).toHaveBeenCalledWith('/journey/beacon-2018');
  });

  test('the replay visibly advances, completes, and returns without replaying a stale screen', async () => {
    jest.useFakeTimers();
    function StartedReplay() { const { dispatch } = usePrototype(); useEffect(() => dispatch({ type: 'start-replay' }), [dispatch]); return <ReplayView />; }
    const replay = await withProvider(<StartedReplay />);
    expect(await replay.findByText('Paper Lantern City')).toBeTruthy();
    await act(async () => { jest.advanceTimersByTime(1400); });
    expect((await replay.findAllByText('Beacon Bay')).length).toBeGreaterThan(0);
    await act(async () => { jest.advanceTimersByTime(1400); });
    await act(async () => { jest.advanceTimersByTime(1400); });
    expect(await replay.findByText(/Replay preview complete/i)).toBeTruthy();
    fireEvent.press(replay.getByText('Return to reveal'));
    expect(replace).toHaveBeenCalledWith('/reveal');
    jest.useRealTimers();
  });

  test('a broken constellation falls back to readable content', async () => {
    const quietError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    function BrokenConstellation(): React.ReactNode { throw new Error('synthetic map failure'); }
    const openTimeline = jest.fn();
    const boundary = await render(<MapErrorBoundary fallback={<Pressable accessibilityRole="button" accessibilityLabel="Open Timeline fallback" onPress={openTimeline}><Text>Timeline fallback</Text></Pressable>}><BrokenConstellation /></MapErrorBoundary>);
    expect(await boundary.findByText('Timeline fallback')).toBeTruthy();
    fireEvent.press(boundary.getByLabelText('Open Timeline fallback'));
    expect(openTimeline).toHaveBeenCalledTimes(1);
    quietError.mockRestore();
  });

  test('replay remains cancellable and never claims rendered media', async () => {
    function StartedReplay() { const { dispatch } = usePrototype(); useEffect(() => dispatch({ type: 'start-replay' }), [dispatch]); return <ReplayView />; }
    const replay = await withProvider(<StartedReplay />);
    expect(replay.getByText(/No 720p video is rendered, saved, exported, uploaded, or shared/i)).toBeTruthy();
    fireEvent.press(replay.getByText('Cancel preview'));
    expect(replace).toHaveBeenCalledWith('/reveal');
  });

  test.each(['sparse', 'declined'] as const)('%s evidence stays honest and offers a next action', async (kind) => {
    const limited = await withProvider(<LimitedStateView kind={kind} />);
    expect(limited.getByText('Choose simulated photo access')).toBeTruthy();
    expect(limited.getAllByText(/synthetic sample|partial reveal|without access/i).length).toBeGreaterThan(0);
  });

  test('an unknown journey route remains recoverable instead of showing another journey', async () => {
    searchParams.mockReturnValue({ id: 'unknown-sample' });
    const journey = await withProvider(<JourneyDetailView />);
    expect(await journey.findByText('That sample screen is not here.')).toBeTruthy();
  });

  test('the screen sources retain the local-only boundary', () => {
    const source = readFileSync('src/components/prototype-screens.tsx', 'utf8');
    for (const forbidden of ['fetch(', 'expo-media-library', 'AsyncStorage', 'expo-image-picker']) expect(source).not.toContain(forbidden);
  });

  test('motion preference is honored and every journey crop is a bundled local asset', () => {
    const uiSource = readFileSync('src/components/ui.tsx', 'utf8');
    const recordSource = readFileSync('src/data/synthetic-record.ts', 'utf8');
    expect(uiSource).toContain('AccessibilityInfo.isReduceMotionEnabled');
    expect(recordSource).not.toMatch(/https?:\/\//);
    for (const file of ['rainforest-river.png', 'limestone-coast.png', 'misty-highland.png']) {
      expect(existsSync(join(process.cwd(), 'assets', 'synthetic', file))).toBe(true);
      expect(recordSource).toContain(file);
    }
  });
});
