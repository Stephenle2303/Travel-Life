import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AppState, Text, type AppStateStatus } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

import ManualJourneyRoute from '@/app/manual-journey';
import { EmptyAtlasScreen, ImportScreen } from '@/components/mobile-screens';
import { canPublishJourneyDetail, hasVerifiedOwnerPlace, isCurrentDurableRevealRead, PhotoAccessProvider, preparedReplayCacheIdentity, replayCompositionGroups, replayDraftMatchesCommittedManifest, usePhotoAccess, verifiedOwnerPlaceDisplayId } from '@/photo-access/provider';
import type { OwnerPreview, PermissionSnapshot, PhotoAccessAdapter } from '@/photo-access/types';
import type { ImportRepository, MaintenanceRepository } from '@/import-record';
import { DurableRevealStageError } from '@/reconstruction/repository';
import { ReplayDraftStaleError } from '@/replay/draft-error';
import { munimReplayRenderer } from '@/replay/renderer';
import * as replayRenderer from '@/replay/renderer';
import type { DurableRevealRecord } from '@/reveal/types';
import { replayPreparationDiagnostics } from '@/replay/preparation-diagnostics';
import { ReplayController } from '@/replay/controller';
import { AccountMediaError } from '@/account/media-cache';
import { ReplayPreparedArtifactError } from '@/replay/prepared-error';
import * as visualNative from '@/visual-place/native-signage';
import * as regionalNative from '@/visual-place/native-regional-packs';
import { regionalLandmarkDescriptor } from '@/visual-place/regional-landmarks';
import { createRegionalPackLoader } from '@/visual-place/regional-pack-loader';
import { fixtureSha256, regionalFixtureEmbedding, regionalFixtureRelease } from '@/test/regional-landmark-fixture';
import { createVisualRecognition, VisualPlaceError } from '@/visual-place/recovery';
import { resolveVisualPlace } from '@/visual-place/place-catalog';
import { advanceVisualDiscovery, initialVisualDiscovery, type DiscoveryPhoto, type DiscoveryProposal, type QualifiedVisualAlbum } from '@/visual-place/discovery';

