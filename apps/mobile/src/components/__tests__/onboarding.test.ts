import { PhotoAccessController } from '@/photo-access/controller';
import type { PhotoAccessAdapter } from '@/photo-access/types';
import type { ImportRepository } from '@/import-record';
import type { PreparationIntent } from '@/import-record/types';
import * as SecureStore from 'expo-secure-store';
import { readPresentation, savePresentation } from '@/onboarding/presentation';

jest.mock('expo-secure-store', () => {
  let value: string | null = null;
  return { getItemAsync: jest.fn(async () => value), setItemAsync: jest.fn(async (_key: string, next: string) => { value = next; }) };
});

function harness() {
  let intent: PreparationIntent | null = null;
  const repository: ImportRepository = {
    getCheckpoint: jest.fn(async () => null), loadCoverage: jest.fn(async () => null), commitPage: jest.fn(async () => {}),
    getPrivateRecordLifecycle: jest.fn(async () => ({ state: 'connected' as const })),
    connectPrivateRecord: jest.fn(async () => {}), disconnectPrivateRecord: async () => {}, deleteLocalHistory: async () => {}, saveCorrectionOverlay: async () => {},
    loadPreparationIntent: jest.fn(async () => intent), savePreparationIntent: jest.fn(async (next) => { intent = next; }),
  };
  const adapter: PhotoAccessAdapter = {
    inspect: jest.fn(async () => ({ scope: 'full' as const, canAskAgain: false })), request: jest.fn(async () => null),
    readPage: jest.fn(async () => 0), readMetadataPage: jest.fn(async () => []), readSelectedMetadata: jest.fn(async () => []),
    manageLimited: async () => {}, select: jest.fn(async () => ({ canceled: false, count: 1, missingAssetIds: 0, stableAssetIds: ['synthetic-selection'] })),
  };
  const completed = jest.fn(async () => true);
  const controller = new PhotoAccessController(adapter, () => {}, () => {}, repository, completed);
  return { controller, repository, adapter, completed, intent: () => intent };
}

