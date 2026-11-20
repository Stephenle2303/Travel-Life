import {
  createAutomaticTravelWindowDiscovery, stepTravelWindowDiscovery, travelWindowCommand,
  type AutomaticTravelWindowDiscovery, type TravelWindowProposalToken,
} from '@/travel-window/production-discovery';
import type { CaptureRecord } from '@/travel-window';
import type { ScanCursor, ScanState, TravelWindowStorage } from '@/travel-window/storage';

const mockQuery = {
  eq: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  gt: jest.fn().mockReturnThis(),
  lt: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  exeForMetadata: jest.fn(),
};
jest.mock('expo-media-library', () => ({
  Query: jest.fn(() => mockQuery),
  AssetField: { MEDIA_TYPE: 'mediaType', CREATION_TIME: 'creationTime' },
  MediaType: { IMAGE: 'image' },
}));

const KR = 540;
const VN = 420;

function fakeStorage(initial: Partial<ScanState> = {}): TravelWindowStorage & { captures: CaptureRecord[]; cursor: ScanCursor; dispositions: Map<string, 'confirmed' | 'dismissed'>; confirmedWith: Parameters<TravelWindowStorage['confirmWindow']>[] } {
  const captures = initial.captures ? [...initial.captures] : [];
  const cursor: ScanCursor = initial.cursor ? { ...initial.cursor } : { backfillCursorMillis: null, backfillComplete: false, newestCursorMillis: null };
  const dispositions = new Map<string, 'confirmed' | 'dismissed'>();
  const confirmedWith: Parameters<TravelWindowStorage['confirmWindow']>[] = [];
  return {
    captures, cursor, dispositions, confirmedWith,
    async readScanState() { return { captures: [...captures], cursor: { ...cursor } }; },
    async writeScanBatch(records, update) {
      captures.push(...records);
      if ('backfillCursorMillis' in update) cursor.backfillCursorMillis = update.backfillCursorMillis ?? null;
      if ('backfillComplete' in update) cursor.backfillComplete = Boolean(update.backfillComplete);
      if ('newestCursorMillis' in update) cursor.newestCursorMillis = update.newestCursorMillis ?? null;
    },
    async readDispositions() { return new Map(dispositions); },
    async confirmWindow(...args) { confirmedWith.push(args); dispositions.set(args[0], 'confirmed'); },
    async dismissWindow(command) { dispositions.set(command, 'dismissed'); },
  };
}

// Different months by default so a home record never interleaves with (and
// regime-breaks) a same-numbered trip day — matching the shared fixture
// convention in travel-window.test.ts.
function record(id: string, day: number, offset: number, provenance: CaptureRecord['provenance'] = 'camera', month = 6): CaptureRecord {
  return { id, capturedAtMillis: Date.UTC(2026, month - 1, day, 8, 0) - offset * 60_000, utcOffsetMinutes: offset, provenance, located: false };
}

function asset(id: string, millis: number) { return { id, creationTime: millis } as { id: string; creationTime: number | null }; }

const read = jest.fn(async (uri: string) => ({ offsetTimeOriginal: uri.includes('kr') ? '+09:00' : '+07:00', relativeDirectory: 'DCIM/Camera/' }));

describe('travelWindowCommand', () => {
  it('is stable for the same window bounds and distinct for different ones', () => {
    expect(travelWindowCommand({ startMillis: 1, endMillis: 2 })).toBe(travelWindowCommand({ startMillis: 1, endMillis: 2 }));
    expect(travelWindowCommand({ startMillis: 1, endMillis: 2 })).not.toBe(travelWindowCommand({ startMillis: 1, endMillis: 3 }));
  });
});

