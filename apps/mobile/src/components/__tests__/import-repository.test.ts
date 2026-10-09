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
  mockGetFirstAsync.mockResolvedValue({ version: 1 });
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
    expect(mockRunAsync).toHaveBeenCalledWith('INSERT INTO import_schema_version (version) VALUES (?)', 1);
    expect(mockExecAsync).toHaveBeenLastCalledWith('COMMIT');
  });

  it('maps a checkpoint and atomically upserts sources without touching correction markers', async () => {
    const repository = createNativeImportRepository();
    mockGetFirstAsync
      .mockResolvedValueOnce({ version: 1 })
      .mockResolvedValueOnce({ scope: 'limited', next_offset: 4, scanned: 4, geotagged: 1, unavailable: 2, status: 'paused' });

    await expect(repository.getCheckpoint('limited')).resolves.toEqual({ scope: 'limited', nextOffset: 4, scanned: 4, geotagged: 1, unavailable: 2, status: 'paused' });
    await repository.commitPage({ scope: 'limited', nextOffset: 1, scanned: 1, geotagged: 0, unavailable: 0, status: 'complete' }, [candidate]);

    expect(mockRunAsync).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO import_source_index'), 'opaque-id', 'image', null, null, null, 'unknown');
    expect(mockRunAsync).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO import_checkpoint'), 'limited', 1, 1, 0, 0, 'complete');
    expect(mockExecAsync.mock.calls.flat().join('\n')).not.toContain('correction_markers');
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