describe('durable photo choice handoff', () => {
  beforeEach(() => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
  });
  it('offers the development reveal only for a fresh admitted full-library preparation in this session', async () => {
    const oldGate = process.env.EXPO_PUBLIC_TRAVEL_LIFE_RECOGNIZABLE_REVEAL;
    process.env.EXPO_PUBLIC_TRAVEL_LIFE_RECOGNIZABLE_REVEAL = 'true';
    try {
      const fresh = harness();
      expect(fresh.controller.hasFirstRecognizableReveal).toBe(false);
      expect(await fresh.controller.choosePhotos('library')).toBe(true);
      await fresh.controller.whenImportIdle();
      expect(fresh.controller.hasFirstRecognizableReveal).toBe(true);
      fresh.controller.dismissFirstRecognizableReveal();
      expect(fresh.controller.hasFirstRecognizableReveal).toBe(false);
      const restarted = new PhotoAccessController(fresh.adapter, () => {}, () => {}, fresh.repository, fresh.completed);
      await restarted.resumePreparation();
      expect(restarted.hasFirstRecognizableReveal).toBe(false);

      const returning = harness();
      returning.repository.hasEstablishedHistory = async () => true;
      await returning.controller.choosePhotos('library');
      await returning.controller.whenImportIdle();
      expect(returning.controller.hasFirstRecognizableReveal).toBe(false);

      const selected = harness();
      await selected.controller.choosePhotos('selected');
      await selected.controller.whenImportIdle();
      expect(selected.controller.hasFirstRecognizableReveal).toBe(false);
    } finally {
      if (oldGate === undefined) delete process.env.EXPO_PUBLIC_TRAVEL_LIFE_RECOGNIZABLE_REVEAL;
      else process.env.EXPO_PUBLIC_TRAVEL_LIFE_RECOGNIZABLE_REVEAL = oldGate;
    }
  });
  it('imports library once without a count prepass or second confirmation', async () => {
    const h = harness();
    expect(await h.controller.choosePhotos('library')).toBe(true);
    await h.controller.whenImportIdle();
    expect(h.adapter.readPage).not.toHaveBeenCalled();
    expect(h.adapter.readMetadataPage).toHaveBeenCalledTimes(1);
    expect(h.completed).toHaveBeenCalledTimes(1);
    expect(h.intent()?.phase).toBe('complete');
  });
  it('uses only exact selected handles even with full library permission', async () => {
    const h = harness();
    await h.controller.choosePhotos('selected'); await h.controller.whenImportIdle();
    expect(h.adapter.readMetadataPage).not.toHaveBeenCalled();
    expect(h.adapter.readSelectedMetadata).toHaveBeenCalledWith(['synthetic-selection']);
  });
  it('cancellation creates no intent or source read', async () => {
    const h = harness();
    (h.adapter.select as jest.Mock).mockResolvedValue({ canceled: true });
    expect(await h.controller.choosePhotos('selected')).toBe(false);
    expect(h.repository.savePreparationIntent).not.toHaveBeenCalled();
    expect(h.adapter.readMetadataPage).not.toHaveBeenCalled();
  });
  it('coalesces two choices while intent is being saved', async () => {
    const h = harness();
    const a = h.controller.choosePhotos('library'); const b = h.controller.choosePhotos('selected');
    await Promise.all([a, b]); await h.controller.whenImportIdle();
    expect(h.adapter.select).not.toHaveBeenCalled();
    expect(h.adapter.readMetadataPage).toHaveBeenCalledTimes(1);
  });
  it('never admits native photo work into an account replica', async () => {
    const h = harness(); h.adapter.accountAuthorized = async () => true;
    expect(await h.controller.choosePhotos('library')).toBe(false);
    expect(h.adapter.inspect).not.toHaveBeenCalled();
  });
  it('keeps an explicit pause through controller recreation and foreground events', async () => {
    const h = harness();
    let release!: (value: []) => void;
    (h.adapter.readMetadataPage as jest.Mock).mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    await h.controller.choosePhotos('library');
    await new Promise((resolve) => setTimeout(resolve, 0));
    await h.controller.pausePreparation(); release([]); await h.controller.whenImportIdle();
    const next = new PhotoAccessController(h.adapter, () => {}, () => {}, h.repository, h.completed);
    await next.resumePreparation(); await next.resumePreparation();
    expect(next.preparation).toBe('paused');
    expect(next.isBusy).toBe(false);
    expect(h.adapter.readMetadataPage).toHaveBeenCalledTimes(1);
  });

  it('resolves fresh, started, legacy manual, disconnected and deleted records without source enumeration', async () => {
    const h = harness();
    expect(await h.controller.resolveEntry()).toBe('welcome');
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify({ version: 1, disposition: 'started', updatesOffer: false }));
    expect(await h.controller.resolveEntry()).toBe('access');
    h.repository.hasEstablishedHistory = async () => true;
    expect(await h.controller.resolveEntry()).toBe('atlas');
    h.repository.hasEstablishedHistory = async () => false;
    for (const state of ['disconnected', 'deleted']) {
      (h.repository.getPrivateRecordLifecycle as jest.Mock).mockResolvedValue({ state });
      expect(await h.controller.resolveEntry()).toBe('atlas');
    }
    expect(h.adapter.readMetadataPage).not.toHaveBeenCalled();
    expect(h.repository.connectPrivateRecord).not.toHaveBeenCalled();
  });

  it.each(['null', '[]', '{bad', '{"version":99}'])('rejects corrupt marker %s rather than showing fresh setup', async (raw) => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(raw);
    const log = jest.spyOn(console, 'info').mockImplementation(() => {});
    try {
      await expect(harness().controller.resolveEntry()).rejects.toThrow("Couldn't open your Atlas.");
      expect(log.mock.calls.some(([, e]) => e.operation === 'ONBOARDING_ENTRY' && e.stage === 'ENTRY_READ' && e.reasonCode === 'SCHEMA')).toBe(true);
    } finally { log.mockRestore(); }
  });

  it('reconciles lost intent acknowledgement before starting exactly one run', async () => {
    const h = harness();
    const save = h.repository.savePreparationIntent!;
    (h.repository.savePreparationIntent as jest.Mock).mockImplementationOnce(async (intent) => { await save(intent); throw new Error('synthetic lost acknowledgement'); });
    expect(await h.controller.choosePhotos('library')).toBe(true);
    await h.controller.whenImportIdle();
    expect(h.adapter.readMetadataPage).toHaveBeenCalledTimes(1);
  });

  it('does not read photos when intent acknowledgement cannot be reconciled and redacts native content', async () => {
    const h = harness(); const sentinel = 'synthetic-secret-location-path';
    (h.repository.savePreparationIntent as jest.Mock).mockRejectedValue(new Error(`no such table ${sentinel}`));
    const log = jest.spyOn(console, 'info').mockImplementation(() => {});
    try {
      expect(await h.controller.choosePhotos('library')).toBe(false);
      expect(h.adapter.readMetadataPage).not.toHaveBeenCalled();
      expect(log.mock.calls).toEqual(expect.arrayContaining([[expect.any(String), expect.objectContaining({ operation: 'ONBOARDING_SETUP', stage: 'INTENT_SAVE', reasonCode: 'SCHEMA', durableOutcome: 'unknown' })]]));
      expect(JSON.stringify(log.mock.calls)).not.toContain(sentinel);
      expect(h.controller.snapshot.message).not.toContain(sentinel);
    } finally { log.mockRestore(); }
  });

  it('preserves the choice correlation through import failure and exposes no raw native payload', async () => {
    const h = harness(); const sentinel = 'synthetic-credential-coordinate';
    (h.adapter.readMetadataPage as jest.Mock).mockRejectedValue(new Error(`constraint failed ${sentinel}`));
    const log = jest.spyOn(console, 'info').mockImplementation(() => {});
    try {
      await h.controller.choosePhotos('library'); await h.controller.whenImportIdle();
      const events = log.mock.calls.map(([, e]) => e);
      const start = events.find((e) => e.operation === 'ONBOARDING_RUN' && e.reasonCode === 'START');
      const failure = events.filter((e) => e.operation === 'METADATA_IMPORT' && e.stage === 'IMPORT_READ');
      expect(failure).toHaveLength(1);
      expect(failure[0]).toMatchObject({ reasonCode: 'CONSTRAINT', correlationId: start.correlationId });
      expect(JSON.stringify(events)).not.toContain(sentinel);
    } finally { log.mockRestore(); }
  });

  it('retains an unknown pause outcome until a durable marker can be read', async () => {
    const h = harness();
    await h.controller.choosePhotos('library'); await h.controller.whenImportIdle();
    (h.repository.savePreparationIntent as jest.Mock).mockRejectedValue(new Error('synthetic write failure'));
    (h.repository.loadPreparationIntent as jest.Mock).mockRejectedValue(new Error('synthetic read failure'));
    await h.controller.pausePreparation();
    expect(h.controller.preparation).toBe('checking');
  });

  it('Check again reconciles a lost pause acknowledgement without resuming saved work', async () => {
    const h = harness();
    await h.controller.choosePhotos('library'); await h.controller.whenImportIdle();
    const save = h.repository.savePreparationIntent!;
    (h.repository.savePreparationIntent as jest.Mock).mockImplementationOnce(async (intent) => { await save(intent); throw new Error('synthetic lost pause acknowledgement'); });
    (h.repository.loadPreparationIntent as jest.Mock).mockRejectedValueOnce(new Error('synthetic unavailable readback'));
    await h.controller.pausePreparation();
    expect(h.controller.preparation).toBe('checking');
    h.completed.mockClear();
    await h.controller.resumePreparation(true); await h.controller.whenImportIdle();
    expect(h.controller.preparation).toBe('paused');
    expect(h.completed).not.toHaveBeenCalled();
  });

  it('retries only durable publication after a failed read without reimporting', async () => {
    const h = harness();
    await h.repository.savePreparationIntent!({ version: 1, id: 'synthetic-run', scope: 'full', selectedIds: [], missingIds: 0, phase: 'publishing' });
    await h.controller.resumePreparation(true); await h.controller.whenImportIdle();
    expect(h.adapter.readMetadataPage).not.toHaveBeenCalled();
    expect(h.completed).toHaveBeenCalledWith(expect.any(String), true, expect.any(Function), expect.any(Function));
  });

  it('persists Updates Later independently of first-run disposition', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify({ version: 1, disposition: 'atlas', updatesOffer: false }));
    await savePresentation(undefined, true);
    expect(SecureStore.setItemAsync).toHaveBeenLastCalledWith(expect.any(String), JSON.stringify({ version: 1, disposition: 'atlas', updatesOffer: true }));
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify({ version: 1, disposition: 'atlas', updatesOffer: true }));
    expect((await readPresentation())?.updatesOffer).toBe(true);
  });

  it('keeps exact presentation failure attribution without duplicate outer diagnostics', async () => {
    const h = harness();
    h.repository.hasEstablishedHistory = async () => true;
    (SecureStore.setItemAsync as jest.Mock).mockRejectedValue(new Error('database is locked synthetic-sensitive-marker'));
    const log = jest.spyOn(console, 'info').mockImplementation(() => {});
    try {
      await expect(h.controller.resolveEntry()).rejects.toThrow("Couldn't open your Atlas.");
      expect(log.mock.calls.map(([, e]) => e)).toEqual([expect.objectContaining({ operation: 'ONBOARDING_ENTRY', stage: 'ENTRY_MIGRATE', reasonCode: 'DATABASE_BUSY', durableOutcome: 'unknown' })]);
      log.mockClear();
      await expect(savePresentation(undefined, true)).rejects.toThrow('Could not save setup progress.');
      expect(log.mock.calls.map(([, e]) => e)).toEqual([expect.objectContaining({ operation: 'ONBOARDING_UPDATES', stage: 'UPDATE_PREFERENCE', reasonCode: 'DATABASE_BUSY' })]);
      expect(JSON.stringify(log.mock.calls)).not.toContain('synthetic-sensitive-marker');
    } finally { log.mockRestore(); }
  });

  it.each([
    ['inspect', 'library', 'ACCESS_INSPECT'],
    ['request', 'library', 'ACCESS_REQUEST'],
    ['select', 'selected', 'PICKER_SELECT'],
  ] as const)('classifies %s failure at its own boundary without reading photos', async (method, mode, stage) => {
    const h = harness();
    if (method === 'request') (h.adapter.inspect as jest.Mock).mockResolvedValue({ scope: 'unasked', canAskAgain: true });
    (h.adapter[method] as jest.Mock).mockRejectedValue(new Error('synthetic-sensitive-native-path'));
    const log = jest.spyOn(console, 'info').mockImplementation(() => {});
    try {
      expect(await h.controller.choosePhotos(mode)).toBe(false);
      const failures = log.mock.calls.map(([, e]) => e).filter((e) => e.reasonCode === 'UNKNOWN');
      expect(failures).toHaveLength(1);
      expect(failures[0]).toMatchObject({ operation: 'ONBOARDING_SETUP', stage, durableOutcome: 'unchanged' });
      expect(JSON.stringify(log.mock.calls)).not.toContain('synthetic-sensitive-native-path');
      expect(h.adapter.readMetadataPage).not.toHaveBeenCalled();
      expect(h.adapter.readSelectedMetadata).not.toHaveBeenCalled();
    } finally { log.mockRestore(); }
  });

  it('continues an exact selected intent after relaunch without library enumeration', async () => {
    const h = harness();
    await h.repository.savePreparationIntent!({ version: 1, id: 'synthetic-resume', scope: 'selected', selectedIds: ['synthetic-only'], missingIds: 0, phase: 'queued' });
    await h.controller.resumePreparation(); await h.controller.whenImportIdle();
    expect(h.adapter.readSelectedMetadata).toHaveBeenCalledWith(['synthetic-only']);
    expect(h.adapter.readMetadataPage).not.toHaveBeenCalled();
  });

  it('requires a new explicit selection when persisted handles are missing', async () => {
    const h = harness();
    await h.repository.savePreparationIntent!({ version: 1, id: 'synthetic-resume', scope: 'selected', selectedIds: [], missingIds: 1, phase: 'queued' });
    await h.controller.resumePreparation();
    expect(h.controller.preparation).toBe('blocked');
    expect(h.adapter.readMetadataPage).not.toHaveBeenCalled();
    expect(h.adapter.readSelectedMetadata).not.toHaveBeenCalled();
  });

  it('blocks changed library scope on resume without widening the previous grant', async () => {
    const h = harness();
    await h.repository.savePreparationIntent!({ version: 1, id: 'synthetic-resume', scope: 'limited', selectedIds: [], missingIds: 0, phase: 'queued' });
    await h.controller.resumePreparation(); await h.controller.whenImportIdle();
    expect(h.controller.preparation).toBe('blocked');
    expect(h.adapter.readMetadataPage).not.toHaveBeenCalled();
    expect(h.adapter.request).not.toHaveBeenCalled();
  });

  it('uses bounded safe read retries and stops pending retries on interruption', async () => {
    jest.useFakeTimers();
    try {
      const h = harness();
      (h.adapter.readMetadataPage as jest.Mock).mockRejectedValueOnce(new Error('released native handle')).mockRejectedValueOnce(new Error('released native handle')).mockResolvedValue([]);
      await h.controller.choosePhotos('library');
      await jest.runAllTimersAsync(); await h.controller.whenImportIdle();
      expect(h.adapter.readMetadataPage).toHaveBeenCalledTimes(3);
      const next = harness();
      (next.adapter.readMetadataPage as jest.Mock).mockRejectedValue(new Error('released native handle'));
      await next.controller.choosePhotos('library');
      await jest.advanceTimersByTimeAsync(1);
      next.controller.interrupt();
      await jest.runAllTimersAsync(); await next.controller.whenImportIdle();
      expect(next.adapter.readMetadataPage).toHaveBeenCalledTimes(1);
    } finally { jest.useRealTimers(); }
  });

  it('fences work queued behind maintenance on background interruption', async () => {
    const h = harness(); let release!: () => void;
    const controller = new PhotoAccessController(h.adapter, () => {}, () => {}, h.repository, h.completed, () => new Promise((resolve) => { release = resolve; }));
    await controller.choosePhotos('library');
    await new Promise((resolve) => setTimeout(resolve, 0));
    controller.interrupt(); release(); await controller.whenImportIdle();
    expect(h.adapter.readMetadataPage).not.toHaveBeenCalled();
    expect(h.completed).not.toHaveBeenCalled();
  });

  it('does not auto-resume while lifecycle disconnect is between stop and durable write', async () => {
    const h = harness(); let release!: (value: []) => void;
    (h.adapter.readMetadataPage as jest.Mock).mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    await h.controller.choosePhotos('library');
    await new Promise((resolve) => setTimeout(resolve, 0));
    await h.controller.stopImport();
    release([]); await h.controller.whenImportIdle();
    await h.controller.resumePreparation(); await h.controller.whenImportIdle();
    expect(h.adapter.readMetadataPage).toHaveBeenCalledTimes(1);
    expect(h.completed).not.toHaveBeenCalled();
  });

  it('retains publication phase through explicit pause and Continue', async () => {
    const h = harness();
    h.completed.mockResolvedValueOnce(false);
    await h.repository.savePreparationIntent!({ version: 1, id: 'synthetic-publishing', scope: 'full', selectedIds: [], missingIds: 0, phase: 'publishing' });
    await h.controller.resumePreparation(); await h.controller.whenImportIdle();
    await h.controller.pausePreparation();
    h.completed.mockClear();
    const next = new PhotoAccessController(h.adapter, () => {}, () => {}, h.repository, h.completed);
    await next.resumePreparation(true); await next.whenImportIdle();
    expect(h.completed).toHaveBeenCalledWith(expect.any(String), true, expect.any(Function), expect.any(Function));
    expect(h.adapter.readMetadataPage).not.toHaveBeenCalled();
  });

  it('acknowledges Continue durably before its deferred native read can begin', async () => {
    const h = harness();
    await h.repository.savePreparationIntent!({ version: 1, id: 'synthetic-continued', scope: 'full', selectedIds: [], missingIds: 0, phase: 'paused', resumePhase: 'queued' });
    let release!: (value: []) => void;
    (h.adapter.readMetadataPage as jest.Mock).mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    await h.controller.resumePreparation(true);
    expect(h.intent()?.phase).toBe('queued');
    await new Promise((resolve) => setTimeout(resolve, 0));
    h.controller.interrupt(); release([]); await h.controller.whenImportIdle();
    const next = new PhotoAccessController(h.adapter, () => {}, () => {}, h.repository, h.completed);
    await next.resumePreparation(); await next.whenImportIdle();
    expect(next.preparation).toBe('complete');
  });

  it('clears stale in-memory intent after deletion or a missing durable intent', async () => {
    const h = harness();
    await h.controller.choosePhotos('library'); await h.controller.whenImportIdle();
    h.controller.clearDeletedRecord();
    expect(h.controller.preparation).toBe('idle');
    expect(h.controller.preparationScope).toBeNull();
    const other = harness();
    await other.controller.choosePhotos('library'); await other.controller.whenImportIdle();
    (other.repository.loadPreparationIntent as jest.Mock).mockResolvedValue(null);
    await other.controller.resumePreparation();
    expect(other.controller.preparationScope).toBeNull();
    expect(other.controller.preparation).toBe('idle');
    (h.repository.loadPreparationIntent as jest.Mock).mockResolvedValue(null);
    await h.controller.resumePreparation();
    expect(h.controller.preparationScope).toBeNull();
  });

  it('attributes failed intent load and run permission inspection to exact boundaries', async () => {
    const h = harness();
    const log = jest.spyOn(console, 'info').mockImplementation(() => {});
    try {
      (h.repository.loadPreparationIntent as jest.Mock).mockRejectedValueOnce(new Error('no such table synthetic-sensitive'));
      await h.controller.resumePreparation();
      expect(log.mock.calls.map(([, e]) => e)).toContainEqual(expect.objectContaining({ operation: 'ONBOARDING_RUN', stage: 'INTENT_READ', reasonCode: 'SCHEMA' }));
      log.mockClear();
      (h.adapter.inspect as jest.Mock).mockResolvedValueOnce({ scope: 'full', canAskAgain: false }).mockRejectedValueOnce(new Error('synthetic-sensitive-native'));
      await h.controller.choosePhotos('library'); await h.controller.whenImportIdle();
      expect(log.mock.calls.map(([, e]) => e)).toContainEqual(expect.objectContaining({ operation: 'ONBOARDING_RUN', stage: 'RUN_ACCESS_INSPECT', reasonCode: 'UNKNOWN' }));
      expect(JSON.stringify(log.mock.calls)).not.toContain('synthetic-sensitive');
    } finally { log.mockRestore(); }
  });

  it('does not admit a fresh choice while a lifecycle mutation is pending', async () => {
    const h = harness();
    h.controller.setLifecyclePending(true);
    expect(await h.controller.choosePhotos('library')).toBe(false);
    expect(h.adapter.inspect).not.toHaveBeenCalled();
    expect(h.repository.savePreparationIntent).not.toHaveBeenCalled();
  });

  it('accepts the pending native picker result after its Activity backgrounds and returns', async () => {
    const h = harness(); let finish!: (value: { canceled: false; count: number; missingAssetIds: number; stableAssetIds: string[] }) => void;
    (h.adapter.select as jest.Mock).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const choice = h.controller.choosePhotos('selected');
    await new Promise((resolve) => setTimeout(resolve, 0));
    h.controller.interrupt();
    expect(h.adapter.readSelectedMetadata).not.toHaveBeenCalled();
    await h.controller.resumePreparation();
    finish({ canceled: false, count: 1, missingAssetIds: 0, stableAssetIds: ['synthetic-activity-choice'] });
    expect(await choice).toBe(true); await h.controller.whenImportIdle();
    expect(h.adapter.readSelectedMetadata).toHaveBeenCalledWith(['synthetic-activity-choice']);
    expect(h.adapter.readMetadataPage).not.toHaveBeenCalled();
  });

  it('saves a pending permission result in background but starts no reads until foreground', async () => {
    const h = harness(); let finish!: (value: { scope: 'full'; canAskAgain: false }) => void;
    (h.adapter.inspect as jest.Mock).mockResolvedValueOnce({ scope: 'unasked', canAskAgain: true });
    (h.adapter.request as jest.Mock).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const choice = h.controller.choosePhotos('library');
    await new Promise((resolve) => setTimeout(resolve, 0));
    h.controller.interrupt(); finish({ scope: 'full', canAskAgain: false });
    expect(await choice).toBe(true);
    expect(h.adapter.readMetadataPage).not.toHaveBeenCalled();
    await h.controller.resumePreparation(); await h.controller.whenImportIdle();
    expect(h.adapter.readMetadataPage).toHaveBeenCalledTimes(1);
  });

  it('invalidates a pending native choice when its provider is disposed', async () => {
    const h = harness(); let finish!: (value: { canceled: false; count: number; missingAssetIds: number; stableAssetIds: string[] }) => void;
    (h.adapter.select as jest.Mock).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const choice = h.controller.choosePhotos('selected');
    await new Promise((resolve) => setTimeout(resolve, 0));
    h.controller.dispose(); finish({ canceled: false, count: 1, missingAssetIds: 0, stableAssetIds: ['synthetic-old-provider'] });
    expect(await choice).toBe(false);
    expect(h.repository.savePreparationIntent).not.toHaveBeenCalled();
    expect(h.adapter.readSelectedMetadata).not.toHaveBeenCalled();
  });
});
