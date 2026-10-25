import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { ReplayScreen, replayVideoSceneSeconds, shareableCommittedMemories } from '@/components/replay-screen';
import { ReplayPreparationError } from '@/replay/renderer';
import { Alert } from 'react-native';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockLoadReplayManifestInput = jest.fn();
const mockLoadReplayEditorPreviewPage = jest.fn();
const mockLoadPreparedReplay = jest.fn();
const mockPreparePrivateReplay = jest.fn();
const mockSaveReplayDraft = jest.fn();
const mockStageReplayWorkingDraft = jest.fn();
const mockResetReplayDraft = jest.fn();
const mockExportPrivateReplay = jest.fn();
const mockNavigationAddListener = jest.fn();
const mockGetDocumentAsync = jest.fn();
const mockCopyAsync = jest.fn();
const mockGetInfoAsync = jest.fn();
const mockGetMediaInformation = jest.fn();
let mockBeforeRemove: ((event: { preventDefault(): void }) => void) | undefined;
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }), useNavigation: () => ({ addListener: mockNavigationAddListener }) }));
jest.mock('expo-video', () => ({ useVideoPlayer: jest.fn(() => ({ pause: jest.fn(), generateThumbnailsAsync: jest.fn(async () => []) })), VideoView: 'VideoView' }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: (...args: unknown[]) => mockGetDocumentAsync(...args) }));
jest.mock('expo-file-system/legacy', () => ({ documentDirectory: 'file:///documents/', copyAsync: (...args: unknown[]) => mockCopyAsync(...args), getInfoAsync: (...args: unknown[]) => mockGetInfoAsync(...args) }));
jest.mock('munim-ffmpeg', () => ({ execute: jest.fn(), getMediaInformation: (...args: unknown[]) => mockGetMediaInformation(...args), pickEncoder: jest.fn() }));
jest.mock('@/photo-access/provider', () => ({ usePhotoAccess: () => ({ loadReplayManifestInput: mockLoadReplayManifestInput, loadReplayEditorPreviewPage: mockLoadReplayEditorPreviewPage, loadPreparedReplay: mockLoadPreparedReplay, saveReplayDraft: mockSaveReplayDraft, stageReplayWorkingDraft: mockStageReplayWorkingDraft, resetReplayDraft: mockResetReplayDraft, preparePrivateReplay: mockPreparePrivateReplay, exportPrivateReplay: mockExportPrivateReplay, discardPrivateReplay: jest.fn() }) }));

