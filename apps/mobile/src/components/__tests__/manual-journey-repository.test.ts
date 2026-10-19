import { createNativeReconstructionRepository } from '@/reconstruction';
import type { ManualJourneyInput } from '@/import-record';

const mockExecAsync = jest.fn(); const mockRunAsync = jest.fn(); const mockGetFirstAsync = jest.fn(); const mockGetAllAsync = jest.fn(); const mockOpenDatabaseAsync = jest.fn();
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: (...args: unknown[]) => mockOpenDatabaseAsync(...args) }));

const input: ManualJourneyInput = { commandKey: 'manual:retry-key', label: 'Kyoto', context: 'Japan', anchor: { latitude: 35.74, longitude: 139.76 }, date: { kind: 'exact', day: '2024-04-01' }, reviewedOverlapIds: [] };

describe('manual journey repository boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks(); mockExecAsync.mockResolvedValue(undefined); mockRunAsync.mockResolvedValue(undefined); mockGetAllAsync.mockResolvedValue([]);
    mockOpenDatabaseAsync.mockResolvedValue({ execAsync: mockExecAsync, runAsync: mockRunAsync, getFirstAsync: mockGetFirstAsync, getAllAsync: mockGetAllAsync });
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
  it('rolls back and never inserts when overlap state changes after review', async () => {
    mockGetFirstAsync.mockImplementation(async (sql: string) => sql.includes('private_record_lifecycle') ? { state: 'connected' } : sql.includes('WHERE command_key') ? null : sql.includes('MAX(run_id)') ? null : null);
    mockGetAllAsync.mockResolvedValue([{ manual_id: 'late' }]);
    await expect(createNativeReconstructionRepository().createManualJourney(input)).rejects.toThrow(/changed after overlap review/);
    expect(mockExecAsync).toHaveBeenCalledWith('ROLLBACK');
    expect(mockRunAsync.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO manual_journey'))).toBe(false);
  });
});