describe('stepTravelWindowDiscovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.exeForMetadata.mockResolvedValue([]); // safe default; tests layer mockResolvedValueOnce on top
  });

  it('on the very first call, queries newest-first with no lower bound and sets the high-water mark', async () => {
    mockQuery.exeForMetadata.mockResolvedValueOnce(Array.from({ length: 50 }, (_, i) => asset(`a${i}`, 1000 - i)));
    const storage = fakeStorage();
    const result = await stepTravelWindowDiscovery(read, storage, new AbortController().signal);
    expect(mockQuery.lt).not.toHaveBeenCalled();
    expect(mockQuery.orderBy).toHaveBeenCalledWith({ key: 'creationTime', ascending: false });
    expect(storage.cursor.newestCursorMillis).toBe(1000);
    expect(storage.cursor.backfillCursorMillis).toBe(951); // oldest of the 50 (1000 - 49)
    expect(storage.cursor.backfillComplete).toBe(true); // fewer than SCAN_BATCH_SIZE (150)
    expect(result.more).toBe(false);
  });

  it('continues backfill with a strictly-older filter on the existing cursor', async () => {
    mockQuery.exeForMetadata.mockResolvedValueOnce(Array.from({ length: 150 }, (_, i) => asset(`b${i}`, 900 - i)));
    const storage = fakeStorage({ cursor: { backfillCursorMillis: 950, backfillComplete: false, newestCursorMillis: 1000 } });
    const result = await stepTravelWindowDiscovery(read, storage, new AbortController().signal);
    expect(mockQuery.lt).toHaveBeenCalledWith('creationTime', 950);
    expect(storage.cursor.newestCursorMillis).toBe(1000); // unchanged: already established
    expect(storage.cursor.backfillComplete).toBe(false); // a full page: more may remain
    expect(result.more).toBe(true);
  });

  it('once backfill is complete, catches up on photos newer than the high-water mark, ascending', async () => {
    mockQuery.exeForMetadata.mockResolvedValueOnce([asset('new1', 1100), asset('new2', 1200)]);
    const storage = fakeStorage({ cursor: { backfillCursorMillis: 0, backfillComplete: true, newestCursorMillis: 1000 } });
    await stepTravelWindowDiscovery(read, storage, new AbortController().signal);
    expect(mockQuery.gt).toHaveBeenCalledWith('creationTime', 1000);
    expect(mockQuery.orderBy).toHaveBeenCalledWith({ key: 'creationTime', ascending: true });
    expect(storage.cursor.newestCursorMillis).toBe(1200);
  });

  it('with backfill complete and nothing new, does no native read and just re-evaluates the cache', async () => {
    mockQuery.exeForMetadata.mockResolvedValueOnce([]);
    const storage = fakeStorage({
      captures: [record('kr-1', 3, KR), record('kr-2', 3, KR)],
      cursor: { backfillCursorMillis: 0, backfillComplete: true, newestCursorMillis: 1000 },
    });
    const result = await stepTravelWindowDiscovery(read, storage, new AbortController().signal);
    expect(read).not.toHaveBeenCalled();
    expect(result.more).toBe(false);
  });

  it('surfaces a travel-looking window as a proposal, skipping windows already decided', async () => {
    mockQuery.exeForMetadata.mockResolvedValueOnce([]);
    const home = Array.from({ length: 30 }, (_, i) => record(`home-${i}`, 1 + i, VN, 'camera', 5));
    // Spread across several days (not minutes) so the window clears the
    // 20-hour minimum span the real detector requires.
    const trip = Array.from({ length: 30 }, (_, i) => record(`kr-${i}`, 3 + Math.floor(i / 5), KR));
    trip.forEach((r, i) => { r.capturedAtMillis += (i % 5) * 60_000; });
    const storage = fakeStorage({ captures: [...home, ...trip], cursor: { backfillCursorMillis: 0, backfillComplete: true, newestCursorMillis: 1000 } });
    const result = await stepTravelWindowDiscovery(read, storage, new AbortController().signal);
    expect(result.proposal).not.toBeNull();
    expect(result.proposal?.shiftMinutes).toBe(KR - VN);
    expect(result.proposal?.cameraCount).toBe(30);

    // Dismiss it, then the same cache must no longer surface it.
    await storage.dismissWindow(result.proposal!.token.command);
    const after = await stepTravelWindowDiscovery(read, storage, new AbortController().signal);
    expect(after.proposal).toBeNull();
  });

  it('returns no proposal and stops immediately once the signal is aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    mockQuery.exeForMetadata.mockResolvedValueOnce([asset('x', 1)]);
    const result = await stepTravelWindowDiscovery(read, fakeStorage(), controller.signal);
    expect(result).toEqual({ proposal: null, more: false });
    expect(read).not.toHaveBeenCalled();
  });

  it('turns a storage failure into a quiet stop, never a thrown rejection', async () => {
    const storage = fakeStorage();
    storage.readScanState = async () => { throw new Error('database is locked'); };
    await expect(stepTravelWindowDiscovery(read, storage, new AbortController().signal)).resolves.toEqual({ proposal: null, more: false });
  });
});