jest.mock('expo-file-system/legacy', () => ({ ...jest.requireActual('expo-file-system/legacy'), documentDirectory: 'file:///documents/' }));
const mockRouterPush = jest.fn();
jest.mock('munim-ffmpeg', () => ({ execute: jest.fn(), getMediaInformation: jest.fn(), pickEncoder: jest.fn() }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockRouterPush, replace: jest.fn(), dismissTo: jest.fn() }) }));
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
  it.each([
    ['kr', 'locality-seoul', ['ewha-womans-university', 'namsan-seoul-tower'], 0, 'available'],
    ['vn', 'locality-hanoi', ['turtle-tower', 'khue-van-cac'], 4, 'available'],
    ['vn', 'locality-hanoi', ['turtle-tower', 'khue-van-cac'], 4, 'offline-starter-qualifies'],
    ['vn', 'locality-hanoi', ['turtle-tower', 'khue-van-cac'], 4, 'offline-starter-incomplete'],
    ['vn', 'locality-hanoi', ['turtle-tower', 'khue-van-cac'], 4, 'offline-manifest'],
  ] as const)('uses only the supported %s pack for %s with stops %j, descriptor seed %s, and pack status %s', async (country, placeId, stopIds, firstAxis, packStatus) => {
    let access!: ReturnType<typeof usePhotoAccess>;
    const previousState = AppState.currentState;
    const sentinel = 'synthetic-regional-asset';
    const date = '2026-04-12';
    const rows: DiscoveryPhoto[] = [0, 2, 240, 480, 482, 720].map((minute, index) => ({
      evidence_id: `asset-${index}`, family: `family-${index}`, source_origin: 'capture-like',
      source_ref: `${sentinel}-${index}`, captured_day: date, captured_at_millis: Date.parse(date) + minute * 60_000,
    }));
    const { candidate } = advanceVisualDiscovery(initialVisualDiscovery(), [...rows].reverse(), true);
    expect(candidate).not.toBeNull();
    const scanToken = {};
    const proposalToken = {};
    let staged: DiscoveryProposal | null = null;
    const loadVisualDiscoveryPage = jest.fn(async (_canAccess: () => Promise<boolean>, _onRead?: () => void,
      stagedToken?: object, release?: string) => {
      expect(release).toBe(manifestSha256);
      return staged && stagedToken === scanToken ? { kind: 'proposal' as const, token: proposalToken, proposal: staged }
        : { kind: 'scan' as const, token: scanToken, candidate, more: false };
    });
    const checkpointVisualDiscovery = jest.fn(async (_token, result: QualifiedVisualAlbum | null, _canAccess, _signal, acknowledge: () => void) => {
      if (result) staged = { ...result, key: candidate!.key, correctionId: null,
        photos: rows.filter(({ evidence_id }) => result.membership.some(({ id }) => id === evidence_id)) };
      acknowledge();
      return { staged: !!staged, more: false };
    });
    const native = { ...stagedFailureRepository(async () => ({ journeys: [] })), loadVisualDiscoveryEnabled: async () => true,
      setVisualDiscoveryEnabled: async () => {}, loadVisualDiscoveryPage, checkpointVisualDiscovery,
      loadVisualDiscoveryAlbum: async () => ({ photos: staged?.photos ?? [], hasMore: false }),
      verifyVisualDiscovery: async (_token: object, canAccess: () => Promise<boolean>) => { await canAccess(); },
      reviewVisualDiscovery: async () => ({ manualId: null }),
    };
    const adapter: PhotoAccessAdapter = { ...adapterFor({ scope: 'full', canAskAgain: false }), resolveOwnerPreviews: async (refs) =>
      refs.map((ref): OwnerPreview => ref === null ? { kind: 'photo', availability: 'unavailable', uri: null }
        : { kind: 'photo', availability: 'available', uri: `file:///${ref}` }) };
    const { files, manifestName, manifestSha256 } = regionalFixtureRelease();
    const regionalFilename = `${regionalLandmarkDescriptor}-${country}.json`;
    const download = jest.fn(async (name: string) => {
      if (name === manifestName && packStatus === 'offline-manifest') throw new VisualPlaceError('MEDIA_UNAVAILABLE');
      if (name === regionalFilename && packStatus !== 'available') throw new VisualPlaceError('MEDIA_UNAVAILABLE');
      return files.get(name)!;
    });
    const fixture = jest.spyOn(regionalNative, 'nativeRegionalPackLoader').mockReturnValue(createRegionalPackLoader(manifestSha256,
      { download, digest: async (bytes) => fixtureSha256(bytes) }));
    const read = jest.fn(async (uri: string, _signal: AbortSignal, regional?: boolean) => {
      expect(regional).toBe(true);
      const offsets = packStatus === 'offline-starter-qualifies' ? [0, 0, 60, 2, 2, 61] : [0, 1, 60, 2, 3, 61];
      const offset = offsets[Number(uri.at(-1))];
      return { place: null, embedding: regionalFixtureEmbedding(firstAxis + offset) };
    });
    const recognizer = jest.spyOn(visualNative, 'nativeVisualRecognition').mockReturnValue(createVisualRecognition(async () => [], undefined, read));
    const log = jest.spyOn(console, 'info').mockImplementation(() => {});
    const Harness = () => { access = usePhotoAccess(); return null; };
    AppState.currentState = 'active';
    try {
      await render(<PhotoAccessProvider adapter={adapter} repository={emptyRepository} reconstructionRepository={native}><Harness /></PhotoAccessProvider>);
      await waitFor(() => expect(access.visualDiscovery?.enabled).toBe(true));
      log.mockClear();
      const signal = new AbortController().signal;
      const result = await access.visualDiscovery?.discover(signal);
      const events = log.mock.calls.map(([, event]) => event).filter((event) => event?.operation === 'VISUAL_PLACE_REVIEW');
      expect(new Set(events.map((event) => event.correlationId)).size).toBe(1);
      expect(JSON.stringify(events)).not.toMatch(new RegExp(`${sentinel}|${manifestSha256}|${date}|${placeId}`));
      if (packStatus === 'offline-manifest') {
        expect(result).toEqual({ proposal: null, more: false });
        expect(loadVisualDiscoveryPage).not.toHaveBeenCalled();
        expect(checkpointVisualDiscovery).not.toHaveBeenCalled();
        expect(read).not.toHaveBeenCalled();
        expect(download.mock.calls.map(([name]) => name)).toEqual([manifestName]);
        expect(events).toContainEqual(expect.objectContaining({ stage: 'PACK_LOAD', reasonCode: 'MEDIA_UNAVAILABLE', retryable: true }));
        return;
      }
      expect(read).toHaveBeenCalledTimes(candidate?.representatives.length ?? 0);
      expect(download.mock.calls.map(([name]) => name)).toEqual([manifestName, `${regionalLandmarkDescriptor}-starter.json`, regionalFilename]);
      if (packStatus !== 'available') {
        expect(events.filter((event) => event.reasonCode === 'MEDIA_UNAVAILABLE')).toEqual([expect.objectContaining({
          stage: 'PACK_LOAD', durableOutcome: 'unchanged', retryable: true,
        })]);
      }
      if (packStatus === 'offline-starter-incomplete') {
        expect(result).toEqual({ proposal: null, more: false });
        expect(checkpointVisualDiscovery).not.toHaveBeenCalled();
        return;
      }
      expect(result?.proposal).toMatchObject({ token: proposalToken, place: { id: placeId }, count: 4, observedPeriod: date });
      expect(result?.proposal?.stops.map(({ id }) => id)).toEqual(stopIds);
      expect(result?.proposal?.covers.map(({ id }) => id)).toEqual(['asset-0', 'asset-3']);
      expect(checkpointVisualDiscovery).toHaveBeenCalledTimes(1);
      expect(events.filter((event) => event.reasonCode === 'COMPLETE').map((event) => event.stage)).toEqual(expect.arrayContaining([
        'PACK_LOAD', 'PACK_VALIDATE', 'REGION_ROUTE', 'LANDMARK_MATCH', 'TRIP_QUALIFY', 'ALBUM_ASSOCIATE', 'PROPOSAL_STAGE', 'PROPOSAL_READBACK',
      ]));
      const album = await access.visualDiscovery?.loadAlbum(proposalToken, 0, signal);
      expect(album?.photos.map(({ id }) => id)).toEqual(['asset-0', 'asset-1', 'asset-3', 'asset-4']);
    } finally {
      AppState.currentState = previousState;
      log.mockRestore();
      recognizer.mockRestore();
      fixture.mockRestore();
    }
  });

  it.each(['off', 'on', 'invalid-readback', 'missing-readback', 'invalid-observation', 'cancelled'] as const)(
    'applies the partial visual proposal policy and correlated readback when %s', async (mode) => {
      let access!: ReturnType<typeof usePhotoAccess>;
      const previousState = AppState.currentState;
      const originalPreview = process.env.EXPO_PUBLIC_TRAVEL_LIFE_VISUAL_PLACE_PREVIEW;
      const originalPartial = process.env.EXPO_PUBLIC_TRAVEL_LIFE_VISUAL_PARTIAL_PREVIEW;
      const sentinel = 'partial-private-sentinel';
      const token = {};
      const reviewToken = {};
      const controller = new AbortController();
      const placeNames = ['Ewha Womans University', 'Ewha Womans University', 'Nami Island', 'Nami Island', 'N Seoul Tower', 'N Seoul Tower'];
      const date = '2026-04-12';
      const photos: DiscoveryPhoto[] = [0, 2, 180, 182, 360, 362].map((minute, index) => ({
        evidence_id: `synthetic-${index}`, family: `family-${index}`, source_origin: 'capture-like',
        source_ref: `${sentinel}-${index}`, captured_day: date, captured_at_millis: Date.parse(date) + minute * 60_000,
      }));
      const candidate = { key: sentinel, start: date, end: date, representatives: photos };
      let staged: DiscoveryProposal | null = null;
      const loadVisualDiscoveryPage = jest.fn(async (_canAccess: () => Promise<boolean>, onRead?: () => void, _stagedToken?: object) => {
        if (!staged) return { kind: 'scan' as const, token, candidate, more: false };
        if (mode === 'missing-readback') return { kind: 'done' as const };
        onRead?.();
        const proposal = mode === 'invalid-readback' ? { ...staged, pendingPlaceIds: [sentinel] } : staged;
        return { kind: 'proposal' as const, token: reviewToken, proposal };
      });
      const checkpointVisualDiscovery = jest.fn(async (_token, result: QualifiedVisualAlbum | null, _canAccess, _signal, acknowledge: () => void) => {
        if (result) staged = { ...result, key: candidate.key, correctionId: null,
          photos: photos.filter(({ evidence_id }) => result.membership.some(({ id }) => id === evidence_id)) };
        acknowledge();
        return { staged: !!staged, more: false };
      });
      const native = {
        ...stagedFailureRepository(async () => ({ journeys: [] })),
        loadVisualDiscoveryEnabled: async () => true,
        setVisualDiscoveryEnabled: async () => {},
        loadVisualDiscoveryPage,
        loadVisualDiscoveryAlbum: async () => ({ photos: staged?.photos ?? [], hasMore: false }),
        verifyVisualDiscovery: async (_token: object, canAccess: () => Promise<boolean>) => { await canAccess(); },
        checkpointVisualDiscovery,
        reviewVisualDiscovery: async () => ({ manualId: null }),
      };
      const adapter: PhotoAccessAdapter = { ...adapterFor({ scope: 'full', canAskAgain: false }), resolveOwnerPreviews: async (refs) =>
        refs.map((ref): OwnerPreview => ref === null ? { kind: 'photo', availability: 'unavailable', uri: null }
          : { kind: 'photo', availability: 'available', uri: `file:///${ref}` }) };
      const recognize = createVisualRecognition(async (uri) => [placeNames[Number(uri.at(-1))]]);
      const recognizer = jest.spyOn(visualNative, 'nativeVisualRecognition').mockReturnValue(async (...args) => {
        const result = await recognize(...args);
        if (mode === 'cancelled') controller.abort();
        if (mode === 'invalid-observation' && result.status === 'recognized') {
          result.observations.unshift({ id: sentinel, placeId: 'nami-island', kind: 'signage' });
        }
        return result;
      });
      const log = jest.spyOn(console, 'info').mockImplementation(() => {});
      const Harness = () => { access = usePhotoAccess(); return null; };
      AppState.currentState = 'active';
      process.env.EXPO_PUBLIC_TRAVEL_LIFE_VISUAL_PLACE_PREVIEW = 'true';
      process.env.EXPO_PUBLIC_TRAVEL_LIFE_VISUAL_PARTIAL_PREVIEW = mode === 'off' ? 'false' : 'true';
      try {
        await render(<PhotoAccessProvider adapter={adapter} repository={emptyRepository} reconstructionRepository={native}><Harness /></PhotoAccessProvider>);
        await waitFor(() => expect(access.visualDiscovery?.enabled).toBe(true));
        log.mockClear();
        const result = await access.visualDiscovery?.discover(controller.signal);
        const events = log.mock.calls.map(([, event]) => event).filter((event) => event?.operation === 'VISUAL_PLACE_REVIEW');
        expect(new Set(events.map((event) => event.correlationId)).size).toBe(1);
        expect(JSON.stringify(events)).not.toMatch(new RegExp(`${sentinel}|Nami Island|Ewha|2026-04-12`));
        if (mode === 'invalid-observation' || mode === 'cancelled') {
          expect(result).toEqual({ proposal: null, more: false });
          expect(checkpointVisualDiscovery).not.toHaveBeenCalled();
          expect(events.filter((event) => !['START', 'COMPLETE'].includes(event.reasonCode))).toEqual([
            expect.objectContaining({ stage: 'TRIP_QUALIFY', reasonCode: mode === 'cancelled' ? 'SKIPPED' : 'MEDIA_SCHEMA',
              durableOutcome: mode === 'cancelled' ? 'skipped' : 'unchanged', retryable: false }),
          ]);
          return;
        }
        if (mode === 'invalid-readback' || mode === 'missing-readback') {
          expect(result).toEqual({ proposal: null, more: false });
          expect(loadVisualDiscoveryPage).toHaveBeenLastCalledWith(expect.any(Function), undefined, token);
          expect(events.filter((event) => !['START', 'COMPLETE'].includes(event.reasonCode))).toEqual([
            expect.objectContaining({ stage: 'PROPOSAL_READBACK', reasonCode: mode === 'missing-readback' ? 'HISTORY_STALE' : 'MEDIA_SCHEMA',
              durableOutcome: mode === 'missing-readback' ? 'skipped' : 'unchanged', retryable: false }),
          ]);
          return;
        }
        const stops = ['ewha-womans-university', 'namsan-seoul-tower'];
        expect(checkpointVisualDiscovery).toHaveBeenCalledTimes(1);
        if (mode === 'off') {
          expect(result).toEqual({ proposal: null, more: true });
          const second = await access.visualDiscovery?.discover(controller.signal);
          expect(second?.proposal?.stops.map(({ id }) => id)).toEqual([stops[0], 'nami-island', stops[1]]);
          expect(second?.proposal?.pendingPlace).toBeUndefined();
          expect(second?.proposal?.count).toBe(6);
          return;
        }
        expect(result?.proposal).toMatchObject({ token: reviewToken, count: 4, observedPeriod: date,
          place: { id: 'locality-seoul' }, pendingPlace: { id: 'nami-island', label: 'Nami Island' } });
        expect(result?.proposal?.stops.map(({ id }) => id)).toEqual(stops);
        expect(result?.proposal?.covers.map(({ id }) => id)).toEqual(['synthetic-0', 'synthetic-4']);
        expect(events.filter((event) => event.reasonCode === 'COMPLETE').map((event) => event.stage)).toEqual(expect.arrayContaining([
          'TRIP_QUALIFY', 'ALBUM_ASSOCIATE', 'PROPOSAL_STAGE', 'PROPOSAL_READBACK',
        ]));
        const album = await access.visualDiscovery?.loadAlbum(reviewToken, 0, controller.signal);
        expect(album?.photos.map(({ id }) => id)).toEqual(['synthetic-0', 'synthetic-1', 'synthetic-4', 'synthetic-5']);
      } finally {
        AppState.currentState = previousState;
        if (originalPreview === undefined) delete process.env.EXPO_PUBLIC_TRAVEL_LIFE_VISUAL_PLACE_PREVIEW;
        else process.env.EXPO_PUBLIC_TRAVEL_LIFE_VISUAL_PLACE_PREVIEW = originalPreview;
        if (originalPartial === undefined) delete process.env.EXPO_PUBLIC_TRAVEL_LIFE_VISUAL_PARTIAL_PREVIEW;
        else process.env.EXPO_PUBLIC_TRAVEL_LIFE_VISUAL_PARTIAL_PREVIEW = originalPartial;
        log.mockRestore();
        recognizer.mockRestore();
      }
    });

  it.each([
    ['Seoul', 'locality-seoul', 'ewha-womans-university', 'Seoul Metropolitan Government'],
    ['Hà Nội', 'locality-hanoi', 'khue-van-cac', 'Ủy ban nhân dân thành phố Hà Nội'],
    ['unresolved preview', 'locality-seoul', 'ewha-womans-university', 'Seoul Metropolitan Government'],
    ['stale readback', 'locality-seoul', 'ewha-womans-university', 'Seoul Metropolitan Government'],
  ])('runs the normal city proposal path for %s', async (scenario, city, landmark, civic) => {
    let access!: ReturnType<typeof usePhotoAccess>;
    const state = AppState.currentState;
    const pageToken = {};
    const reviewToken = {};
    const sentinel = 'synthetic-city-private-source';
    const day = '2025-08-01';
    const rows: DiscoveryPhoto[] = [0, 2, 170, 180, 182, ...(scenario === 'unresolved preview' ? [75, 135] : [])].map((minute, index) => ({
      evidence_id: `city-${index}`, family: `family-${index}`, source_origin: 'capture-like', source_ref: `${sentinel}-${index}`,
      captured_day: day, captured_at_millis: Date.parse(day) + minute * 60_000,
    }));
    const candidate = { key: sentinel, start: day, end: day, representatives: rows };
    let staged: DiscoveryProposal | null = null;
    const loadVisualDiscoveryPage = jest.fn(async (_canUse: () => Promise<boolean>, _onRead?: () => void, token?: object) => {
      if (token === pageToken) {
        if (scenario === 'stale readback') throw new VisualPlaceError('HISTORY_STALE');
        if (staged) return { kind: 'proposal' as const, token: reviewToken, proposal: staged };
      }
      return { kind: 'scan' as const, token: pageToken, candidate, more: false };
    });
    const checkpointVisualDiscovery = jest.fn(async (_token, result: QualifiedVisualAlbum | null, _canUse, _signal, acknowledge: () => void) => {
      if (result) staged = { ...result, key: candidate.key, correctionId: null,
        photos: rows.filter(({ evidence_id }) => result.membership.some(({ id }) => id === evidence_id)) };
      acknowledge();
      return { staged: staged !== null, more: false };
    });
    const native = { ...stagedFailureRepository(async () => ({ journeys: [] })), loadVisualDiscoveryEnabled: async () => true,
      setVisualDiscoveryEnabled: async () => {}, loadVisualDiscoveryPage, checkpointVisualDiscovery,
      loadVisualDiscoveryAlbum: async () => ({ photos: staged?.photos ?? [], hasMore: false }),
      verifyVisualDiscovery: async (_token: object, canUse: () => Promise<boolean>) => { await canUse(); },
      reviewVisualDiscovery: async () => ({ manualId: null }),
    };
    const adapter: PhotoAccessAdapter = { ...adapterFor({ scope: 'full', canAskAgain: false }), resolveOwnerPreviews: async (refs) =>
      refs.map((ref): OwnerPreview => ref === null || Number(ref.at(-1)) >= 5 ? { kind: 'photo', availability: 'unavailable', uri: null }
        : { kind: 'photo', availability: 'available', uri: `file:///${ref}` }) };
    const recognize = createVisualRecognition(async (uri) => {
      const index = Number(uri.at(-1));
      return index >= 3 ? [civic] : index < 2 && city === 'locality-seoul' ? ['Ewha Womans University'] : ['generic scene'];
    }, 12_000, city === 'locality-hanoi' ? async (uri) => ({ place: Number(uri.at(-1)) < 2 ? resolveVisualPlace(landmark) : null }) : undefined);
    const recognizer = jest.spyOn(visualNative, 'nativeVisualRecognition').mockReturnValue(recognize);
    const log = jest.spyOn(console, 'info').mockImplementation(() => {});
    const Harness = () => { access = usePhotoAccess(); return null; };
    AppState.currentState = 'active';
    try {
      await render(<PhotoAccessProvider adapter={adapter} repository={emptyRepository} reconstructionRepository={native}><Harness /></PhotoAccessProvider>);
      await waitFor(() => expect(access.visualDiscovery?.enabled).toBe(true));
      log.mockClear();
      const signal = new AbortController().signal;
      const result = await access.visualDiscovery?.discover(signal);
      expect(checkpointVisualDiscovery).toHaveBeenCalledTimes(1);
      const events = log.mock.calls.map(([, event]) => event).filter((event) => event?.operation === 'VISUAL_PLACE_REVIEW');
      expect(new Set(events.map((event) => event.correlationId)).size).toBe(1);
      expect(JSON.stringify(events)).not.toMatch(new RegExp(`${sentinel}|city-0|${day}|${civic}`));
      for (const event of events) {
        expect(Object.keys(event).sort()).toEqual(['correlationId', 'durableOutcome', 'operation', 'reasonCode', 'retryable', 'stage']);
      }
      const failures = events.filter((event) => !['START', 'COMPLETE'].includes(event.reasonCode));
      if (scenario === 'unresolved preview' || scenario === 'stale readback') {
        expect(result).toEqual({ proposal: null, more: false });
        expect(failures).toEqual([expect.objectContaining(scenario === 'unresolved preview'
          ? { stage: 'TRIP_QUALIFY', reasonCode: 'VISUAL_EPISODE_SUPPORT', durableOutcome: 'skipped', retryable: false }
          : { stage: 'PROPOSAL_READBACK', reasonCode: 'HISTORY_STALE', durableOutcome: 'skipped', retryable: false })]);
        return;
      }
      expect(failures).toEqual([]);
      expect(loadVisualDiscoveryPage).toHaveBeenLastCalledWith(expect.any(Function), undefined, pageToken);
      expect(result?.proposal).toMatchObject({ token: reviewToken, count: 4, observedPeriod: day, place: { id: city, label: scenario },
        stops: [{ id: landmark }], covers: [{ id: 'city-0' }, { id: 'city-3' }] });
      const album = await access.visualDiscovery?.loadAlbum(reviewToken, 0, signal);
      expect(album?.photos.map(({ id }) => id)).toEqual(['city-0', 'city-1', 'city-3', 'city-4']);
    } finally {
      AppState.currentState = state;
      recognizer.mockRestore();
      log.mockRestore();
    }
  });

  it.each([
    ['eligibility', 'HINT_ELIGIBILITY', 'DATABASE_BUSY', 'unchanged'],
    ['media', 'MEDIA_SCOPE', 'UNKNOWN', 'unchanged'],
    ['withdrawn', 'MEDIA_SCOPE', 'ACCESS', 'restricted'],
    ['output', 'RESULT_VALIDATE', 'MEDIA_SCHEMA', 'unchanged'],
    ['trip', 'TRIP_QUALIFY', 'VISUAL_EPISODE_SUPPORT', 'skipped'],
    ['album', 'ALBUM_ASSOCIATE', 'MEDIA_SCHEMA', 'unchanged'],
    ['checkpoint', 'PROPOSAL_STAGE', 'DATABASE_BUSY', 'unchanged'],
    ['ack', 'PROPOSAL_STAGE', 'UNKNOWN', 'unknown'],
    ['readback', 'PROPOSAL_READBACK', 'MEDIA_SCHEMA', 'unchanged'],
    ['review-commit', 'REVIEW_COMMIT', 'DATABASE_BUSY', 'unchanged'],
    ['review-ack', 'REVIEW_READBACK', 'UNKNOWN', 'unknown'],
  ] as const)('classifies automatic visual %s faults once without logging private content', async (fault, stage, reasonCode, durableOutcome) => {
    let access!: ReturnType<typeof usePhotoAccess>;
    const token = {};
    const sentinel = 'synthetic-visual-private-sentinel';
    const state = AppState.currentState;
    const permission: PermissionSnapshot = { scope: 'full', canAskAgain: false };
    const photo = (offset: number) => ({
      evidence_id: `opaque-${offset}`, source_ref: `${sentinel}-${offset}`, family: `family-${offset}`,
      captured_day: '2026-04-12', captured_at_millis: Date.parse('2026-04-12') + offset * 60_000,
      source_origin: 'capture-like',
    });
    const candidate = { key: sentinel, start: '2026-04-12', end: '2026-04-12',
      representatives: [4, 6, 120, 122].map(photo) };
    const loadVisualDiscoveryPage = jest.fn(async (_canAccess: () => Promise<boolean>, read: () => void) => {
      if (fault === 'eligibility') throw new Error(`database is locked ${sentinel}`);
      if (fault === 'readback') { read(); throw new VisualPlaceError('MEDIA_SCHEMA'); }
      return { kind: 'scan' as const, token, candidate, more: false };
    });
    const checkpointVisualDiscovery = jest.fn(async (_token, _result, _canAccess, _signal, acknowledge: () => void) => {
      if (fault === 'checkpoint') throw new Error(`database is locked ${sentinel}`);
      if (fault === 'ack') { acknowledge(); throw new Error(sentinel); }
      return { staged: fault !== 'trip', more: false };
    });
    const reviewVisualDiscovery = jest.fn(async (_token, _decision, _canAccess, _signal, acknowledge: () => void) => {
      if (fault === 'review-commit') throw new Error(`database is locked ${sentinel}`);
      acknowledge();
      throw new Error(sentinel);
    });
    const native = {
      ...stagedFailureRepository(async () => ({ journeys: [] })),
      loadVisualDiscoveryEnabled: async () => true,
      setVisualDiscoveryEnabled: async () => {},
      loadVisualDiscoveryPage,
      loadVisualDiscoveryAlbum: async () => { throw new VisualPlaceError('MEDIA_SCHEMA'); },
      verifyVisualDiscovery: async (_token: object, canAccess: () => Promise<boolean>) => { await canAccess(); },
      checkpointVisualDiscovery,
      reviewVisualDiscovery,
    };
    const resolveOwnerPreviews = jest.fn(async () => {
      if (fault === 'media') throw new Error(sentinel);
      if (fault === 'withdrawn') permission.scope = 'limited';
      return [{ kind: 'photo' as const, availability: 'available' as const, uri: `file:///${sentinel}` }];
    });
    const adapter = { ...adapterFor(permission), resolveOwnerPreviews };
    let reads = 0;
    const read = jest.fn(async () => fault === 'output' ? { text: sentinel }
      : [reads++ < 2 ? 'Ewha Womans University' : fault === 'trip' ? 'Generic scene' : 'N Seoul Tower']);
    const recognizer = jest.spyOn(visualNative, 'nativeVisualRecognition').mockReturnValue(createVisualRecognition(read));
    const log = jest.spyOn(console, 'info').mockImplementation(() => {});
    const Harness = () => { access = usePhotoAccess(); return null; };
    AppState.currentState = 'active';
    try {
      await render(<PhotoAccessProvider adapter={adapter} repository={emptyRepository} reconstructionRepository={native}><Harness /></PhotoAccessProvider>);
      await waitFor(() => expect(access.visualDiscovery?.enabled).toBe(true));
      log.mockClear();
      const signal = new AbortController().signal;
      if (fault.startsWith('review')) {
        await expect(access.visualDiscovery?.review(token, 'confirm', signal)).resolves.toBe(false);
      } else if (fault === 'album') {
        await expect(access.visualDiscovery?.loadAlbum(token, 0, signal)).resolves.toBeNull();
      } else {
        await expect(access.visualDiscovery?.discover(signal)).resolves.toEqual({ proposal: null, more: false });
      }
      const events = log.mock.calls.map(([, event]) => event).filter((event) => event?.operation === 'VISUAL_PLACE_REVIEW');
      expect(events.filter((event) => event.reasonCode !== 'START' && event.reasonCode !== 'COMPLETE')).toEqual([
        expect.objectContaining({ stage, reasonCode, durableOutcome }),
      ]);
      expect(new Set(events.map((event) => event.correlationId)).size).toBe(1);
      expect(JSON.stringify(events)).not.toMatch(new RegExp(`${sentinel}|Ewha`));
      if (fault === 'withdrawn') { expect(resolveOwnerPreviews).toHaveBeenCalledTimes(1); expect(read).not.toHaveBeenCalled(); }
      if (fault === 'output' || fault === 'withdrawn') expect(checkpointVisualDiscovery).not.toHaveBeenCalled();
    } finally {
      AppState.currentState = state;
      log.mockRestore();
      recognizer.mockRestore();
    }
  });

  it('gates exact Local featured evidence, rejects malformed slots, and disposes stale isolated Replay output', async () => {
    let access!: ReturnType<typeof usePhotoAccess>;
    const env = process.env.EXPO_PUBLIC_TRAVEL_LIFE_RECOGNIZABLE_REVEAL;
    const appState = AppState.currentState;
    const token = {};
    const sentinel = 'synthetic-private-featured-asset';
    const uri = `file:///${sentinel}.mov`;
    const card = { id: 'shadow-4-1', title: 'Synthetic place', observedPeriod: 'Jan 2025', coverRefs: [sentinel], state: 'reliable' as const, reasons: ['corroborated-outing' as const] };
    const verify = jest.fn(async (_token: object, canUseSource: () => boolean | Promise<boolean>) => await canUseSource());
    const load = jest.fn(async () => ({ status: 'complete' as const, policyVersion: 'recognizable-travel-shadow-v1' as const, token, cards: [card], observed: [{ latitude: 10.2, longitude: 100 }] }));
    const read = jest.fn(async () => ({ refs: [sentinel], card, run: 4 }));
    const lifetimeManifest = jest.fn(async () => ({ snapshotToken: 18, privacyRevision: 2, groups: [], memories: [] }));
    const native = { ...stagedFailureRepository(async () => ({ journeys: [] })), loadCandidateShadowSnapshot: load,
      verifyCandidateShadowSnapshot: verify, readCandidateShadowMedia: read, loadReplayManifestInput: lifetimeManifest };
    const resolve = jest.fn<Promise<OwnerPreview[]>, [(string | null)[], number]>(async () => [{ kind: 'video', uri, availability: 'available' }]);
    const permission: PermissionSnapshot = { scope: 'full', canAskAgain: false };
    const adapter = { ...adapterFor(permission), resolveOwnerPreviews: resolve };
    const renderer = jest.spyOn(munimReplayRenderer, 'render').mockImplementation(async (manifest) => ({ uri: 'file:///synthetic-private-preview.mp4', digest: 'test', manifest }));
    const dispose = jest.spyOn(munimReplayRenderer, 'dispose').mockResolvedValue(undefined);
    const log = jest.spyOn(console, 'info').mockImplementation(() => {});
    const Harness = () => { access = usePhotoAccess(); return null; };
    AppState.currentState = 'active';
    delete process.env.EXPO_PUBLIC_TRAVEL_LIFE_RECOGNIZABLE_REVEAL;
    try {
      await render(<PhotoAccessProvider adapter={adapter} repository={emptyRepository} reconstructionRepository={native}><Harness /></PhotoAccessProvider>);
      await waitFor(() => expect(access.privateRecord.state).toBe('connected'));
      await expect(access.loadRecognizableReveal?.()).resolves.toBeNull();
      expect(load).not.toHaveBeenCalled();
      process.env.EXPO_PUBLIC_TRAVEL_LIFE_RECOGNIZABLE_REVEAL = 'true';
      await expect(access.loadRecognizableReveal?.()).resolves.toMatchObject({ token, featured: { id: card.id, coverUri: null, canPlay: true } });
      expect(load).toHaveBeenCalledWith(expect.objectContaining({ purpose: 'reveal', limit: 24 }));
      resolve.mockResolvedValueOnce([]);
      await expect(access.readRecognizableTrip?.(token, card.id)).resolves.toBeNull();
      expect(log).toHaveBeenLastCalledWith('[Travel Life diagnostic]', expect.objectContaining({ operation: 'ATLAS_PREVIEW', stage: 'PREVIEW_MEDIA', reasonCode: 'MEDIA_VERIFY' }));
      resolve.mockRejectedValueOnce(new Error(`database is locked ${sentinel}`));
      await expect(access.readRecognizableTrip?.(token, card.id)).resolves.toBeNull();
      expect(log).toHaveBeenLastCalledWith('[Travel Life diagnostic]', expect.objectContaining({ operation: 'ATLAS_PREVIEW', stage: 'PREVIEW_MEDIA', reasonCode: 'DATABASE_BUSY' }));
      const rendered = await access.playRecognizableTrip?.(token, card.id, undefined, 'synthetic_d2_render');
      expect(rendered?.renderedMemoryCount).toBe(1);
      expect(renderer).toHaveBeenLastCalledWith(expect.objectContaining({ groupKeys: ['featured-trip'], memoryKeys: ['trip-memory-1'] }),
        [{ groupKey: 'featured-trip', memoryKey: 'trip-memory-1', uri, kind: 'video' }], expect.anything());
      await expect(access.exportPrivateReplay(rendered!.uri)).rejects.toMatchObject({ stage: 'REPLAY_ACCESS' });
      expect(lifetimeManifest).not.toHaveBeenCalled();
      await access.discardRecognizableTripPreview?.(rendered!.uri);
      expect(dispose).toHaveBeenCalledTimes(1);
      renderer.mockImplementationOnce(async (manifest) => {
        permission.scope = 'limited';
        return { uri: 'file:///synthetic-private-stale.mp4', digest: 'test', manifest };
      });
      await expect(access.playRecognizableTrip?.(token, card.id, undefined, 'synthetic_d2_stale')).resolves.toBeNull();
      expect(dispose).toHaveBeenCalledTimes(2);
      expect(log).toHaveBeenLastCalledWith('[Travel Life diagnostic]', expect.objectContaining({ operation: 'REPLAY_RENDER', stage: 'REPLAY_OUTPUT_VERIFY', reasonCode: 'HISTORY_STALE', durableOutcome: 'skipped', correlationId: 'synthetic_d2_stale' }));
      expect(JSON.stringify(log.mock.calls)).not.toContain(sentinel);
    } finally {
      if (env === undefined) delete process.env.EXPO_PUBLIC_TRAVEL_LIFE_RECOGNIZABLE_REVEAL;
      else process.env.EXPO_PUBLIC_TRAVEL_LIFE_RECOGNIZABLE_REVEAL = env;
      AppState.currentState = appState;
      renderer.mockRestore(); dispose.mockRestore(); log.mockRestore();
    }
  });

  it.each(['REPLAY_SCOPE_INVALID', 'REPLAY_MAPPING_INVALID', 'REPLAY_RECEIPT_CONFLICT'] as const)('preserves prepared artifact %s while keeping the public output stage', reason => {
    const log = jest.spyOn(console, 'info').mockImplementation(() => {});
    try {
      const diagnostic = replayPreparationDiagnostics('local_artifact_guard');
      diagnostic.enter('REPLAY_OUTPUT_SAVE');
      expect(diagnostic.failure(new ReplayPreparedArtifactError(reason, reason === 'REPLAY_RECEIPT_CONFLICT' ? 'REPLAY_OUTPUT_CAS' : reason === 'REPLAY_MAPPING_INVALID' ? 'REPLAY_OUTPUT_MAPPING' : 'REPLAY_OUTPUT_PRIVACY'), 'REPLAY_OUTPUT')).toMatchObject({ stage: 'REPLAY_OUTPUT' });
      expect(log).toHaveBeenLastCalledWith('[Travel Life diagnostic]', expect.objectContaining({ stage: reason === 'REPLAY_RECEIPT_CONFLICT' ? 'REPLAY_OUTPUT_CAS' : reason === 'REPLAY_MAPPING_INVALID' ? 'REPLAY_OUTPUT_MAPPING' : 'REPLAY_OUTPUT_PRIVACY', reasonCode: reason, retryable: reason === 'REPLAY_RECEIPT_CONFLICT', durableOutcome: reason === 'REPLAY_RECEIPT_CONFLICT' ? 'unchanged' : 'skipped' }));
    } finally { log.mockRestore(); }
  });
  it.each(['save', 'verify', 'cas'] as const)('classifies original Replay output %s failure before cleanup and redacts content', async (boundary) => {
    let access!: ReturnType<typeof usePhotoAccess>;
    const sentinel = 'synthetic-private-output-sentinel';
    const replay = { snapshotToken: 7, privacyRevision: 2, previewSourceRefs: [], groups: [{ key: 'trip', label: 'Trip', inferred: true, eligible: true, orderCertain: true }], memories: [] };
    const save = jest.fn(async () => { if (boundary === 'cas') throw new ReplayPreparedArtifactError('REPLAY_RECEIPT_CONFLICT', 'REPLAY_OUTPUT_CAS'); if (boundary === 'save') throw new Error(`database is locked ${sentinel}`); });
    const native = { ...stagedFailureRepository(async () => ({ journeys: [] })), loadReplayManifestInput: async () => replay, saveReplayPreparedArtifact: save };
    const adapter = { ...adapterFor(null), accountAuthorized: async () => true, resolveOwnerPreviews: async () => [] };
    const Harness = () => { access = usePhotoAccess(); return null; };
    const prepare = jest.spyOn(ReplayController.prototype, 'prepareWith').mockImplementation(async manifest => ({ uri: 'file:///rendered.mp4', digest: 'synthetic', manifest }));
    const mkdir = jest.spyOn(FileSystem, 'makeDirectoryAsync').mockResolvedValue(undefined);
    const copy = jest.spyOn(FileSystem, 'copyAsync').mockResolvedValue(undefined);
    const info = jest.spyOn(FileSystem, 'getInfoAsync').mockImplementation(async () => { if (boundary === 'verify') throw new Error(`released native handle ${sentinel}`); return { exists: true, size: 12 } as never; });
    const cleanup = jest.spyOn(FileSystem, 'deleteAsync').mockRejectedValue(new Error('cleanup-private-sentinel'));
    const log = jest.spyOn(console, 'info').mockImplementation(() => {});
    try {
      await render(<PhotoAccessProvider adapter={adapter} repository={emptyRepository} reconstructionRepository={native}><Harness /></PhotoAccessProvider>);
      await waitFor(() => expect(access.privateRecord.state).toBe('connected'));
      await expect(access.preparePrivateReplay(undefined, undefined, undefined, undefined, undefined, 'local_output_test')).rejects.toMatchObject({ stage: 'REPLAY_OUTPUT', diagnosticRecorded: true });
      const events = log.mock.calls.map(([, event]) => event).filter(event => event.operation === 'REPLAY_RENDER');
      expect(events.some(event => event.stage === 'REPLAY_ACCOUNT')).toBe(true);
      expect(events.filter(event => event.reasonCode !== 'START')).toEqual([expect.objectContaining({ stage: boundary === 'save' ? 'REPLAY_OUTPUT_SAVE' : boundary === 'cas' ? 'REPLAY_OUTPUT_CAS' : 'REPLAY_OUTPUT_VERIFY', reasonCode: boundary === 'save' ? 'DATABASE_BUSY' : boundary === 'cas' ? 'REPLAY_RECEIPT_CONFLICT' : 'NATIVE_HANDLE', correlationId: 'local_output_test' })]);
      expect(JSON.stringify(log.mock.calls)).not.toContain(sentinel);
      expect(JSON.stringify(log.mock.calls)).not.toContain('cleanup-private-sentinel');
    } finally { prepare.mockRestore(); mkdir.mockRestore(); copy.mockRestore(); info.mockRestore(); cleanup.mockRestore(); log.mockRestore(); }
  });

  it.each(['MEDIA_VERIFY', 'MEDIA_CONSENT', 'MEDIA_SCOPE', 'MEDIA_UNAVAILABLE', 'ACCOUNT_SESSION', 'MEDIA_NETWORK'] as const)('preserves closed %s media failure semantics', reason => {
    const log = jest.spyOn(console, 'info').mockImplementation(() => {});
    try {
      const diagnostic = replayPreparationDiagnostics('local_media_reason');
      diagnostic.enter('REPLAY_SOUNDTRACK');
      diagnostic.failure(new AccountMediaError(reason));
      expect(log).toHaveBeenLastCalledWith('[Travel Life diagnostic]', expect.objectContaining({ reasonCode: reason, retryable: reason === 'MEDIA_NETWORK', durableOutcome: reason === 'MEDIA_NETWORK' ? 'unchanged' : 'blocked' }));
    } finally { log.mockRestore(); }
  });

  it('hands exact resolved account soundtrack to renderer and denies an otherwise valid cache after authority changes', async () => {
    let access!: ReturnType<typeof usePhotoAccess>;
    const soundtrack = { kind: 'custom' as const, revision: 'exact-owner-revision', localUri: '' };
    const replay = { snapshotToken: 7, privacyRevision: 2, soundtrack, previewSourceRefs: [], groups: [{ key: 'trip', label: 'Trip', inferred: true, eligible: true, orderCertain: true }], memories: [] };
    const cached = { ...replay, preparedArtifact: { cacheVersion: 2 as const, identity: preparedReplayCacheIdentity(replay, soundtrack)!, fileKey: 'replay-abc-def.mp4', durationSeconds: 5, renderedMemoryCount: 0 } };
    const authorized = jest.fn(async () => true);
    const adapter = { ...adapterFor(null), accountAuthorized: authorized, resolveOwnerPreviews: async () => [], resolveReplaySoundtrack: async (track: typeof soundtrack) => ({ ...track, localUri: 'file:///resolved-owner-audio.m4a' }) };
    const native = { ...stagedFailureRepository(async () => ({ journeys: [] })), loadReplayManifestInput: async () => cached };
    const renderer = jest.spyOn(munimReplayRenderer, 'render').mockImplementation(async manifest => ({ uri: 'file:///private.mp4', digest: 'synthetic', manifest }));
    const info = jest.spyOn(FileSystem, 'getInfoAsync').mockResolvedValue({ exists: true, size: 12 } as never);
    const verify = jest.spyOn(replayRenderer, 'verifyReplayOutput').mockResolvedValue(true);
    const Harness = () => { access = usePhotoAccess(); return null; };
    try {
      await render(<PhotoAccessProvider adapter={adapter} repository={emptyRepository} reconstructionRepository={native}><Harness /></PhotoAccessProvider>);
      await waitFor(() => expect(access.privateRecord.state).toBe('connected'));
      await access.preparePrivateReplay([], undefined, soundtrack, undefined, ['trip']);
      expect(renderer.mock.calls[0][0].music).toEqual({ ...soundtrack, localUri: 'file:///resolved-owner-audio.m4a' });
      authorized.mockResolvedValue(true);
      await expect(access.loadPreparedReplay()).resolves.toMatchObject({ uri: expect.stringContaining('replay-abc-def.mp4') });
      authorized.mockReset().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
      await expect(access.loadPreparedReplay()).resolves.toBeNull();
      expect(authorized).toHaveBeenCalledTimes(2);
    } finally { await access.discardPrivateReplay('file:///private.mp4'); renderer.mockRestore(); info.mockRestore(); verify.mockRestore(); }
  });
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

  it('does not require account copies for explicitly excluded Replay memories', async () => {
    let access!: ReturnType<typeof usePhotoAccess>;
    const replay={snapshotToken:7,privacyRevision:2,includedGroupKeys:['trip'],autoGroupKeys:[],previewSourceRefs:['account:kept','account:excluded'],groups:[{key:'trip',label:'Synthetic trip',inferred:true,eligible:true,orderCertain:true}],memories:[{key:'kept',groupKey:'trip',kind:'photo' as const,available:true,eligible:true,intent:'keep' as const},{key:'excluded',groupKey:'trip',kind:'photo' as const,available:false,eligible:true,intent:'exclude' as const}]};
    const native={...stagedFailureRepository(async()=>({journeys:[]})),loadReplayManifestInput:async()=>replay};
    const resolveOwnerPreviews=jest.fn(async()=>[{uri:'file:///kept.jpg',availability:'available' as const,kind:'photo' as const},{uri:null,availability:'unavailable' as const,kind:'photo' as const}]);
    const adapter={...adapterFor(null),accountAuthorized:async()=>true,resolveOwnerPreviews};
    const renderer=jest.spyOn(munimReplayRenderer,'render').mockImplementation(async manifest=>({uri:'file:///account-kept.mp4',digest:'synthetic',manifest}));
    const Harness=()=>{access=usePhotoAccess();return null;};
    try{await render(<PhotoAccessProvider adapter={adapter} repository={emptyRepository} reconstructionRepository={native}><Harness/></PhotoAccessProvider>);await waitFor(()=>expect(access.privateRecord.state).toBe('connected'));
      await expect(access.preparePrivateReplay(['kept'],undefined,undefined,undefined,['trip'])).resolves.toMatchObject({renderedMemoryCount:1});
      expect(renderer).toHaveBeenCalledWith(expect.objectContaining({memoryKeys:['kept']}),expect.anything(),expect.anything(),undefined);
      expect(resolveOwnerPreviews).toHaveBeenCalledWith(['account:kept',null],2);
    }finally{renderer.mockRestore();}
  });

  it('blocks account Replay when committed derivatives are missing rather than dropping them', async () => {
    let access!: ReturnType<typeof usePhotoAccess>;
    const replay = { snapshotToken: 7, privacyRevision: 2, previewSourceRefs: ['account:synthetic'], groups: [{ key: 'trip', label: 'Synthetic trip', inferred: true, eligible: true, orderCertain: true }], memories: [{ key: 'memory', groupKey: 'trip', kind: 'photo' as const, available: true, eligible: true }] };
    const native = { ...stagedFailureRepository(async () => ({ journeys: [] })), loadReplayManifestInput: jest.fn(async () => replay) };
    const adapter = { ...adapterFor(null), accountAuthorized: async () => true, resolveOwnerPreviews: async () => [{ uri: null, availability: 'unavailable' as const, kind: 'photo' as const }] };
    const Harness = () => { access = usePhotoAccess(); return null; };
    await render(<PhotoAccessProvider adapter={adapter} repository={emptyRepository} reconstructionRepository={native}><Harness /></PhotoAccessProvider>);
    await waitFor(() => expect(access.privateRecord.state).toBe('connected'));
    await expect(access.preparePrivateReplay()).rejects.toMatchObject({ stage: 'REPLAY_ACCESS' });
  });

  it('withholds account render completion and export after live media authority changes', async () => {
    let access!: ReturnType<typeof usePhotoAccess>;
    let allowed = true;
    const replay = { snapshotToken: 7, privacyRevision: 2, previewSourceRefs: [], groups: [{ key: 'trip', label: 'Synthetic trip', inferred: true, eligible: true, orderCertain: true }], memories: [] };
    const native = { ...stagedFailureRepository(async () => ({ journeys: [] })), loadReplayManifestInput: jest.fn(async () => replay) };
    const adapter = { ...adapterFor(null), accountAuthorized: async () => allowed, resolveOwnerPreviews: async () => [] };
    const rendererSpy = jest.spyOn(munimReplayRenderer, 'render').mockImplementation(async manifest => { allowed = false; return { uri: 'file:///late-account.mp4', digest: 'synthetic', manifest }; });
    const disposeSpy = jest.spyOn(munimReplayRenderer, 'dispose').mockResolvedValue(undefined);
    const Harness = () => { access = usePhotoAccess(); return null; };
    try {
      await render(<PhotoAccessProvider adapter={adapter} repository={emptyRepository} reconstructionRepository={native}><Harness /></PhotoAccessProvider>);
      await waitFor(() => expect(access.privateRecord.state).toBe('connected'));
      await expect(access.preparePrivateReplay([], undefined, undefined, undefined, ['trip'])).rejects.toMatchObject({ stage: 'REPLAY_STALE' });
      expect(disposeSpy).toHaveBeenCalledWith(expect.objectContaining({ uri: 'file:///late-account.mp4' }));
      await expect(access.exportPrivateReplay('file:///late-account.mp4')).rejects.toMatchObject({ stage: 'REPLAY_STALE' });
    } finally { rendererSpy.mockRestore(); disposeSpy.mockRestore(); }
  });

  it('withholds a cached account Replay before native reads when live media consent is denied', async () => {
    let access!: ReturnType<typeof usePhotoAccess>;
    const loadReplayManifestInput = jest.fn(async () => ({ snapshotToken: 7, privacyRevision: 2, groups: [], memories: [] }));
    const native = { ...stagedFailureRepository(async () => ({ journeys: [] })), loadReplayManifestInput };
    const adapter = { ...adapterFor(null), accountAuthorized: async () => false };
    const Harness = () => { access = usePhotoAccess(); return null; };
    await render(<PhotoAccessProvider adapter={adapter} repository={emptyRepository} reconstructionRepository={native}><Harness /></PhotoAccessProvider>);
    await waitFor(() => expect(access.privateRecord.state).toBe('connected'));
    loadReplayManifestInput.mockClear();
    await expect(access.loadPreparedReplay()).resolves.toBeNull();expect(loadReplayManifestInput).not.toHaveBeenCalled();
  });

  it('resolves account custom audio before rendering and blocks when that exact audio is missing', async () => {
    let access!: ReturnType<typeof usePhotoAccess>;
    const soundtrack = { kind: 'custom' as const, revision: 'chosen-track', localUri: '' };
    const replay = { snapshotToken: 7, privacyRevision: 2, soundtrack, previewSourceRefs: [], groups: [{ key: 'trip', label: 'Synthetic trip', inferred: true, eligible: true, orderCertain: true }], memories: [] };
    const native = { ...stagedFailureRepository(async () => ({ journeys: [] })), loadReplayManifestInput: jest.fn(async () => replay) };
    const resolveReplaySoundtrack = jest.fn(async () => { throw new Error('private-sentinel'); });
    const adapter = { ...adapterFor(null), accountAuthorized: async () => true, resolveReplaySoundtrack, resolveOwnerPreviews: async () => [] };
    const Harness = () => { access = usePhotoAccess(); return null; };
    await render(<PhotoAccessProvider adapter={adapter} repository={emptyRepository} reconstructionRepository={native}><Harness /></PhotoAccessProvider>);
    await waitFor(() => expect(access.privateRecord.state).toBe('connected'));
    await expect(access.preparePrivateReplay([], undefined, soundtrack, undefined, ['trip'])).rejects.toMatchObject({ stage: 'REPLAY_ACCESS' });
    expect(resolveReplaySoundtrack).toHaveBeenCalledWith(soundtrack);
  });

  it('rejects a selected Replay key that is no longer in the included eligible composition as stale', async () => {
    let access!: ReturnType<typeof usePhotoAccess>;
    const replay = { snapshotToken: 7, privacyRevision: 2, includedGroupKeys: ['kept'], previewSourceRefs: ['opaque-kept', 'opaque-removed'], groups: [
      { key: 'kept', label: 'Kept trip', inferred: true, eligible: true, orderCertain: true },
      { key: 'removed', label: 'Removed trip', inferred: true, eligible: true, orderCertain: true },
    ], memories: [
      { key: 'kept-memory', groupKey: 'kept', kind: 'photo' as const, available: true, eligible: true },
      { key: 'removed-memory', groupKey: 'removed', kind: 'photo' as const, available: true, eligible: true },
    ] };
    const native = { ...stagedFailureRepository(async () => ({ journeys: [] })), loadReplayManifestInput: jest.fn(async () => replay) };
    const adapter = { ...adapterFor({ scope: 'full', canAskAgain: false }), resolveOwnerPreviews: jest.fn(async () => [
      { uri: 'file:///kept.jpg', availability: 'available' as const, kind: 'photo' as const },
      { uri: 'file:///removed.jpg', availability: 'available' as const, kind: 'photo' as const },
    ]) };
    const Harness = () => { access = usePhotoAccess(); return null; };
    await render(<PhotoAccessProvider adapter={adapter} repository={emptyRepository} reconstructionRepository={native}><Harness /></PhotoAccessProvider>);
    await waitFor(() => expect(access.privateRecord.state).toBe('connected'));
    await expect(access.preparePrivateReplay(['removed-memory'])).rejects.toMatchObject({ stage: 'REPLAY_STALE' });
  });

  it('rejects a selected Replay chapter that is no longer in the committed composition as stale', async () => {
    let access!: ReturnType<typeof usePhotoAccess>;
    const replay = { snapshotToken: 7, privacyRevision: 2, includedGroupKeys: ['kept'], previewSourceRefs: ['opaque-kept'], groups: [
      { key: 'kept', label: 'Kept trip', inferred: true, eligible: true, orderCertain: true },
      { key: 'removed', label: 'Removed trip', inferred: true, eligible: true, orderCertain: true },
    ], memories: [{ key: 'kept-memory', groupKey: 'kept', kind: 'photo' as const, available: true, eligible: true }] };
    const native = { ...stagedFailureRepository(async () => ({ journeys: [] })), loadReplayManifestInput: jest.fn(async () => replay) };
    const adapter = { ...adapterFor({ scope: 'full', canAskAgain: false }), resolveOwnerPreviews: jest.fn(async () => [{ uri: 'file:///kept.jpg', availability: 'available' as const, kind: 'photo' as const }]) };
    const Harness = () => { access = usePhotoAccess(); return null; };
    await render(<PhotoAccessProvider adapter={adapter} repository={emptyRepository} reconstructionRepository={native}><Harness /></PhotoAccessProvider>);
    await waitFor(() => expect(access.privateRecord.state).toBe('connected'));
    await expect(access.preparePrivateReplay([], undefined, undefined, undefined, ['removed'])).rejects.toMatchObject({ stage: 'REPLAY_STALE' });
  });

  it('prepares selected normal and card-only committed chapters in committed media order with the supplied soundtrack', async () => {
    let access!: ReturnType<typeof usePhotoAccess>;
    const soundtrack = { kind: 'custom' as const, revision: 'committed-track', localUri: 'file:///committed.m4a' };
    const replay = { snapshotToken: 7, privacyRevision: 2, direction: 'oldest-first' as const, soundtrack, includedGroupKeys: ['normal', 'card-only'], previewSourceRefs: ['opaque-first', 'opaque-second'], groups: [
      { key: 'normal', label: 'Normal trip', inferred: true, eligible: true, orderCertain: true },
      { key: 'card-only', label: 'Card-only trip', inferred: true, eligible: true, orderCertain: true },
    ], memories: [
      { key: 'first', groupKey: 'normal', kind: 'photo' as const, available: true, eligible: true },
      { key: 'second', groupKey: 'normal', kind: 'video' as const, available: true, eligible: true },
    ] };
    const native = { ...stagedFailureRepository(async () => ({ journeys: [] })), loadReplayManifestInput: jest.fn(async () => replay) };
    const adapter = { ...adapterFor({ scope: 'full', canAskAgain: false }), resolveOwnerPreviews: jest.fn(async () => [{ uri: 'file:///first.jpg', availability: 'available' as const, kind: 'photo' as const }, { uri: 'file:///second.mp4', availability: 'available' as const, kind: 'video' as const }]) };
    const rendererSpy = jest.spyOn(munimReplayRenderer, 'render').mockImplementation(async (manifest) => ({ uri: 'file:///subset.mp4', digest: 'synthetic', manifest }));
    const Harness = () => { access = usePhotoAccess(); return null; };
    try {
      await render(<PhotoAccessProvider adapter={adapter} repository={emptyRepository} reconstructionRepository={native}><Harness /></PhotoAccessProvider>);
      await waitFor(() => expect(access.privateRecord.state).toBe('connected'));
      await expect(access.preparePrivateReplay(['second', 'first'], undefined, soundtrack, undefined, ['normal', 'card-only'])).resolves.toMatchObject({ uri: 'file:///subset.mp4', renderedMemoryCount: 2 });
      expect(rendererSpy).toHaveBeenCalledWith(expect.objectContaining({ groupKeys: ['normal', 'card-only'], memoryKeys: ['first', 'second'], music: soundtrack }), expect.arrayContaining([expect.objectContaining({ memoryKey: 'first' }), expect.objectContaining({ memoryKey: 'second' })]), expect.any(AbortSignal), undefined);
    } finally { rendererSpy.mockRestore(); }
  });

  it('refreshes every selected trip’s committed media instead of trusting a bounded Share-screen media list', async () => {
    let access!: ReturnType<typeof usePhotoAccess>;
    const replay = { snapshotToken: 7, privacyRevision: 2, direction: 'oldest-first' as const, includedGroupKeys: ['first-trip', 'later-trip'], previewSourceRefs: ['opaque-first', 'opaque-later'], groups: [
      { key: 'first-trip', label: 'First trip', inferred: true, eligible: true, orderCertain: true },
      { key: 'later-trip', label: 'Later trip', inferred: true, eligible: true, orderCertain: true },
    ], memories: [
      { key: 'first-memory', groupKey: 'first-trip', kind: 'photo' as const, available: true, eligible: true },
      { key: 'later-memory', groupKey: 'later-trip', kind: 'video' as const, available: true, eligible: true },
    ] };
    const native = { ...stagedFailureRepository(async () => ({ journeys: [] })), loadReplayManifestInput: jest.fn(async () => replay) };
    const adapter = { ...adapterFor({ scope: 'full', canAskAgain: false }), resolveOwnerPreviews: jest.fn(async () => [
      { uri: 'file:///first.jpg', availability: 'available' as const, kind: 'photo' as const },
      { uri: 'file:///later.mp4', availability: 'available' as const, kind: 'video' as const },
    ]) };
    const rendererSpy = jest.spyOn(munimReplayRenderer, 'render').mockImplementation(async (manifest) => ({ uri: 'file:///subset.mp4', digest: 'synthetic', manifest }));
    const Harness = () => { access = usePhotoAccess(); return null; };
    try {
      await render(<PhotoAccessProvider adapter={adapter} repository={emptyRepository} reconstructionRepository={native}><Harness /></PhotoAccessProvider>);
      await waitFor(() => expect(access.privateRecord.state).toBe('connected'));
      // The Share screen had resolved only the first trip while the provider's
      // fresh source-of-truth manifest still contains media for both trips.
      await access.preparePrivateReplay(['first-memory'], undefined, undefined, undefined, ['first-trip', 'later-trip']);
      expect(rendererSpy).toHaveBeenCalledWith(expect.objectContaining({ groupKeys: ['first-trip', 'later-trip'], memoryKeys: ['first-memory', 'later-memory'] }), expect.arrayContaining([
        expect.objectContaining({ memoryKey: 'first-memory', groupKey: 'first-trip' }),
        expect.objectContaining({ memoryKey: 'later-memory', groupKey: 'later-trip' }),
      ]), expect.any(AbortSignal), undefined);
    } finally { rendererSpy.mockRestore(); }
  });

  it('rejects selected media whose committed group was not selected', async () => {
    let access!: ReturnType<typeof usePhotoAccess>;
    const replay = { snapshotToken: 7, privacyRevision: 2, includedGroupKeys: ['normal', 'card-only'], previewSourceRefs: ['opaque'], groups: [{ key: 'normal', label: 'Normal', inferred: true, eligible: true, orderCertain: true }, { key: 'card-only', label: 'Card', inferred: true, eligible: true, orderCertain: true }], memories: [{ key: 'normal-memory', groupKey: 'normal', kind: 'photo' as const, available: true, eligible: true }] };
    const native = { ...stagedFailureRepository(async () => ({ journeys: [] })), loadReplayManifestInput: jest.fn(async () => replay) };
    const adapter = { ...adapterFor({ scope: 'full', canAskAgain: false }), resolveOwnerPreviews: jest.fn(async () => [{ uri: 'file:///normal.jpg', availability: 'available' as const, kind: 'photo' as const }]) };
    const Harness = () => { access = usePhotoAccess(); return null; };
    await render(<PhotoAccessProvider adapter={adapter} repository={emptyRepository} reconstructionRepository={native}><Harness /></PhotoAccessProvider>);
    await waitFor(() => expect(access.privateRecord.state).toBe('connected'));
    await expect(access.preparePrivateReplay(['normal-memory'], undefined, undefined, undefined, ['card-only'])).rejects.toMatchObject({ stage: 'REPLAY_STALE' });
  });

  it('refreshes photo permission before export and blocks a stale scope before touching the handoff artifact', async () => {
    let access!: ReturnType<typeof usePhotoAccess>;
    const inspect = jest.fn(async (): Promise<PermissionSnapshot> => ({ scope: 'full', canAskAgain: false }));
    const replay = { snapshotToken: 7, privacyRevision: 2, includedGroupKeys: ['trip'], previewSourceRefs: ['opaque'], groups: [{ key: 'trip', label: 'Trip', inferred: true, eligible: true, orderCertain: true }], memories: [{ key: 'memory', groupKey: 'trip', kind: 'photo' as const, available: true, eligible: true }] };
    const adapter = { ...adapterFor({ scope: 'full', canAskAgain: false }), inspect, resolveOwnerPreviews: jest.fn(async () => [{ uri: 'file:///memory.jpg', availability: 'available' as const, kind: 'photo' as const }]) };
    const Harness = () => { access = usePhotoAccess(); return null; };
    const file = jest.spyOn(FileSystem, 'getInfoAsync');
    const rendererSpy = jest.spyOn(munimReplayRenderer, 'render').mockImplementation(async (manifest) => ({ uri: 'file:///private-subset.mp4', digest: 'synthetic', manifest }));
    const handoff = jest.spyOn(replayRenderer, 'shareReplayArtifact');
    try {
      const native = { ...stagedFailureRepository(async () => ({ journeys: [] })), loadReplayManifestInput: jest.fn(async () => replay) };
      await render(<PhotoAccessProvider adapter={adapter} repository={emptyRepository} reconstructionRepository={native}><Harness /></PhotoAccessProvider>);
      await waitFor(() => expect(access.privateRecord.state).toBe('connected'));
      await access.preparePrivateReplay(['memory'], undefined, undefined, undefined, ['trip']);
      file.mockClear();
      inspect.mockResolvedValue({ scope: 'denied', canAskAgain: false });
      await expect(access.exportPrivateReplay('file:///private-subset.mp4')).rejects.toMatchObject({ stage: 'REPLAY_STALE' });
      expect(file).not.toHaveBeenCalled();
      expect(handoff).not.toHaveBeenCalled();
    } finally { file.mockRestore(); rendererSpy.mockRestore(); handoff.mockRestore(); }
  });

  it('maps the screen-first Replay manifest read failure to local access', async () => {
    let access!: ReturnType<typeof usePhotoAccess>;
    const native = { ...stagedFailureRepository(async () => ({ journeys: [] })), loadReplayManifestInput: jest.fn(async () => { throw new Error('released native handle'); }) };
    const Harness = () => { access = usePhotoAccess(); return null; };
    await render(<PhotoAccessProvider adapter={adapterFor({ scope: 'full', canAskAgain: false })} repository={emptyRepository} reconstructionRepository={native}><Harness /></PhotoAccessProvider>);
    await waitFor(() => expect(access.privateRecord.state).toBe('connected'));
    await expect(access.loadReplayManifestInput()).rejects.toMatchObject({ stage: 'REPLAY_ACCESS' });
  });

  it.each(['manifest', 'previews', 'soundtrack', 'eligibility'] as const)('locates account Replay %s failure with one redacted action correlation', async (boundary) => {
    let access!: ReturnType<typeof usePhotoAccess>;
    const sentinel = 'synthetic-private-replay-sentinel';
    const replay = { snapshotToken: 7, privacyRevision: 2, previewSourceRefs: ['account:80000000-0000-4000-8000-000000000001'], groups: [{ key: 'trip', label: 'Trip', inferred: true, eligible: true, orderCertain: true }], memories: [{ key: 'memory', groupKey: 'trip', kind: 'photo' as const, available: true, eligible: true }] };
    const native = { ...stagedFailureRepository(async () => ({ journeys: [] })), loadReplayManifestInput: jest.fn(async () => { if (boundary === 'manifest') throw new Error(`database is locked ${sentinel}`); return replay; }) };
    const adapter = { ...adapterFor(null), accountAuthorized: async () => true,
      resolveOwnerPreviews: jest.fn(async () => { if (boundary === 'previews') throw new Error(sentinel); return [{ uri: boundary === 'eligibility' ? null : 'file:///private.jpg', availability: boundary === 'eligibility' ? 'unavailable' as const : 'available' as const, kind: 'photo' as const }]; }),
      resolveReplaySoundtrack: jest.fn(async (track: import('@/replay/types').ReplaySoundtrack) => { if (boundary === 'soundtrack') throw Object.assign(new Error(sentinel), { reason: 'MEDIA_ACCESS' }); return track; }),
    };
    const Harness = () => { access = usePhotoAccess(); return null; };
    const log = jest.spyOn(console, 'info').mockImplementation(() => {});
    try {
      await render(<PhotoAccessProvider adapter={adapter} repository={emptyRepository} reconstructionRepository={native}><Harness /></PhotoAccessProvider>);
      await waitFor(() => expect(access.privateRecord.state).toBe('connected'));
      await expect(access.preparePrivateReplay(undefined, undefined, undefined, undefined, undefined, 'local_replay_diagnostic')).rejects.toMatchObject({ stage: 'REPLAY_ACCESS', diagnosticRecorded: true });
      const events = log.mock.calls.map(([, event]) => event).filter(event => event.operation === 'REPLAY_RENDER');
      const failures = events.filter(event => event.reasonCode !== 'START');
      expect(failures).toEqual([expect.objectContaining({ stage: `REPLAY_${boundary === 'previews' ? 'PREVIEWS' : boundary.toUpperCase()}`, reasonCode: boundary === 'manifest' ? 'DATABASE_BUSY' : boundary === 'soundtrack' ? 'MEDIA_ACCESS' : boundary === 'eligibility' ? 'MEDIA_UNAVAILABLE' : 'UNKNOWN', correlationId: 'local_replay_diagnostic' })]);
      expect(events.every(event => event.correlationId === 'local_replay_diagnostic' && Object.keys(event).length === 6)).toBe(true);
      expect(JSON.stringify(log.mock.calls)).not.toContain(sentinel);
    } finally { log.mockRestore(); }
  });

  it('retains stale lifecycle and typed renderer failures without duplicate or private error diagnostics', () => {
    const log = jest.spyOn(console, 'info').mockImplementation(() => {});
    try {
      const diagnostic = replayPreparationDiagnostics('local_replay_lifecycle');
      diagnostic.enter('REPLAY_ELIGIBILITY');
      const stale = diagnostic.failure(new replayRenderer.ReplayPreparationError('REPLAY_STALE'));
      expect(diagnostic.failure(stale)).toBe(stale);
      diagnostic.enter('REPLAY_ENCODE');
      diagnostic.failure(new replayRenderer.ReplayPreparationError('REPLAY_DECODE'));
      const terminal = log.mock.calls.map(([, event]) => event).filter(event => event.reasonCode !== 'START');
      expect(terminal).toEqual([
        expect.objectContaining({ operation: 'REPLAY_RENDER', stage: 'REPLAY_ELIGIBILITY', reasonCode: 'SKIPPED', durableOutcome: 'skipped', retryable: false, correlationId: 'local_replay_lifecycle' }),
        expect.objectContaining({ operation: 'REPLAY_RENDER', stage: 'REPLAY_DECODE', reasonCode: 'UNKNOWN', correlationId: 'local_replay_lifecycle' }),
      ]);
    } finally { log.mockRestore(); }
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
  it('keeps concurrent Atlas detail previews publishable until the private lifecycle changes', async () => {
    let access!: ReturnType<typeof usePhotoAccess>;
    let resolveFirst!: (value: { detail: never; previewSourceRefs: string[]; snapshotToken: number }) => void;
    let resolveSecond!: (value: { detail: never; previewSourceRefs: string[]; snapshotToken: number }) => void;
    const first = new Promise<{ detail: never; previewSourceRefs: string[]; snapshotToken: number }>((resolve) => { resolveFirst = resolve; });
    const second = new Promise<{ detail: never; previewSourceRefs: string[]; snapshotToken: number }>((resolve) => { resolveSecond = resolve; });
    const native = {
      ...stagedFailureRepository(async () => ({ journeys: [] })),
      loadJourneyDetail: jest.fn((id: string, stage?: (value: 'PREVIEW_SUPPORT_READ') => void) => {
        if (id === 'synthetic-failure') {
          stage?.('PREVIEW_SUPPORT_READ');
          return Promise.reject(new Error('Row too big to fit into CursorWindow SYNTHETIC_PRIVATE_DETAIL'));
        }
        return id === 'first' ? first : second;
      }),
    };
    const adapter = {
      ...adapterFor({ scope: 'full', canAskAgain: false }),
      resolveOwnerPreviews: jest.fn(async (refs: (string | null)[]) => refs.map((ref) => ({ uri: `file:///${ref}.jpg`, availability: 'available' as const, kind: 'photo' as const }))),
    };
    const Harness = () => { access = usePhotoAccess(); return null; };
    await render(<PhotoAccessProvider adapter={adapter} repository={emptyRepository} reconstructionRepository={native}><Harness /></PhotoAccessProvider>);
    await waitFor(() => expect(access.privateRecord.state).toBe('connected'));
    const pending = Promise.all([access.loadJourneyDetail('first'), access.loadJourneyDetail('second')]);
    await waitFor(() => expect(native.loadJourneyDetail).toHaveBeenCalledTimes(2));
    await act(async () => {
      resolveFirst({ detail: null as never, previewSourceRefs: ['first-local'], snapshotToken: 7 });
      resolveSecond({ detail: null as never, previewSourceRefs: ['second-local'], snapshotToken: 7 });
    });
    await expect(pending).resolves.toEqual([
      expect.objectContaining({ previews: [expect.objectContaining({ uri: 'file:///first-local.jpg' })] }),
      expect.objectContaining({ previews: [expect.objectContaining({ uri: 'file:///second-local.jpg' })] }),
    ]);
    const { classifyAppDiagnosticError } = jest.requireActual<typeof import('@/diagnostics/app-diagnostics')>('@/diagnostics/app-diagnostics');
    const error = await access.loadJourneyDetail('synthetic-failure').catch((failure: unknown) => failure);
    expect(error).toMatchObject({ stage: 'PREVIEW_SUPPORT_READ', message: 'Journey is no longer available.' });
    expect(classifyAppDiagnosticError(error)).toBe('ROW_LIMIT');
  });
  it('keeps concurrent Atlas cover-page previews publishable until the private lifecycle changes', async () => {
    let access!: ReturnType<typeof usePhotoAccess>;
    let resolveFirst!: (value: { items: []; previewSourceRefs: string[]; hasMore: boolean }) => void;
    let resolveSecond!: (value: { items: []; previewSourceRefs: string[]; hasMore: boolean }) => void;
    const first = new Promise<{ items: []; previewSourceRefs: string[]; hasMore: boolean }>((resolve) => { resolveFirst = resolve; });
    const second = new Promise<{ items: []; previewSourceRefs: string[]; hasMore: boolean }>((resolve) => { resolveSecond = resolve; });
    const native = {
      ...stagedFailureRepository(async () => ({ journeys: [] })),
      loadJourneyMediaPage: jest.fn((id: string) => id === 'first' ? first : second),
    };
    const adapter = {
      ...adapterFor({ scope: 'full', canAskAgain: false }),
      resolveOwnerPreviews: jest.fn(async (refs: (string | null)[]) => refs.map((ref) => ({ uri: `file:///${ref}.jpg`, availability: 'available' as const, kind: 'photo' as const }))),
    };
    const Harness = () => { access = usePhotoAccess(); return null; };
    await render(<PhotoAccessProvider adapter={adapter} repository={emptyRepository} reconstructionRepository={native}><Harness /></PhotoAccessProvider>);
    await waitFor(() => expect(access.privateRecord.state).toBe('connected'));
    const pending = Promise.all([access.loadJourneyMediaPage?.('first', 7, 0), access.loadJourneyMediaPage?.('second', 7, 0)]);
    await waitFor(() => expect(native.loadJourneyMediaPage).toHaveBeenCalledTimes(2));
    await act(async () => {
      resolveFirst({ items: [], previewSourceRefs: ['first-page-local'], hasMore: false });
      resolveSecond({ items: [], previewSourceRefs: ['second-page-local'], hasMore: false });
    });
    await expect(pending).resolves.toEqual([
      expect.objectContaining({ previews: [expect.objectContaining({ uri: 'file:///first-page-local.jpg' })] }),
      expect.objectContaining({ previews: [expect.objectContaining({ uri: 'file:///second-page-local.jpg' })] }),
    ]);
  });
  it('invalidates an in-flight Atlas cover page when the private lifecycle changes', async () => {
    let access!: ReturnType<typeof usePhotoAccess>;
    let resolvePage!: (value: { items: []; previewSourceRefs: string[]; hasMore: boolean }) => void;
    const page = new Promise<{ items: []; previewSourceRefs: string[]; hasMore: boolean }>((resolve) => { resolvePage = resolve; });
    const native = {
      ...stagedFailureRepository(async () => ({ journeys: [] })),
      loadJourneyMediaPage: jest.fn(() => page),
    };
    const Harness = () => { access = usePhotoAccess(); return null; };
    await render(<PhotoAccessProvider adapter={adapterFor({ scope: 'full', canAskAgain: false })} repository={emptyRepository} reconstructionRepository={native}><Harness /></PhotoAccessProvider>);
    await waitFor(() => expect(access.privateRecord.state).toBe('connected'));
    const pending = access.loadJourneyMediaPage?.('trip', 7, 0);
    const rejected = expect(pending).rejects.toMatchObject({ message: 'Journey is no longer available.' });
    await waitFor(() => expect(native.loadJourneyMediaPage).toHaveBeenCalled());
    await act(async () => { await access.privateRecordController.disconnect(); resolvePage({ items: [], previewSourceRefs: [], hasMore: false }); });
    await rejected;
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
    const retryEvents = diagnostic.mock.calls.map(([, event]) => event).filter((event) => event.operation === 'ATLAS_REVEAL_RETRY');
    expect(retryEvents).toEqual([expect.objectContaining({ operation: 'ATLAS_REVEAL_RETRY', reasonCode: 'START', stage: null, retryable: false, durableOutcome: 'unchanged' }), expect.objectContaining({ operation: 'ATLAS_REVEAL_RETRY', reasonCode: 'ACCESS', stage: null, retryable: true, durableOutcome: 'restricted' })]);
    expect(retryEvents[0].correlationId).toBe(retryEvents[1].correlationId);
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
  it('reinspects limited permission on foreground without a counting prepass', async () => {
    let activeListener: ((state: AppStateStatus) => void) | undefined;
    const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => { activeListener = listener; return { remove: jest.fn() }; });
    const readPage = jest.fn(async () => 4);
    const adapter = { ...adapterFor({ scope: 'limited', canAskAgain: false }), readPage };
    try {
      const view = await render(<PhotoAccessProvider adapter={adapter} repository={emptyRepository}><ImportScreen /></PhotoAccessProvider>);
      await fireEvent.press(view.getByRole('button', { name: 'Privacy & details' }));
      await waitFor(() => expect(view.getByText(/Limited photo-library access granted/)).toBeOnTheScreen());
      await act(async () => { activeListener?.('active'); });
      expect(readPage).not.toHaveBeenCalled();
    } finally { spy.mockRestore(); }
  });

  it('retains an independent picker and recheck when library inspection is unavailable', async () => {
    const unavailable = await render(<PhotoAccessProvider adapter={adapterFor(null)} repository={emptyRepository}><ImportScreen /></PhotoAccessProvider>);
    await fireEvent.press(unavailable.getByRole('button', { name: 'Privacy & details' }));
    await waitFor(() => expect(unavailable.getByText(/Native photo-library access is unavailable/)).toBeOnTheScreen());
    expect(unavailable.getByRole('button', { name: 'Choose some photos' })).toBeOnTheScreen();
    expect(unavailable.getByRole('button', { name: 'Recheck photo access' })).toBeOnTheScreen();
    await unavailable.unmount();

    const blocked = await render(<PhotoAccessProvider adapter={adapterFor({ scope: 'unasked', canAskAgain: false })} repository={emptyRepository}><ImportScreen /></PhotoAccessProvider>);
    await waitFor(() => expect(blocked.getByRole('button', { name: 'Choose some photos' })).toBeOnTheScreen());
    expect(blocked.queryByRole('button', { name: 'Allow full photo library' })).toBeNull();
    expect(blocked.getByRole('button', { name: 'Choose some photos' })).toBeOnTheScreen();
    await blocked.unmount();
  });

  it('keeps setup recoverable when private intent storage is unavailable', async () => {
    const view = await render(<PhotoAccessProvider adapter={adapterFor({ scope: 'full', canAskAgain: false })} repository={emptyRepository}><ImportScreen /></PhotoAccessProvider>);
    await fireEvent.press(view.getByRole('button', { name: 'Use photo library' }));
    await waitFor(() => expect(view.getByText("Couldn't start your Atlas. Try again.")).toBeOnTheScreen());
    expect(view.queryByRole('button', { name: 'Start metadata import' })).toBeNull();
  });

  it('keeps explicit local import and Atlas recovery controls available after a recoverable failure', async () => {
    const repository: ImportRepository = { ...emptyRepository, loadCoverage: async () => ({ scope: 'full', nextOffset: 0, scanned: 1, geotagged: 1, unavailable: 0, status: 'paused' }) };
    const importView = await render(<PhotoAccessProvider adapter={adapterFor({ scope: 'full', canAskAgain: false })} repository={repository}><ImportScreen /></PhotoAccessProvider>);
    await waitFor(() => expect(importView.getByRole('button', { name: 'Use photo library' })).toBeOnTheScreen());
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
