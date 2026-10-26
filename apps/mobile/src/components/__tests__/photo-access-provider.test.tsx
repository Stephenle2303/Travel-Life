import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AppState, Text, type AppStateStatus } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

import ManualJourneyRoute from '@/app/manual-journey';
import { EmptyAtlasScreen, ImportScreen } from '@/components/mobile-screens';
import { canPublishJourneyDetail, hasVerifiedOwnerPlace, isCurrentDurableRevealRead, PhotoAccessProvider, preparedReplayCacheIdentity, replayCompositionGroups, replayDraftMatchesCommittedManifest, usePhotoAccess, verifiedOwnerPlaceDisplayId } from '@/photo-access/provider';
import type { PermissionSnapshot, PhotoAccessAdapter } from '@/photo-access/types';
import type { ImportRepository, MaintenanceRepository } from '@/import-record';
import { DurableRevealStageError } from '@/reconstruction/repository';
import { ReplayDraftStaleError } from '@/replay/draft-error';
import type { DurableRevealRecord } from '@/reveal/types';

const mockRouterPush = jest.fn();
jest.mock('munim-ffmpeg', () => ({ execute: jest.fn(), getMediaInformation: jest.fn(), pickEncoder: jest.fn() }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockRouterPush, replace: jest.fn() }) }));
jest.mock('expo-video', () => ({
  useVideoPlayer: (_source: unknown, setup: (player: { muted: boolean; volume: number; loop: boolean; play(): void; pause(): void }) => void) => {
    const player = { muted: true, volume: 0, loop: false, play: jest.fn(), pause: jest.fn() };
    setup(player); return player;
  },
  VideoView: () => null,
}));

function adapterFor(permission: PermissionSnapshot | null, count = 0): PhotoAccessAdapter {
  return {
    inspect: async () => permission,
    request: async () => permission,
    readPage: async () => count,
    readMetadataPage: async () => [],
    readSelectedMetadata: async () => [],
    manageLimited: async () => {},
    select: async () => ({ canceled: true }),
  };
}

const emptyRepository: ImportRepository = {
  getCheckpoint: async () => null,
  loadCoverage: async () => null,
  commitPage: async () => {},
  getPrivateRecordLifecycle: async () => ({ state: 'connected' }),
  connectPrivateRecord: async () => {},
  disconnectPrivateRecord: async () => {},
  deleteLocalHistory: async () => {},
  saveCorrectionOverlay: async () => {},
};

function stagedFailureRepository(loadDurableReveal: () => Promise<DurableRevealRecord>) {
  const graph = { ruleVersion: 'reconstruction-v1' as const, places: [], visits: [], journeys: [], possibleMerges: [], dispositions: [], memberships: [] };
  return {
    loadDurableReveal,
    loadJourneyDetail: async () => ({ detail: null as never, previewSourceRefs: [], snapshotToken: 7 }),
    loadJourneyMediaPage: async () => ({ items: [], previewSourceRefs: [], hasMore: false }),
    loadUncertainMemories: async () => ({ memories: [], hasMore: false }),
    saveJourneyCorrection: async () => ({ revisionId: 'synthetic-revision', state: 'confirmed' as const, graph }),
    saveJourneyMemoryCorrection: async () => ({ revisionId: 'synthetic-memory', graph }),
    discardJourneyCorrectionPending: async () => ({ graph }),
    markJourneyCorrectionPending: async () => {},
    saveConfiguredHomeAreaFromJourney: async () => {},
    rebuild: jest.fn(async () => graph),
    reconcileQueued: jest.fn(async () => ({ graph, newJourneyCount: 0, updatedJourneyCount: 0 })),
  };
}

