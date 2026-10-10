import { PhotoAccessController } from '@/photo-access/controller';
import type { PermissionSnapshot, PhotoAccessAdapter, SelectionResult } from '@/photo-access/types';
import type { ImportRepository } from '@/import-record';

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

function harness(initial: PermissionSnapshot | null = { scope: 'unasked', canAskAgain: true }, repository: ImportRepository = emptyRepository) {
  let permission = initial;
  const adapter: jest.Mocked<PhotoAccessAdapter> = {
    inspect: jest.fn(async () => permission),
    request: jest.fn(async () => permission),
    readPage: jest.fn(async (_offset: number, _limit: number) => 0),
    readMetadataPage: jest.fn(async (_offset: number, _limit: number) => []),
    readSelectedMetadata: jest.fn(async (_assetIds: string[]) => []),
    manageLimited: jest.fn(async () => {}),
    select: jest.fn(async (): Promise<SelectionResult> => ({ canceled: true })),
  };
  const controller = new PhotoAccessController(adapter, () => {}, () => {}, repository);
  return { adapter, controller, setPermission(next: PermissionSnapshot | null) { permission = next; } };
}

describe('native photo access contract', () => {
  it('does not enumerate the photo source while the private record is disconnected', async () => {
    const disconnected: ImportRepository = { ...emptyRepository, getPrivateRecordLifecycle: async () => ({ state: 'disconnected' }) };
    const h = harness({ scope: 'full', canAskAgain: false }, disconnected);

    await h.controller.countAccessible();

    expect(h.adapter.readPage).not.toHaveBeenCalled();
    expect(h.controller.snapshot.message).toMatch(/Photo-source reads are disconnected/);
  });

  it('does not open photo permission or selection controls while disconnected', async () => {
    const disconnected: ImportRepository = { ...emptyRepository, getPrivateRecordLifecycle: async () => ({ state: 'disconnected' }) };
    const h = harness({ scope: 'limited', canAskAgain: false }, disconnected);

    await h.controller.requestBroad();
    await h.controller.manageLimited();
    await h.controller.selectPhotos();

    expect(h.adapter.request).not.toHaveBeenCalled();
    expect(h.adapter.manageLimited).not.toHaveBeenCalled();
    expect(h.adapter.select).not.toHaveBeenCalled();
  });

  it('stops an in-flight photo count before a lifecycle action completes', async () => {
    const h = harness({ scope: 'full', canAskAgain: false });
    let finishPage!: (count: number) => void;
    h.adapter.readPage.mockImplementationOnce(() => new Promise((resolve) => { finishPage = resolve; }));

    const count = h.controller.countAccessible();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await h.controller.stopImport();
    finishPage(100);
    await count;

    expect(h.adapter.readPage).toHaveBeenCalledTimes(1);
    expect(h.controller.snapshot.countStatus).toBe('incomplete');
  });

  it('clears retained counts and selections after confirmed local deletion', async () => {
    const h = harness({ scope: 'full', canAskAgain: false });
    h.adapter.readPage.mockResolvedValue(2);
    h.adapter.select.mockResolvedValue({ canceled: false, count: 1, missingAssetIds: 0, stableAssetIds: ['synthetic-id'] });
    await h.controller.countAccessible();
    await h.controller.selectPhotos();

    h.controller.clearDeletedRecord();

    expect(h.controller.snapshot).toMatchObject({ count: 0, countStatus: 'none', selectedCount: null, selectedMissingIds: 0, message: null });
  });

  it('requests once on explicit broad action, then counts paged device-visible media', async () => {
    const h = harness();
    h.adapter.request.mockResolvedValue({ scope: 'full', canAskAgain: false });
    h.setPermission({ scope: 'full', canAskAgain: false });
    h.adapter.readPage.mockResolvedValueOnce(100).mockResolvedValueOnce(23);

    await h.controller.requestBroad();

    expect(h.adapter.request).toHaveBeenCalledTimes(0); // Already granted on inspection; no duplicate OS prompt.
    expect(h.adapter.readPage.mock.calls).toEqual([[0, 100], [100, 100]]);
    expect(h.controller.snapshot).toMatchObject({ scope: 'full', count: 123, countStatus: 'complete' });
    await h.controller.requestBroad();
    expect(h.adapter.request).not.toHaveBeenCalled();
  });

  it('prompts exactly once when access is undetermined', async () => {
    const h = harness();
    h.adapter.request.mockImplementation(async () => {
      h.setPermission({ scope: 'full', canAskAgain: false });
      return { scope: 'full', canAskAgain: false };
    });
    await h.controller.requestBroad();
    expect(h.adapter.request).toHaveBeenCalledTimes(1);
    expect(h.controller.snapshot.scope).toBe('full');
  });

  it('labels limited access and manages only that scope on owner action', async () => {
    const h = harness({ scope: 'limited', canAskAgain: false });
    h.adapter.readPage.mockResolvedValue(4);
    await h.controller.requestBroad();
    expect(h.controller.snapshot).toMatchObject({ scope: 'limited', count: 4, countStatus: 'complete' });
    expect(h.adapter.request).not.toHaveBeenCalled();
    await h.controller.manageLimited();
    expect(h.adapter.manageLimited).toHaveBeenCalledTimes(1);
  });

  it('rechecks and recounts a completed limited scope after foreground return', async () => {
    const h = harness({ scope: 'limited', canAskAgain: false });
    h.adapter.readPage.mockResolvedValueOnce(4).mockResolvedValueOnce(6);
    await h.controller.countAccessible();
    expect(h.controller.snapshot.count).toBe(4);
    await h.controller.refresh(true);
    expect(h.controller.snapshot).toMatchObject({ scope: 'limited', count: 6, countStatus: 'complete' });
    expect(h.adapter.readPage).toHaveBeenCalledTimes(2);
    expect(h.adapter.request).not.toHaveBeenCalled();
  });

  it('keeps a canceled picker result intact and marks missing IDs uncertain', async () => {
    const h = harness();
    h.adapter.select.mockResolvedValueOnce({ canceled: false, count: 3, missingAssetIds: 1, stableAssetIds: ['a', 'b'] }).mockResolvedValueOnce({ canceled: true });
    await h.controller.selectPhotos();
    expect(h.controller.snapshot).toMatchObject({ selectedCount: 3, selectedMissingIds: 1 });
    await h.controller.selectPhotos();
    expect(h.controller.snapshot).toMatchObject({ selectedCount: 3, selectedMissingIds: 1 });
    expect(h.adapter.readPage).not.toHaveBeenCalled();
  });

  it('keeps an owner-selected observation when recounting the same library scope', async () => {
    const h = harness({ scope: 'full', canAskAgain: false });
    h.adapter.readPage.mockResolvedValueOnce(4).mockResolvedValueOnce(6).mockResolvedValueOnce(7);
    await h.controller.countAccessible();
    h.adapter.select.mockResolvedValue({ canceled: false, count: 2, missingAssetIds: 1, stableAssetIds: ['a'] });
    await h.controller.selectPhotos();
    await h.controller.countAccessible();
    expect(h.controller.snapshot).toMatchObject({ scope: 'full', count: 6, countStatus: 'complete', selectedCount: 2, selectedMissingIds: 1 });
    await h.controller.refresh(true);
    expect(h.controller.snapshot).toMatchObject({ scope: 'full', count: 7, countStatus: 'complete', selectedCount: 2, selectedMissingIds: 1 });
  });

  it('preserves a completed limited count when management fails before recount', async () => {
    const h = harness({ scope: 'limited', canAskAgain: false });
    h.adapter.readPage.mockResolvedValue(4);
    await h.controller.countAccessible();
    h.adapter.manageLimited.mockRejectedValue(new Error('picker unavailable'));
    await h.controller.manageLimited();
    expect(h.controller.snapshot).toMatchObject({ scope: 'limited', count: 4, countStatus: 'complete' });
    expect(h.adapter.readPage).toHaveBeenCalledTimes(1);
  });

  it('does not open limited management while a page is being counted', async () => {
    const h = harness({ scope: 'limited', canAskAgain: false });
    let finishPage!: (count: number) => void;
    h.adapter.readPage.mockImplementationOnce(() => new Promise((resolve) => { finishPage = resolve; }));
    const scan = h.controller.countAccessible();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await h.controller.manageLimited();
    expect(h.adapter.manageLimited).not.toHaveBeenCalled();
    finishPage(4);
    await scan;
    h.adapter.readPage.mockResolvedValue(5);
    await h.controller.manageLimited();
    expect(h.adapter.manageLimited).toHaveBeenCalledTimes(1);
    expect(h.controller.snapshot).toMatchObject({ count: 5, countStatus: 'complete' });
  });

  it('ignores a permission request result after interruption', async () => {
    const h = harness();
    let finishRequest!: (permission: PermissionSnapshot) => void;
    h.adapter.request.mockImplementationOnce(() => new Promise((resolve) => { finishRequest = resolve; }));
    const request = h.controller.requestBroad();
    await new Promise((resolve) => setTimeout(resolve, 0));
    h.controller.interrupt();
    finishRequest({ scope: 'full', canAskAgain: false });
    await request;
    expect(h.controller.snapshot.scope).toBe('unasked');
    expect(h.adapter.readPage).not.toHaveBeenCalled();
  });

  it('never queries after denial and clears a stale count after revocation', async () => {
    const h = harness({ scope: 'denied', canAskAgain: false });
    await h.controller.requestBroad();
    expect(h.adapter.request).not.toHaveBeenCalled();
    expect(h.adapter.readPage).not.toHaveBeenCalled();

    h.setPermission({ scope: 'full', canAskAgain: false });
    h.adapter.readPage.mockResolvedValue(8);
    await h.controller.countAccessible();
    expect(h.controller.snapshot.count).toBe(8);
    h.setPermission({ scope: 'denied', canAskAgain: false });
    await h.controller.refresh();
    expect(h.controller.snapshot).toMatchObject({ scope: 'revoked', count: 0, countStatus: 'none' });
    await h.controller.countAccessible();
    expect(h.adapter.readPage).toHaveBeenCalledTimes(1);
  });

  it('clears a previous count when permission inspection becomes unavailable', async () => {
    const h = harness({ scope: 'full', canAskAgain: false });
    h.adapter.readPage.mockResolvedValue(5);
    await h.controller.countAccessible();
    h.adapter.inspect.mockRejectedValueOnce(new Error('native permission API missing'));
    await h.controller.countAccessible();
    expect(h.controller.snapshot).toMatchObject({ scope: 'unavailable', count: 0, countStatus: 'none' });
    expect(h.adapter.readPage).toHaveBeenCalledTimes(1);
  });

  it('keeps partial progress incomplete after query failure or background interruption', async () => {
    const h = harness({ scope: 'full', canAskAgain: false });
    h.adapter.readPage.mockResolvedValueOnce(100).mockRejectedValueOnce(new Error('interrupted'));
    await h.controller.countAccessible();
    expect(h.controller.snapshot).toMatchObject({ count: 100, countStatus: 'incomplete' });

    let finishPage!: (count: number) => void;
    let signalPageStarted!: () => void;
    const pageStarted = new Promise<void>((resolve) => { signalPageStarted = resolve; });
    h.adapter.readPage.mockImplementationOnce(() => new Promise((resolve) => {
      finishPage = resolve;
      signalPageStarted();
    }));
    const scan = h.controller.countAccessible();
    await pageStarted;
    h.controller.interrupt();
    finishPage(30);
    await scan;
    expect(h.controller.snapshot).toMatchObject({ countStatus: 'incomplete' });
  });

  it('rechecks permission after a page failure and clears a revoked scope', async () => {
    const h = harness({ scope: 'full', canAskAgain: false });
    h.adapter.readPage.mockResolvedValueOnce(100).mockImplementationOnce(async () => {
      h.setPermission({ scope: 'denied', canAskAgain: false });
      throw new Error('read revoked');
    });
    await h.controller.countAccessible();
    expect(h.controller.snapshot).toMatchObject({ scope: 'revoked', count: 0, countStatus: 'none' });
    expect(h.adapter.readPage).toHaveBeenCalledTimes(2);
  });

  it('reports unsupported runtime without permission prompt or query', async () => {
    const h = harness(null);
    await h.controller.refresh();
    await h.controller.requestBroad();
    expect(h.controller.snapshot.scope).toBe('unavailable');
    expect(h.adapter.request).not.toHaveBeenCalled();
    expect(h.adapter.readPage).not.toHaveBeenCalled();
  });
});
