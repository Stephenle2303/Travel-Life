import { ImportCoordinator } from '@/import-record';
import type { ImportCheckpoint, ImportCoverage, ImportRepository, SourceCandidate } from '@/import-record/types';
import type { PermissionSnapshot, PhotoAccessAdapter } from '@/photo-access/types';

const image = (assetId: string, overrides: Partial<SourceCandidate> = {}): SourceCandidate => ({
  assetId,
  mediaType: 'image',
  capturedAtMillis: null,
  modifiedAtMillis: null,
  locationAvailable: null,
  availability: 'available',
  ...overrides,
});

class MemoryRepository implements ImportRepository {
  readonly checkpoints = new Map<string, ImportCheckpoint>();
  readonly sources = new Map<string, SourceCandidate>();
  readonly correctionMarkers = new Map<string, string>();
  state: 'connected' | 'disconnected' | 'deleted' = 'connected';

  async getCheckpoint(scope: ImportCheckpoint['scope']) { return this.checkpoints.get(scope) ?? null; }
  async loadCoverage(scope: ImportCheckpoint['scope']) { return this.getCheckpoint(scope); }
  async commitPage(checkpoint: ImportCheckpoint, candidates: SourceCandidate[]) {
    for (const candidate of candidates) this.sources.set(candidate.assetId, candidate);
    this.checkpoints.set(checkpoint.scope, { ...checkpoint });
  }
  async getPrivateRecordLifecycle() { return { state: this.state } as const; }
  async connectPrivateRecord() { this.state = 'connected'; }
  async disconnectPrivateRecord() { this.state = 'disconnected'; }
  async deleteLocalHistory() { this.state = 'deleted'; this.checkpoints.clear(); this.sources.clear(); }
  async saveCorrectionOverlay() {}
}

function harness(initial: PermissionSnapshot | null = { scope: 'full', canAskAgain: false }) {
  let permission = initial;
  const adapter: jest.Mocked<PhotoAccessAdapter> = {
    inspect: jest.fn(async () => permission),
    request: jest.fn(async () => permission),
    readPage: jest.fn(async (_offset: number, _limit: number) => 0),
    readMetadataPage: jest.fn(async (_offset: number, _limit: number) => []),
    readSelectedMetadata: jest.fn(async (_assetIds: string[]) => []),
    manageLimited: jest.fn(async () => {}),
    select: jest.fn(async () => ({ canceled: true } as const)),
  };
  const repository = new MemoryRepository();
  const updates: ImportCoverage[] = [];
  const coordinator = new ImportCoordinator(adapter, repository, (coverage) => updates.push(coverage));
  return { adapter, coordinator, repository, updates, setPermission(next: PermissionSnapshot | null) { permission = next; } };
}