describe('Replay screen', () => {
  const openTrip = async (view: Awaited<ReturnType<typeof render>>, startDay = '2024-01-01') => {
    await waitFor(() => expect(view.getByLabelText('Replay trip overview')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText(`Edit trip Observed destination ${startDay}`));
    await waitFor(() => expect(view.getByLabelText('Replay media grid')).toBeOnTheScreen());
  };
  afterEach(async () => {
    // Unmount and flush queued React work in one act boundary before resetting
    // module-level provider doubles used by the next screen instance.
    await act(async () => {
      await cleanup();
      await Promise.resolve();
    });
    mockLoadReplayManifestInput.mockReset(); mockLoadReplayEditorPreviewPage.mockReset(); mockLoadPreparedReplay.mockReset(); mockPreparePrivateReplay.mockReset(); mockSaveReplayDraft.mockReset(); mockStageReplayWorkingDraft.mockReset(); mockResetReplayDraft.mockReset(); mockExportPrivateReplay.mockReset(); mockNavigationAddListener.mockReset(); mockGetDocumentAsync.mockReset(); mockCopyAsync.mockReset(); mockGetInfoAsync.mockReset(); mockGetMediaInformation.mockReset(); mockBeforeRemove = undefined;
  });
  beforeEach(() => { mockNavigationAddListener.mockImplementation((_event, listener) => { mockBeforeRemove = listener; return jest.fn(); }); mockLoadPreparedReplay.mockResolvedValue(null); mockLoadReplayEditorPreviewPage.mockResolvedValue([]); mockStageReplayWorkingDraft.mockResolvedValue(undefined); mockGetInfoAsync.mockResolvedValue({ exists: true, size: 1024 }); mockCopyAsync.mockResolvedValue(undefined); mockGetMediaInformation.mockResolvedValue({ format: { duration: 30 } }); return mockLoadReplayManifestInput.mockResolvedValue({ snapshotToken: 7, privacyRevision: 1, memories: [
    { key: 'memory-a', groupKey: 'a', kind: 'photo', available: true, eligible: true, previewUri: 'file:///private-a.jpg' },
    { key: 'memory-b', groupKey: 'b', kind: 'video', available: true, eligible: true, previewUri: 'file:///private-b.jpg' },
  ], groups: [
    { key: 'a', label: 'Observed destination', interval: { startDay: '2024-01-01', endDay: '2024-01-02' }, inferred: true, eligible: true, orderCertain: true },
    { key: 'b', label: 'Observed destination', interval: { startDay: '2024-02-01', endDay: '2024-02-02' }, inferred: true, eligible: true, orderCertain: true },
  ] }); });
  it('opens a verified durable Replay without rendering again', async () => {
    mockLoadPreparedReplay.mockResolvedValue({ uri: 'file:///documents/replay-previews/saved.mp4', renderedMemoryCount: 2, omittedMemoryCount: 0, durationSeconds: 8 });
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByLabelText('Re-render private Replay')).toBeOnTheScreen());
    expect(mockPreparePrivateReplay).not.toHaveBeenCalled();
  });
  it('uses the same bounded video scene interval as the renderer frame allocation', () => {
    expect(replayVideoSceneSeconds(1, 0)).toBe(2);
    expect(replayVideoSceneSeconds(2, 0)).toBe(2.5);
    expect(replayVideoSceneSeconds(3, 0)).toBe(4);
  });
  it('hydrates Edit from the current manifest when a verified preview is restored', async () => {
    mockLoadPreparedReplay.mockResolvedValue({ uri: 'file:///documents/replay-previews/saved.mp4', renderedMemoryCount: 2, omittedMemoryCount: 0, durationSeconds: 8 });
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByLabelText('Edit private Replay')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Edit private Replay'));
    await openTrip(view);
    expect(mockPreparePrivateReplay).not.toHaveBeenCalled();
  });
  it('returns from native navigation in Edit Replay to the prepared preview', async () => {
    mockPreparePrivateReplay.mockResolvedValue({ uri: 'file:///private-replay.mp4', renderedMemoryCount: 2, omittedMemoryCount: 0, durationSeconds: 8 });
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByLabelText('Edit private Replay')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Edit private Replay'));
    await waitFor(() => expect(view.getByLabelText('Replay trip overview')).toBeOnTheScreen());
    const preventDefault = jest.fn();
    mockBeforeRemove?.({ preventDefault });
    expect(preventDefault).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(view.getByLabelText('Edit private Replay')).toBeOnTheScreen());
  });
  it('mutes and unmutes the existing player without preparing another Replay', async () => {
    mockPreparePrivateReplay.mockResolvedValue({ uri: 'file:///private-replay.mp4', renderedMemoryCount: 1, omittedMemoryCount: 0, durationSeconds: 5 });
    mockExportPrivateReplay.mockResolvedValue('closed');
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByLabelText('Mute Replay audio')).toBeOnTheScreen());
    expect(mockPreparePrivateReplay).toHaveBeenLastCalledWith(undefined, expect.any(Function), { kind: 'bundled', revision: 'happy-moments-1.4' });
    await fireEvent.press(view.getByLabelText('Mute Replay audio'));
    await waitFor(() => expect(view.getByLabelText('Unmute Replay audio')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Unmute Replay audio'));
    await waitFor(() => expect(view.getByLabelText('Mute Replay audio')).toBeOnTheScreen());
    expect(mockPreparePrivateReplay).toHaveBeenCalledTimes(1);
    await fireEvent.press(view.getByLabelText('Choose Replay for sharing'));
    await waitFor(() => expect(view.getByLabelText('Select photo 1 for sharing')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Select photo 1 for sharing'));
    await waitFor(() => expect(view.getByLabelText('Open Replay share sheet')).not.toBeDisabled());
    await fireEvent.press(view.getByLabelText('Open Replay share sheet'));
    await waitFor(() => expect(mockPreparePrivateReplay).toHaveBeenLastCalledWith(['memory-a'], undefined, { kind: 'bundled', revision: 'happy-moments-1.4' }));
  });
  it('starts a private Replay on entry without a Prepare action and permits cancellation', async () => {
    mockPreparePrivateReplay.mockResolvedValue({ uri: 'file:///private-replay.mp4', renderedMemoryCount: 1, omittedMemoryCount: 0, durationSeconds: 5 });
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByText(/Playing your private Replay/)).toBeOnTheScreen());
    expect(view.getByText(/Built locally from 1 selected memories/)).toBeOnTheScreen();
    expect(view.queryByLabelText('Prepare private Replay')).toBeNull();
    mockExportPrivateReplay.mockResolvedValue('closed');
    await fireEvent.press(view.getByLabelText('Choose Replay for sharing'));
    await waitFor(() => expect(view.getByLabelText('Open Replay share sheet')).toBeDisabled());
    await fireEvent.press(view.getByLabelText('Select photo 1 for sharing'));
    await waitFor(() => expect(view.getByLabelText('Open Replay share sheet')).not.toBeDisabled());
    await fireEvent.press(view.getByLabelText('Open Replay share sheet'));
    await waitFor(() => expect(view.getByText(/Share sheet closed/)).toBeOnTheScreen());
    expect(mockPreparePrivateReplay).toHaveBeenLastCalledWith(['memory-a'], undefined, { kind: 'bundled', revision: 'happy-moments-1.4' });
    expect(view.queryByText(/0 selected/)).toBeNull();
    await fireEvent.press(view.getByLabelText('Cancel Replay preparation'));
    await waitFor(() => expect(view.getByText(/Your private Replay/)).toBeOnTheScreen());

  });
  it('shows active local preparation phases while Replay is resolving and rendering', async () => {
    let resolveManifest!: (value: { snapshotToken: number; privacyRevision: number; memories: { key: string; groupKey: string; kind: 'photo'; available: boolean; eligible: boolean }[]; groups: { key: string; label: string; interval: { startDay: string; endDay: string }; inferred: boolean; eligible: boolean; orderCertain: boolean }[] }) => void;
    let resolveRender!: (value: { uri: string; renderedMemoryCount: number; omittedMemoryCount: number; durationSeconds: number }) => void;
    let reportProgress!: (update: { message: string; completed: number; total: number }) => void;
    mockLoadReplayManifestInput.mockImplementation(() => new Promise((resolve) => { resolveManifest = resolve; }));
    mockPreparePrivateReplay.mockImplementation((_keys: unknown, onProgress: (update: { message: string; completed: number; total: number }) => void) => new Promise((resolve) => { reportProgress = onProgress; resolveRender = resolve; }));
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByLabelText('Resolving private Replay memories')).toBeOnTheScreen());
    resolveManifest({ snapshotToken: 7, privacyRevision: 1, memories: [{ key: 'memory-a', groupKey: 'a', kind: 'photo', available: true, eligible: true }], groups: [{ key: 'a', label: 'Observed destination', interval: { startDay: '2024-01-01', endDay: '2024-01-02' }, inferred: true, eligible: true, orderCertain: true }] });
    await waitFor(() => expect(view.getByLabelText('Rendering private Replay video')).toBeOnTheScreen());
    reportProgress({ message: 'Rendering scene 1 of 2.', completed: 1, total: 2 });
    await waitFor(() => expect(view.getByLabelText('Replay rendering 50% complete')).toBeOnTheScreen());
    resolveRender({ uri: 'file:///private-replay.mp4', renderedMemoryCount: 1, omittedMemoryCount: 0, durationSeconds: 5 });
    await waitFor(() => expect(view.getByText(/Playing your private Replay/)).toBeOnTheScreen());
  });
  it('shows a fixed Replay preparation cause without native details', async () => {
    mockPreparePrivateReplay.mockRejectedValue(new ReplayPreparationError('REPLAY_DECODE'));
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByText(/could not be decoded into a Replay scene/)).toBeOnTheScreen());
  });
  it('keeps Edit available after a render failure only when a current manifest was loaded', async () => {
    mockPreparePrivateReplay.mockRejectedValue(new ReplayPreparationError('REPLAY_ENCODE'));
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByLabelText('Edit private Replay')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Edit private Replay'));
    await waitFor(() => expect(view.getByLabelText('Back to saved Replay')).not.toBeDisabled());
    await fireEvent.press(view.getByLabelText('Back to saved Replay'));
    await waitFor(() => expect(view.getByText(/could not compose the Replay video/)).toBeOnTheScreen());
  });
  it('does not offer Edit when loading the current manifest itself fails', async () => {
    mockLoadReplayManifestInput.mockRejectedValue(new ReplayPreparationError('REPLAY_ACCESS'));
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByText(/could not provide an original for Replay/)).toBeOnTheScreen());
    expect(view.queryByLabelText('Edit private Replay')).toBeNull();
  });
  it('withholds the editor after the Replay scope becomes stale', async () => {
    mockPreparePrivateReplay.mockRejectedValue(new ReplayPreparationError('REPLAY_STALE'));
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByText(/Journey List changed/)).toBeOnTheScreen());
    expect(view.queryByLabelText('Edit private Replay')).toBeNull();
    expect(view.queryByLabelText('photo thumbnail')).toBeNull();
  });
  it('allows only one selected-Replay share handoff while export is pending', async () => {
    let finishShare!: (value: 'closed') => void;
    mockPreparePrivateReplay.mockResolvedValue({ uri: 'file:///private-replay.mp4', renderedMemoryCount: 2, omittedMemoryCount: 0, durationSeconds: 8 });
    mockExportPrivateReplay.mockImplementation(() => new Promise((resolve) => { finishShare = resolve; }));
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByLabelText('Choose Replay for sharing')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Choose Replay for sharing'));
    await waitFor(() => expect(view.getByLabelText('Select photo 1 for sharing')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Select photo 1 for sharing'));
    await waitFor(() => expect(view.getByLabelText('Open Replay share sheet')).not.toBeDisabled());
    await fireEvent.press(view.getByLabelText('Open Replay share sheet'));
    await waitFor(() => expect(mockExportPrivateReplay).toHaveBeenCalledTimes(1));
    await fireEvent.press(view.getByLabelText('Open Replay share sheet'));
    expect(mockExportPrivateReplay).toHaveBeenCalledTimes(1);
    finishShare('closed');
    await waitFor(() => expect(view.getByText(/Share sheet closed/)).toBeOnTheScreen());
  });
  it('keeps exact sharing empty-first while allowing an explicit select-all choice', async () => {
    mockPreparePrivateReplay.mockResolvedValue({ uri: 'file:///private-replay.mp4', renderedMemoryCount: 2, omittedMemoryCount: 0, durationSeconds: 8 });
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByLabelText('Choose Replay for sharing')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Choose Replay for sharing'));
    await waitFor(() => expect(view.getByLabelText('Select all Replay moments for sharing')).toBeOnTheScreen());
    expect(view.getByLabelText('Open Replay share sheet')).toBeDisabled();
    await fireEvent.press(view.getByLabelText('Select all Replay moments for sharing'));
    await waitFor(() => expect(view.getByLabelText('Open Replay share sheet')).not.toBeDisabled());
    expect(view.getByText('Clear all moments')).toBeOnTheScreen();
  });
  it('offers Share only the committed editor composition, never an unselected eligible candidate', () => {
    const candidates = shareableCommittedMemories({ snapshotToken: 7, privacyRevision: 1, groups: [], memories: [
      { key: 'memory-a', groupKey: 'a', kind: 'photo', available: true, eligible: true },
      { key: 'memory-b', groupKey: 'b', kind: 'video', available: true, eligible: true },
      { key: 'memory-c', groupKey: 'b', kind: 'photo', available: false, eligible: true },
    ] }, ['memory-b', 'memory-c']);
    expect(candidates.map((memory) => memory.key)).toEqual(['memory-b']);
  });
  const verifyDirectSelectionAndAggregateUpdate = async () => {
    mockPreparePrivateReplay.mockResolvedValue({ uri: 'file:///private-replay.mp4', renderedMemoryCount: 1, omittedMemoryCount: 0, durationSeconds: 5 });
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByLabelText('Edit private Replay')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Edit private Replay'));
    await openTrip(view);
    await waitFor(() => expect(view.getByLabelText('Remove photo 1')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Remove photo 1'));
    await waitFor(() => expect(view.getByLabelText('Add photo 1')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Add photo 1'));
    mockSaveReplayDraft.mockResolvedValue(undefined);
    await fireEvent.press(view.getByLabelText('Done editing this trip'));
    await waitFor(() => expect(view.getByLabelText('Update Replay')).not.toBeDisabled());
    expect(mockSaveReplayDraft).not.toHaveBeenCalled();
    expect(mockPreparePrivateReplay).toHaveBeenCalledTimes(1);
    await act(async () => {
      await fireEvent.press(view.getByLabelText('Update Replay'));
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });
    await waitFor(() => expect(mockSaveReplayDraft).toHaveBeenCalledWith(['memory-b', 'memory-a'], 7, 1, 'oldest-first', { kind: 'bundled', revision: 'happy-moments-1.4' }, undefined, ['a', 'b'], ['b']));
    await waitFor(() => expect(mockPreparePrivateReplay).toHaveBeenCalledTimes(2));
    expect(mockPreparePrivateReplay).toHaveBeenLastCalledWith(undefined, expect.any(Function), { kind: 'bundled', revision: 'happy-moments-1.4' });
  };
  it('serializes rapid working saves using the acknowledged working revision', async () => {
    mockPreparePrivateReplay.mockResolvedValue({ uri: 'file:///private-replay.mp4', renderedMemoryCount: 2, omittedMemoryCount: 0, durationSeconds: 8 });
    mockStageReplayWorkingDraft.mockResolvedValueOnce(4).mockResolvedValueOnce(5);
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByLabelText('Edit private Replay')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Edit private Replay'));
    await openTrip(view);
    await waitFor(() => expect(view.getByLabelText('Remove photo 1')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Remove photo 1'));
    await waitFor(() => expect(mockStageReplayWorkingDraft).toHaveBeenCalledWith(['memory-b'], 7, 1, 'oldest-first', { kind: 'bundled', revision: 'happy-moments-1.4' }, undefined, ['a', 'b'], ['b']));
    await fireEvent.press(view.getByLabelText('Add photo 1'));
    await waitFor(() => expect(mockStageReplayWorkingDraft).toHaveBeenLastCalledWith(['memory-b', 'memory-a'], 7, 1, 'oldest-first', { kind: 'bundled', revision: 'happy-moments-1.4' }, 4, ['a', 'b'], ['b']));
  });
  it('returns from a trip after its existing working save without writing a duplicate draft', async () => {
    mockPreparePrivateReplay.mockResolvedValue({ uri: 'file:///private-replay.mp4', renderedMemoryCount: 2, omittedMemoryCount: 0, durationSeconds: 8 });
    mockStageReplayWorkingDraft.mockResolvedValue(4);
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByLabelText('Edit private Replay')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Edit private Replay'));
    await openTrip(view);
    await fireEvent.press(view.getByLabelText('Remove photo 1'));
    await waitFor(() => expect(mockStageReplayWorkingDraft).toHaveBeenCalledTimes(1));
    await fireEvent.press(view.getByLabelText('Done editing this trip'));
    await waitFor(() => expect(view.getByLabelText('Replay trip overview')).toBeOnTheScreen());
    expect(mockStageReplayWorkingDraft).toHaveBeenCalledTimes(1);
  });
  it('coalesces rapid visual edits and flushes their latest intent when Done is tapped', async () => {
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByLabelText('Edit private Replay')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Edit private Replay'));
    await openTrip(view);
    await fireEvent.press(view.getByLabelText('Remove photo 1'));
    await waitFor(() => expect(view.getByLabelText('Add photo 1')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Add photo 1'));
    await fireEvent.press(view.getByLabelText('Done editing this trip'));
    await waitFor(() => expect(view.getByLabelText('Replay trip overview')).toBeOnTheScreen());
    await waitFor(() => expect(mockStageReplayWorkingDraft).toHaveBeenCalledTimes(1));
    expect(mockStageReplayWorkingDraft).toHaveBeenLastCalledWith(['memory-b', 'memory-a'], 7, 1, 'oldest-first', expect.anything(), undefined, ['a', 'b'], ['b']);
  });
  it('keeps header navigation reachable while queued saves finish and returns only after the latest acknowledgement', async () => {
    mockPreparePrivateReplay.mockResolvedValue({ uri: 'file:///private-replay.mp4', renderedMemoryCount: 2, omittedMemoryCount: 0, durationSeconds: 8 });
    let finishFirst!: (revision: number) => void;
    let finishSecond!: (revision: number) => void;
    mockStageReplayWorkingDraft.mockImplementationOnce(() => new Promise<number>((resolve) => { finishFirst = resolve; }))
      .mockImplementationOnce(() => new Promise<number>((resolve) => { finishSecond = resolve; }));
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByLabelText('Edit private Replay')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Edit private Replay'));
    await openTrip(view);
    await fireEvent.press(view.getByLabelText('Remove photo 1'));
    await waitFor(() => expect(mockStageReplayWorkingDraft).toHaveBeenCalledTimes(1));
    await fireEvent.press(view.getByLabelText('Add photo 1'));
    expect(view.getByLabelText('Done editing this trip')).not.toBeDisabled();
    expect(view.getByLabelText('Back to Replay trip overview')).not.toBeDisabled();
    await fireEvent.press(view.getByLabelText('Done editing this trip'));
    await waitFor(() => expect(view.getByLabelText('Replay trip overview')).toBeOnTheScreen());
    expect(view.getByText(/Saving changes/)).toBeOnTheScreen();
    await act(async () => { finishFirst(4); });
    await waitFor(() => expect(mockStageReplayWorkingDraft).toHaveBeenCalledTimes(2));
    expect(view.getByLabelText('Replay trip overview')).toBeOnTheScreen();
    await act(async () => { finishSecond(5); });
    await waitFor(() => expect(view.getByLabelText('Replay trip overview')).toBeOnTheScreen());
    expect(mockStageReplayWorkingDraft).toHaveBeenCalledTimes(2);
  });
  it('places trip navigation and its summary outside the scrolling gallery', async () => {
    mockPreparePrivateReplay.mockResolvedValue({ uri: 'file:///private-replay.mp4', renderedMemoryCount: 2, omittedMemoryCount: 0, durationSeconds: 8 });
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByLabelText('Edit private Replay')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Edit private Replay'));
    await openTrip(view);
    const grid = view.getByLabelText('Replay media grid');
    for (const label of ['Done editing this trip', 'Back to Replay trip overview', 'Trip selection summary']) {
      let element = view.getByLabelText(label).parent;
      while (element) { expect(element).not.toBe(grid); element = element.parent; }
    }
    expect(view.queryByText('Done trip')).toBeNull();
  });
  it('waits for a tapped unknown photo to resolve and save before leaving the trip', async () => {
    mockPreparePrivateReplay.mockResolvedValue({ uri: 'file:///private-replay.mp4', renderedMemoryCount: 2, omittedMemoryCount: 0, durationSeconds: 8 });
    const current = await mockLoadReplayManifestInput();
    mockLoadReplayManifestInput.mockResolvedValue({ ...current, memories: [{ ...current.memories[0], available: false, previewUri: undefined }, current.memories[1]] });
    let finishPreview!: (page: { key: string; available: boolean; previewUri: string }[]) => void;
    mockLoadReplayEditorPreviewPage.mockResolvedValueOnce([]).mockImplementationOnce(() => new Promise((resolve) => { finishPreview = resolve; }));
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByLabelText('Edit private Replay')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Edit private Replay'));
    await openTrip(view);
    await fireEvent.press(view.getByLabelText('Add photo 1'));
    await waitFor(() => expect(view.getByLabelText('Checking photo 1')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Done editing this trip'));
    await waitFor(() => expect(view.getByLabelText('Replay trip overview')).toBeOnTheScreen());
    expect(view.getByText(/Saving changes/)).toBeOnTheScreen();
    await act(async () => { finishPreview([{ key: 'memory-a', available: true, previewUri: 'file:///private-a.jpg' }]); });
    await waitFor(() => expect(view.getByLabelText('Replay trip overview')).toBeOnTheScreen());
    expect(mockStageReplayWorkingDraft).toHaveBeenCalledWith(['memory-b', 'memory-a'], 7, 1, 'oldest-first', expect.anything(), undefined, ['a', 'b'], ['b']);
  });
  it.each([false, true])('acknowledges a new photo tap started while Done waits for a save (retry=%s)', async (retry) => {
    const current = await mockLoadReplayManifestInput();
    mockLoadReplayManifestInput.mockResolvedValue({ ...current, memories: [...current.memories, { key: 'memory-c', groupKey: 'a', kind: 'photo', available: false, eligible: true }] });
    mockPreparePrivateReplay.mockResolvedValue({ uri: 'file:///private-replay.mp4', renderedMemoryCount: 2, durationSeconds: 8 });
    let finishSave!: (revision: number) => void;
    let finishPreview!: (page: { key: string; available: boolean; previewUri: string }[]) => void;
    if (retry) mockStageReplayWorkingDraft.mockRejectedValueOnce(new ReplayPreparationError('REPLAY_UNAVAILABLE'));
    mockStageReplayWorkingDraft.mockImplementationOnce(() => new Promise<number>((resolve) => { finishSave = resolve; })).mockResolvedValue(5);
    mockLoadReplayEditorPreviewPage.mockResolvedValueOnce([]).mockImplementationOnce(() => new Promise((resolve) => { finishPreview = resolve; }));
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByLabelText('Edit private Replay')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Edit private Replay'));
    await openTrip(view);
    await fireEvent.press(view.getByLabelText('Remove photo 1'));
    if (retry) await waitFor(() => expect(view.getByText(/Couldn’t save this trip/)).toBeOnTheScreen());
    else await waitFor(() => expect(mockStageReplayWorkingDraft).toHaveBeenCalledTimes(1));
    await fireEvent.press(view.getByLabelText('Add photo 2'));
    await waitFor(() => expect(view.getByLabelText('Checking photo 2')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Done editing this trip'));
    await waitFor(() => expect(view.getByLabelText('Replay trip overview')).toBeOnTheScreen());
    if (retry) {
      await act(async () => { finishPreview([{ key: 'memory-c', available: true, previewUri: 'file:///private-c.jpg' }]); });
      await waitFor(() => expect(mockStageReplayWorkingDraft).toHaveBeenCalledTimes(2));
      await act(async () => { finishSave(4); });
    } else {
      await act(async () => { finishSave(4); });
      await act(async () => { finishPreview([{ key: 'memory-c', available: true, previewUri: 'file:///private-c.jpg' }]); });
    }
    await waitFor(() => expect(view.getByLabelText('Replay trip overview')).toBeOnTheScreen());
    // A retry has no acknowledged revision after its initial failure; the
    // normal path does, and retains that optimistic precondition.
    expect(mockStageReplayWorkingDraft).toHaveBeenLastCalledWith(['memory-b', 'memory-c'], 7, 1, 'oldest-first', expect.anything(), retry ? undefined : 4, ['a', 'b'], ['b']);
  });
  it('requires an explicit restore confirmation and uses current scope without rendering', async () => {
    mockPreparePrivateReplay.mockResolvedValue({ uri: 'file:///private-replay.mp4', renderedMemoryCount: 2, omittedMemoryCount: 0, durationSeconds: 8 });
    mockStageReplayWorkingDraft.mockRejectedValueOnce(new ReplayPreparationError('REPLAY_STALE'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByLabelText('Edit private Replay')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Edit private Replay'));
    await openTrip(view);
    await fireEvent.press(view.getByLabelText('Remove photo 1'));
    await waitFor(() => expect(view.getByLabelText('Restore saved Replay selection')).toBeOnTheScreen());
    const current = await mockLoadReplayManifestInput();
    mockLoadReplayManifestInput.mockResolvedValue({ ...current, snapshotToken: 8 });
    await fireEvent.press(view.getByLabelText('Restore saved Replay selection'));
    expect(mockResetReplayDraft).not.toHaveBeenCalled();
    const confirm = alert.mock.calls[0][2]?.find((button) => button.style === 'destructive');
    await act(async () => { confirm?.onPress?.(); });
    await waitFor(() => expect(mockResetReplayDraft).toHaveBeenCalledWith(8, 1));
    await waitFor(() => expect(view.getByLabelText('Replay trip overview')).toBeOnTheScreen());
    expect(mockPreparePrivateReplay).toHaveBeenCalledTimes(1);
    await fireEvent.press(view.getByLabelText('Back to saved Replay'));
    await waitFor(() => expect(view.getByText('Replay could not be prepared.')).toBeOnTheScreen());
    expect(view.queryByLabelText('Mute Replay audio')).toBeNull();
    alert.mockRestore();
  });
  it('keeps overview navigation and Update Replay outside the scrolling trip rows', async () => {
    mockPreparePrivateReplay.mockResolvedValue({ uri: 'file:///private-replay.mp4', renderedMemoryCount: 2, omittedMemoryCount: 0, durationSeconds: 8 });
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByLabelText('Edit private Replay')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Edit private Replay'));
    const list = await view.findByLabelText('Replay trip overview');
    for (const label of ['Update Replay', 'Back to saved Replay']) {
      let element = view.getByLabelText(label).parent;
      while (element) { expect(element).not.toBe(list); element = element.parent; }
    }
    expect(view.getByLabelText('Music and Replay order')).toBeOnTheScreen();
    expect(view.queryByLabelText('Use newest-first Replay timeline')).toBeNull();
  });
  it('stages automatic defaults without replacing the saved preview until Done', async () => {
    mockPreparePrivateReplay.mockResolvedValue({ uri: 'file:///private-replay.mp4', renderedMemoryCount: 2, omittedMemoryCount: 0, durationSeconds: 8 });
    mockResetReplayDraft.mockResolvedValue(undefined);
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByLabelText('Edit private Replay')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Edit private Replay'));
    await fireEvent.press(view.getByLabelText('Music and Replay order'));
    await waitFor(() => expect(view.getByLabelText('Reset Replay edits')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Reset Replay edits'));
    await waitFor(() => expect(mockResetReplayDraft).toHaveBeenCalledWith(7, 1));
    await waitFor(() => expect(mockStageReplayWorkingDraft).toHaveBeenCalledWith(['memory-a', 'memory-b'], 7, 1, 'oldest-first', { kind: 'bundled', revision: 'happy-moments-1.4' }, undefined, ['a', 'b'], ['a', 'b']));
    expect(mockPreparePrivateReplay).toHaveBeenCalledTimes(1);
    await fireEvent.press(view.getByLabelText('Close Replay settings'));
    expect(view.getByLabelText('Update Replay')).toBeOnTheScreen();
  });
  it('retains committed custom music when resetting automatic media', async () => {
    const current = await mockLoadReplayManifestInput();
    const soundtrack = { kind: 'custom', revision: 'custom-synthetic', localUri: 'file:///private-music.audio' };
    mockLoadReplayManifestInput.mockResolvedValue({ ...current, soundtrack });
    mockLoadPreparedReplay.mockResolvedValue({ uri: 'file:///private-replay.mp4', renderedMemoryCount: 2, durationSeconds: 8 });
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByLabelText('Edit private Replay')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Edit private Replay'));
    await fireEvent.press(view.getByLabelText('Music and Replay order'));
    await fireEvent.press(view.getByLabelText('Reset Replay edits'));
    await waitFor(() => expect(mockStageReplayWorkingDraft).toHaveBeenCalledWith(['memory-a', 'memory-b'], 7, 1, 'oldest-first', soundtrack, undefined, ['a', 'b'], ['a', 'b']));
  });
  it('copies a chosen local audio file with its playable extension and stages it for Replay', async () => {
    mockLoadPreparedReplay.mockResolvedValue({ uri: 'file:///private-replay.mp4', renderedMemoryCount: 2, durationSeconds: 8 });
    mockGetDocumentAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///cache/song.m4a', name: 'song.m4a', mimeType: 'audio/mp4', size: 1024 }] });
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByLabelText('Edit private Replay')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Edit private Replay'));
    await fireEvent.press(view.getByLabelText('Music and Replay order'));
    await fireEvent.press(view.getByLabelText('Choose Replay audio file'));
    await waitFor(() => expect(view.getByText('Background music: Custom audio ready')).toBeOnTheScreen());
    expect(view.getByText('Loaded audio: song.m4a')).toBeOnTheScreen();
    expect(mockCopyAsync).toHaveBeenCalledWith({ from: 'file:///cache/song.m4a', to: expect.stringMatching(/^file:\/\/\/documents\/replay-custom-.+\.m4a$/) });
    await waitFor(() => expect(mockStageReplayWorkingDraft).toHaveBeenCalledWith(['memory-a', 'memory-b'], 7, 1, 'oldest-first', expect.objectContaining({ kind: 'custom', localUri: expect.stringMatching(/\.m4a$/) }), undefined, ['a', 'b'], ['a', 'b']));
    await fireEvent.press(view.getByLabelText('Save music and Replay order'));
    await waitFor(() => expect(view.getByLabelText('Update Replay')).not.toBeDisabled());
  });
  it('selects an unknown photo already resolved by a previous gallery page', async () => {
    const current = await mockLoadReplayManifestInput();
    mockLoadReplayManifestInput.mockResolvedValue({ ...current, memories: [{ ...current.memories[0], available: false, previewUri: undefined }, current.memories[1]] });
    mockLoadReplayEditorPreviewPage.mockResolvedValue([{ key: 'memory-a', available: true, previewUri: 'file:///private-a.jpg' }]);
    mockPreparePrivateReplay.mockResolvedValue({ uri: 'file:///private-replay.mp4', renderedMemoryCount: 1, durationSeconds: 8 });
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByLabelText('Edit private Replay')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Edit private Replay'));
    await openTrip(view);
    await waitFor(() => expect(view.getByLabelText('photo thumbnail')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Open trip media actions'));
    await fireEvent.press(view.getByLabelText('Select all media in this trip'));
    await waitFor(() => expect(mockStageReplayWorkingDraft).toHaveBeenCalledWith(['memory-b', 'memory-a'], 7, 1, 'oldest-first', expect.anything(), undefined, ['a', 'b'], ['b']));
  });
  it('does not offer a previous trip’s Undo after opening another trip', async () => {
    mockPreparePrivateReplay.mockResolvedValue({ uri: 'file:///private-replay.mp4', renderedMemoryCount: 2, durationSeconds: 8 });
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByLabelText('Edit private Replay')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Edit private Replay'));
    await openTrip(view);
    await fireEvent.press(view.getByLabelText('Remove photo 1'));
    await fireEvent.press(view.getByLabelText('Done editing this trip'));
    await openTrip(view, '2024-02-01');
    await fireEvent.press(view.getByLabelText('Open trip media actions'));
    expect(view.getByLabelText('Undo last trip media change')).toBeDisabled();
  });
  it('keeps media recognizable, grouped by trip, and inspectable without changing selection', async () => {
    mockPreparePrivateReplay.mockResolvedValue({ uri: 'file:///private-replay.mp4', renderedMemoryCount: 2, omittedMemoryCount: 0, durationSeconds: 8 });
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByLabelText('Edit private Replay')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Edit private Replay'));
    await openTrip(view);
    expect(view.getByLabelText('photo thumbnail')).toBeOnTheScreen();
    await fireEvent.press(view.getByLabelText('Done editing this trip'));
    await waitFor(() => expect(view.getByLabelText('Replay trip overview')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Edit trip Observed destination 2024-02-01'));
    await waitFor(() => expect(view.getByLabelText('video poster')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Inspect video 1'));
    await waitFor(() => expect(view.getByLabelText('Inspected video')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Close Replay media inspection'));
    await waitFor(() => expect(view.getByLabelText('Remove video 1')).toBeOnTheScreen());
  });
  it('keeps unknown album media visible and resolves the unfiltered trip page on demand', async () => {
    mockLoadReplayManifestInput.mockResolvedValue({ snapshotToken: 7, privacyRevision: 1, memories: [
      { key: 'memory-known', groupKey: 'a', kind: 'photo', available: true, eligible: true, previewUri: 'file:///private-known.jpg' },
      { key: 'memory-unknown', groupKey: 'a', kind: 'photo', available: false, eligible: true },
    ], groups: [{ key: 'a', label: 'Observed destination', interval: { startDay: '2024-01-01', endDay: '2024-01-02' }, inferred: true, eligible: true, orderCertain: true }] });
    mockPreparePrivateReplay.mockResolvedValue({ uri: 'file:///private-replay.mp4', renderedMemoryCount: 1, omittedMemoryCount: 0, durationSeconds: 5 });
    mockLoadReplayEditorPreviewPage.mockResolvedValue([{ key: 'memory-unknown', available: true, previewUri: 'file:///private-unknown.jpg' }]);
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByLabelText('Edit private Replay')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Edit private Replay'));
    await openTrip(view);
    expect(view.getByLabelText('Add photo 2')).toBeOnTheScreen();
    await waitFor(() => expect(mockLoadReplayEditorPreviewPage).toHaveBeenCalledWith(['memory-unknown'], 7, 1));
  });
  it('offers a retry when a trip preview page fails without clearing the album', async () => {
    mockLoadReplayManifestInput.mockResolvedValue({ snapshotToken: 7, privacyRevision: 1, memories: [
      { key: 'memory-known', groupKey: 'a', kind: 'photo', available: true, eligible: true, previewUri: 'file:///private-known.jpg' },
      { key: 'memory-unknown', groupKey: 'a', kind: 'photo', available: false, eligible: true },
    ], groups: [{ key: 'a', label: 'Observed destination', interval: { startDay: '2024-01-01', endDay: '2024-01-02' }, inferred: true, eligible: true, orderCertain: true }] });
    mockPreparePrivateReplay.mockResolvedValue({ uri: 'file:///private-replay.mp4', renderedMemoryCount: 2, omittedMemoryCount: 0, durationSeconds: 8 });
    mockLoadReplayEditorPreviewPage.mockRejectedValueOnce(new Error('synthetic page failure')).mockResolvedValue([]);
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByLabelText('Edit private Replay')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Edit private Replay'));
    await openTrip(view);
    await waitFor(() => expect(view.getByLabelText('Retry loading trip media')).toBeOnTheScreen());
    expect(view.getByLabelText('Replay media grid')).toBeOnTheScreen();
    await fireEvent.press(view.getByLabelText('Retry loading trip media'));
    await waitFor(() => expect(mockLoadReplayEditorPreviewPage).toHaveBeenCalledTimes(2));
  });
  it('lets the owner switch to selected media without losing the active trip', async () => {
    mockPreparePrivateReplay.mockResolvedValue({ uri: 'file:///private-replay.mp4', renderedMemoryCount: 2, omittedMemoryCount: 0, durationSeconds: 8 });
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByLabelText('Edit private Replay')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Edit private Replay'));
    await openTrip(view);
    await waitFor(() => expect(view.getByLabelText('Show selected Replay media')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Show selected Replay media'));
    await waitFor(() => expect(view.getByText(/selected · about/)).toBeOnTheScreen());
    expect(view.getByLabelText('Show all media in this trip')).toBeOnTheScreen();
    await fireEvent.press(view.getByLabelText('Show all media in this trip'));
    await waitFor(() => expect(view.getByLabelText('Show selected Replay media')).toBeOnTheScreen());
  });
  it('keeps the trip open and makes a durable-save failure actionable instead of appearing unresponsive', async () => {
    mockPreparePrivateReplay.mockResolvedValue({ uri: 'file:///private-replay.mp4', renderedMemoryCount: 2, omittedMemoryCount: 0, durationSeconds: 8 });
    mockStageReplayWorkingDraft.mockRejectedValueOnce(new ReplayPreparationError('REPLAY_STALE'));
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByLabelText('Edit private Replay')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Edit private Replay'));
    await openTrip(view);
    await fireEvent.press(view.getByLabelText('Remove photo 1'));
    await waitFor(() => expect(view.getByText(/could not be matched to the last saved edit/)).toBeOnTheScreen());
    expect(view.getByLabelText('Replay media grid')).toBeOnTheScreen();
    await fireEvent.press(view.getByLabelText('Keep my trip choices'));
    await waitFor(() => expect(view.getByLabelText('Replay trip overview')).toBeOnTheScreen());
    expect(mockResetReplayDraft).toHaveBeenCalledWith(7, 1);
    expect(mockStageReplayWorkingDraft).toHaveBeenCalledTimes(2);
  });
  it('retains a trip selection while excluding and re-including its chapter', async () => {
    mockPreparePrivateReplay.mockResolvedValue({ uri: 'file:///private-replay.mp4', renderedMemoryCount: 2, omittedMemoryCount: 0, durationSeconds: 8 });
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByLabelText('Edit private Replay')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Edit private Replay'));
    await openTrip(view);
    await fireEvent.press(view.getByLabelText('Open trip media actions'));
    await waitFor(() => expect(view.getByLabelText('Exclude this trip from Replay')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Exclude this trip from Replay'));
    await waitFor(() => expect(view.getByLabelText('Inactive photo 1')).toBeDisabled());
    await waitFor(() => expect(mockStageReplayWorkingDraft).toHaveBeenCalledWith(['memory-a', 'memory-b'], 7, 1, 'oldest-first', expect.anything(), undefined, ['b'], ['b']));
    await fireEvent.press(view.getByLabelText('Open trip media actions'));
    await waitFor(() => expect(view.getByLabelText('Include this trip in Replay')).toBeOnTheScreen());
    expect(view.getByLabelText('Inactive photo 1')).toBeDisabled();
    await fireEvent.press(view.getByLabelText('Include this trip in Replay'));
    await waitFor(() => expect(view.getByLabelText('Remove photo 1')).not.toBeDisabled());
    await fireEvent.press(view.getByLabelText('Open trip media actions'));
    await waitFor(() => expect(view.getByLabelText('Exclude this trip from Replay')).toBeOnTheScreen());
    expect(view.getByLabelText('Remove photo 1')).not.toBeDisabled();
  });
  it('stages a newest-first private timeline choice without regenerating early', async () => {
    mockPreparePrivateReplay.mockResolvedValue({ uri: 'file:///private-replay.mp4', renderedMemoryCount: 2, omittedMemoryCount: 0, durationSeconds: 8 });
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByLabelText('Edit private Replay')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Edit private Replay'));
    await fireEvent.press(view.getByLabelText('Music and Replay order'));
    await waitFor(() => expect(view.getByLabelText('Use newest-first Replay timeline')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Use newest-first Replay timeline'));
    await waitFor(() => expect(mockStageReplayWorkingDraft).toHaveBeenCalledWith(['memory-a', 'memory-b'], 7, 1, 'newest-first', { kind: 'bundled', revision: 'happy-moments-1.4' }, undefined, ['a', 'b'], ['a', 'b']));
    expect(mockPreparePrivateReplay).toHaveBeenCalledTimes(1);
  });
  it('requires an explicit Done action to finish Music and Replay order editing', async () => {
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByLabelText('Edit private Replay')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Edit private Replay'));
    await fireEvent.press(view.getByLabelText('Music and Replay order'));
    expect(view.getByLabelText('Save music and Replay order')).toBeOnTheScreen();
    await fireEvent.press(view.getByLabelText('Use newest-first Replay timeline'));
    await fireEvent.press(view.getByLabelText('Save music and Replay order'));
    await waitFor(() => expect(mockStageReplayWorkingDraft).toHaveBeenCalledWith(['memory-a', 'memory-b'], 7, 1, 'newest-first', { kind: 'bundled', revision: 'happy-moments-1.4' }, undefined, ['a', 'b'], ['a', 'b']));
    await waitFor(() => expect(view.queryByLabelText('Save music and Replay order')).toBeNull());
    expect(view.getByLabelText('Replay trip overview')).toBeOnTheScreen();
  });
  // This asynchronous aggregate-update regression intentionally runs last: it
  // verifies the rendered replacement path and its cleanup must not race a
  // fresh mount that uses the same provider test doubles.
  it('saves a direct visual selection and regenerates without changing the entry flow', verifyDirectSelectionAndAggregateUpdate);
});