describe('photo access provider and Import screen', () => {
  it('preserves the verified video during rerender invalidation and deletes it on normal discard', async () => {
    let access!: ReturnType<typeof usePhotoAccess>;
    const native = stagedFailureRepository(async () => ({ journeys: [] }));
    const Harness = () => { access = usePhotoAccess(); return null; };
    await render(<PhotoAccessProvider adapter={adapterFor({ scope: 'full', canAskAgain: false })} repository={emptyRepository} reconstructionRepository={native}><Harness /></PhotoAccessProvider>);
    await waitFor(() => expect(access.privateRecord.state).toBe('connected'));
    const remove = jest.spyOn(FileSystem, 'deleteAsync').mockResolvedValue(undefined);
    try {
      await access.discardPrivateReplay('file:///verified-replay.mp4', { preserveFile: true });
      expect(remove).not.toHaveBeenCalled();
      await access.discardPrivateReplay('file:///verified-replay.mp4');
      expect(remove).toHaveBeenCalledWith('file:///verified-replay.mp4', { idempotent: true });
    } finally { remove.mockRestore(); }
  });
  it('starts a foreground Replay draft without waiting for an unrelated maintenance lifecycle', async () => {
    let access!: ReturnType<typeof usePhotoAccess>;
    let releaseMaintenance!: (permission: PermissionSnapshot | null) => void;
    const maintenanceWrite = new Promise<PermissionSnapshot | null>((resolve) => { releaseMaintenance = resolve; });
    const adapter = { ...adapterFor({ scope: 'full', canAskAgain: false }), inspect: jest.fn(() => maintenanceWrite) };
    const stageReplayWorkingDraft = jest.fn(async () => 9);
    const native = { ...stagedFailureRepository(async () => ({ journeys: [] })), stageReplayWorkingDraft };
    const Harness = () => { access = usePhotoAccess(); return null; };
    await render(<PhotoAccessProvider adapter={adapter} repository={emptyRepository} reconstructionRepository={native}><Harness /></PhotoAccessProvider>);
    await waitFor(() => expect(access.privateRecord.state).toBe('connected'));
    await waitFor(() => expect(adapter.inspect).toHaveBeenCalled());

    const saving = access.stageReplayWorkingDraft([], 7, 2, 'oldest-first', { kind: 'bundled', revision: 'happy-moments-1.4' });
    await act(async () => { await Promise.resolve(); });
    expect(stageReplayWorkingDraft).toHaveBeenCalledTimes(1);
    await expect(saving).resolves.toBe(9);
    await act(async () => { releaseMaintenance({ scope: 'full', canAskAgain: false }); });
  });
  it('rehydrates the native Replay key map before staging an owner edit', async () => {
    let access!: ReturnType<typeof usePhotoAccess>;
    const replay = { snapshotToken: 7, privacyRevision: 2, groups: [], memories: [] } as const;
    const loadReplayManifestInput = jest.fn(async () => replay);
    const stageReplayWorkingDraft = jest.fn(async () => 4);
    const native = { ...stagedFailureRepository(async () => ({ journeys: [] })), loadReplayManifestInput, stageReplayWorkingDraft };
    const Harness = () => { access = usePhotoAccess(); return null; };
    await render(<PhotoAccessProvider adapter={adapterFor({ scope: 'full', canAskAgain: false })} repository={emptyRepository} reconstructionRepository={native}><Harness /></PhotoAccessProvider>);
    await waitFor(() => expect(access.privateRecord.state).toBe('connected'));
    await expect(access.stageReplayWorkingDraft([], 7, 2, 'oldest-first', { kind: 'bundled', revision: 'happy-moments-1.4' })).resolves.toBe(4);
    expect(loadReplayManifestInput).toHaveBeenCalledTimes(1);
    expect(stageReplayWorkingDraft).toHaveBeenCalledTimes(1);
  });
  it('rehydrates a missing mapping without adopting another durable working revision', async () => {
    let access!: ReturnType<typeof usePhotoAccess>;
    const replay = { snapshotToken: 7, privacyRevision: 2, groups: [], memories: [], workingDraft: { memoryKeys: [], includedGroupKeys: [], autoGroupKeys: [], direction: 'oldest-first' as const, soundtrack: { kind: 'bundled' as const, revision: 'happy-moments-1.4' }, baseRevision: 3, revision: 9 } } as const;
    const loadReplayManifestInput = jest.fn(async () => replay);
    const stageReplayWorkingDraft = jest.fn(async () => 10);
    const native = { ...stagedFailureRepository(async () => ({ journeys: [] })), loadReplayManifestInput, stageReplayWorkingDraft };
    const Harness = () => { access = usePhotoAccess(); return null; };
    await render(<PhotoAccessProvider adapter={adapterFor({ scope: 'full', canAskAgain: false })} repository={emptyRepository} reconstructionRepository={native}><Harness /></PhotoAccessProvider>);
    await waitFor(() => expect(access.privateRecord.state).toBe('connected'));
    await expect(access.stageReplayWorkingDraft([], 7, 2, 'oldest-first', { kind: 'bundled', revision: 'happy-moments-1.4' }, 4)).resolves.toBe(10);
    expect(stageReplayWorkingDraft).toHaveBeenCalledWith([], 7, 2, 'oldest-first', { kind: 'bundled', revision: 'happy-moments-1.4' }, 4, undefined, undefined, undefined);
  });
  it('uses the supplied revision without rehydration when mapping remains', async () => {
    let access!: ReturnType<typeof usePhotoAccess>;
    const replay = { snapshotToken: 7, privacyRevision: 2, groups: [], memories: [], workingDraft: { memoryKeys: [], includedGroupKeys: [], autoGroupKeys: [], direction: 'oldest-first' as const, soundtrack: { kind: 'bundled' as const, revision: 'happy-moments-1.4' }, baseRevision: 3, revision: 9 } } as const;
    const loadReplayManifestInput = jest.fn(async () => replay);
    const stageReplayWorkingDraft = jest.fn(async () => 10);
    const native = { ...stagedFailureRepository(async () => ({ journeys: [] })), loadReplayManifestInput, stageReplayWorkingDraft, hasReplayMapping: () => true };
    const Harness = () => { access = usePhotoAccess(); return null; };
    await render(<PhotoAccessProvider adapter={adapterFor({ scope: 'full', canAskAgain: false })} repository={emptyRepository} reconstructionRepository={native}><Harness /></PhotoAccessProvider>);
    await waitFor(() => expect(access.privateRecord.state).toBe('connected'));
    await expect(access.stageReplayWorkingDraft([], 7, 2, 'oldest-first', { kind: 'bundled', revision: 'happy-moments-1.4' }, 4)).resolves.toBe(10);
    expect(loadReplayManifestInput).not.toHaveBeenCalled();
    expect(stageReplayWorkingDraft).toHaveBeenCalledWith([], 7, 2, 'oldest-first', { kind: 'bundled', revision: 'happy-moments-1.4' }, 4, undefined, undefined, undefined);
  });
  it('uses the matching durable working revision when committing an Update after runtime reload', async () => {
    let access!: ReturnType<typeof usePhotoAccess>;
    const working = { snapshotToken: 7, privacyRevision: 2, groups: [], memories: [], workingDraft: { memoryKeys: [], includedGroupKeys: [], autoGroupKeys: [], direction: 'oldest-first' as const, soundtrack: { kind: 'bundled' as const, revision: 'happy-moments-1.4' }, baseRevision: 3, revision: 9 } } as const;
    const committed = { snapshotToken: 7, privacyRevision: 2, direction: 'oldest-first' as const, soundtrack: { kind: 'bundled' as const, revision: 'happy-moments-1.4' }, includedGroupKeys: [], autoGroupKeys: [], groups: [], memories: [] } as const;
    const loadReplayManifestInput = jest.fn().mockResolvedValueOnce(working).mockResolvedValueOnce(committed);
    const saveReplayDraft = jest.fn(async () => {});
    const native = { ...stagedFailureRepository(async () => ({ journeys: [] })), loadReplayManifestInput, saveReplayDraft };
    const Harness = () => { access = usePhotoAccess(); return null; };
    await render(<PhotoAccessProvider adapter={adapterFor({ scope: 'full', canAskAgain: false })} repository={emptyRepository} reconstructionRepository={native}><Harness /></PhotoAccessProvider>);
    await waitFor(() => expect(access.privateRecord.state).toBe('connected'));
    await expect(access.saveReplayDraft([], 7, 2, 'oldest-first', { kind: 'bundled', revision: 'happy-moments-1.4' }, 4, [], [])).resolves.toBeUndefined();
    expect(saveReplayDraft).toHaveBeenCalledWith([], 7, 2, 'oldest-first', { kind: 'bundled', revision: 'happy-moments-1.4' }, 9, [], []);
  });
  it('retains a genuine stale working-draft outcome as a closed conflict stage', async () => {
    let access!: ReturnType<typeof usePhotoAccess>;
    const native = { ...stagedFailureRepository(async () => ({ journeys: [] })), stageReplayWorkingDraft: jest.fn(async () => { throw new ReplayDraftStaleError(); }) };
    const Harness = () => { access = usePhotoAccess(); return null; };
    await render(<PhotoAccessProvider adapter={adapterFor({ scope: 'full', canAskAgain: false })} repository={emptyRepository} reconstructionRepository={native}><Harness /></PhotoAccessProvider>);
    await waitFor(() => expect(access.privateRecord.state).toBe('connected'));
    await expect(access.stageReplayWorkingDraft([], 7, 2, 'oldest-first', { kind: 'bundled', revision: 'happy-moments-1.4' })).rejects.toMatchObject({ stage: 'REPLAY_STALE' });
  });
  it('preserves an obsolete working branch conflict without reset or retry', async () => {
    let access!: ReturnType<typeof usePhotoAccess>;
    const replay = { snapshotToken: 7, privacyRevision: 2, groups: [], memories: [] } as const;
    const loadReplayManifestInput = jest.fn(async () => replay);
    const resetReplayDraft = jest.fn(async () => {});
    const stageReplayWorkingDraft = jest.fn().mockRejectedValueOnce(new ReplayDraftStaleError()).mockResolvedValueOnce(11);
    const native = { ...stagedFailureRepository(async () => ({ journeys: [] })), loadReplayManifestInput, resetReplayDraft, stageReplayWorkingDraft };
    const Harness = () => { access = usePhotoAccess(); return null; };
    await render(<PhotoAccessProvider adapter={adapterFor({ scope: 'full', canAskAgain: false })} repository={emptyRepository} reconstructionRepository={native}><Harness /></PhotoAccessProvider>);
    await waitFor(() => expect(access.privateRecord.state).toBe('connected'));
    await expect(access.stageReplayWorkingDraft([], 7, 2, 'oldest-first', { kind: 'bundled', revision: 'happy-moments-1.4' }, 9, [], [])).rejects.toMatchObject({ stage: 'REPLAY_STALE' });
    expect(resetReplayDraft).not.toHaveBeenCalled();
    expect(stageReplayWorkingDraft).toHaveBeenCalledTimes(1);
  });
  it('does not replace a rejected mutation identity or overwrite its branch', async () => {
    let access!: ReturnType<typeof usePhotoAccess>;
    const replay = { snapshotToken: 7, privacyRevision: 2, groups: [], memories: [] } as const;
    const stageReplayWorkingDraft = jest.fn().mockRejectedValueOnce(new ReplayDraftStaleError()).mockResolvedValueOnce(12);
    const native = { ...stagedFailureRepository(async () => ({ journeys: [] })), loadReplayManifestInput: jest.fn(async () => replay), resetReplayDraft: jest.fn(async () => {}), stageReplayWorkingDraft };
    const Harness = () => { access = usePhotoAccess(); return null; };
    await render(<PhotoAccessProvider adapter={adapterFor({ scope: 'full', canAskAgain: false })} repository={emptyRepository} reconstructionRepository={native}><Harness /></PhotoAccessProvider>);
    await waitFor(() => expect(access.privateRecord.state).toBe('connected'));
    const mutation = { operationId: 'first-stage', sessionId: 'edit-session', editVersion: 4 };
    await expect(access.stageReplayWorkingDraft([], 7, 2, 'oldest-first', { kind: 'bundled', revision: 'happy-moments-1.4' }, 9, [], [], mutation)).rejects.toMatchObject({ stage: 'REPLAY_STALE' });
    expect(stageReplayWorkingDraft.mock.calls[0]![8]).toEqual(mutation);
    expect(stageReplayWorkingDraft).toHaveBeenCalledTimes(1);
    expect(native.resetReplayDraft).not.toHaveBeenCalled();
  });
  it('reports a failed working save without claiming a draft conflict or exposing native details', async () => {
    let access!: ReturnType<typeof usePhotoAccess>;
    const native = { ...stagedFailureRepository(async () => ({ journeys: [] })), stageReplayWorkingDraft: jest.fn(async () => { throw new Error('synthetic native storage detail'); }) };
    const Harness = () => { access = usePhotoAccess(); return null; };
    const diagnostic = jest.spyOn(console, 'info').mockImplementation(() => {});
    await render(<PhotoAccessProvider adapter={adapterFor({ scope: 'full', canAskAgain: false })} repository={emptyRepository} reconstructionRepository={native}><Harness /></PhotoAccessProvider>);
    await waitFor(() => expect(access.privateRecord.state).toBe('connected'));
    await expect(access.stageReplayWorkingDraft([], 7, 2, 'oldest-first', { kind: 'bundled', revision: 'happy-moments-1.4' })).rejects.toMatchObject({ stage: 'REPLAY_UNAVAILABLE', message: 'REPLAY_UNAVAILABLE' });
    expect(diagnostic).toHaveBeenLastCalledWith('[Travel Life diagnostic]', expect.objectContaining({ operation: 'REPLAY_DRAFT_SAVE', reasonCode: 'UNKNOWN', stage: 'REPLAY_UNAVAILABLE', retryable: true, durableOutcome: 'unchanged' }));
    expect(JSON.stringify(diagnostic.mock.calls)).not.toContain('synthetic native storage detail');
    diagnostic.mockRestore();
  });
  it('reports a rejected native group mapping using only a fixed guard category', async () => {
    let access!: ReturnType<typeof usePhotoAccess>;
    const native = { ...stagedFailureRepository(async () => ({ journeys: [] })), stageReplayWorkingDraft: jest.fn(async () => { throw new ReplayDraftStaleError('Replay draft is stale.', 'scope', 'group'); }) };
    const Harness = () => { access = usePhotoAccess(); return null; };
    const diagnostic = jest.spyOn(console, 'info').mockImplementation(() => {});
    await render(<PhotoAccessProvider adapter={adapterFor({ scope: 'full', canAskAgain: false })} repository={emptyRepository} reconstructionRepository={native}><Harness /></PhotoAccessProvider>);
    await waitFor(() => expect(access.privateRecord.state).toBe('connected'));
    await expect(access.stageReplayWorkingDraft([], 7, 2, 'oldest-first', { kind: 'bundled', revision: 'happy-moments-1.4' })).rejects.toMatchObject({ stage: 'REPLAY_STALE', reason: 'scope' });
    expect(diagnostic).toHaveBeenLastCalledWith('[Travel Life diagnostic]', expect.objectContaining({ operation: 'REPLAY_DRAFT_SAVE', reasonCode: 'REPLAY_GROUP_MAPPING', stage: 'REPLAY_STALE', durableOutcome: 'unchanged' }));
    diagnostic.mockRestore();
  });
  it('keys a prepared Replay to its committed composition rather than transient editor-preview availability', () => {
    const input = {
      snapshotToken: 7,
      privacyRevision: 2,
      autoGroupKeys: ['trip'],
      groups: [{ key: 'trip', label: 'Private journey', inferred: true, eligible: true, orderCertain: false }],
      memories: [{ key: 'memory', groupKey: 'trip', kind: 'photo' as const, available: false, eligible: true }],
    };
    expect(preparedReplayCacheIdentity(input)).toBe(preparedReplayCacheIdentity({ ...input, memories: [{ ...input.memories[0]!, available: true }] }));
    expect(preparedReplayCacheIdentity(input)).not.toBe(preparedReplayCacheIdentity({ ...input, direction: 'newest-first' }));
  });
  it('makes a saved included-trip scope authoritative for Replay composition', () => {
    const input = {
      snapshotToken: 7,
      privacyRevision: 2,
      includedGroupKeys: ['kept'],
      groups: [
        { key: 'kept', label: 'Kept trip', inferred: true, eligible: true, orderCertain: true },
        { key: 'excluded', label: 'Excluded trip', inferred: true, eligible: true, orderCertain: true },
      ],
      memories: [
        { key: 'kept-memory', groupKey: 'kept', kind: 'photo' as const, available: true, eligible: true },
        { key: 'excluded-memory', groupKey: 'excluded', kind: 'photo' as const, available: true, eligible: true },
      ],
    };
    expect(replayCompositionGroups(input).filter((group) => group.eligible).map((group) => group.key)).toEqual(['kept']);
    expect(preparedReplayCacheIdentity(input)).not.toBe(preparedReplayCacheIdentity({ ...input, includedGroupKeys: ['kept', 'excluded'] }));
  });

  it('requires Update Replay readback to retain excluded trips and exact manual media choices', () => {
    const request = { memoryKeys: ['kept-video'], snapshotToken: 7, privacyRevision: 2, direction: 'newest-first' as const, soundtrack: { kind: 'bundled' as const, revision: 'happy-moments-1.4' as const }, includedGroupKeys: ['kept'], autoGroupKeys: [] };
    const committed = {
      snapshotToken: 7, privacyRevision: 2, direction: 'newest-first' as const, soundtrack: request.soundtrack, includedGroupKeys: ['kept'], autoGroupKeys: [],
      groups: [
        { key: 'kept', label: 'Kept trip', inferred: true, eligible: true, orderCertain: true },
        { key: 'excluded', label: 'Excluded trip', inferred: true, eligible: false, orderCertain: true },
      ],
      memories: [
        { key: 'kept-photo', groupKey: 'kept', kind: 'photo' as const, available: true, eligible: true, intent: 'exclude' as const },
        { key: 'kept-video', groupKey: 'kept', kind: 'video' as const, available: true, eligible: true, intent: 'keep' as const },
        { key: 'excluded-photo', groupKey: 'excluded', kind: 'photo' as const, available: true, eligible: true, intent: 'keep' as const },
      ],
    };
    expect(replayDraftMatchesCommittedManifest(committed, request)).toBe(true);
    expect(replayDraftMatchesCommittedManifest({ ...committed, includedGroupKeys: ['kept', 'excluded'], groups: committed.groups.map((group) => ({ ...group, eligible: true })) }, request)).toBe(false);
    expect(replayDraftMatchesCommittedManifest({ ...committed, memories: committed.memories.map((memory) => memory.key === 'kept-photo' ? { ...memory, intent: 'keep' as const } : memory) }, request)).toBe(false);
  });

  it('fails closed after a Replay commit when native readback restores an excluded trip', async () => {
    let access!: ReturnType<typeof usePhotoAccess>;
    const saveReplayDraft = jest.fn(async () => {});
    const committed = {
      snapshotToken: 7, privacyRevision: 2, direction: 'oldest-first' as const, soundtrack: { kind: 'bundled' as const, revision: 'happy-moments-1.4' as const }, includedGroupKeys: ['kept', 'restored'], autoGroupKeys: [],
      groups: [
        { key: 'kept', label: 'Kept trip', inferred: true, eligible: true, orderCertain: true },
        { key: 'restored', label: 'Restored trip', inferred: true, eligible: true, orderCertain: true },
      ],
      memories: [
        { key: 'kept-video', groupKey: 'kept', kind: 'video' as const, available: true, eligible: true, intent: 'keep' as const },
        { key: 'restored-photo', groupKey: 'restored', kind: 'photo' as const, available: true, eligible: true, intent: 'keep' as const },
      ],
    };
    const native = { ...stagedFailureRepository(async () => ({ journeys: [] })), saveReplayDraft, loadReplayManifestInput: jest.fn(async () => committed) };
    const Harness = () => { access = usePhotoAccess(); return null; };
    await render(<PhotoAccessProvider adapter={adapterFor({ scope: 'full', canAskAgain: false })} repository={emptyRepository} reconstructionRepository={native}><Harness /></PhotoAccessProvider>);
    await waitFor(() => expect(access.privateRecord.state).toBe('connected'));
    await expect(access.saveReplayDraft(['kept-video'], 7, 2, 'oldest-first', { kind: 'bundled', revision: 'happy-moments-1.4' }, undefined, ['kept'], [])).rejects.toMatchObject({ stage: 'REPLAY_STALE' });
    expect(saveReplayDraft).toHaveBeenCalledTimes(1);
  });

  it('exposes only the repository replay input while the private record remains current', async () => {
    let access!: ReturnType<typeof usePhotoAccess>;
    const replay = { snapshotToken: 7, privacyRevision: 2, groups: [{ key: 'trip', label: 'Observed destination', interval: { startDay: '2024-01-01', endDay: '2024-01-02' }, inferred: true, eligible: true, orderCertain: true }], memories: [] } as const;
    const native = { ...stagedFailureRepository(async () => ({ journeys: [] })), loadReplayManifestInput: jest.fn(async () => replay) };
    const Harness = () => { access = usePhotoAccess(); return null; };
    await render(<PhotoAccessProvider adapter={adapterFor({ scope: 'full', canAskAgain: false })} repository={emptyRepository} reconstructionRepository={native}><Harness /></PhotoAccessProvider>);
    await waitFor(() => expect(access.privateRecord.state).toBe('connected'));
    await expect(access.loadReplayManifestInput()).resolves.toEqual(replay);
    expect(native.loadReplayManifestInput).toHaveBeenCalledTimes(1);
  });

  it('resolves unknown Replay attachments through the same local adapter path as the journey album', async () => {
    let access!: ReturnType<typeof usePhotoAccess>;
    const resolveOwnerPreviews = jest.fn(async () => [{ uri: 'file:///private-local.jpg', availability: 'available' as const, kind: 'photo' as const }]);
    const adapter = { ...adapterFor({ scope: 'full', canAskAgain: false }), resolveOwnerPreviews };
    const replay = { snapshotToken: 7, privacyRevision: 2, previewSourceRefs: ['opaque-source'], groups: [{ key: 'trip', label: 'Private journey', interval: { startDay: '2024-01-01', endDay: '2024-01-02' }, inferred: true, eligible: true, orderCertain: false }], memories: [{ key: 'memory', groupKey: 'trip', kind: 'photo' as const, available: false, eligible: true }] };
    const native = { ...stagedFailureRepository(async () => ({ journeys: [] })), loadReplayManifestInput: jest.fn(async () => replay) };
    const Harness = () => { access = usePhotoAccess(); return null; };
    await render(<PhotoAccessProvider adapter={adapter} repository={emptyRepository} reconstructionRepository={native}><Harness /></PhotoAccessProvider>);
    await waitFor(() => expect(access.privateRecord.state).toBe('connected'));
    const resolved = await access.loadReplayManifestInput();
    expect(resolved).toMatchObject({ memories: [{ key: 'memory', available: true }] });
    expect(resolved.previewSourceRefs).toBeUndefined();
    expect(resolveOwnerPreviews).toHaveBeenCalledWith(['opaque-source'], 1);
  });

  it('bounds editor-entry local preview resolution without hiding later Replay candidates', async () => {
    let access!: ReturnType<typeof usePhotoAccess>;
    const previewSourceRefs = Array.from({ length: 49 }, (_value, index) => `opaque-source-${index + 1}`);
    const memories = previewSourceRefs.map((_, index) => ({ key: `memory-${index + 1}`, groupKey: 'trip', kind: 'photo' as const, available: true, eligible: true }));
    const resolveOwnerPreviews = jest.fn(async (refs: (string | null)[]) => refs.map(() => ({ uri: 'file:///private-local.jpg', availability: 'available' as const, kind: 'photo' as const })));
    const adapter = { ...adapterFor({ scope: 'full', canAskAgain: false }), resolveOwnerPreviews };
    const replay = { snapshotToken: 7, privacyRevision: 2, previewSourceRefs, groups: [{ key: 'trip', label: 'Private journey', inferred: true, eligible: true, orderCertain: false }], memories };
    const native = { ...stagedFailureRepository(async () => ({ journeys: [] })), loadReplayManifestInput: jest.fn(async () => replay) };
    const Harness = () => { access = usePhotoAccess(); return null; };
    await render(<PhotoAccessProvider adapter={adapter} repository={emptyRepository} reconstructionRepository={native}><Harness /></PhotoAccessProvider>);
    await waitFor(() => expect(access.privateRecord.state).toBe('connected'));
    const resolved = await access.loadReplayManifestInput();
    expect(resolveOwnerPreviews).toHaveBeenCalledWith(previewSourceRefs.slice(0, 48), 48);
    expect(resolved.memories[0]).toMatchObject({ available: true, previewUri: 'file:///private-local.jpg' });
    expect(resolved.memories[48]).toMatchObject({ key: 'memory-49', available: true });
    expect(resolved.memories[48]?.previewUri).toBeUndefined();
  });

  it('resolves a bounded Replay editor page through the local adapter without exposing source refs', async () => {
    let access!: ReturnType<typeof usePhotoAccess>;
    const resolveOwnerPreviews = jest.fn(async () => [{ uri: 'file:///private-page.jpg', availability: 'available' as const, kind: 'photo' as const }, { uri: null, availability: 'unavailable' as const, kind: 'photo' as const }]);
    const adapter = { ...adapterFor({ scope: 'full', canAskAgain: false }), resolveOwnerPreviews };
    const native = {
      ...stagedFailureRepository(async () => ({ journeys: [] })),
      loadReplayEditorPreviewPage: jest.fn(async () => ({ keys: ['memory-a', 'memory-b'], previewSourceRefs: ['opaque-a', null] })),
    };
    const Harness = () => { access = usePhotoAccess(); return null; };
    await render(<PhotoAccessProvider adapter={adapter} repository={emptyRepository} reconstructionRepository={native}><Harness /></PhotoAccessProvider>);
    await waitFor(() => expect(access.privateRecord.state).toBe('connected'));
    await expect(access.loadReplayEditorPreviewPage(['memory-a', 'memory-b'], 7, 2)).resolves.toEqual([
      { key: 'memory-a', available: true, previewUri: 'file:///private-page.jpg' },
      { key: 'memory-b', available: false },
    ]);
    expect(resolveOwnerPreviews).toHaveBeenCalledWith(['opaque-a', null], 2, expect.any(Function));
  });

  it('keeps the Replay Journey List scope through an unrelated Atlas detail read', async () => {
    let access!: ReturnType<typeof usePhotoAccess>;
    let releaseManifest!: (value: { snapshotToken: number; privacyRevision: number; previewSourceRefs: string[]; groups: { key: string; label: string; interval: { startDay: string; endDay: string }; inferred: boolean; eligible: boolean; orderCertain: boolean }[]; memories: { key: string; groupKey: string; kind: 'photo'; available: boolean; eligible: boolean }[] }) => void;
    const pendingManifest = new Promise<{ snapshotToken: number; privacyRevision: number; previewSourceRefs: string[]; groups: { key: string; label: string; interval: { startDay: string; endDay: string }; inferred: boolean; eligible: boolean; orderCertain: boolean }[]; memories: { key: string; groupKey: string; kind: 'photo'; available: boolean; eligible: boolean }[] }>((resolve) => { releaseManifest = resolve; });
    const replay = { snapshotToken: 7, privacyRevision: 2, previewSourceRefs: ['opaque-source'], groups: [{ key: 'trip', label: 'Private journey', interval: { startDay: '2024-01-01', endDay: '2024-01-02' }, inferred: true, eligible: true, orderCertain: false }], memories: [{ key: 'memory', groupKey: 'trip', kind: 'photo' as const, available: false, eligible: true }] };
    const native = { ...stagedFailureRepository(async () => ({ journeys: [] })), loadReplayManifestInput: jest.fn(() => pendingManifest) };
    const adapter = { ...adapterFor({ scope: 'full', canAskAgain: false }), resolveOwnerPreviews: jest.fn(async () => [{ uri: 'file:///private-local.jpg', availability: 'available' as const, kind: 'photo' as const }]) };
    const Harness = () => { access = usePhotoAccess(); return null; };
    await render(<PhotoAccessProvider adapter={adapter} repository={emptyRepository} reconstructionRepository={native}><Harness /></PhotoAccessProvider>);
    await waitFor(() => expect(access.privateRecord.state).toBe('connected'));
    const replayRead = access.loadReplayManifestInput();
    await access.loadJourneyDetail('unrelated-visible-journey');
    releaseManifest(replay);
    await expect(replayRead).resolves.toMatchObject({ groups: [{ key: 'trip' }], memories: [{ key: 'memory', available: true }] });
  });

  it('reports a Replay access failure when native media-handle resolution rejects', async () => {
    let access!: ReturnType<typeof usePhotoAccess>;
    const replay = { snapshotToken: 7, privacyRevision: 2, previewSourceRefs: ['opaque-source'], groups: [{ key: 'trip', label: 'Private journey', interval: { startDay: '2024-01-01', endDay: '2024-01-02' }, inferred: true, eligible: true, orderCertain: false }], memories: [{ key: 'memory', groupKey: 'trip', kind: 'photo' as const, available: true, eligible: true }] };
    const native = { ...stagedFailureRepository(async () => ({ journeys: [] })), loadReplayManifestInput: jest.fn(async () => replay) };
    const adapter = { ...adapterFor({ scope: 'full', canAskAgain: false }), resolveOwnerPreviews: jest.fn(async () => { throw new Error('released native handle'); }) };
    const Harness = () => { access = usePhotoAccess(); return null; };
    await render(<PhotoAccessProvider adapter={adapter} repository={emptyRepository} reconstructionRepository={native}><Harness /></PhotoAccessProvider>);
    await waitFor(() => expect(access.privateRecord.state).toBe('connected'));
    await expect(access.preparePrivateReplay()).rejects.toMatchObject({ stage: 'REPLAY_ACCESS' });
  });

  it('maps the screen-first Replay manifest read failure to local access', async () => {
    let access!: ReturnType<typeof usePhotoAccess>;
    const native = { ...stagedFailureRepository(async () => ({ journeys: [] })), loadReplayManifestInput: jest.fn(async () => { throw new Error('released native handle'); }) };
    const Harness = () => { access = usePhotoAccess(); return null; };
    await render(<PhotoAccessProvider adapter={adapterFor({ scope: 'full', canAskAgain: false })} repository={emptyRepository} reconstructionRepository={native}><Harness /></PhotoAccessProvider>);
    await waitFor(() => expect(access.privateRecord.state).toBe('connected'));
    await expect(access.loadReplayManifestInput()).rejects.toMatchObject({ stage: 'REPLAY_ACCESS' });
  });

  for (const failure of ['detail', 'scope', 'list'] as const) it(`classifies privacy ${failure} read failure without exposing native details`, async () => {
    let access!: ReturnType<typeof usePhotoAccess>;
    const sentinel = 'synthetic-private-read-sentinel';
    const native = {
      ...stagedFailureRepository(async () => ({ journeys: [] })),
      loadJourneyDetail: async () => {
        if (failure === 'detail') throw new Error(`database is locked ${sentinel}`);
        return { detail: null as never, previewSourceRefs: [], snapshotToken: 7 };
      },
      reviewJourneyPrivacy: async () => { throw new Error(`database is locked ${sentinel}`); },
      loadJourneyPrivacyPolicies: async () => { throw new Error(`database is locked ${sentinel}`); },
    };
    const Harness = () => { access = usePhotoAccess(); return null; };
    const diagnostic = jest.spyOn(console, 'info').mockImplementation(() => {});
    try {
      await render(<PhotoAccessProvider adapter={adapterFor({ scope: 'full', canAskAgain: false })} repository={emptyRepository} reconstructionRepository={native}><Harness /></PhotoAccessProvider>);
      await waitFor(() => expect(access.privateRecord.state).toBe('connected'));
      await expect(failure === 'list' ? access.loadJourneyPrivacyPolicies() : access.reviewJourneyPrivacy('trip')).rejects.not.toThrow(sentinel);
      expect(diagnostic).toHaveBeenCalledWith('[Travel Life diagnostic]', expect.objectContaining({ operation: 'JOURNEY_PRIVACY_READ', reasonCode: 'DATABASE_BUSY', stage: failure === 'detail' ? 'PRIVACY_REVIEW_DETAIL' : failure === 'scope' ? 'PRIVACY_REVIEW_SCOPE' : 'PRIVACY_POLICY_LIST', durableOutcome: 'failed' }));
      expect(JSON.stringify(diagnostic.mock.calls)).not.toContain(sentinel);
    } finally { diagnostic.mockRestore(); }
  });

  it('represents stale privacy list completion as a fixed lifecycle outcome', async () => {
    let access!: ReturnType<typeof usePhotoAccess>;
    let release!: (policies: []) => void;
    const pending = new Promise<[]>((resolve) => { release = resolve; });
    const native = { ...stagedFailureRepository(async () => ({ journeys: [] })), loadJourneyPrivacyPolicies: () => pending, saveJourneyPrivacy: async () => {} };
    const Harness = () => { access = usePhotoAccess(); return null; };
    const diagnostic = jest.spyOn(console, 'info').mockImplementation(() => {});
    try {
      await render(<PhotoAccessProvider adapter={adapterFor({ scope: 'full', canAskAgain: false })} repository={emptyRepository} reconstructionRepository={native}><Harness /></PhotoAccessProvider>);
      await waitFor(() => expect(access.privateRecord.state).toBe('connected'));
      const read = expect(access.loadJourneyPrivacyPolicies()).rejects.toThrow('Private visibility controls could not load');
      await act(async () => { await access.saveJourneyPrivacy('review', 'hide', 'hide-stale-list', 'trip'); release([]); });
      await read;
      expect(diagnostic).toHaveBeenCalledWith('[Travel Life diagnostic]', expect.objectContaining({ operation: 'JOURNEY_PRIVACY_READ', reasonCode: 'LIFECYCLE', stage: 'PRIVACY_POLICY_LIST', durableOutcome: 'skipped', retryable: false }));
    } finally { diagnostic.mockRestore(); }
  });

  it('represents a cancelled privacy review rejection as a fixed lifecycle outcome', async () => {
    let access!: ReturnType<typeof usePhotoAccess>;
    let rejectDetail!: (error: Error) => void;
    const pending = new Promise<{ detail: never; previewSourceRefs: []; snapshotToken: number }>((_, reject) => { rejectDetail = reject; });
    const review = jest.fn(async () => ({ reviewId: 'review', title: 'Synthetic', ownerEntered: false, supportingPhotoCount: 1, duplicatePhotoCount: 0, duplicateFamilyCount: 0 }));
    const native = { ...stagedFailureRepository(async () => ({ journeys: [] })), loadJourneyDetail: () => pending, reviewJourneyPrivacy: review, saveJourneyPrivacy: async () => {} };
    const Harness = () => { access = usePhotoAccess(); return null; };
    const diagnostic = jest.spyOn(console, 'info').mockImplementation(() => {});
    try {
      await render(<PhotoAccessProvider adapter={adapterFor({ scope: 'full', canAskAgain: false })} repository={emptyRepository} reconstructionRepository={native}><Harness /></PhotoAccessProvider>);
      await waitFor(() => expect(access.privateRecord.state).toBe('connected'));
      const result = access.reviewJourneyPrivacy('trip');
      const rejected = expect(result).rejects.toThrow('Privacy review changed');
      await act(async () => { await access.saveJourneyPrivacy('review', 'hide', 'cancel-privacy-review', 'trip'); rejectDetail(new Error('synthetic-private-cancel-sentinel')); });
      await rejected;
      expect(review).not.toHaveBeenCalled();
      expect(diagnostic).toHaveBeenCalledWith('[Travel Life diagnostic]', expect.objectContaining({ operation: 'JOURNEY_PRIVACY_READ', reasonCode: 'LIFECYCLE', stage: 'PRIVACY_REVIEW_DETAIL', durableOutcome: 'skipped', retryable: false }));
      expect(JSON.stringify(diagnostic.mock.calls)).not.toContain('synthetic-private-cancel-sentinel');
    } finally { diagnostic.mockRestore(); }
  });

  for (const filterFails of [false, true]) it(`keeps post-commit fallback privacy-safe when refresh fails and filtering ${filterFails ? 'fails' : 'succeeds'}`, async () => {
    let access!: ReturnType<typeof usePhotoAccess>;
    const prior: DurableRevealRecord = { journeys: ['target', 'overlapping', 'unrelated'].map((displayId) => ({ displayId, state: 'inferred', anchor: null, years: [2020], periodLabel: '2020', ordering: 'chronological' })), statistics: { journeyCount: 3, placeCount: 3, supportedCountryCount: 1, countryStatus: 'supported' } };
    let committed = false;
    const native = {
      ...stagedFailureRepository(async () => { if (committed) throw new Error('database is locked synthetic-refresh'); return prior; }),
      saveJourneyPrivacy: async () => { committed = true; },
      applyJourneyPrivacyToRecord: async () => {
        if (filterFails) throw new Error('database is locked synthetic-filter');
        return { journeys: prior.journeys.filter((journey) => journey.displayId === 'unrelated'), statistics: null };
      },
    };
    const Harness = () => { access = usePhotoAccess(); return null; };
    const diagnostic = jest.spyOn(console, 'info').mockImplementation(() => {});
    try {
      await render(<PhotoAccessProvider adapter={adapterFor({ scope: 'full', canAskAgain: false })} repository={emptyRepository} reconstructionRepository={native}><Harness /></PhotoAccessProvider>);
      await waitFor(() => expect(access.durableReveal).toEqual(prior));
      await act(async () => { await expect(access.saveJourneyPrivacy('review', 'hide', 'hide-fallback', 'target')).rejects.toThrow('Privacy action was saved'); });
      expect(access.durableReveal?.journeys.map((journey) => journey.displayId)).toEqual(filterFails ? [] : ['unrelated']);
      expect(access.durableReveal?.statistics ?? null).toBeNull();
    } finally { diagnostic.mockRestore(); }
  });
  it('invalidates pending resolved media previews when a privacy command commits', async () => {
    let access!: ReturnType<typeof usePhotoAccess>;
    let resolvePreview!: (value: []) => void;
    const previews = new Promise<[]>((resolve) => { resolvePreview = resolve; });
    const prior: DurableRevealRecord = { journeys: [{ displayId: 'trip', state: 'inferred', anchor: null, years: [2020], periodLabel: '2020', ordering: 'chronological' }] };
    let hidden = false;
    const native = {
      ...stagedFailureRepository(async () => hidden ? { journeys: [] } : prior),
      loadJourneyDetail: async () => ({ detail: { id: 'trip', title: 'Synthetic trip', observedSpan: 'Observed', visits: [], memories: [], uncertainty: [] }, previewSourceRefs: ['synthetic-local-ref'], snapshotToken: 7 }),
      saveJourneyPrivacy: jest.fn(async () => { hidden = true; }),
    };
    const adapter = { ...adapterFor({ scope: 'full' as const, canAskAgain: false }), resolveOwnerPreviews: jest.fn(() => previews) };
    const Harness = () => { access = usePhotoAccess(); return null; };
    await render(<PhotoAccessProvider adapter={adapter} repository={emptyRepository} reconstructionRepository={native}><Harness /></PhotoAccessProvider>);
    await waitFor(() => expect(access.durableReveal?.journeys).toHaveLength(1));
    const pending = access.loadJourneyDetail('trip');
    const rejected = expect(pending).rejects.toThrow('no longer available');
    await waitFor(() => expect(adapter.resolveOwnerPreviews).toHaveBeenCalled());
    await act(async () => { await access.saveJourneyPrivacy('review', 'hide', 'synthetic-hide', 'trip'); resolvePreview([]); });
    await rejected;
    expect(access.durableReveal?.journeys).toEqual([]);
  });
  it('invalidates an in-flight uncertain-memory page when privacy scope changes', async () => {
    let access!: ReturnType<typeof usePhotoAccess>;
    let resolvePage!: (value: { memories: []; hasMore: boolean }) => void;
    const page = new Promise<{ memories: []; hasMore: boolean }>((resolve) => { resolvePage = resolve; });
    const load = jest.fn(() => page);
    const native = { ...stagedFailureRepository(async () => ({ journeys: [] })), loadUncertainMemories: load, saveJourneyPrivacy: jest.fn(async () => {}) };
    const Harness = () => { access = usePhotoAccess(); return null; };
    await render(<PhotoAccessProvider adapter={adapterFor({ scope: 'full', canAskAgain: false })} repository={emptyRepository} reconstructionRepository={native}><Harness /></PhotoAccessProvider>);
    await waitFor(() => expect(access.privateRecord.state).toBe('connected'));
    const pending = access.loadUncertainMemories('trip', 7, '', 0);
    const rejected = expect(pending).rejects.toThrow('no longer available');
    await waitFor(() => expect(load).toHaveBeenCalled());
    await act(async () => { await access.saveJourneyPrivacy('review', 'hide', 'synthetic-hide', 'trip'); resolvePage({ memories: [], hasMore: false }); });
    await rejected;
  });
  for (const action of ['startup', 'catch-up', 'retry'] as const) {
    it(`keeps the prior Atlas and emits only fixed durable-read diagnostics after ${action} failure`, async () => {
      let access!: ReturnType<typeof usePhotoAccess>;
      const sentinel = 'synthetic-private-durable-error-sentinel';
      const error = new DurableRevealStageError('DURABLE_OWNER_PLACE_READ', new Error(`no such column: ${sentinel}`));
      const prior: DurableRevealRecord = { journeys: [{ displayId: 'retained-display', state: 'inferred', anchor: { latitude: 1, longitude: 2 }, years: [2020], periodLabel: '2020', ordering: 'chronological', label: 'Retained journey' }], statistics: null };
      const loadDurableReveal = jest.fn(async () => prior);
      if (action === 'startup') loadDurableReveal.mockRejectedValueOnce(error);
      const reconstructionRepository = stagedFailureRepository(loadDurableReveal);
      const diagnostic = jest.spyOn(console, 'info').mockImplementation(() => {});
      const Harness = () => { access = usePhotoAccess(); return <Text>{access.reconstruction.message}</Text>; };
      try {
        const view = await render(<PhotoAccessProvider adapter={adapterFor({ scope: 'full', canAskAgain: false })} repository={emptyRepository} reconstructionRepository={reconstructionRepository}><Harness /></PhotoAccessProvider>);
        await waitFor(() => expect(access.privateRecord.state).toBe('connected'));
        await waitFor(() => expect(access.snapshot.scope).toBe('full'));
        if (action !== 'startup') {
          await waitFor(() => expect(access.durableReveal).toEqual(prior));
          loadDurableReveal.mockRejectedValueOnce(error);
          access.reconstructionController.resume();
          await act(async () => {
            if (action === 'catch-up') await access.catchUpHistory();
            else expect(await access.retryJourneyCorrectionProjection()).toBe(false);
          });
        }
        const safeCopy = action === 'startup'
          ? 'The local Atlas could not be read. Try again when ready.'
          : 'Local Atlas storage needs a safe schema recovery. Your last completed Atlas was kept.';
        await waitFor(() => expect(view.getByText(safeCopy)).toBeOnTheScreen());
        expect(access.reconstruction.status).toBe('error');
        // A failed first read starts without a published projection; later
        // owner operations must retain the previously published object.
        expect(access.durableReveal).toEqual(action === 'startup' ? null : prior);
        expect(diagnostic).toHaveBeenCalledWith('[Travel Life diagnostic]', expect.objectContaining({
          operation: action === 'retry' ? 'ATLAS_REVEAL_RETRY' : 'ATLAS_DURABLE_READ',
          reasonCode: 'SCHEMA', stage: 'DURABLE_OWNER_PLACE_READ', retryable: true,
          durableOutcome: action === 'retry' ? 'failed' : 'unchanged',
        }));
        expect(JSON.stringify(diagnostic.mock.calls)).not.toContain(sentinel);
        expect(JSON.stringify(view.toJSON())).not.toContain(sentinel);
      } finally { diagnostic.mockRestore(); }
    });
  }
  it('requires both final detail and durable Atlas projection before reporting a place as applied', () => {
    const place = { id: 'phu-quoc', name: 'Phú Quốc', context: 'Kiên Giang, Vietnam', anchor: { latitude: 10.2, longitude: 103.9 } };
    const detail = { id: 'trip', title: 'Phú Quốc', observedSpan: 'Observed', visits: [], memories: [], uncertainty: [], ownerPlace: place };
    expect(hasVerifiedOwnerPlace('trip', place, detail, { journeys: [{ displayId: 'trip', state: 'inferred', anchor: place.anchor, years: [], periodLabel: '2022', ordering: 'chronological', label: 'Phú Quốc, Kiên Giang, Vietnam', locationKind: 'owner-confirmed' }] })).toBe(true);
    expect(hasVerifiedOwnerPlace('trip', place, detail, { journeys: [{ displayId: 'trip', state: 'inferred', anchor: place.anchor, years: [], periodLabel: '2022', ordering: 'chronological', label: 'Old place', locationKind: 'owner-confirmed' }] })).toBe(false);
    expect(verifiedOwnerPlaceDisplayId('old-trip', place, { journeys: [{ displayId: 'final-trip', state: 'inferred', anchor: { latitude: 10.2, longitude: 103.9 }, years: [], periodLabel: '2022', ordering: 'chronological', label: 'Phú Quốc, Kiên Giang, Vietnam', locationKind: 'owner-confirmed' }] })).toBe('final-trip');
    expect(verifiedOwnerPlaceDisplayId('old-trip', place, { journeys: [
      { displayId: 'final-trip-a', state: 'inferred', anchor: place.anchor, years: [], periodLabel: '2022', ordering: 'chronological', label: 'Phú Quốc, Kiên Giang, Vietnam', locationKind: 'owner-confirmed' },
      { displayId: 'final-trip-b', state: 'inferred', anchor: place.anchor, years: [], periodLabel: '2023', ordering: 'chronological', label: 'Phú Quốc, Kiên Giang, Vietnam', locationKind: 'owner-confirmed' },
    ] })).toBeNull();
  });
  it('shows a recoverable status when the startup reconciliation read is locked', async () => {
    let access!: ReturnType<typeof usePhotoAccess>;
    const privateSentinel = 'private-startup-reconciliation-sentinel';
    const repository: ImportRepository & Pick<MaintenanceRepository, 'loadMaintenance' | 'getMaintenanceCheckpoint' | 'loadReconciliation'> = {
      ...emptyRepository,
      loadMaintenance: async () => ({ enabled: false, status: 'disabled' as const, lastCheckedAtMillis: null, lastUpdatedAtMillis: null, message: null }),
      getMaintenanceCheckpoint: async () => null,
      loadReconciliation: async () => { throw new Error(`database is locked: ${privateSentinel}`); },
    };
    const Harness = () => { access = usePhotoAccess(); return null; };
    const diagnostic = jest.spyOn(console, 'info').mockImplementation(() => {});
    try {
      await render(<PhotoAccessProvider adapter={adapterFor({ scope: 'full', canAskAgain: false })} repository={repository}><Harness /></PhotoAccessProvider>);
      await waitFor(() => expect(access.reconciliation).toMatchObject({ status: 'error', message: 'Local update status could not be read. Retry when ready.' }));
      expect(diagnostic).toHaveBeenCalledWith('[Travel Life diagnostic]', expect.objectContaining({
        operation: 'MAINTENANCE_RECONCILIATION', reasonCode: 'DATABASE_BUSY', stage: null,
        retryable: true, durableOutcome: 'failed', correlationId: expect.any(String),
      }));
      expect(JSON.stringify(diagnostic.mock.calls)).not.toContain(privateSentinel);
    } finally { diagnostic.mockRestore(); }
  });

  it('rejects mounted detail and preview reads after lifecycle invalidation', async () => {
    let access!: ReturnType<typeof usePhotoAccess>;
    let releaseDetail!: (value: { detail: never; previewSourceRefs: string[]; snapshotToken: number }) => void;
    let releasePreview!: (value: []) => void;
    const detail = new Promise<{ detail: never; previewSourceRefs: string[]; snapshotToken: number }>((resolve) => { releaseDetail = resolve; });
    const preview = new Promise<[]>((resolve) => { releasePreview = resolve; });
    const reconstructionRepository = {
      loadDurableReveal: async () => ({ journeys: [], statistics: null }), loadJourneyDetail: jest.fn(() => detail),
      loadJourneyMediaPage: async () => ({ items: [], previewSourceRefs: [], hasMore: false }),
      loadUncertainMemories: async () => ({ memories: [], hasMore: false }),
      saveJourneyCorrection: async () => ({ revisionId: 'review', state: 'confirmed' as const, graph: { ruleVersion: 'reconstruction-v1' as const, places: [], visits: [], journeys: [], possibleMerges: [], dispositions: [], memberships: [] } }),
      saveJourneyMemoryCorrection: async () => ({ revisionId: 'memory-review', graph: null }),
      discardJourneyCorrectionPending: async () => ({ graph: null }),
      markJourneyCorrectionPending: async () => {},
      saveConfiguredHomeAreaFromJourney: async () => {},
      rebuild: async () => ({ ruleVersion: 'reconstruction-v1' as const, places: [], visits: [], journeys: [], possibleMerges: [], dispositions: [], memberships: [] }), reconcileQueued: async () => ({ graph: { ruleVersion: 'reconstruction-v1' as const, places: [], visits: [], journeys: [], possibleMerges: [], dispositions: [], memberships: [] }, newJourneyCount: 0, updatedJourneyCount: 0 }),
    };
    const adapter: PhotoAccessAdapter = { ...adapterFor({ scope: 'full', canAskAgain: false }), resolveOwnerPreviews: jest.fn(() => preview) };
    const Harness = () => { access = usePhotoAccess(); return null; };
    await render(<PhotoAccessProvider adapter={adapter} repository={emptyRepository} reconstructionRepository={reconstructionRepository}><Harness /></PhotoAccessProvider>);
    await waitFor(() => expect(access.privateRecord.state).toBe('connected'));
    const pendingDetail = access.loadJourneyDetail('opaque');
    const rejectedDetail = expect(pendingDetail).rejects.toThrow('no longer available');
    await act(async () => { await access.privateRecordController.disconnect(); releaseDetail({ detail: null as never, previewSourceRefs: [], snapshotToken: 1 }); });
    await rejectedDetail;
    await act(async () => { await access.privateRecordController.reconnect(); });
    await waitFor(() => expect(access.privateRecord.state).toBe('connected'));
    reconstructionRepository.loadJourneyDetail.mockResolvedValueOnce({ detail: null as never, previewSourceRefs: [], snapshotToken: 1 });
    const pendingPreview = access.loadJourneyDetail('opaque');
    await waitFor(() => expect(adapter.resolveOwnerPreviews).toHaveBeenCalled());
    const rejectedPreview = expect(pendingPreview).rejects.toThrow('no longer available');
    await act(async () => { await access.privateRecordController.disconnect(); releasePreview([]); });
    await rejectedPreview;
  });
  it('publishes the projection that was committed with a revision-bound decision', async () => {
    let access!: ReturnType<typeof usePhotoAccess>;
    const graph = { ruleVersion: 'reconstruction-v1' as const, places: [], visits: [], journeys: [], possibleMerges: [], dispositions: [], memberships: [] };
    const reconstructionRepository = {
      loadDurableReveal: jest.fn(async () => ({ journeys: [], statistics: null })),
      loadJourneyDetail: async () => ({ detail: null as never, previewSourceRefs: [], snapshotToken: 7 }),
      loadJourneyMediaPage: async () => ({ items: [], previewSourceRefs: [], hasMore: false }),
      loadUncertainMemories: async () => ({ memories: [], hasMore: false }),
      saveJourneyCorrection: jest.fn(async () => ({ revisionId: 'revision-1', state: 'rejected' as const, graph })),
      saveJourneyMemoryCorrection: jest.fn(async () => ({ revisionId: 'memory-review', graph })),
      discardJourneyCorrectionPending: jest.fn(async () => ({ graph })),
      markJourneyCorrectionPending: jest.fn(async () => {}),
      saveConfiguredHomeAreaFromJourney: async () => {},
      rebuild: jest.fn(async () => graph),
      reconcileQueued: async () => ({ graph, newJourneyCount: 0, updatedJourneyCount: 0 }),
    };
    const Harness = () => { access = usePhotoAccess(); return null; };
    await render(<PhotoAccessProvider adapter={adapterFor({ scope: 'full', canAskAgain: false })} repository={emptyRepository} reconstructionRepository={reconstructionRepository}><Harness /></PhotoAccessProvider>);
    await waitFor(() => expect(access.privateRecord.state).toBe('connected'));
    await waitFor(() => expect(reconstructionRepository.loadDurableReveal).toHaveBeenCalledTimes(1));
    let result!: 'applied' | 'pending';
    const snapshot = { id: 'opaque', title: 'Private journey', observedSpan: 'Observed 2024-01-01', visits: [], memories: [], uncertainty: [] };
    await act(async () => { result = await access.saveJourneyCorrection('opaque', 'reject', 7, snapshot, 'command-reject'); });
    expect(reconstructionRepository.saveJourneyCorrection).toHaveBeenCalledWith('opaque', 'reject', 7, snapshot, 'command-reject');
    expect(reconstructionRepository.rebuild).not.toHaveBeenCalled();
    // The success state is withheld until the redacted Atlas cache has been
    // refreshed from the same completed projection.
    expect(reconstructionRepository.loadDurableReveal).toHaveBeenCalledTimes(2);
    expect(result).toBe('applied');
    expect(reconstructionRepository.markJourneyCorrectionPending).not.toHaveBeenCalled();
  });
  it('retries a failed Atlas reveal through durable publication rather than a controller-only rebuild', async () => {
    let access!: ReturnType<typeof usePhotoAccess>;
    const graph = { ruleVersion: 'reconstruction-v1' as const, places: [], visits: [], journeys: [], possibleMerges: [], dispositions: [], memberships: [] };
    const reconstructionRepository = {
      loadDurableReveal: jest.fn(async () => ({ journeys: [], statistics: null })),
      loadJourneyDetail: async () => ({ detail: null as never, previewSourceRefs: [], snapshotToken: 7 }),
      loadJourneyMediaPage: async () => ({ items: [], previewSourceRefs: [], hasMore: false }),
      loadUncertainMemories: async () => ({ memories: [], hasMore: false }),
      saveJourneyCorrection: async () => ({ revisionId: 'unused', state: 'rejected' as const, graph }),
      saveJourneyMemoryCorrection: async () => ({ revisionId: 'unused', graph }),
      discardJourneyCorrectionPending: async () => ({ graph }),
      markJourneyCorrectionPending: async () => {},
      saveConfiguredHomeAreaFromJourney: async () => {},
      rebuild: jest.fn().mockRejectedValueOnce(new Error('read failure')).mockResolvedValueOnce(graph),
      reconcileQueued: async () => ({ graph, newJourneyCount: 0, updatedJourneyCount: 0 }),
    };
    const Harness = () => { access = usePhotoAccess(); return null; };
    await render(<PhotoAccessProvider adapter={adapterFor({ scope: 'full', canAskAgain: false })} repository={emptyRepository} reconstructionRepository={reconstructionRepository}><Harness /></PhotoAccessProvider>);
    await waitFor(() => expect(access.privateRecord.state).toBe('connected'));
    await waitFor(() => expect(access.snapshot.scope).toBe('full'));
    access.reconstructionController.resume();
    await act(async () => { await access.reconstructionController.rebuild(); });
    let retried!: boolean;
    await act(async () => { retried = await access.retryJourneyCorrectionProjection(); });
    expect(retried).toBe(true);
    expect(reconstructionRepository.rebuild).toHaveBeenCalledTimes(2);
    expect(reconstructionRepository.loadDurableReveal).toHaveBeenCalledTimes(2);
  });
  it('contains an unavailable durable lifecycle before a reveal retry can reach rebuild', async () => {
    let access!: ReturnType<typeof usePhotoAccess>;
    const diagnostic = jest.spyOn(console, 'info').mockImplementation(() => {});
    const graph = { ruleVersion: 'reconstruction-v1' as const, places: [], visits: [], journeys: [], possibleMerges: [], dispositions: [], memberships: [] };
    const reconstructionRepository = {
      loadDurableReveal: async () => ({ journeys: [], statistics: null }),
      loadJourneyDetail: async () => ({ detail: null as never, previewSourceRefs: [], snapshotToken: 7 }),
      loadJourneyMediaPage: async () => ({ items: [], previewSourceRefs: [], hasMore: false }),
      loadUncertainMemories: async () => ({ memories: [], hasMore: false }),
      saveJourneyCorrection: async () => ({ revisionId: 'unused', state: 'rejected' as const, graph }),
      saveJourneyMemoryCorrection: async () => ({ revisionId: 'unused', graph }),
      discardJourneyCorrectionPending: async () => ({ graph }),
      markJourneyCorrectionPending: async () => {},
      saveConfiguredHomeAreaFromJourney: async () => {},
      rebuild: jest.fn(),
      reconcileQueued: async () => ({ graph, newJourneyCount: 0, updatedJourneyCount: 0 }),
    };
    const repository = { ...emptyRepository, getPrivateRecordLifecycle: async () => { throw new Error('Private record is unavailable.'); } };
    const Harness = () => { access = usePhotoAccess(); return null; };
    await render(<PhotoAccessProvider adapter={adapterFor({ scope: 'full', canAskAgain: false })} repository={repository} reconstructionRepository={reconstructionRepository}><Harness /></PhotoAccessProvider>);
    let retried!: boolean;
    await act(async () => { retried = await access.retryJourneyCorrectionProjection(); });
    expect(retried).toBe(false);
    expect(reconstructionRepository.rebuild).not.toHaveBeenCalled();
    expect(diagnostic).toHaveBeenNthCalledWith(1, '[Travel Life diagnostic]', expect.objectContaining({ operation: 'ATLAS_REVEAL_RETRY', reasonCode: 'START', stage: null, retryable: false, durableOutcome: 'unchanged' }));
    expect(diagnostic).toHaveBeenNthCalledWith(2, '[Travel Life diagnostic]', expect.objectContaining({ operation: 'ATLAS_REVEAL_RETRY', reasonCode: 'ACCESS', stage: null, retryable: true, durableOutcome: 'restricted' }));
    diagnostic.mockRestore();
  });
  it('does not start a second projection transaction after a saved decision', async () => {
    let access!: ReturnType<typeof usePhotoAccess>;
    const graph = { ruleVersion: 'reconstruction-v1' as const, places: [], visits: [], journeys: [], possibleMerges: [], dispositions: [], memberships: [] };
    const reconstructionRepository = {
      loadDurableReveal: async () => ({ journeys: [], statistics: null }),
      loadJourneyDetail: async () => ({ detail: null as never, previewSourceRefs: [], snapshotToken: 7 }),
      loadJourneyMediaPage: async () => ({ items: [], previewSourceRefs: [], hasMore: false }),
      loadUncertainMemories: async () => ({ memories: [], hasMore: false }),
      saveJourneyCorrection: jest.fn(async () => ({ revisionId: 'revision-2', state: 'confirmed' as const, graph })),
      saveJourneyMemoryCorrection: jest.fn(async () => ({ revisionId: 'memory-review', graph })),
      discardJourneyCorrectionPending: jest.fn(async () => ({ graph })),
      markJourneyCorrectionPending: jest.fn(async () => {}),
      saveConfiguredHomeAreaFromJourney: async () => {},
      rebuild: jest.fn().mockRejectedValue(new Error('must not run')),
      reconcileQueued: async () => ({ graph, newJourneyCount: 0, updatedJourneyCount: 0 }),
    };
    const Harness = () => { access = usePhotoAccess(); return null; };
    await render(<PhotoAccessProvider adapter={adapterFor({ scope: 'full', canAskAgain: false })} repository={emptyRepository} reconstructionRepository={reconstructionRepository}><Harness /></PhotoAccessProvider>);
    await waitFor(() => expect(access.privateRecord.state).toBe('connected'));
    let result!: 'applied' | 'pending';
    const snapshot = { id: 'opaque', title: 'Private journey', observedSpan: 'Observed 2024-01-01', visits: [], memories: [], uncertainty: [] };
    await act(async () => { result = await access.saveJourneyCorrection('opaque', 'confirm', 7, snapshot, 'command-confirm'); });
    expect(result).toBe('applied');
    expect(reconstructionRepository.rebuild).not.toHaveBeenCalled();
    expect(reconstructionRepository.markJourneyCorrectionPending).not.toHaveBeenCalled();
  });
  it('rejects a durable reveal read that completed after a lifecycle invalidation', () => {
    expect(isCurrentDurableRevealRead(4, 4)).toBe(true);
    expect(isCurrentDurableRevealRead(4, 5)).toBe(false);
  });
  it('rejects a deferred detail and preview result after lifecycle invalidation', async () => {
    let releaseDetail!: () => void; let releasePreview!: () => void;
    const detail = new Promise<void>((resolve) => { releaseDetail = resolve; });
    const preview = new Promise<void>((resolve) => { releasePreview = resolve; });
    const generation = 7;
    const completed = Promise.all([detail, preview]).then(() => canPublishJourneyDetail(generation, generation + 1, 'deleted'));
    releaseDetail(); releasePreview();
    await expect(completed).resolves.toBe(false);
  });
  it('rechecks and updates a finished limited count on foreground return', async () => {
    let activeListener: ((state: AppStateStatus) => void) | undefined;
    const subscription = { remove: jest.fn() };
    const appStateSpy = jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
      activeListener = listener as (state: AppStateStatus) => void;
      return subscription as ReturnType<typeof AppState.addEventListener>;
    });
    let currentCount = 4;
    const adapter: PhotoAccessAdapter = { ...adapterFor({ scope: 'limited', canAskAgain: false }), readPage: async () => currentCount };
    try {
      const view = await render(<PhotoAccessProvider adapter={adapter} repository={emptyRepository}><ImportScreen /></PhotoAccessProvider>);
      await waitFor(() => expect(view.getByText(/Limited photo-library access granted/)).toBeOnTheScreen());
      await fireEvent.press(view.getByRole('button', { name: 'Recheck accessible photos' }));
      await waitFor(() => expect(view.getByText(/4 device-visible photos and videos observed/)).toBeOnTheScreen());

      currentCount = 7;
      await act(async () => { activeListener?.('active'); });
      await waitFor(() => expect(view.getByText(/7 device-visible photos and videos observed/)).toBeOnTheScreen());
      expect(view.getByRole('button', { name: 'Manage limited selection' })).toBeOnTheScreen();
    } finally {
      appStateSpy.mockRestore();
    }
  });

  it('hides native picker on unavailable runtime and explains blocked initial access', async () => {
    const unavailable = await render(<PhotoAccessProvider adapter={adapterFor(null)} repository={emptyRepository}><ImportScreen /></PhotoAccessProvider>);
    await waitFor(() => expect(unavailable.getByText(/Native photo-library access is unavailable/)).toBeOnTheScreen());
    expect(unavailable.queryByRole('button', { name: 'Select photos and videos' })).toBeNull();
    await unavailable.unmount();

    const blocked = await render(<PhotoAccessProvider adapter={adapterFor({ scope: 'unasked', canAskAgain: false })} repository={emptyRepository}><ImportScreen /></PhotoAccessProvider>);
    await waitFor(() => expect(blocked.getByText(/Photo access cannot be requested here/)).toBeOnTheScreen());
    expect(blocked.queryByRole('button', { name: 'Allow full photo library' })).toBeNull();
    expect(blocked.getByRole('button', { name: 'Select photos and videos' })).toBeOnTheScreen();
    await blocked.unmount();
  });

  it('starts a local metadata import and exposes completed coverage without a journey claim', async () => {
    const view = await render(<PhotoAccessProvider adapter={adapterFor({ scope: 'full', canAskAgain: false })} repository={emptyRepository}><ImportScreen /></PhotoAccessProvider>);
    await waitFor(() => expect(view.getByRole('button', { name: 'Start metadata import' })).toBeOnTheScreen());

    await fireEvent.press(view.getByRole('button', { name: 'Start metadata import' }));

    await waitFor(() => expect(view.getByText(/Metadata import completed for the current accessible scope/)).toBeOnTheScreen());
    expect(view.getByText(/not lifetime coverage/)).toBeOnTheScreen();
  });

  it('keeps explicit local import and Atlas recovery controls available after a recoverable failure', async () => {
    const repository: ImportRepository = { ...emptyRepository, loadCoverage: async () => ({ scope: 'full', nextOffset: 0, scanned: 1, geotagged: 1, unavailable: 0, status: 'paused' }) };
    const importView = await render(<PhotoAccessProvider adapter={adapterFor({ scope: 'full', canAskAgain: false })} repository={repository}><ImportScreen /></PhotoAccessProvider>);
    await waitFor(() => expect(importView.getByRole('button', { name: 'Resume metadata import' })).toBeOnTheScreen());
    await importView.unmount();
    const atlasView = await render(<PhotoAccessProvider adapter={adapterFor({ scope: 'full', canAskAgain: false })} repository={emptyRepository}><EmptyAtlasScreen /></PhotoAccessProvider>);
    await waitFor(() => expect(atlasView.getByRole('button', { name: 'Import or reconnect photos' })).toBeOnTheScreen());
  });

  it('routes the queued Atlas catch-up button through provider reconciliation without rebuilding directly', async () => {
    const graph = { ruleVersion: 'reconstruction-v1' as const, places: [], visits: [], journeys: [], possibleMerges: [], dispositions: [], memberships: [] };
    const reconstructionRepository = {
      ...stagedFailureRepository(async () => ({ journeys: [], statistics: null })),
      rebuild: jest.fn(async () => graph),
      reconcileQueued: jest.fn(async () => ({ graph, newJourneyCount: 0, updatedJourneyCount: 0 })),
    };
    const repository: ImportRepository & Pick<MaintenanceRepository, 'loadMaintenance' | 'getMaintenanceCheckpoint' | 'loadReconciliation'> = {
      ...emptyRepository,
      loadCoverage: async () => ({ scope: 'full', nextOffset: 0, scanned: 3, geotagged: 3, unavailable: 0, status: 'complete' }),
      // Supplying the durable maintenance surface prevents the provider's
      // deliberately-restricted Jest fallback from replacing this queue.
      loadMaintenance: async () => ({ enabled: false, status: 'disabled' as const, lastCheckedAtMillis: null, lastUpdatedAtMillis: null, message: null }),
      getMaintenanceCheckpoint: async () => null,
      loadReconciliation: async () => ({ status: 'pending', pendingCount: 1, queuedChangeCount: 1, unresolvedRemapCount: 0, lastCheckedAtMillis: null, lastUpdatedAtMillis: null, newJourneyCount: 0, updatedJourneyCount: 0, message: null }),
    };
    let access!: ReturnType<typeof usePhotoAccess>;
    const Harness = () => { access = usePhotoAccess(); return <EmptyAtlasScreen />; };
    const view = await render(<PhotoAccessProvider adapter={adapterFor({ scope: 'full', canAskAgain: false })} repository={repository} reconstructionRepository={reconstructionRepository}><Harness /></PhotoAccessProvider>);

    await waitFor(() => expect(access.snapshot.scope).toBe('full'));
    await waitFor(() => expect(view.getByRole('button', { name: 'Catch up waiting local journey changes' })).toBeOnTheScreen());
    await fireEvent.press(view.getByRole('button', { name: 'Catch up waiting local journey changes' }));
    await waitFor(() => expect(reconstructionRepository.reconcileQueued).toHaveBeenCalledTimes(1));
    expect(reconstructionRepository.rebuild).not.toHaveBeenCalled();
  });

  it('gates manual entry on a disconnected private record, then restores Atlas context after reconnecting', async () => {
    let lifecycle: 'connected' | 'disconnected' | 'deleted' = 'disconnected';
    const repository: ImportRepository = {
      ...emptyRepository,
      getPrivateRecordLifecycle: async () => ({ state: lifecycle }),
      connectPrivateRecord: async () => { lifecycle = 'connected'; },
    };
    mockRouterPush.mockClear();
    const view = await render(<PhotoAccessProvider adapter={adapterFor({ scope: 'full', canAskAgain: false })} repository={repository}><EmptyAtlasScreen /></PhotoAccessProvider>);
    await waitFor(() => expect(view.getByRole('button', { name: 'Add a journey manually' })).toBeOnTheScreen());
    await fireEvent.press(view.getByRole('button', { name: 'Add a journey manually' }));
    expect(view.getByText('Reconnect your private record first')).toBeOnTheScreen();
    expect(view.queryByLabelText('Destination label')).toBeNull();
    await fireEvent.press(view.getByRole('button', { name: 'Reconnect private record and add journey' }));
    await waitFor(() => expect(mockRouterPush).toHaveBeenCalledWith('/manual-journey'));
  });

  it('keeps recovery open on failure and cancellation prevents a late reconnect navigation', async () => {
    let lifecycle: 'connected' | 'disconnected' | 'deleted' = 'disconnected';
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    const repository: ImportRepository = { ...emptyRepository, getPrivateRecordLifecycle: async () => ({ state: lifecycle }), connectPrivateRecord: jest.fn().mockRejectedValueOnce(new Error('sqlite')).mockImplementationOnce(async () => { await pending; lifecycle = 'connected'; }) };
    mockRouterPush.mockClear();
    const view = await render(<PhotoAccessProvider adapter={adapterFor({ scope: 'full', canAskAgain: false })} repository={repository}><EmptyAtlasScreen /></PhotoAccessProvider>);
    await waitFor(() => expect(view.getByRole('button', { name: 'Add a journey manually' })).toBeOnTheScreen());
    await fireEvent.press(view.getByRole('button', { name: 'Add a journey manually' }));
    await fireEvent.press(view.getByRole('button', { name: 'Reconnect private record and add journey' }));
    await waitFor(() => expect(view.getByText(/could not be opened.*Retry/)).toBeOnTheScreen());
    expect(mockRouterPush).not.toHaveBeenCalled();
    await fireEvent.press(view.getByRole('button', { name: 'Reconnect private record and add journey' }));
    await fireEvent.press(view.getByRole('button', { name: 'Cancel private record recovery' }));
    await act(async () => { release(); await Promise.resolve(); });
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it('guards a direct manual-journey route before the owner can enter a destination', async () => {
    const repository: ImportRepository = {
      ...emptyRepository,
      getPrivateRecordLifecycle: async () => ({ state: 'deleted' }),
      connectPrivateRecord: async () => { throw new Error('private'); },
    };
    const view = await render(<PhotoAccessProvider adapter={adapterFor({ scope: 'full', canAskAgain: false })} repository={repository}><ManualJourneyRoute /></PhotoAccessProvider>);
    await waitFor(() => expect(view.getByText('Create a private record first')).toBeOnTheScreen());
    expect(view.queryByLabelText('Destination label')).toBeNull();
    await fireEvent.press(view.getByRole('button', { name: 'Prepare private record for manual journey' }));
    await waitFor(() => expect(view.getByText(/could not be opened.*Retry/)).toBeOnTheScreen());
  });
});