describe('confirm/dismiss', () => {
  it('confirm computes membership over the cached captures and persists a trip with the owner-typed name', async () => {
    const trip = Array.from({ length: 10 }, (_, i) => record(`kr-${i}`, 3, KR));
    const storage = fakeStorage({ captures: trip, cursor: { backfillCursorMillis: 0, backfillComplete: true, newestCursorMillis: 1000 } });
    const discovery = createAutomaticTravelWindowDiscovery({ read, storage, enabled: true })!;
    const token: TravelWindowProposalToken = { command: travelWindowCommand({ startMillis: trip[0].capturedAtMillis, endMillis: trip[9].capturedAtMillis }), startMillis: trip[0].capturedAtMillis, endMillis: trip[9].capturedAtMillis };
    const confirmed = await discovery.confirm(token, { name: 'Seoul', context: 'South Korea', latitude: 37.5, longitude: 127.0 }, new AbortController().signal);
    expect(confirmed).toBe(true);
    expect(storage.dispositions.get(token.command)).toBe('confirmed');
    const [, , , , place, dateRange] = storage.confirmedWith[0]!;
    expect(place).toEqual({ name: 'Seoul', context: 'South Korea', latitude: 37.5, longitude: 127.0 });
    expect(dateRange).toEqual({ startDay: new Date(trip[0].capturedAtMillis).toISOString().slice(0, 10), endDay: new Date(trip[9].capturedAtMillis).toISOString().slice(0, 10) });
  });

  it('confirm never throws out of a storage failure; it resolves false', async () => {
    const storage = fakeStorage();
    storage.confirmWindow = async () => { throw new Error('constraint failed'); };
    const discovery = createAutomaticTravelWindowDiscovery({ read, storage, enabled: true })!;
    const token: TravelWindowProposalToken = { command: 'x', startMillis: 0, endMillis: 1 };
    await expect(discovery.confirm(token, { name: 'Seoul', context: 'South Korea', latitude: 37.5, longitude: 127.0 }, new AbortController().signal)).resolves.toBe(false);
  });

  it('dismiss persists a dismissal and returns true', async () => {
    const storage = fakeStorage();
    const discovery = createAutomaticTravelWindowDiscovery({ read, storage, enabled: true })!;
    const token: TravelWindowProposalToken = { command: 'travel-window-v1:1:2', startMillis: 1, endMillis: 2 };
    await expect(discovery.dismiss(token, new AbortController().signal)).resolves.toBe(true);
    expect(storage.dispositions.get('travel-window-v1:1:2')).toBe('dismissed');
  });

  it('dismiss returns false immediately on an already-aborted signal, without writing', async () => {
    const storage = fakeStorage();
    const discovery = createAutomaticTravelWindowDiscovery({ read, storage, enabled: true })!;
    const controller = new AbortController();
    controller.abort();
    await expect(discovery.dismiss({ command: 'x', startMillis: 0, endMillis: 1 }, controller.signal)).resolves.toBe(false);
    expect(storage.dispositions.size).toBe(0);
  });
});

