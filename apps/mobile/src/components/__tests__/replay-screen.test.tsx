import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { ReplayScreen } from '@/components/replay-screen';
import { ReplayPreparationError } from '@/replay/renderer';

const mockLoadReplayManifestInput = jest.fn();
const mockPreparePrivateReplay = jest.fn();
const mockSaveReplayDraft = jest.fn();
const mockResetReplayDraft = jest.fn();
const mockExportPrivateReplay = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }));
jest.mock('expo-video', () => ({ useVideoPlayer: jest.fn(() => ({})), VideoView: 'VideoView' }));
jest.mock('munim-ffmpeg', () => ({ execute: jest.fn(), getMediaInformation: jest.fn(), pickEncoder: jest.fn() }));
jest.mock('@/photo-access/provider', () => ({ usePhotoAccess: () => ({ loadReplayManifestInput: mockLoadReplayManifestInput, saveReplayDraft: mockSaveReplayDraft, resetReplayDraft: mockResetReplayDraft, preparePrivateReplay: mockPreparePrivateReplay, exportPrivateReplay: mockExportPrivateReplay, discardPrivateReplay: jest.fn() }) }));

describe('Replay screen', () => {
  afterEach(async () => { await cleanup(); mockLoadReplayManifestInput.mockReset(); mockPreparePrivateReplay.mockReset(); mockSaveReplayDraft.mockReset(); mockResetReplayDraft.mockReset(); mockExportPrivateReplay.mockReset(); });
  beforeEach(() => mockLoadReplayManifestInput.mockResolvedValue({ snapshotToken: 7, privacyRevision: 1, memories: [
    { key: 'memory-a', groupKey: 'a', kind: 'photo', available: true, eligible: true },
    { key: 'memory-b', groupKey: 'b', kind: 'video', available: true, eligible: true },
  ], groups: [
    { key: 'a', label: 'Observed destination', interval: { startDay: '2024-01-01', endDay: '2024-01-02' }, inferred: true, eligible: true, orderCertain: true },
    { key: 'b', label: 'Observed destination', interval: { startDay: '2024-02-01', endDay: '2024-02-02' }, inferred: true, eligible: true, orderCertain: true },
  ] }));
  it('starts a private Replay on entry without a Prepare action and permits cancellation', async () => {
    mockPreparePrivateReplay.mockResolvedValue({ uri: 'file:///private-replay.mp4', renderedMemoryCount: 1, omittedMemoryCount: 0, durationSeconds: 5 });
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByText(/Playing your private Replay/)).toBeOnTheScreen());
    expect(view.getByText(/Built locally from 1 selected memories/)).toBeOnTheScreen();
    expect(view.queryByLabelText('Prepare private Replay')).toBeNull();
    mockExportPrivateReplay.mockResolvedValue('closed');
    fireEvent.press(view.getByLabelText('Choose Replay for sharing'));
    await waitFor(() => expect(view.getByLabelText('Open Replay share sheet')).toBeDisabled());
    fireEvent.press(view.getByLabelText('Select photo 1 for sharing'));
    await waitFor(() => expect(view.getByLabelText('Open Replay share sheet')).not.toBeDisabled());
    fireEvent.press(view.getByLabelText('Open Replay share sheet'));
    await waitFor(() => expect(view.getByText(/Share sheet closed/)).toBeOnTheScreen());
    expect(mockPreparePrivateReplay).toHaveBeenLastCalledWith(['memory-a']);
    expect(view.queryByText(/0 selected/)).toBeNull();
    fireEvent.press(view.getByLabelText('Cancel Replay preparation'));
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
  it('allows only one selected-Replay share handoff while export is pending', async () => {
    let finishShare!: (value: 'closed') => void;
    mockPreparePrivateReplay.mockResolvedValue({ uri: 'file:///private-replay.mp4', renderedMemoryCount: 2, omittedMemoryCount: 0, durationSeconds: 8 });
    mockExportPrivateReplay.mockImplementation(() => new Promise((resolve) => { finishShare = resolve; }));
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByLabelText('Choose Replay for sharing')).toBeOnTheScreen());
    fireEvent.press(view.getByLabelText('Choose Replay for sharing'));
    await waitFor(() => expect(view.getByLabelText('Select photo 1 for sharing')).toBeOnTheScreen());
    fireEvent.press(view.getByLabelText('Select photo 1 for sharing'));
    await waitFor(() => expect(view.getByLabelText('Open Replay share sheet')).not.toBeDisabled());
    fireEvent.press(view.getByLabelText('Open Replay share sheet'));
    await waitFor(() => expect(mockExportPrivateReplay).toHaveBeenCalledTimes(1));
    fireEvent.press(view.getByLabelText('Open Replay share sheet'));
    expect(mockExportPrivateReplay).toHaveBeenCalledTimes(1);
    finishShare('closed');
    await waitFor(() => expect(view.getByText(/Share sheet closed/)).toBeOnTheScreen());
  });
  it('keeps exact sharing empty-first while allowing an explicit select-all choice', async () => {
    mockPreparePrivateReplay.mockResolvedValue({ uri: 'file:///private-replay.mp4', renderedMemoryCount: 2, omittedMemoryCount: 0, durationSeconds: 8 });
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByLabelText('Choose Replay for sharing')).toBeOnTheScreen());
    fireEvent.press(view.getByLabelText('Choose Replay for sharing'));
    await waitFor(() => expect(view.getByLabelText('Select all Replay moments for sharing')).toBeOnTheScreen());
    expect(view.getByLabelText('Open Replay share sheet')).toBeDisabled();
    fireEvent.press(view.getByLabelText('Select all Replay moments for sharing'));
    await waitFor(() => expect(view.getByLabelText('Open Replay share sheet')).not.toBeDisabled());
    expect(view.getByText('Clear all moments')).toBeOnTheScreen();
  });
  it('saves edited private selection and regenerates without changing the entry flow', async () => {
    mockPreparePrivateReplay.mockResolvedValue({ uri: 'file:///private-replay.mp4', renderedMemoryCount: 1, omittedMemoryCount: 0, durationSeconds: 5 });
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByLabelText('Edit private Replay')).toBeOnTheScreen());
    fireEvent.press(view.getByLabelText('Edit private Replay'));
    await waitFor(() => expect(view.getByLabelText('Remove photo 1')).toBeOnTheScreen());
    fireEvent.press(view.getByLabelText('Remove photo 1'));
    await waitFor(() => expect(view.getByLabelText('Add photo 1')).toBeOnTheScreen());
    fireEvent.press(view.getByLabelText('Remove video 2'));
    await waitFor(() => expect(view.getByLabelText('Save Replay edits')).toBeDisabled());
    fireEvent.press(view.getByLabelText('Add photo 1'));
    mockSaveReplayDraft.mockResolvedValue(undefined);
    await waitFor(() => expect(view.getByLabelText('Save Replay edits')).not.toBeDisabled());
    fireEvent.press(view.getByLabelText('Save Replay edits'));
    await waitFor(() => expect(mockSaveReplayDraft).toHaveBeenCalledWith(['memory-a'], 7, 1, 'oldest-first'));
    await waitFor(() => expect(mockPreparePrivateReplay).toHaveBeenCalledTimes(2));
  });
  it('clears only the private Replay draft before regenerating automatic selection', async () => {
    mockPreparePrivateReplay.mockResolvedValue({ uri: 'file:///private-replay.mp4', renderedMemoryCount: 2, omittedMemoryCount: 0, durationSeconds: 8 });
    mockResetReplayDraft.mockResolvedValue(undefined);
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByLabelText('Edit private Replay')).toBeOnTheScreen());
    fireEvent.press(view.getByLabelText('Edit private Replay'));
    await waitFor(() => expect(view.getByLabelText('Reset Replay edits')).toBeOnTheScreen());
    fireEvent.press(view.getByLabelText('Reset Replay edits'));
    await waitFor(() => expect(mockResetReplayDraft).toHaveBeenCalledWith(7, 1));
    await waitFor(() => expect(mockPreparePrivateReplay).toHaveBeenCalledTimes(2));
  });
  it('replaces and reorders private Replay moments before saving', async () => {
    mockPreparePrivateReplay.mockResolvedValue({ uri: 'file:///private-replay.mp4', renderedMemoryCount: 2, omittedMemoryCount: 0, durationSeconds: 8 });
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByLabelText('Edit private Replay')).toBeOnTheScreen());
    fireEvent.press(view.getByLabelText('Edit private Replay'));
    await waitFor(() => expect(view.getByLabelText('Replace photo 1')).toBeOnTheScreen());
    fireEvent.press(view.getByLabelText('Remove video 2'));
    await waitFor(() => expect(view.getByLabelText('Add video 2')).toBeOnTheScreen());
    fireEvent.press(view.getByLabelText('Replace photo 1'));
    await waitFor(() => expect(view.getByLabelText('Use video 2 as replacement')).toBeOnTheScreen());
    fireEvent.press(view.getByLabelText('Use video 2 as replacement'));
    await waitFor(() => expect(view.getByLabelText('Add photo 1')).toBeOnTheScreen());
    fireEvent.press(view.getByLabelText('Add photo 1'));
    await waitFor(() => expect(view.getByLabelText('Move photo 1 earlier')).toBeOnTheScreen());
    fireEvent.press(view.getByLabelText('Move photo 1 earlier'));
    await waitFor(() => expect(view.getByLabelText('Move photo 1 earlier')).toBeDisabled());
    mockSaveReplayDraft.mockResolvedValue(undefined);
    fireEvent.press(view.getByLabelText('Save Replay edits'));
    await waitFor(() => expect(mockSaveReplayDraft).toHaveBeenCalledWith(['memory-a', 'memory-b'], 7, 1, 'oldest-first'));
  });
  it('persists a newest-first private timeline choice and regenerates Replay', async () => {
    mockPreparePrivateReplay.mockResolvedValue({ uri: 'file:///private-replay.mp4', renderedMemoryCount: 2, omittedMemoryCount: 0, durationSeconds: 8 });
    const view = await render(<ReplayScreen />);
    await waitFor(() => expect(view.getByLabelText('Edit private Replay')).toBeOnTheScreen());
    fireEvent.press(view.getByLabelText('Edit private Replay'));
    await waitFor(() => expect(view.getByLabelText('Use newest-first Replay timeline')).toBeOnTheScreen());
    fireEvent.press(view.getByLabelText('Use newest-first Replay timeline'));
    fireEvent.press(view.getByLabelText('Save Replay edits'));
    await waitFor(() => expect(mockSaveReplayDraft).toHaveBeenCalledWith(['memory-a', 'memory-b'], 7, 1, 'newest-first'));
    await waitFor(() => expect(mockPreparePrivateReplay).toHaveBeenCalledTimes(2));
  });
});