describe('resumable local metadata import', () => {
  it('finishes an empty permitted scope with explicit zero coverage', async () => {
    const h = harness();
    await h.coordinator.start('full', 0);

    expect(h.coordinator.coverage).toMatchObject({ status: 'complete', accessible: 0, scanned: 0, geotagged: 0, unavailable: 0 });
    expect(h.repository.sources.size).toBe(0);
  });

  it('does not read source metadata while the private record is disconnected', async () => {
    const h = harness();
    h.repository.state = 'disconnected';

    await h.coordinator.start('full', 0);

    expect(h.adapter.readMetadataPage).not.toHaveBeenCalled();
    expect(h.coordinator.coverage).toMatchObject({ status: 'blocked', message: 'Photo-source reads are disconnected. Reconnect your private record before importing.' });
  });

  it('does not restore paused maintenance while the private record is disconnected', async () => {
    const h = harness();
    h.repository.state = 'disconnected';
    h.repository.loadCoverage = async () => { throw new Error('should not load'); };

    await h.coordinator.restore('full');

    expect(h.coordinator.coverage).toMatchObject({ status: 'blocked' });
  });

  it('does not resume a start that was cancelled while its lifecycle check was pending', async () => {
    const h = harness();
    let resolveLifecycle!: (value: { state: 'connected' }) => void;
    h.repository.getPrivateRecordLifecycle = () => new Promise((resolve) => { resolveLifecycle = resolve; });

    const start = h.coordinator.start('full', 0);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await h.coordinator.cancel();
    resolveLifecycle({ state: 'connected' });
    await start;

    expect(h.adapter.readMetadataPage).not.toHaveBeenCalled();
  });

  it('does not resume selected metadata after a pending lifecycle check is cancelled', async () => {
    const h = harness({ scope: 'denied', canAskAgain: false });
    let resolveLifecycle!: (value: { state: 'connected' }) => void;
    h.repository.getPrivateRecordLifecycle = () => new Promise((resolve) => { resolveLifecycle = resolve; });

    const selected = h.coordinator.importSelected(['asset'], 0);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await h.coordinator.cancel();
    resolveLifecycle({ state: 'connected' });
    await selected;

    expect(h.adapter.readSelectedMetadata).not.toHaveBeenCalled();
  });

  it('finishes a sparse permitted scope without media fields or a travel claim', async () => {
    const h = harness();
    h.adapter.readMetadataPage.mockResolvedValue([image('sparse', { capturedAtMillis: 100, locationAvailable: true })]);

    await h.coordinator.start('full', 1);

    expect(h.coordinator.coverage).toMatchObject({ status: 'complete', accessible: 1, scanned: 1, geotagged: 1, unavailable: 0 });
    expect(h.repository.sources.get('sparse')).toEqual(image('sparse', { capturedAtMillis: 100, locationAvailable: true }));
    expect(h.repository.sources.get('sparse')).not.toHaveProperty('uri');
    expect(h.repository.sources.get('sparse')).not.toHaveProperty('filename');
  });

  it('retains absent timestamp and location fields without calling them unavailable', async () => {
    const h = harness();
    h.adapter.readMetadataPage.mockResolvedValue([image('no-fields')]);

    await h.coordinator.start('full', 1);

    expect(h.repository.sources.get('no-fields')).toEqual(image('no-fields'));
    expect(h.coordinator.coverage).toMatchObject({ status: 'complete', scanned: 1, geotagged: 0, unavailable: 0 });
  });

  it('commits large pages, resumes after cancellation, and deduplicates a repeat without erasing a correction marker', async () => {
    const h = harness();
    const first = Array.from({ length: 100 }, (_, index) => image(`id-${index}`, { locationAvailable: index === 0 }));
    h.adapter.readMetadataPage.mockResolvedValueOnce(first).mockResolvedValueOnce([image('id-100', { availability: 'unavailable' })]);
    await h.coordinator.start('full', 101);
    expect(h.repository.sources.size).toBe(101);
    h.repository.correctionMarkers.set('id-0', 'owner-note');

    h.adapter.readMetadataPage.mockResolvedValueOnce([image('id-0'), image('id-100', { availability: 'unavailable' })]);
    await h.coordinator.start('full', 101);

    expect(h.repository.sources.size).toBe(101);
    expect(h.repository.correctionMarkers.get('id-0')).toBe('owner-note');
  });

  it('keeps committed pages and discards an in-flight page when cancellation interrupts the run', async () => {
    const h = harness();
    let finishPage!: (value: SourceCandidate[]) => void;
    h.adapter.readMetadataPage.mockImplementationOnce(() => new Promise((resolve) => { finishPage = resolve; }));
    const run = h.coordinator.start('full', null);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await h.coordinator.cancel();
    finishPage([image('late')]);
    await run;

    expect(h.repository.sources.size).toBe(0);
    expect(h.coordinator.coverage).toMatchObject({ status: 'paused', scanned: 0 });
  });

  it('clears retained coverage after a confirmed local deletion', async () => {
    const h = harness();
    h.adapter.readMetadataPage.mockResolvedValue([image('local')]);
    await h.coordinator.start('full', 1);
    expect(h.coordinator.coverage.status).toBe('complete');

    h.coordinator.clear();

    expect(h.coordinator.coverage).toMatchObject({ scope: null, status: 'idle', scanned: 0 });
  });

  it('restores a process-interrupted checkpoint as paused and safely restarts from zero', async () => {
    const h = harness();
    await h.repository.commitPage({ scope: 'full', nextOffset: 100, scanned: 100, geotagged: 1, unavailable: 0, status: 'running' }, [image('committed')]);
    const resumed = new ImportCoordinator(h.adapter, h.repository, () => {});
    h.adapter.readMetadataPage.mockResolvedValueOnce([image('after-restart')]);

    await resumed.restore('full');
    expect(resumed.coverage).toMatchObject({ status: 'paused', scanned: 100, geotagged: 1 });
    expect(await h.repository.getCheckpoint('full')).toMatchObject({ status: 'paused', nextOffset: 100 });

    await resumed.start('full', 101);
    expect(h.adapter.readMetadataPage).toHaveBeenCalledWith(0, 100);
    expect(resumed.coverage).toMatchObject({ status: 'complete', scanned: 1 });
  });

  it('stops before a revoked scope and discards a page returned after permission changes', async () => {
    const h = harness();
    h.adapter.readMetadataPage.mockImplementationOnce(async () => {
      h.setPermission({ scope: 'denied', canAskAgain: false });
      return [image('stale')];
    });

    await h.coordinator.start('full', 1);

    expect(h.repository.sources.size).toBe(0);
    expect(h.coordinator.coverage).toMatchObject({ status: 'blocked', scanned: 0 });
  });

  it('persists a paused checkpoint when a page read fails', async () => {
    const h = harness();
    h.adapter.readMetadataPage.mockRejectedValueOnce(new Error('source unavailable'));

    await h.coordinator.start('full', 1);

    expect(h.coordinator.coverage).toMatchObject({ status: 'paused', scanned: 0 });
    expect(await h.repository.getCheckpoint('full')).toMatchObject({ status: 'paused', nextOffset: 0 });
  });

  it('shows a recoverable paused state when local checkpoint access fails', async () => {
    const h = harness();
    h.repository.getCheckpoint = async () => { throw new Error('database unavailable'); };

    await expect(h.coordinator.start('full', 1)).resolves.toBeUndefined();

    expect(h.coordinator.coverage).toMatchObject({ scope: 'full', accessible: 1, status: 'paused' });
    expect(h.coordinator.coverage.message).toMatch(/Local import progress could not be read/);
  });

  it('imports a picker result even when broad library permission is denied', async () => {
    const h = harness({ scope: 'denied', canAskAgain: false });
    h.adapter.readSelectedMetadata.mockResolvedValue([image('stable')]);
    await h.coordinator.importSelected(['stable'], 2);

    expect(h.repository.sources.size).toBe(1);
    expect(h.coordinator.coverage).toMatchObject({ scope: 'selected', status: 'complete', scanned: 1, unavailable: 2, accessible: 3 });
  });

  it('records all missing or vanished picker IDs as unavailable without inventing identity', async () => {
    const h = harness({ scope: 'denied', canAskAgain: false });
    h.adapter.readSelectedMetadata.mockResolvedValue([]);
    await h.coordinator.importSelected(['vanished'], 2);

    expect(h.repository.sources.size).toBe(0);
    expect(h.coordinator.coverage).toMatchObject({ scope: 'selected', status: 'complete', scanned: 0, unavailable: 3, accessible: 3 });
  });

  it('discards a late selected lookup after cancellation and resets selected counters on repeat', async () => {
    const h = harness({ scope: 'denied', canAskAgain: false });
    let finishLookup!: (value: SourceCandidate[]) => void;
    h.adapter.readSelectedMetadata.mockImplementationOnce(() => new Promise((resolve) => { finishLookup = resolve; }));
    const first = h.coordinator.importSelected(['late'], 0);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await h.coordinator.cancel();
    finishLookup([image('late')]);
    await first;
    expect(h.repository.sources.size).toBe(0);
    expect(h.coordinator.coverage.status).toBe('paused');

    h.adapter.readSelectedMetadata.mockResolvedValueOnce([image('stable')]);
    await h.coordinator.importSelected(['stable'], 0);
    h.adapter.readSelectedMetadata.mockResolvedValueOnce([image('stable')]);
    await h.coordinator.importSelected(['stable'], 0);
    expect(h.repository.sources.size).toBe(1);
    expect(h.coordinator.coverage).toMatchObject({ status: 'complete', scanned: 1, unavailable: 0 });
  });

  it('counts cloud-only and lookup-unavailable records without downloading their media', async () => {
    const h = harness();
    h.adapter.readMetadataPage.mockResolvedValue([image('cloud', { availability: 'unavailable' }), image('unknown', { availability: 'unknown', locationAvailable: false })]);
    await h.coordinator.start('full', 2);

    expect(h.coordinator.coverage).toMatchObject({ status: 'complete', scanned: 2, geotagged: 0, unavailable: 1 });
    expect(h.adapter.readPage).not.toHaveBeenCalled();
  });
});
