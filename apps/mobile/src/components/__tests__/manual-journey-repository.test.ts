import { createNativeReconstructionRepository } from '@/reconstruction';
import { journeyPrivacyTableDefinition } from '@/import-record/repository';
import type { ManualJourneyInput } from '@/import-record';

const mockExecAsync = jest.fn(); const mockRunAsync = jest.fn(); const mockGetFirstAsync = jest.fn(); const mockGetAllAsync = jest.fn(); const mockOpenDatabaseAsync = jest.fn();
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: (...args: unknown[]) => mockOpenDatabaseAsync(...args) }));

const input: ManualJourneyInput = { commandKey: 'manual:retry-key', label: 'Kyoto', context: 'Japan', anchor: { latitude: 35.74, longitude: 139.76 }, date: { kind: 'exact', day: '2024-04-01' }, reviewedOverlapIds: [] };

describe('manual journey repository boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks(); mockExecAsync.mockResolvedValue(undefined); mockRunAsync.mockResolvedValue(undefined); mockGetAllAsync.mockResolvedValue([]);
    mockOpenDatabaseAsync.mockResolvedValue({ execAsync: mockExecAsync, runAsync: mockRunAsync, getFirstAsync: (sql: string, ...args: unknown[]) => sql.includes("name = 'journey_privacy_revision'") ? Promise.resolve({ sql: journeyPrivacyTableDefinition }) : mockGetFirstAsync(sql, ...args), getAllAsync: mockGetAllAsync });
  });
  it('coarsens, inserts, reads back, and retries one command idempotently', async () => {
    mockGetFirstAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('private_record_lifecycle')) return { state: 'connected' };
      if (sql.includes('WHERE command_key')) return null;
      if (sql.includes('WHERE manual_id')) return { manual_id: expect.any(String) };
      if (sql.includes('MAX(run_id)')) return null;
      return null;
    });
    const repository = createNativeReconstructionRepository();
    const id = await repository.createManualJourney(input);
    expect(id).toMatch(/^manual:manual-/);
    expect(mockRunAsync).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO manual_journey'), expect.any(String), input.commandKey, 'Kyoto', 'Japan', 35.7, 139.8, 'exact', '2024-04-01', '2024-04-01', expect.any(Number));
    mockGetFirstAsync.mockImplementation(async (sql: string) => sql.includes('private_record_lifecycle') ? { state: 'connected' } : sql.includes('WHERE command_key') ? { manual_id: 'stable' } : null);
    await expect(repository.createManualJourney(input)).resolves.toBe('manual:stable');
    expect(mockRunAsync.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO manual_journey'))).toHaveLength(1);
  });

  it('migrates a v32 private database before the direct reconstruction open queries manual dates', async () => {
    mockGetFirstAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('import_schema_version')) return { version: 32 };
      if (sql.includes('private_record_lifecycle')) return { state: 'connected' };
      if (sql.includes('MAX(run_id)')) return null;
      return null;
    });

    await createNativeReconstructionRepository().findManualJourneyOverlaps(input);

    expect(mockExecAsync.mock.calls.flat().join('\n')).toContain('CREATE TABLE IF NOT EXISTS manual_journey');
    expect(mockExecAsync.mock.calls.flat().join('\n')).toContain('date_start TEXT NOT NULL');
    expect(mockRunAsync).toHaveBeenCalledWith('UPDATE import_schema_version SET version = ?', 37);
  });

  it('opens a fresh native connection for the manually entered journey path after an Android runtime restart', async () => {
    mockGetFirstAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('import_schema_version')) return { version: 33 };
      if (sql.includes('private_record_lifecycle')) return { state: 'connected' };
      if (sql.includes('MAX(run_id)')) return null;
      return null;
    });

    await createNativeReconstructionRepository().findManualJourneyOverlaps(input);

    expect(mockOpenDatabaseAsync).toHaveBeenCalledWith('travel-life-import-v1.db', { useNewConnection: true });
  });

  it('rolls back and never inserts when overlap state changes after review', async () => {
    mockGetFirstAsync.mockImplementation(async (sql: string) => sql.includes('private_record_lifecycle') ? { state: 'connected' } : sql.includes('WHERE command_key') ? null : sql.includes('MAX(run_id)') ? null : null);
    mockGetAllAsync.mockImplementation(async (sql: string) => sql.includes('FROM manual_journey WHERE date_start') ? [{ manual_id: 'late' }] : []);
    await expect(createNativeReconstructionRepository().createManualJourney(input)).rejects.toThrow(/changed after overlap review/);
    expect(mockExecAsync).toHaveBeenCalledWith('ROLLBACK');
    expect(mockRunAsync.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO manual_journey'))).toBe(false);
  });
});
