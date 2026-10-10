import { createNativeImportRepository } from '@/import-record';
import type { SourceCandidate } from '@/import-record/types';

const mockExecAsync = jest.fn();
const mockRunAsync = jest.fn();
const mockGetFirstAsync = jest.fn();
const mockOpenDatabaseAsync = jest.fn();

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: (...args: unknown[]) => mockOpenDatabaseAsync(...args) }));

const candidate: SourceCandidate = {
  assetId: 'opaque-id', mediaType: 'image', capturedAtMillis: null, modifiedAtMillis: null,
  locationAvailable: null, availability: 'unknown',
};

function readyDatabase() {
  mockOpenDatabaseAsync.mockResolvedValue({ execAsync: mockExecAsync, runAsync: mockRunAsync, getFirstAsync: mockGetFirstAsync });
  mockGetFirstAsync.mockImplementation(async (sql: string) => sql.includes('private_record_lifecycle') ? { state: 'connected' } : { version: 1 });
  mockExecAsync.mockResolvedValue(undefined);
  mockRunAsync.mockResolvedValue(undefined);
}

describe('native import SQLite repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    readyDatabase();
  });

  it('runs the versioned migration transaction before reading a checkpoint', async () => {
    const repository = createNativeImportRepository();
    mockGetFirstAsync.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    await repository.getCheckpoint('full');

    expect(mockOpenDatabaseAsync).toHaveBeenCalledWith('travel-life-import-v1.db');
    expect(mockExecAsync).toHaveBeenCalledWith('BEGIN IMMEDIATE TRANSACTION');
    expect(mockExecAsync).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS import_source_index'));
    expect(mockRunAsync).toHaveBeenCalledWith('INSERT INTO import_schema_version (version) VALUES (?)', 2);
    expect(mockExecAsync).toHaveBeenLastCalledWith('COMMIT');
  });

  it('maps a checkpoint and atomically upserts source and canonical evidence without touching correction overlays', async () => {
    const repository = createNativeImportRepository();
    mockGetFirstAsync
      .mockResolvedValueOnce({ version: 1 })
      .mockResolvedValueOnce({ scope: 'limited', next_offset: 4, scanned: 4, geotagged: 1, unavailable: 2, status: 'paused' });

    await expect(repository.getCheckpoint('limited')).resolves.toEqual({ scope: 'limited', nextOffset: 4, scanned: 4, geotagged: 1, unavailable: 2, status: 'paused' });
    await repository.commitPage({ scope: 'limited', nextOffset: 1, scanned: 1, geotagged: 0, unavailable: 0, status: 'complete' }, [candidate]);

    expect(mockRunAsync).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO import_source_index'), 'opaque-id', 'image', null, null, null, 'unknown');
    expect(mockRunAsync).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO canonical_evidence'), 'opaque-id', 'opaque-id', 'image', null, null, null, 'unknown');
    expect(mockRunAsync).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO import_checkpoint'), 'limited', 1, 1, 0, 0, 'complete');
    expect(mockExecAsync.mock.calls.flat().join('\n')).not.toContain('DELETE FROM correction_overlays');
  });

  it('migrates an existing M1.3 database in place before creating the private lifecycle', async () => {
    const repository = createNativeImportRepository();
    mockGetFirstAsync.mockResolvedValueOnce({ version: 1 }).mockResolvedValueOnce({ state: 'connected' });

    await repository.getPrivateRecordLifecycle();

    expect(mockExecAsync.mock.calls.flat().join('\n')).toContain('CREATE TABLE IF NOT EXISTS canonical_evidence');
    expect(mockExecAsync.mock.calls.flat().join('\n')).toContain('CREATE TABLE IF NOT EXISTS inferred_history');
    expect(mockExecAsync.mock.calls.flat().join('\n')).toContain('INSERT OR IGNORE INTO canonical_evidence');
    expect(mockExecAsync.mock.calls.flat().join('\n')).toContain('VALUES (1, 2)');
    expect(mockRunAsync).toHaveBeenCalledWith('UPDATE import_schema_version SET version = ?', 2);
  });

  it('keeps a disconnected record locally and clears every covered table only on deletion', async () => {
    const repository = createNativeImportRepository();

    await repository.disconnectPrivateRecord();
    expect(mockRunAsync).toHaveBeenCalledWith('UPDATE private_record_lifecycle SET state = ? WHERE record_id = 1', 'disconnected');

    await repository.deleteLocalHistory();
    const statements = mockExecAsync.mock.calls.flat().join('\n');
    expect(statements).toContain('DELETE FROM correction_markers');
    expect(statements).toContain('DELETE FROM correction_overlays');
    expect(statements).toContain('DELETE FROM inferred_history');
    expect(statements).toContain('DELETE FROM canonical_evidence');
    expect(statements).toContain('DELETE FROM import_source_index');
    expect(statements).toContain('DELETE FROM import_checkpoint');
    expect(statements).toContain('DELETE FROM local_cache_registry');
    expect(statements).toContain('DELETE FROM private_record_lifecycle');
    expect(statements).toContain('DELETE FROM private_history_record');
  });

  it('rolls a failed deletion back without reporting a partial local wipe', async () => {
    const repository = createNativeImportRepository();
    mockExecAsync.mockImplementation(async (source: string) => {
      if (source.includes('DELETE FROM correction_markers')) throw new Error('delete failed');
    });

    await expect(repository.deleteLocalHistory()).rejects.toThrow('delete failed');
    expect(mockExecAsync).toHaveBeenCalledWith('ROLLBACK');
  });

  it('blocks a late import commit after confirmed deletion', async () => {
    const repository = createNativeImportRepository();
    mockGetFirstAsync.mockImplementation(async (sql: string) => sql.includes('private_record_lifecycle') ? null : { version: 2 });

    await repository.deleteLocalHistory();

    await expect(repository.commitPage(
      { scope: 'full', nextOffset: 1, scanned: 1, geotagged: 0, unavailable: 0, status: 'complete' },
      [candidate],
    )).rejects.toMatchObject({ name: 'ImportLifecycleBlockedError' });
  });

  it('stores a revisioned correction overlay without importing media or source paths', async () => {
    const repository = createNativeImportRepository();

    await repository.saveCorrectionOverlay({
      overlayId: 'overlay-1',
      targetKind: 'evidence',
      targetId: 'evidence-1',
      scope: 'label',
      action: 'apply',
      ownerValue: 'Reviewed',
      createdAtMillis: 1,
      identityLineageId: null,
      replacesOverlayId: null,
    });

    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO correction_overlays'),
      'overlay-1', 'evidence', 'evidence-1', 'label', 'apply', 'Reviewed', 1, null, 1, null,
    );
    expect(mockRunAsync.mock.calls.flat().join('\n')).not.toMatch(/uri|filename|coordinate|exif/i);
  });

  it('rejects corrections for missing targets, disconnected records, or unrelated replacement lineage', async () => {
    const overlay = {
      overlayId: 'overlay-1', targetKind: 'evidence' as const, targetId: 'evidence-1', scope: 'label' as const,
      action: 'apply' as const, ownerValue: 'Reviewed', createdAtMillis: 1, identityLineageId: null, replacesOverlayId: null,
    };

    mockGetFirstAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('private_record_lifecycle')) return { state: 'connected' };
      if (sql.includes('canonical_evidence')) return null;
      return { version: 2 };
    });
    await expect(createNativeImportRepository().saveCorrectionOverlay(overlay)).rejects.toThrow(/existing stable target/);

    mockGetFirstAsync.mockImplementation(async (sql: string) => sql.includes('private_record_lifecycle') ? { state: 'disconnected' } : { version: 2 });
    await expect(createNativeImportRepository().saveCorrectionOverlay(overlay)).rejects.toMatchObject({ name: 'ImportLifecycleBlockedError' });

    mockGetFirstAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('private_record_lifecycle')) return { state: 'connected' };
      if (sql.includes('canonical_evidence')) return { evidence_id: 'evidence-1' };
      if (sql.includes('correction_overlays WHERE overlay_id')) return null;
      return { version: 2 };
    });
    await expect(createNativeImportRepository().saveCorrectionOverlay({ ...overlay, overlayId: 'overlay-2', replacesOverlayId: 'other-overlay' })).rejects.toThrow(/replacement must match/);
  });

  it('blocks an import write after disconnect without reading or recreating local evidence', async () => {
    const repository = createNativeImportRepository();
    mockGetFirstAsync.mockImplementation(async (sql: string) => sql.includes('private_record_lifecycle') ? { state: 'disconnected' } : { version: 1 });

    await expect(repository.commitPage({ scope: 'full', nextOffset: 1, scanned: 1, geotagged: 0, unavailable: 0, status: 'paused' }, [candidate])).rejects.toThrow('not connected');

    expect(mockExecAsync).toHaveBeenCalledWith('ROLLBACK');
    expect(mockRunAsync.mock.calls.flat().join('\n')).not.toContain('INSERT INTO canonical_evidence');
  });

  it('rolls back a failed migration and allows a later retry', async () => {
    const repository = createNativeImportRepository();
    mockExecAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('CREATE TABLE IF NOT EXISTS import_checkpoint')) throw new Error('migration failed');
    });
    mockGetFirstAsync.mockResolvedValueOnce(null);

    await expect(repository.getCheckpoint('full')).rejects.toThrow('migration failed');
    expect(mockExecAsync).toHaveBeenCalledWith('ROLLBACK');
  });

  it('rolls back a failed metadata/checkpoint commit', async () => {
    const repository = createNativeImportRepository();
    mockRunAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('INSERT INTO import_source_index')) throw new Error('source write failed');
    });

    await expect(repository.commitPage({ scope: 'full', nextOffset: 1, scanned: 1, geotagged: 0, unavailable: 0, status: 'paused' }, [candidate])).rejects.toThrow('source write failed');

    expect(mockExecAsync).toHaveBeenCalledWith('ROLLBACK');
  });
});
