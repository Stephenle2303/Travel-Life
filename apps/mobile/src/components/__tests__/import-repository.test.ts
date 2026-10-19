import { createNativeImportRepository } from '@/import-record';
import type { SourceCandidate } from '@/import-record/types';

const mockExecAsync = jest.fn();
const mockRunAsync = jest.fn();
const mockGetFirstAsync = jest.fn();
const mockGetAllAsync = jest.fn();
const mockOpenDatabaseAsync = jest.fn();

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: (...args: unknown[]) => mockOpenDatabaseAsync(...args) }));

const candidate: SourceCandidate = {
  assetId: 'opaque-id', mediaType: 'image', capturedAtMillis: null, modifiedAtMillis: null,
  locationAvailable: null, availability: 'unknown', capturedDay: null, hasPreciseOffset: false,
};

function readyDatabase() {
  mockOpenDatabaseAsync.mockResolvedValue({ execAsync: mockExecAsync, runAsync: mockRunAsync, getFirstAsync: mockGetFirstAsync, getAllAsync: mockGetAllAsync });
  mockGetFirstAsync.mockImplementation(async (sql: string) => sql.includes('private_record_lifecycle') ? { state: 'connected' } : { version: 1 });
  mockExecAsync.mockResolvedValue(undefined);
  mockRunAsync.mockResolvedValue(undefined);
  mockGetAllAsync.mockResolvedValue([]);
}

