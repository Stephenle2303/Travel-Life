import { act, fireEvent, render } from '@testing-library/react-native';
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { AccessibilityInfo, AppState, Platform, type AppStateStatus } from 'react-native';
import { TravelHero } from '@/components/travel-hero';

const mockListeners: Record<string, (event: { status?: string; isPlaying?: boolean }) => void> = {};
const mockPlayer = {
  play: jest.fn(), pause: jest.fn(), muted: false, loop: false, volume: 1, staysActiveInBackground: true,
  addListener: jest.fn((event: string, listener: (event: { status?: string; isPlaying?: boolean }) => void) => {
    mockListeners[event] = listener;
    return { remove: jest.fn() };
  }),
};

jest.mock('expo-video', () => ({
  useVideoPlayer: (_source: unknown, setup: (player: typeof mockPlayer) => void) => { setup(mockPlayer); return mockPlayer; },
  VideoView: () => null,
}));

beforeEach(() => {
  mockPlayer.play.mockReset();
  mockPlayer.pause.mockReset();
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
});
afterEach(() => { jest.restoreAllMocks(); });

describe('welcome travel hero', () => {
  test('never starts while the accessibility preference lookup is unresolved', async () => {
    let resolveMotion: (reduced: boolean) => void = () => undefined;
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(new Promise<boolean>((resolve) => { resolveMotion = resolve; }));
    const hero = await render(<TravelHero onStart={jest.fn()} />);
    expect(mockPlayer.play).not.toHaveBeenCalled();
    expect(hero.getByLabelText('Play travel montage').props.accessibilityState).toMatchObject({ disabled: true });
    await act(async () => { resolveMotion(false); });
    expect(mockPlayer.play).toHaveBeenCalledTimes(1);
    expect(mockPlayer.muted).toBe(true);
    expect(mockPlayer.volume).toBe(0);
    expect(mockPlayer.loop).toBe(true);
  });

  test('reduced motion shows a deliberate play and pause, while navigation stays usable', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const onStart = jest.fn();
    const hero = await render(<TravelHero onStart={onStart} />);
    expect(mockPlayer.play).not.toHaveBeenCalled();
    await fireEvent.press(hero.getByLabelText('Play travel montage'));
    expect(mockPlayer.play).toHaveBeenCalledTimes(1);
    await fireEvent.press(hero.getByLabelText('Pause travel montage'));
    expect(hero.getByLabelText('Play travel montage')).toBeTruthy();
    await fireEvent.press(hero.getByText('Set up private reveal'));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(hero.getByText(/Synthetic demo imagery/)).toBeTruthy();
  });

  test('a failed video restores a static hero and keeps the CTA available', async () => {
    const onStart = jest.fn();
    const hero = await render(<TravelHero onStart={onStart} />);
    await act(() => { mockListeners.statusChange({ status: 'error' }); });
    expect(hero.getByText(/Video unavailable · still view/)).toBeTruthy();
    expect(hero.getByLabelText('Play travel montage').props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(hero.getByText('Set up private reveal'));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  test('a thrown playback request falls back and can be deliberately retried', async () => {
    mockPlayer.play.mockImplementationOnce(() => { throw new Error('autoplay denied'); });
    const hero = await render(<TravelHero onStart={jest.fn()} />);
    expect(hero.getByText(/Motion paused · play to retry/)).toBeTruthy();
    await fireEvent.press(hero.getByLabelText('Play travel montage'));
    expect(mockPlayer.play).toHaveBeenCalledTimes(2);
    expect(hero.getByLabelText('Pause travel montage')).toBeTruthy();
    await act(() => { mockListeners.playingChange({ isPlaying: true }); });
    expect(hero.queryByText(/Motion paused · play to retry/)).toBeNull();
  });

  test('a failed accessibility lookup stays static but allows an explicit play', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockRejectedValue(new Error('preference unavailable'));
    const hero = await render(<TravelHero onStart={jest.fn()} />);
    expect(mockPlayer.play).not.toHaveBeenCalled();
    expect(hero.getByLabelText('Play travel montage').props.accessibilityState).toMatchObject({ disabled: false });
    await fireEvent.press(hero.getByLabelText('Play travel montage'));
    expect(mockPlayer.play).toHaveBeenCalledTimes(1);
  });

  test('a changed reduced-motion preference wins over a stale initial lookup', async () => {
    let resolveMotion: (reduced: boolean) => void = () => undefined;
    let preferenceChanged: (reduced: boolean) => void = () => undefined;
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(new Promise<boolean>((resolve) => { resolveMotion = resolve; }));
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((...args: unknown[]) => {
      preferenceChanged = args[1] as (reduced: boolean) => void;
      return { remove: jest.fn() } as unknown as ReturnType<typeof AccessibilityInfo.addEventListener>;
    });
    const hero = await render(<TravelHero onStart={jest.fn()} />);
    await act(() => { preferenceChanged(true); });
    await act(async () => { resolveMotion(false); });
    expect(mockPlayer.play).not.toHaveBeenCalled();
    expect(hero.getByLabelText('Play travel montage').props.accessibilityState).toMatchObject({ disabled: false });
  });

  test('a web page follows reduced motion and visibility changes without losing an owner pause', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    let visibilityChanged = () => undefined;
    let preferenceChanged = () => undefined;
    const documentMock = { visibilityState: 'visible', addEventListener: jest.fn((_event: string, callback: () => undefined) => { visibilityChanged = callback; }), removeEventListener: jest.fn() };
    const media = { matches: true, addEventListener: jest.fn((_event: string, callback: () => undefined) => { preferenceChanged = callback; }), removeEventListener: jest.fn() };
    Object.defineProperty(globalThis, 'document', { configurable: true, value: documentMock });
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { matchMedia: () => media } });
    try {
      const hero = await render(<TravelHero onStart={jest.fn()} />);
      expect(mockPlayer.play).not.toHaveBeenCalled();
      await act(() => { media.matches = false; preferenceChanged(); });
      expect(hero.getByLabelText('Pause travel montage')).toBeTruthy();
      await act(() => { documentMock.visibilityState = 'hidden'; visibilityChanged(); });
      expect(hero.getByLabelText('Play travel montage')).toBeTruthy();
      await act(() => { documentMock.visibilityState = 'visible'; visibilityChanged(); });
      await fireEvent.press(hero.getByLabelText('Pause travel montage'));
      await act(() => { documentMock.visibilityState = 'hidden'; visibilityChanged(); });
      await act(() => { documentMock.visibilityState = 'visible'; visibilityChanged(); });
      expect(hero.getByLabelText('Play travel montage')).toBeTruthy();
      await hero.unmount();
      expect(media.removeEventListener).toHaveBeenCalled();
      expect(documentMock.removeEventListener).toHaveBeenCalled();
    } finally {
      if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
      else Reflect.deleteProperty(globalThis, 'document');
      if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
      else Reflect.deleteProperty(globalThis, 'window');
    }
  });

  test('background pauses motion and returning respects an owner pause', async () => {
    let lifecycle: (state: AppStateStatus) => void = () => undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
      lifecycle = listener;
      return { remove: jest.fn() };
    });
    const hero = await render(<TravelHero onStart={jest.fn()} />);
    await act(() => { lifecycle('background'); });
    expect(hero.getByLabelText('Play travel montage')).toBeTruthy();
    await act(() => { lifecycle('active'); });
    expect(hero.getByLabelText('Pause travel montage')).toBeTruthy();
    await fireEvent.press(hero.getByLabelText('Pause travel montage'));
    await act(() => { lifecycle('background'); lifecycle('active'); });
    expect(hero.getByLabelText('Play travel montage')).toBeTruthy();
  });

  test('an inactive welcome screen cannot keep the montage playing', async () => {
    const hero = await render(<TravelHero onStart={jest.fn()} screenActive={false} />);
    expect(mockPlayer.play).not.toHaveBeenCalled();
    expect(hero.getByLabelText('Play travel montage')).toBeTruthy();
  });
});
