import { createTravelWindowStorage } from '@/travel-window/storage';
import { CURRENT_SCHEMA_VERSION, journeyPrivacyTableDefinition } from '@/import-record/repository';
import type { AppDiagnosticEvent } from '@/diagnostics/app-diagnostics';

jest.mock('@/diagnostics/app-diagnostics', () => {
  const actual = jest.requireActual('@/diagnostics/app-diagnostics');
  return { ...actual, recordAppDiagnostic: (event: unknown) => recordedEvents.push(event as AppDiagnosticEvent) };
});

const recordedEvents: AppDiagnosticEvent[] = [];
const mockExecAsync = jest.fn();
const mockRunAsync = jest.fn();
const mockGetFirstAsync = jest.fn();
const mockGetAllAsync = jest.fn();
const mockOpenDatabaseAsync = jest.fn();

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: (...args: unknown[]) => mockOpenDatabaseAsync(...args) }));

function readyDatabase() {
  mockOpenDatabaseAsync.mockResolvedValue({
    execAsync: mockExecAsync, runAsync: mockRunAsync, getAllAsync: mockGetAllAsync,
    getFirstAsync: (sql: string, ...args: unknown[]) =>
      sql.includes("name = 'journey_privacy_revision'") ? Promise.resolve({ sql: journeyPrivacyTableDefinition }) : mockGetFirstAsync(sql, ...args),
  });
  // Already-current schema: ensureNativeImportSchema takes the fast no-migration path.
  mockGetFirstAsync.mockImplementation(async (sql: string) => sql.includes('import_schema_version') ? { version: CURRENT_SCHEMA_VERSION } : sql.includes('private_record_lifecycle') ? { state: 'connected' } : null);
  mockExecAsync.mockResolvedValue(undefined);
  mockRunAsync.mockResolvedValue(undefined);
  mockGetAllAsync.mockResolvedValue([]);
}

