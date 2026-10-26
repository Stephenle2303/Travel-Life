import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { keepsReplayRoute, musicSaveFailureCopy, ReplayScreen, replayVideoSceneSeconds, shareableCommittedMemories } from '@/components/replay-screen';
import { ReplayDraftSaveError } from '@/photo-access/provider';
import { ReplayPreparationError } from '@/replay/renderer';
import { Alert } from 'react-native';
import { ReplayEditSession, ReplaySaveOutcomeError } from '@/replay/edit-session';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockLoadReplayManifestInput = jest.fn();
const mockLoadReplayEditorPreviewPage = jest.fn();
const mockLoadPreparedReplay = jest.fn();
const mockPreparePrivateReplay = jest.fn();
const mockSaveReplayDraft = jest.fn();
const mockStageReplayWorkingDraft = jest.fn();
const mockResetReplayDraft = jest.fn();
const mockExportPrivateReplay = jest.fn();
const mockDiscardPrivateReplay = jest.fn(async (_uri: string, _options?: { preserveFile?: boolean }) => {});
const mockNavigationAddListener = jest.fn();
const mockGetDocumentAsync = jest.fn();
const mockCopyAsync = jest.fn();
const mockGetInfoAsync = jest.fn();
const mockGetMediaInformation = jest.fn();
let mockReplayEditSession: ReplayEditSession | undefined;
let mockBeforeRemove: ((event: { preventDefault(): void }) => void) | undefined;
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }), useNavigation: () => ({ addListener: mockNavigationAddListener }) }));
jest.mock('expo-video', () => ({ useVideoPlayer: jest.fn(() => ({ pause: jest.fn(), generateThumbnailsAsync: jest.fn(async () => []) })), VideoView: 'VideoView' }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: (...args: unknown[]) => mockGetDocumentAsync(...args) }));
jest.mock('expo-file-system/legacy', () => ({ documentDirectory: 'file:///documents/', copyAsync: (...args: unknown[]) => mockCopyAsync(...args), getInfoAsync: (...args: unknown[]) => mockGetInfoAsync(...args) }));
jest.mock('munim-ffmpeg', () => ({ execute: jest.fn(), getMediaInformation: (...args: unknown[]) => mockGetMediaInformation(...args), pickEncoder: jest.fn() }));
jest.mock('@/replay/thumbnail-service', () => ({ replayThumbnails: { request: jest.fn(async () => ({ width: 1, height: 1, release: jest.fn() })), pin: jest.fn(), unpin: jest.fn(), subscribeInvalidation: jest.fn(() => jest.fn()) } }));
jest.mock('@/photo-access/provider', () => ({ ReplayDraftSaveError: class ReplayDraftSaveError extends Error { stage = 'REPLAY_STALE'; reason: 'scope' | 'revision' | 'branch' | 'unknown'; constructor(mockReason: 'scope' | 'revision' | 'branch' | 'unknown') { super('REPLAY_STALE'); this.reason = mockReason; } }, usePhotoAccess: () => ({ replayEditSession: mockReplayEditSession, loadReplayManifestInput: mockLoadReplayManifestInput, loadReplayEditorPreviewPage: mockLoadReplayEditorPreviewPage, loadPreparedReplay: mockLoadPreparedReplay, saveReplayDraft: mockSaveReplayDraft, stageReplayWorkingDraft: mockStageReplayWorkingDraft, resetReplayDraft: mockResetReplayDraft, preparePrivateReplay: mockPreparePrivateReplay, exportPrivateReplay: mockExportPrivateReplay, discardPrivateReplay: mockDiscardPrivateReplay }) }));