describe('loadPhotos', () => {
  // Strictly increasing timestamps (unlike record()'s day granularity) so
  // chronological order is unambiguous and never falls back to the id tiebreak.
  const trip: CaptureRecord[] = Array.from({ length: 14 }, (_, i) =>
    ({ id: `kr-${i}`, capturedAtMillis: Date.UTC(2026, 5, 3, 8, 0) + i * 60_000, utcOffsetMinutes: KR, provenance: 'camera', located: false }));
  const token: TravelWindowProposalToken = { command: travelWindowCommand({ startMillis: trip[0].capturedAtMillis, endMillis: trip[13].capturedAtMillis }), startMillis: trip[0].capturedAtMillis, endMillis: trip[13].capturedAtMillis };

  it('is unavailable with no resolver (owner cannot review photos without one)', async () => {
    const storage = fakeStorage({ captures: trip });
    const discovery = createAutomaticTravelWindowDiscovery({ read, storage, enabled: true })!;
    await expect(discovery.loadPhotos(token, 0, new AbortController().signal)).resolves.toBeNull();
  });

  it('pages the window photos in chronological order and reports more when a further page remains', async () => {
    const storage = fakeStorage({ captures: trip });
    const resolvePreviews = jest.fn(async (ids: (string | null)[]) => ids.map((id) => ({ uri: `uri:${id}`, availability: 'available' as const, kind: 'photo' as const })));
    const discovery = createAutomaticTravelWindowDiscovery({ read, storage, enabled: true, resolvePreviews })!;
    const page0 = await discovery.loadPhotos(token, 0, new AbortController().signal);
    expect(page0?.photos.map((p) => p.id)).toEqual(trip.slice(0, 12).map((r) => r.id));
    expect(page0?.hasMore).toBe(true);
    const page1 = await discovery.loadPhotos(token, 1, new AbortController().signal);
    expect(page1?.photos.map((p) => p.id)).toEqual(trip.slice(12, 14).map((r) => r.id));
    expect(page1?.hasMore).toBe(false);
  });

  it('drops a preview that resolved unavailable or to a video instead of failing the whole page', async () => {
    const storage = fakeStorage({ captures: trip.slice(0, 3) });
    const resolvePreviews = jest.fn(async (ids: (string | null)[]) => ids.map((id, index) =>
      index === 1 ? { uri: null, availability: 'unavailable' as const, kind: 'photo' as const } : { uri: `uri:${id}`, availability: 'available' as const, kind: 'photo' as const }));
    const discovery = createAutomaticTravelWindowDiscovery({ read, storage, enabled: true, resolvePreviews })!;
    const page = await discovery.loadPhotos(token, 0, new AbortController().signal);
    expect(page?.photos).toHaveLength(2);
  });

  it('resolves null when the resolver throws or returns the wrong count', async () => {
    const storage = fakeStorage({ captures: trip.slice(0, 3) });
    const resolvePreviews = jest.fn(async () => { throw new Error('native failure'); });
    const discovery = createAutomaticTravelWindowDiscovery({ read, storage, enabled: true, resolvePreviews })!;
    await expect(discovery.loadPhotos(token, 0, new AbortController().signal)).resolves.toBeNull();
  });

  it('resolves null for a negative or non-integer page without calling the resolver', async () => {
    const storage = fakeStorage({ captures: trip });
    const resolvePreviews = jest.fn();
    const discovery = createAutomaticTravelWindowDiscovery({ read, storage, enabled: true, resolvePreviews })!;
    await expect(discovery.loadPhotos(token, -1, new AbortController().signal)).resolves.toBeNull();
    expect(resolvePreviews).not.toHaveBeenCalled();
  });

  it('resolves null when the signal is already aborted before the resolver returns', async () => {
    const storage = fakeStorage({ captures: trip });
    const controller = new AbortController();
    const resolvePreviews = jest.fn(async (ids: (string | null)[]) => { controller.abort(); return ids.map((id) => ({ uri: `uri:${id}`, availability: 'available' as const, kind: 'photo' as const })); });
    const discovery = createAutomaticTravelWindowDiscovery({ read, storage, enabled: true, resolvePreviews })!;
    await expect(discovery.loadPhotos(token, 0, controller.signal)).resolves.toBeNull();
  });
});

describe('createAutomaticTravelWindowDiscovery', () => {
  it('is unavailable when the native reader is absent', () => {
    expect(createAutomaticTravelWindowDiscovery({ read: null, storage: fakeStorage(), enabled: true })).toBeNull();
  });

  it('carries the enabled flag through unchanged', () => {
    const discovery = createAutomaticTravelWindowDiscovery({ read, storage: fakeStorage(), enabled: false }) as AutomaticTravelWindowDiscovery;
    expect(discovery.enabled).toBe(false);
  });
});