describe('travel-window production storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    recordedEvents.length = 0;
    readyDatabase();
  });

  it('reads an empty scan state as null cursor and no captures', async () => {
    const state = await createTravelWindowStorage().readScanState();
    expect(state).toEqual({ captures: [], cursor: { backfillCursorMillis: null, backfillComplete: false, newestCursorMillis: null } });
  });

  it('maps cached rows back into CaptureRecord and a real cursor', async () => {
    mockGetAllAsync.mockImplementation(async (sql: string) => sql.includes('travel_window_capture') ? [
      { asset_id: 'a1', captured_at_millis: 1000, utc_offset_minutes: 540, provenance: 'camera', located: 0 },
      { asset_id: 'a2', captured_at_millis: 2000, utc_offset_minutes: null, provenance: 'imported', located: 1 },
      { asset_id: 'a3', captured_at_millis: 3000, utc_offset_minutes: null, provenance: 'not-a-real-class', located: 0 },
    ] : []);
    mockGetFirstAsync.mockImplementation(async (sql: string) =>
      sql.includes('import_schema_version') ? { version: CURRENT_SCHEMA_VERSION }
        : sql.includes('travel_window_state') ? { backfill_cursor_millis: 500, backfill_complete: 1, newest_cursor_millis: 9000 }
          : null);
    const state = await createTravelWindowStorage().readScanState();
    expect(state.cursor).toEqual({ backfillCursorMillis: 500, backfillComplete: true, newestCursorMillis: 9000 });
    expect(state.captures).toEqual([
      { id: 'a1', capturedAtMillis: 1000, utcOffsetMinutes: 540, provenance: 'camera', located: false },
      { id: 'a2', capturedAtMillis: 2000, utcOffsetMinutes: null, provenance: 'imported', located: true },
      { id: 'a3', capturedAtMillis: 3000, utcOffsetMinutes: null, provenance: 'unknown', located: false },
    ]);
  });

  it('upserts each record and advances only the cursor fields given', async () => {
    await createTravelWindowStorage().writeScanBatch(
      [{ id: 'a1', capturedAtMillis: 1000, utcOffsetMinutes: 540, provenance: 'camera', located: false }],
      { backfillCursorMillis: 1000, backfillComplete: false },
    );
    expect(mockRunAsync).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO travel_window_capture'), 'a1', 1000, 540, 'camera', 0);
    const stateUpdate = mockRunAsync.mock.calls.find(([sql]) => typeof sql === 'string' && sql.startsWith('UPDATE travel_window_state'));
    expect(stateUpdate?.[0]).toBe('UPDATE travel_window_state SET backfill_cursor_millis = ?, backfill_complete = ? WHERE record_id = 1');
    expect(stateUpdate?.slice(1)).toEqual([1000, 0]);
  });

  it('writes no state update when no cursor field is given', async () => {
    await createTravelWindowStorage().writeScanBatch([], {});
    expect(mockRunAsync.mock.calls.some(([sql]) => typeof sql === 'string' && sql.startsWith('UPDATE travel_window_state'))).toBe(false);
  });

  it('reads dispositions as a command-to-decision map', async () => {
    mockGetAllAsync.mockImplementation(async (sql: string) => sql.includes('travel_window_disposition')
      ? [{ command: 'travel-window-v1:1:2', decision: 'dismissed' }, { command: 'travel-window-v1:3:4', decision: 'confirmed' }] : []);
    const dispositions = await createTravelWindowStorage().readDispositions();
    expect(dispositions.get('travel-window-v1:1:2')).toBe('dismissed');
    expect(dispositions.get('travel-window-v1:3:4')).toBe('confirmed');
    expect(dispositions.size).toBe(2);
  });

  const seoul = { name: 'Seoul', context: 'South Korea', latitude: 37.5, longitude: 127.0 };
  const dateRange = { startDay: '2026-11-03', endDay: '2026-11-05' };

  it('confirming a window writes the trip, disposition and a real manual_journey together', async () => {
    await createTravelWindowStorage().confirmWindow('travel-window-v1:1:2', 'manual-1', ['a1', 'a2'], ['a3'], seoul, dateRange);
    expect(mockRunAsync).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO travel_window_trip'), 'manual-1', 'travel-window-v1:1:2', JSON.stringify(['a1', 'a2']), JSON.stringify(['a3']), 'Seoul');
    expect(mockRunAsync).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO travel_window_disposition'), 'travel-window-v1:1:2', 'confirmed', 'manual-1');
    expect(mockRunAsync).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO manual_journey'),
      'manual-1', 'travel-window-v1:1:2', 'Seoul', 'South Korea', 37.5, 127.0, 'approximate', '2026-11-03', '2026-11-05', expect.any(Number));
    expect(mockExecAsync).toHaveBeenCalledWith('BEGIN IMMEDIATE TRANSACTION');
    expect(mockExecAsync).toHaveBeenCalledWith('COMMIT');
  });

  it('uses date_kind exact for a single-day window', async () => {
    await createTravelWindowStorage().confirmWindow('travel-window-v1:1:2', 'manual-1', ['a1'], [], seoul, { startDay: '2026-11-03', endDay: '2026-11-03' });
    expect(mockRunAsync).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO manual_journey'),
      'manual-1', 'travel-window-v1:1:2', 'Seoul', 'South Korea', 37.5, 127.0, 'exact', '2026-11-03', '2026-11-03', expect.any(Number));
  });

  it('attaches only member photos that already have a canonical_evidence row, in order, skipping the rest', async () => {
    mockGetAllAsync.mockImplementation(async (sql: string) => sql.includes('canonical_evidence')
      ? [{ evidence_id: 'ev-a1', source_ref: 'a1' }, { evidence_id: 'ev-a3', source_ref: 'a3' }] : []);
    await createTravelWindowStorage().confirmWindow('travel-window-v1:1:2', 'manual-1', ['a1', 'a2', 'a3'], ['a4'], seoul, dateRange);
    expect(mockRunAsync).toHaveBeenCalledWith('INSERT INTO travel_window_album (manual_id, slot, evidence_id, source_ref) VALUES (?, ?, ?, ?)', 'manual-1', 1, 'ev-a1', 'a1');
    expect(mockRunAsync).toHaveBeenCalledWith('INSERT INTO travel_window_album (manual_id, slot, evidence_id, source_ref) VALUES (?, ?, ?, ?)', 'manual-1', 2, 'ev-a3', 'a3');
    expect(mockRunAsync.mock.calls.filter(([sql]) => typeof sql === 'string' && sql.includes('travel_window_album'))).toHaveLength(2);
    // Review-only ids (a4) are never looked up or attached.
    const evidenceQuery = mockGetAllAsync.mock.calls.find(([sql]) => typeof sql === 'string' && sql.includes('canonical_evidence'));
    expect(evidenceQuery?.slice(1)).toEqual(['a1', 'a2', 'a3']);
  });

  it('attaches nothing when no member photo has a matching canonical_evidence row yet', async () => {
    await createTravelWindowStorage().confirmWindow('travel-window-v1:1:2', 'manual-1', ['a1'], [], seoul, dateRange);
    expect(mockRunAsync.mock.calls.some(([sql]) => typeof sql === 'string' && sql.includes('travel_window_album'))).toBe(false);
  });

  it('dismissing a window writes only a dismissed disposition, no trip row', async () => {
    await createTravelWindowStorage().dismissWindow('travel-window-v1:1:2');
    expect(mockRunAsync).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO travel_window_disposition'), 'travel-window-v1:1:2', 'dismissed', null);
    expect(mockRunAsync.mock.calls.some(([sql]) => typeof sql === 'string' && sql.includes('travel_window_trip'))).toBe(false);
  });

  it('records one COMPLETE diagnostic per successful call, with the storage boundary stage', async () => {
    await createTravelWindowStorage().readScanState();
    expect(recordedEvents).toEqual([
      expect.objectContaining({ operation: 'TRAVEL_WINDOW_SCAN', stage: 'TRAVEL_WINDOW_CACHE_READ', reasonCode: 'COMPLETE', durableOutcome: 'complete', retryable: false }),
    ]);
    expect(typeof recordedEvents[0]!.correlationId).toBe('string');
  });

  it('classifies a failure with the closed reason code and never includes the raw error', async () => {
    const secret = 'select * from travel_window_capture where asset_id = SECRET_PATH_xyz';
    mockGetAllAsync.mockRejectedValueOnce(new Error(`database is locked: ${secret}`));
    await expect(createTravelWindowStorage().readScanState()).rejects.toThrow();
    expect(recordedEvents).toHaveLength(1);
    expect(recordedEvents[0]).toMatchObject({ operation: 'TRAVEL_WINDOW_SCAN', stage: 'TRAVEL_WINDOW_CACHE_READ', reasonCode: 'DATABASE_BUSY', durableOutcome: 'failed', retryable: true });
    expect(JSON.stringify(recordedEvents[0])).not.toContain(secret);
  });

  it('classifies a confirm/dismiss write failure under the review stage', async () => {
    mockRunAsync.mockRejectedValueOnce(new Error('constraint failed'));
    await expect(createTravelWindowStorage().dismissWindow('travel-window-v1:1:2')).rejects.toThrow();
    expect(recordedEvents).toEqual([expect.objectContaining({ stage: 'TRAVEL_WINDOW_REVIEW', reasonCode: 'CONSTRAINT', durableOutcome: 'failed' })]);
  });

  it('reuses one open connection across repeated calls', async () => {
    const storage = createTravelWindowStorage();
    await storage.readScanState();
    await storage.readDispositions();
    expect(mockOpenDatabaseAsync).toHaveBeenCalledTimes(1);
  });
});