describe('Replay screen', () => {
  const openTrip = async (view: Awaited<ReturnType<typeof render>>, startDay = '2024-01-01') => {
    await waitFor(() => expect(view.getByLabelText('Replay trip overview')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText(`Edit trip Observed destination ${startDay}`));
    await waitFor(() => expect(view.getByLabelText('Replay media grid')).toBeOnTheScreen());
  };
  afterEach(async () => {
    mockDiscardPrivateReplay.mockClear();
    // Unmount and flush queued React work in one act boundary before resetting
    // module-level provider doubles used by the next screen instance.
    await act(async () => {
      await cleanup();
      await Promise.resolve();
    });
    mockLoadReplayManifestInput.mockReset(); mockLoadReplayEditorPreviewPage.mockReset(); mockLoadPreparedReplay.mockReset(); mockPreparePrivateReplay.mockReset(); mockSaveReplayDraft.mockReset(); mockStageReplayWorkingDraft.mockReset(); mockResetReplayDraft.mockReset(); mockExportPrivateReplay.mockReset(); mockNavigationAddListener.mockReset(); mockGetDocumentAsync.mockReset(); mockCopyAsync.mockReset(); mockGetInfoAsync.mockReset(); mockGetMediaInformation.mockReset(); mockBeforeRemove = undefined;
  });
  beforeEach(() => { mockReplayEditSession = undefined; mockNavigationAddListener.mockImplementation((_event, listener) => { mockBeforeRemove = listener; return jest.fn(); }); mockLoadPreparedReplay.mockResolvedValue(null); mockLoadReplayEditorPreviewPage.mockResolvedValue([]); mockStageReplayWorkingDraft.mockResolvedValue(undefined); mockGetInfoAsync.mockResolvedValue({ exists: true, size: 1024 }); mockCopyAsync.mockResolvedValue(undefined); mockGetMediaInformation.mockResolvedValue({ format: { duration: 30 }, streams: [{ codec_type: 'audio' }] }); return mockLoadReplayManifestInput.mockResolvedValue({ snapshotToken: 7, privacyRevision: 1, memories: [
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
  it('plays a verified durable Replay before the optional Edit manifest finishes hydrating', async () => {
    let resolveManifest!: (value: { snapshotToken: number; privacyRevision: number; memories: { key: string; groupKey: string; kind: 'photo'; available: boolean; eligible: boolean }[]; groups: { key: string; label: string; interval: { startDay: string; endDay: string }; inferred: boolean; eligible: boolean; orderCertain: boolean }[] }) => void;
    mockLoadPreparedReplay.mockResolvedValue({ uri: 'file:///documents/replay-previews/saved.mp4', renderedMemoryCount: 1, omittedMemoryCount: 0, durationSeconds: 5 });
    mockLoadReplayManifestInput.mockImplementation(() => new Promise((resolve) => { resolveManifest = resolve; }));
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByText(/Playing your private Replay/)).toBeOnTheScreen());
    expect(mockPreparePrivateReplay).not.toHaveBeenCalled();
    resolveManifest({ snapshotToken: 7, privacyRevision: 1, memories: [{ key: 'memory-a', groupKey: 'a', kind: 'photo', available: true, eligible: true }], groups: [{ key: 'a', label: 'Observed destination', interval: { startDay: '2024-01-01', endDay: '2024-01-02' }, inferred: true, eligible: true, orderCertain: true }] });
    await waitFor(() => expect(view.getByLabelText('Edit private Replay')).toBeOnTheScreen());
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
    await act(async () => { mockBeforeRemove?.({ preventDefault }); });
    expect(preventDefault).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(view.getByLabelText('Edit private Replay')).toBeOnTheScreen());
  });
  it('retains the Replay route while an Update is rendering', () => {
    expect(keepsReplayRoute('checking')).toBe(true);
    expect(keepsReplayRoute('final-ready')).toBe(false);
  });
  it('explains a stale Journey List when Music Done cannot safely save', () => {
    expect(musicSaveFailureCopy(new ReplayDraftSaveError('scope'))).toContain('Journey List changed');
    expect(musicSaveFailureCopy(new ReplaySaveOutcomeError({ kind: 'failed', version: 1 }))).toContain('This device could not save');
    expect(musicSaveFailureCopy(new ReplaySaveOutcomeError({ kind: 'outcome-unknown', version: 1 }))).toContain('Still confirming');
    expect(musicSaveFailureCopy(new ReplaySaveOutcomeError({ kind: 'conflict', version: 1 }))).toContain('current local Replay draft');
  });
  it('mutes and unmutes the existing player without preparing another Replay', async () => {
    mockPreparePrivateReplay.mockResolvedValue({ uri: 'file:///private-replay.mp4', renderedMemoryCount: 1, omittedMemoryCount: 0, durationSeconds: 5 });
    mockExportPrivateReplay.mockResolvedValue('closed');
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByLabelText('Mute Replay audio')).toBeOnTheScreen());
    expect(mockPreparePrivateReplay).toHaveBeenLastCalledWith(undefined, expect.any(Function), { kind: 'bundled', revision: 'happy-moments-1.4' }, expect.any(Function));
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
  it('keeps the player listening state through app-owned fullscreen without rendering again', async () => {
    mockPreparePrivateReplay.mockResolvedValue({ uri: 'file:///private-replay.mp4', renderedMemoryCount: 1, omittedMemoryCount: 0, durationSeconds: 5 });
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByLabelText('Mute Replay audio')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Mute Replay audio'));
    await fireEvent.press(view.getByLabelText('Open Replay fullscreen'));
    await waitFor(() => expect(view.getByLabelText('Close Replay fullscreen')).toBeOnTheScreen());
    expect(view.getByLabelText('Unmute Replay audio')).toBeOnTheScreen();
    await fireEvent.press(view.getByLabelText('Close Replay fullscreen'));
    await waitFor(() => expect(view.getByLabelText('Unmute Replay audio')).toBeOnTheScreen());
    expect(mockPreparePrivateReplay).toHaveBeenCalledTimes(1);
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
    await act(async () => { reportProgress({ message: 'Rendering scene 1 of 2.', completed: 1, total: 2 }); });
    await waitFor(() => expect(view.getByLabelText('Replay rendering 50% complete')).toBeOnTheScreen());
    await act(async () => { resolveRender({ uri: 'file:///private-replay.mp4', renderedMemoryCount: 1, omittedMemoryCount: 0, durationSeconds: 5 }); });
    await waitFor(() => expect(view.getByText(/Playing your private Replay/)).toBeOnTheScreen());
  });
  it('plays the verified first trip while remaining trips continue to buffer', async () => {
    let finish!: (value: { uri: string; renderedMemoryCount: number; omittedMemoryCount: number; durationSeconds: number }) => void;
    mockPreparePrivateReplay.mockImplementation((_keys, _progress, _music, firstReady) => new Promise((resolve) => {
      finish = resolve;
      firstReady({ uri: 'file:///first-trip.mp4', renderedMemoryCount: 1, omittedMemoryCount: 1, durationSeconds: 5 });
    }));
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByText(/First trip ready · finishing 1 of 2/)).toBeOnTheScreen());
    expect(view.getByText(/Sound will be ready with the full Replay/)).toBeOnTheScreen();
    expect(view.queryByLabelText('Choose Replay for sharing')).toBeNull();
    await act(async () => { finish({ uri: 'file:///full-replay.mp4', renderedMemoryCount: 2, omittedMemoryCount: 0, durationSeconds: 10 }); });
    await waitFor(() => expect(view.getByText(/Built locally from 2 selected memories/)).toBeOnTheScreen());
  });
  it('ignores late progressive and final callbacks after Replay preparation is closed', async () => {
    let firstReady!: (preview: { uri: string; renderedMemoryCount: number; omittedMemoryCount: number; durationSeconds: number }) => void;
    let finish!: (preview: { uri: string; renderedMemoryCount: number; omittedMemoryCount: number; durationSeconds: number }) => void;
    mockPreparePrivateReplay.mockImplementation((_keys, _progress, _music, onFirstReady) => new Promise((resolve) => { firstReady = onFirstReady; finish = resolve; }));
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByLabelText('Cancel Replay preparation')).toBeOnTheScreen());
    await waitFor(() => expect(mockPreparePrivateReplay).toHaveBeenCalledTimes(1));
    await fireEvent.press(view.getByLabelText('Cancel Replay preparation'));
    await act(async () => {
      firstReady({ uri: 'file:///late-first-trip.mp4', renderedMemoryCount: 1, omittedMemoryCount: 1, durationSeconds: 5 });
      finish({ uri: 'file:///late-full-replay.mp4', renderedMemoryCount: 2, omittedMemoryCount: 0, durationSeconds: 10 });
    });
    await waitFor(() => expect(view.queryByText(/First trip ready/)).toBeNull());
    expect(view.queryByLabelText('Mute Replay audio')).toBeNull();
  });
  it('keeps a prior verified Replay private-safe when a replacement cannot finish', async () => {
    mockLoadPreparedReplay.mockResolvedValue({ uri: 'file:///saved-replay.mp4', renderedMemoryCount: 2, omittedMemoryCount: 0, durationSeconds: 10 });
    mockPreparePrivateReplay.mockRejectedValue(new ReplayPreparationError('REPLAY_ENCODE'));
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByLabelText('Re-render private Replay')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Re-render private Replay'));
    await waitFor(() => expect(view.getByText(/previous verified Replay is still ready/)).toBeOnTheScreen());
    expect(mockDiscardPrivateReplay).toHaveBeenCalledTimes(1);
    expect(mockDiscardPrivateReplay).toHaveBeenCalledWith('file:///saved-replay.mp4', { preserveFile: true });
    expect(view.queryByLabelText('Choose Replay for sharing')).toBeNull();
    expect(view.queryByLabelText('Edit private Replay')).toBeNull();
    expect(view.getByLabelText('Retry full Replay finalization')).toBeOnTheScreen();
  });
  it('removes a reclaimed first-trip preview when finalization fails', async () => {
    let fail!: (error: Error) => void;
    mockPreparePrivateReplay.mockImplementation((_keys, _progress, _music, firstReady) => new Promise((_resolve, reject) => {
      fail = reject;
      firstReady({ uri: 'file:///temporary-first-trip.mp4', renderedMemoryCount: 1, durationSeconds: 5 });
    }));
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByText(/First trip ready/)).toBeOnTheScreen());
    await act(async () => { fail(new ReplayPreparationError('REPLAY_ENCODE')); });
    await waitFor(() => expect(view.getByText(/could not compose the Replay video/)).toBeOnTheScreen());
    expect(view.queryByLabelText('Mute Replay audio')).toBeNull();
    expect(view.queryByText(/This is only the first trip/)).toBeNull();
    expect(view.getByLabelText('Retry private Replay')).toBeOnTheScreen();
  });
  it('reclaims the prior verified video only after replacement succeeds', async () => {
    mockLoadPreparedReplay.mockResolvedValue({ uri: 'file:///saved-replay.mp4', renderedMemoryCount: 2, durationSeconds: 10 });
    let finish!: (preview: { uri: string; renderedMemoryCount: number; durationSeconds: number }) => void;
    mockPreparePrivateReplay.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByLabelText('Re-render private Replay')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Re-render private Replay'));
    await waitFor(() => expect(mockPreparePrivateReplay).toHaveBeenCalled());
    expect(mockDiscardPrivateReplay.mock.calls).toEqual([['file:///saved-replay.mp4', { preserveFile: true }]]);
    await act(async () => { finish({ uri: 'file:///replacement.mp4', renderedMemoryCount: 2, durationSeconds: 10 }); });
    await waitFor(() => expect(mockDiscardPrivateReplay).toHaveBeenLastCalledWith('file:///saved-replay.mp4'));
    expect(view.getByText(/Playing your private Replay/)).toBeOnTheScreen();
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
    await waitFor(() => expect(view.getByText(/Replay needs a refresh/)).toBeOnTheScreen());
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
    expect(mockPreparePrivateReplay).toHaveBeenLastCalledWith(undefined, expect.any(Function), { kind: 'bundled', revision: 'happy-moments-1.4' }, expect.any(Function));
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
    await act(async () => { finishPreview([{ key: 'memory-a', available: true, previewUri: 'file:///private-a.jpg' }]); });
    await waitFor(() => expect(view.getByLabelText('Replay trip overview')).toBeOnTheScreen());
    await waitFor(() => expect(mockStageReplayWorkingDraft).toHaveBeenCalledWith(['memory-b', 'memory-a'], 7, 1, 'oldest-first', expect.anything(), undefined, ['a', 'b'], ['b']));
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
    await waitFor(() => expect(mockStageReplayWorkingDraft).toHaveBeenLastCalledWith(['memory-b', 'memory-c'], 7, 1, 'oldest-first', expect.anything(), retry ? undefined : 4, ['a', 'b'], ['b']));
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
  it('keeps Reset oldest-first when settings Done acknowledges the reset', async () => {
    const current = await mockLoadReplayManifestInput();
    mockLoadReplayManifestInput.mockResolvedValue({ ...current, direction: 'newest-first' });
    mockLoadPreparedReplay.mockResolvedValue({ uri: 'file:///saved-replay.mp4', renderedMemoryCount: 2, durationSeconds: 8 });
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByLabelText('Edit private Replay')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Edit private Replay'));
    await fireEvent.press(view.getByLabelText('Music and Replay order'));
    await fireEvent.press(view.getByLabelText('Reset Replay edits'));
    await waitFor(() => expect(view.getByText('Chapter order: Oldest first.')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Save music and Replay order'));
    await waitFor(() => expect(view.queryByLabelText('Save music and Replay order')).toBeNull());
    expect(mockStageReplayWorkingDraft).toHaveBeenLastCalledWith(expect.any(Array), 7, 1, 'oldest-first', expect.any(Object), undefined, ['a', 'b'], ['a', 'b']);
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
    expect(mockCopyAsync).toHaveBeenCalledWith({ from: 'file:///cache/song.m4a', to: expect.stringMatching(/^file:\/\/\/documents\/replay-audio-.+\.m4a$/) });
    expect(mockGetMediaInformation).not.toHaveBeenCalled();
    expect(mockStageReplayWorkingDraft).not.toHaveBeenCalled();
    await fireEvent.press(view.getByLabelText('Save music and Replay order'));
    await waitFor(() => expect(mockStageReplayWorkingDraft).toHaveBeenCalledWith(['memory-a', 'memory-b'], 7, 1, 'oldest-first', expect.objectContaining({ kind: 'custom', localUri: expect.stringMatching(/\.m4a$/) }), undefined, ['a', 'b'], ['a', 'b']));
    await waitFor(() => expect(view.getByLabelText('Update Replay')).not.toBeDisabled());
  });
  it('reports an oversized selected audio file before copying or staging it', async () => {
    mockLoadPreparedReplay.mockResolvedValue({ uri: 'file:///private-replay.mp4', renderedMemoryCount: 2, durationSeconds: 8 });
    mockGetDocumentAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///cache/too-large.m4a', name: 'too-large.m4a', mimeType: 'audio/mp4', size: 5_000_001 }] });
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByLabelText('Edit private Replay')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Edit private Replay'));
    await fireEvent.press(view.getByLabelText('Music and Replay order'));
    await fireEvent.press(view.getByLabelText('Choose Replay audio file'));
    await waitFor(() => expect(view.getByText('Couldn’t load audio: too-large.m4a')).toBeOnTheScreen());
    expect(view.getByText('Choose a readable audio file up to 5 MB. Your previous music is kept.')).toBeOnTheScreen();
    expect(mockCopyAsync).not.toHaveBeenCalled();
    expect(mockStageReplayWorkingDraft).not.toHaveBeenCalled();
  });
  it('explains an unsupported selected audio format before copying or staging it', async () => {
    mockLoadPreparedReplay.mockResolvedValue({ uri: 'file:///private-replay.mp4', renderedMemoryCount: 2, durationSeconds: 8 });
    mockGetDocumentAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///cache/song.flac', name: 'song.flac', mimeType: 'audio/flac', size: 1024 }] });
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByLabelText('Edit private Replay')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Edit private Replay'));
    await fireEvent.press(view.getByLabelText('Music and Replay order'));
    await fireEvent.press(view.getByLabelText('Choose Replay audio file'));
    await waitFor(() => expect(view.getByText('Couldn’t load audio: song.flac')).toBeOnTheScreen());
    expect(view.getByText('Choose a readable audio file up to 5 MB. Your previous music is kept.')).toBeOnTheScreen();
    expect(mockCopyAsync).not.toHaveBeenCalled();
    expect(mockStageReplayWorkingDraft).not.toHaveBeenCalled();
  });
  it('keeps Music settings open when their durable save fails', async () => {
    mockLoadPreparedReplay.mockResolvedValue({ uri: 'file:///private-replay.mp4', renderedMemoryCount: 2, durationSeconds: 8 });
    mockGetDocumentAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///cache/song.m4a', name: 'song.m4a', mimeType: 'audio/mp4', size: 1024 }] });
    mockStageReplayWorkingDraft.mockRejectedValueOnce(new ReplayPreparationError('REPLAY_UNAVAILABLE'));
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByLabelText('Edit private Replay')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Edit private Replay'));
    await fireEvent.press(view.getByLabelText('Music and Replay order'));
    await fireEvent.press(view.getByLabelText('Choose Replay audio file'));
    await waitFor(() => expect(view.getByText('Loaded audio: song.m4a')).toBeOnTheScreen());
    expect(view.getByText('Background music: Custom audio ready')).toBeOnTheScreen();
    expect(mockStageReplayWorkingDraft).not.toHaveBeenCalled();
    await fireEvent.press(view.getByLabelText('Save music and Replay order'));
    await waitFor(() => expect(view.getByText('This device could not save your Replay changes. Your audio file is kept; try Done again.')).toBeOnTheScreen());
    expect(view.getByLabelText('Save music and Replay order')).toBeOnTheScreen();
    expect(view.getByLabelText('Update Replay')).toBeDisabled();
  });
  it('retries a failed Music save in the same sheet and exposes Update only after acknowledgement', async () => {
    mockGetDocumentAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///cache/retry-song.m4a', name: 'retry-song.m4a', mimeType: 'audio/mp4', size: 1024 }] });
    mockStageReplayWorkingDraft.mockRejectedValueOnce(new ReplayPreparationError('REPLAY_UNAVAILABLE')).mockResolvedValueOnce(8);
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByLabelText('Edit private Replay')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Edit private Replay'));
    await fireEvent.press(view.getByLabelText('Music and Replay order'));
    await fireEvent.press(view.getByLabelText('Choose Replay audio file'));
    await waitFor(() => expect(view.getByText('Loaded audio: retry-song.m4a')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Save music and Replay order'));
    await waitFor(() => expect(view.getByText('This device could not save your Replay changes. Your audio file is kept; try Done again.')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Save music and Replay order'));
    await waitFor(() => expect(mockStageReplayWorkingDraft).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(view.queryByLabelText('Save music and Replay order')).toBeNull());
    expect(view.getByLabelText('Update Replay')).not.toBeDisabled();
  });
  it('keeps Music settings visible while the audio draft is saving, then enables Update', async () => {
    let acknowledge!: (revision: number) => void;
    mockGetDocumentAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///cache/wait-song.m4a', name: 'wait-song.m4a', mimeType: 'audio/mp4', size: 1024 }] });
    mockStageReplayWorkingDraft.mockImplementationOnce(() => new Promise<number>((resolve) => { acknowledge = resolve; }));
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByLabelText('Edit private Replay')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Edit private Replay'));
    await fireEvent.press(view.getByLabelText('Music and Replay order'));
    await fireEvent.press(view.getByLabelText('Choose Replay audio file'));
    await waitFor(() => expect(view.getByText('Loaded audio: wait-song.m4a')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Save music and Replay order'));
    await waitFor(() => expect(view.getByText('Saving audio: wait-song.m4a')).toBeOnTheScreen());
    expect(view.getByLabelText('Save music and Replay order')).toBeDisabled();
    expect(view.getByLabelText('Close Replay settings')).toBeDisabled();
    expect(view.getByLabelText('Choose Replay audio file')).toBeDisabled();
    expect(view.getByLabelText('Use default Replay music')).toBeDisabled();
    expect(view.getByLabelText('Use newest-first Replay timeline')).toBeDisabled();
    await fireEvent.press(view.getByLabelText('Use newest-first Replay timeline'));
    await fireEvent.press(view.getByLabelText('Close Replay settings'));
    expect(view.getByLabelText('Save music and Replay order')).toBeOnTheScreen();
    await act(async () => { acknowledge(8); });
    await waitFor(() => expect(view.queryByLabelText('Save music and Replay order')).toBeNull());
    expect(view.getByLabelText('Update Replay')).not.toBeDisabled();
    expect(view.getByText(/Custom audio.*Oldest first/)).toBeOnTheScreen();
  });
  it('commits and renders a confirmed custom audio track when Update Replay is tapped', async () => {
    mockGetDocumentAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///cache/song.m4a', name: 'song.m4a', mimeType: 'audio/mp4', size: 1024 }] });
    mockPreparePrivateReplay.mockResolvedValue({ uri: 'file:///private-replay-custom.mp4', renderedMemoryCount: 2, omittedMemoryCount: 0, durationSeconds: 8 });
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByLabelText('Edit private Replay')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Edit private Replay'));
    await fireEvent.press(view.getByLabelText('Music and Replay order'));
    await fireEvent.press(view.getByLabelText('Choose Replay audio file'));
    await waitFor(() => expect(view.getByText('Loaded audio: song.m4a')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Save music and Replay order'));
    await waitFor(() => expect(view.getByLabelText('Update Replay')).not.toBeDisabled());
    await fireEvent.press(view.getByLabelText('Update Replay'));
    await waitFor(() => expect(mockSaveReplayDraft).toHaveBeenCalledWith(['memory-a', 'memory-b'], 7, 1, 'oldest-first', expect.objectContaining({ kind: 'custom', localUri: expect.stringMatching(/\.m4a$/) }), undefined, ['a', 'b'], ['a', 'b']));
    await waitFor(() => expect(mockPreparePrivateReplay).toHaveBeenLastCalledWith(undefined, expect.any(Function), expect.objectContaining({ kind: 'custom', localUri: expect.stringMatching(/\.m4a$/) }), expect.any(Function)));
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
  it.each(['single', 'all'])('fences delayed %s media selection after restoring the session', async (mode) => {
    const write = jest.fn(async () => 1);
    mockReplayEditSession = new ReplayEditSession(write, () => false);
    const current = await mockLoadReplayManifestInput();
    mockLoadReplayManifestInput.mockResolvedValue({ ...current, memories: [{ ...current.memories[0], available: false, previewUri: undefined }, current.memories[1]] });
    let resolvePage!: (page: { key: string; available: boolean; previewUri: string }[]) => void;
    const held = new Promise<{ key: string; available: boolean; previewUri: string }[]>((resolve) => { resolvePage = resolve; });
    mockLoadReplayEditorPreviewPage.mockReturnValue(held);
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByLabelText('Edit private Replay')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Edit private Replay'));
    await openTrip(view);
    if (mode === 'all') {
      await fireEvent.press(view.getByLabelText('Open trip media actions'));
      await fireEvent.press(view.getByLabelText('Select all media in this trip'));
    } else await fireEvent.press(view.getByLabelText('Add photo 1'));
    await act(async () => {
      await mockReplayEditSession!.fence();
      resolvePage([{ key: 'memory-a', available: true, previewUri: 'file:///private-a.jpg' }]);
    });
    expect(write).not.toHaveBeenCalled();
    expect(mockReplayEditSession!.scheduler.getCounts()).toEqual({ active: 0, pending: 0 });
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
    await waitFor(() => expect(mockLoadReplayEditorPreviewPage).toHaveBeenCalledWith(['memory-unknown'], 7, 1, expect.any(Function)));
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
  it('keeps an excluded trip excluded when a later trip media edit is staged', async () => {
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByLabelText('Edit private Replay')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Edit private Replay'));
    await openTrip(view);
    await fireEvent.press(view.getByLabelText('Open trip media actions'));
    await fireEvent.press(view.getByLabelText('Exclude this trip from Replay'));
    await waitFor(() => expect(mockStageReplayWorkingDraft).toHaveBeenLastCalledWith(
      ['memory-a', 'memory-b'], 7, 1, 'oldest-first', expect.anything(), undefined, ['b'], ['b'],
    ));

    await fireEvent.press(view.getByLabelText('Done editing this trip'));
    await openTrip(view, '2024-02-01');
    await fireEvent.press(view.getByLabelText('Remove video 1'));
    await waitFor(() => expect(mockStageReplayWorkingDraft).toHaveBeenLastCalledWith(
      ['memory-a'], 7, 1, 'oldest-first', expect.anything(), undefined, ['b'], [],
    ));
  });
  it('stages a newest-first private timeline choice without regenerating early', async () => {
    mockPreparePrivateReplay.mockResolvedValue({ uri: 'file:///private-replay.mp4', renderedMemoryCount: 2, omittedMemoryCount: 0, durationSeconds: 8 });
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByLabelText('Edit private Replay')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Edit private Replay'));
    await fireEvent.press(view.getByLabelText('Music and Replay order'));
    await waitFor(() => expect(view.getByLabelText('Use newest-first Replay timeline')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Use newest-first Replay timeline'));
    expect(mockStageReplayWorkingDraft).not.toHaveBeenCalled();
    await fireEvent.press(view.getByLabelText('Save music and Replay order'));
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
  it('rehydrates a remounted route from its shared session while a save is pending', async () => {
    let acknowledge!: (revision: number) => void;
    const write = jest.fn(() => new Promise<number>((resolve) => { acknowledge = resolve; }));
    mockReplayEditSession = new ReplayEditSession(write, () => false);
    mockLoadPreparedReplay.mockResolvedValue({ uri: 'file:///saved-replay.mp4', renderedMemoryCount: 2, durationSeconds: 8 });
    const first = await render(<ReplayScreen />);
    await waitFor(() => expect(first.getByLabelText('Edit private Replay')).toBeOnTheScreen());
    await fireEvent.press(first.getByLabelText('Edit private Replay'));
    await waitFor(() => expect(first.getByLabelText('Replay trip overview')).toBeOnTheScreen());
    const retained = { ...mockReplayEditSession.getIntent()!, memoryKeys: ['memory-b'], includedGroupKeys: ['b'], autoGroupKeys: [], direction: 'newest-first' as const, soundtrack: { kind: 'custom' as const, revision: 'retained-audio', localUri: 'file:///documents/retained.m4a' } };
    let saving!: Promise<void>;
    await act(async () => { saving = mockReplayEditSession!.enqueue(retained, true); });
    await first.unmount();

    // The manifest still describes the old composition while native saving is held.
    const reopened = await render(<ReplayScreen />);
    await waitFor(() => expect(reopened.getByLabelText('Edit private Replay')).toBeOnTheScreen());
    await fireEvent.press(reopened.getByLabelText('Edit private Replay'));
    await waitFor(() => expect(reopened.getByText('0 selected · Not in Replay')).toBeOnTheScreen());
    expect(reopened.getByText('1 selected')).toBeOnTheScreen();
    expect(reopened.getByText('Custom audio ready · Newest first')).toBeOnTheScreen();
    expect(reopened.getByText('2 trips · Saving changes…')).toBeOnTheScreen();
    await act(async () => { acknowledge(9); await saving; });
    await waitFor(() => expect(reopened.queryByText('2 trips · Saving changes…')).toBeNull());
    expect(mockReplayEditSession.getIntent()).toEqual(retained);
    expect(mockReplayEditSession.scheduler.getRevision()).toBe(9);
    expect(write).toHaveBeenCalledTimes(1);
  });
  // This asynchronous aggregate-update regression intentionally runs last: it
  // verifies the rendered replacement path and its cleanup must not race a
  // fresh mount that uses the same provider test doubles.
  it('saves a direct visual selection and regenerates without changing the entry flow', verifyDirectSelectionAndAggregateUpdate);
});