describe('native import SQLite repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    readyDatabase();
  });

  it('opens an already-current schema without taking a startup write lock', async () => {
    mockGetFirstAsync.mockResolvedValueOnce({ version: 33 });
    await createNativeImportRepository().getCheckpoint('full');
    expect(mockExecAsync).toHaveBeenCalledWith('PRAGMA busy_timeout = 30000');
    expect(mockExecAsync).not.toHaveBeenCalledWith('BEGIN IMMEDIATE TRANSACTION');
  });

  it('still migrates a fresh database when the schema table is absent', async () => {
    mockGetFirstAsync.mockRejectedValueOnce(new Error('no such table: import_schema_version')).mockResolvedValueOnce(null);
    await createNativeImportRepository().getCheckpoint('full');
    expect(mockExecAsync).toHaveBeenCalledWith('BEGIN IMMEDIATE TRANSACTION');
    expect(mockRunAsync).toHaveBeenCalledWith('INSERT INTO import_schema_version (version) VALUES (?)', 33);
  });

  it('runs the versioned migration transaction before reading a checkpoint', async () => {
    const repository = createNativeImportRepository();
    mockGetFirstAsync.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    await repository.getCheckpoint('full');

    expect(mockOpenDatabaseAsync).toHaveBeenCalledWith('travel-life-import-v1.db');
    expect(mockExecAsync).toHaveBeenCalledWith('BEGIN IMMEDIATE TRANSACTION');
    expect(mockExecAsync).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS import_source_index'));
    expect(mockRunAsync).toHaveBeenCalledWith('INSERT INTO import_schema_version (version) VALUES (?)', 33);
    expect(mockExecAsync).toHaveBeenLastCalledWith('COMMIT');
    expect(mockExecAsync.mock.calls.flat().join('\n')).toContain('ADD COLUMN reviewed_snapshot_json');
    expect(mockExecAsync.mock.calls.flat().join('\n')).toContain('CREATE TABLE IF NOT EXISTS journey_correction_candidate');
    expect(mockExecAsync.mock.calls.flat().join('\n')).toContain('CREATE TABLE IF NOT EXISTS manual_journey');
    expect(mockExecAsync.mock.calls.flat().join('\n')).toContain("action IN ('confirm', 'reject', 'claim')");
    expect(mockExecAsync.mock.calls.flat().join('\n')).toContain("'place', 'split', 'merge', 'remove-visit'");
    expect(mockExecAsync.mock.calls.flat().join('\n')).toContain('owner_place_id TEXT NULL');
    expect(mockExecAsync.mock.calls.flat().join('\n')).toContain('reconstruction_trip_qualification');
    expect(mockExecAsync.mock.calls.flat().join('\n')).toContain('v1-1-context-not-yet-qualified');
  });

  it('maps a checkpoint and atomically upserts source and canonical evidence without touching correction overlays', async () => {
    const repository = createNativeImportRepository();
    mockGetFirstAsync
      .mockResolvedValueOnce({ version: 1 })
      .mockResolvedValueOnce({ version: 1 })
      .mockResolvedValueOnce({ scope: 'limited', next_offset: 4, scanned: 4, geotagged: 1, unavailable: 2, status: 'paused' });

    await expect(repository.getCheckpoint('limited')).resolves.toEqual({ scope: 'limited', nextOffset: 4, scanned: 4, geotagged: 1, unavailable: 2, status: 'paused' });
    await repository.commitPage({ scope: 'limited', nextOffset: 1, scanned: 1, geotagged: 0, unavailable: 0, status: 'complete' }, [candidate]);

    expect(mockRunAsync).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO import_source_index'), 'opaque-id', 'image', null, null, 0, null, null, 'unknown', null, null, null, null, null, null, 1, '[null,null,false,null,null,null,null,null]');
    expect(mockRunAsync).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO canonical_evidence'), 'opaque-id', 'opaque-id', 'image', null, null, 0, null, null, 'unknown', null, null, null, null, null, null, 1, '[null,null,false,null,null,null,null,null]');
    expect(mockRunAsync).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO import_checkpoint'), 'limited', 1, 1, 0, 0, 'complete');
    expect(mockExecAsync.mock.calls.flat().join('\n')).not.toContain('DELETE FROM correction_overlays');
  });

  it('refreshes legacy location-only evidence with coordinates on a repeated import', async () => {
    const repository = createNativeImportRepository();
    const refreshed: SourceCandidate = { ...candidate, capturedAtMillis: Date.UTC(2026, 0, 1), capturedDay: '2026-01-01', locationAvailable: true, latitude: 13.7, longitude: 100.5, reportedAccuracyMeters: null, supportEligible: true, availability: 'available' };
    await repository.commitPage({ scope: 'full', nextOffset: 1, scanned: 1, geotagged: 1, unavailable: 0, status: 'complete' }, [refreshed]);

    const canonicalWrite = mockRunAsync.mock.calls.find(([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO canonical_evidence'));
    expect(canonicalWrite?.[0]).toContain('latitude = excluded.latitude, longitude = excluded.longitude');
    expect(canonicalWrite?.slice(1)).toEqual(expect.arrayContaining([13.7, 100.5]));
    expect(mockExecAsync.mock.calls.flat().join('\n')).not.toContain('DELETE FROM correction_overlays');
  });

  it('migrates an existing M1.3 database in place before creating the private lifecycle', async () => {
    const repository = createNativeImportRepository();
    mockGetFirstAsync.mockResolvedValueOnce({ version: 1 }).mockResolvedValueOnce({ version: 1 });

    await repository.getPrivateRecordLifecycle();

    expect(mockExecAsync.mock.calls.flat().join('\n')).toContain('CREATE TABLE IF NOT EXISTS canonical_evidence');
    expect(mockExecAsync.mock.calls.flat().join('\n')).toContain('CREATE TABLE IF NOT EXISTS inferred_history');
    expect(mockExecAsync.mock.calls.flat().join('\n')).toContain('INSERT OR IGNORE INTO canonical_evidence');
    expect(mockExecAsync.mock.calls.flat().join('\n')).toContain('VALUES (1, 2)');
    expect(mockRunAsync).toHaveBeenCalledWith('UPDATE import_schema_version SET version = ?', 33);
  });

  it('adds both reconstructed-place country columns before recording schema v12', async () => {
    const repository = createNativeImportRepository();
    mockGetFirstAsync.mockResolvedValueOnce({ version: 11 }).mockResolvedValueOnce({ version: 11 }).mockResolvedValueOnce(null);
    await repository.getCheckpoint('full');
    const migration = mockExecAsync.mock.calls.flat().join('\n');
    expect(migration).toContain('ADD COLUMN country_code');
    expect(migration).toContain('ADD COLUMN country_dataset_version');
    expect(mockRunAsync).toHaveBeenCalledWith('UPDATE import_schema_version SET version = ?', 33);
  });

  it('upgrades v26 through the private duplicate-family and correction-snapshot migrations', async () => {
    const repository = createNativeImportRepository();
    mockGetFirstAsync.mockResolvedValueOnce({ version: 26 }).mockResolvedValueOnce({ version: 26 }).mockResolvedValueOnce(null);

    await repository.getCheckpoint('full');

    const migration = mockExecAsync.mock.calls.flat().join('\n');
    expect(migration).toContain('ADD COLUMN platform_duplicate_family_id');
    expect(migration).toContain('ADD COLUMN duplicate_tuple_fingerprint');
    expect(migration).toContain('ADD COLUMN reviewed_family_snapshot_json');
    expect(mockRunAsync).toHaveBeenCalledWith('UPDATE import_schema_version SET version = ?', 33);
  });

  it('upgrades a v30 Home base without inventing a location name', async () => {
    const repository = createNativeImportRepository();
    mockGetFirstAsync.mockResolvedValueOnce({ version: 30 }).mockResolvedValueOnce({ version: 30 });
    await repository.getCheckpoint('full');
    const migration = mockExecAsync.mock.calls.flat().join('\n');
    expect(migration).toContain('ADD COLUMN owner_label TEXT NULL');
    expect(migration).toContain("DEFAULT 'legacy'");
    expect(mockRunAsync).toHaveBeenCalledWith('UPDATE import_schema_version SET version = ?', 33);
  });

  it('stores multiple date-scoped owner home areas privately and clears them on deletion', async () => {
    const repository = createNativeImportRepository();
    await repository.saveConfiguredHomeArea?.({ id: 'sa-dec', label: 'Sa Dec, Dong Thap', origin: 'observed-area', latitude: 10.2909, longitude: 105.7564, effectiveStartDay: null, effectiveEndDay: '2026-01-31', radiusMeters: 50_000 });
    await repository.saveConfiguredHomeArea?.({ id: 'ho-chi-minh', label: 'Ho Chi Minh City', origin: 'observed-area', latitude: 10.8231, longitude: 106.6297, effectiveStartDay: '2026-02-01', effectiveEndDay: null, radiusMeters: 50_000 });
    expect(mockExecAsync.mock.calls.flat().join('\n')).toContain('CREATE TABLE IF NOT EXISTS configured_home_area');
    expect(mockRunAsync).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO configured_home_area'), 'sa-dec', 'Sa Dec, Dong Thap', 'observed-area', 10.2909, 105.7564, null, '2026-01-31', 50_000);
    expect(mockRunAsync).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO configured_home_area'), 'ho-chi-minh', 'Ho Chi Minh City', 'observed-area', 10.8231, 106.6297, '2026-02-01', null, 50_000);
    await repository.deleteLocalHistory();
    expect(mockExecAsync.mock.calls.flat().join('\n')).toContain('DELETE FROM configured_home_area');
    expect(mockExecAsync.mock.calls.flat().join('\n')).toContain('DELETE FROM manual_journey');
  });

  it('lists and renames a Home base locally without changing its private area', async () => {
    const repository = createNativeImportRepository();
    mockGetAllAsync.mockResolvedValueOnce([{ area_id: 'home-1', owner_label: null, origin: 'legacy', latitude: 10.2, longitude: 105.7, effective_start_day: null, effective_end_day: null, radius_meters: 50_000 }]);
    await expect(repository.loadConfiguredHomeAreas?.()).resolves.toEqual([{ id: 'home-1', label: null, origin: 'legacy', latitude: 10.2, longitude: 105.7, effectiveStartDay: null, effectiveEndDay: null, radiusMeters: 50_000 }]);
    await repository.renameConfiguredHomeArea?.('home-1', 'Sa Dec, Dong Thap');
    expect(mockRunAsync).toHaveBeenCalledWith('UPDATE configured_home_area SET owner_label = ? WHERE area_id = ?', 'Sa Dec, Dong Thap', 'home-1');
  });

  it('keeps a disconnected record locally and clears every covered table only on deletion', async () => {
    const repository = createNativeImportRepository();

    await repository.disconnectPrivateRecord();
    expect(mockRunAsync).toHaveBeenCalledWith('UPDATE private_record_lifecycle SET state = ? WHERE record_id = 1', 'disconnected');

    await repository.deleteLocalHistory();
    const statements = mockExecAsync.mock.calls.flat().join('\n');
    expect(statements).toContain('DELETE FROM correction_markers');
    expect(statements).toContain('DELETE FROM reconstruction_trip_qualification');
    expect(statements).toContain('DELETE FROM correction_overlays');
    expect(statements).toContain('DELETE FROM journey_correction_revision');
    expect(statements).toContain('DELETE FROM journey_correction_candidate');
    expect(statements).toContain('DELETE FROM journey_memory_correction_candidate');
    expect(statements).toContain('DELETE FROM journey_correction_application');
    expect(statements).toContain('DELETE FROM journey_correction_scope_review');
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
    mockGetFirstAsync.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

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
