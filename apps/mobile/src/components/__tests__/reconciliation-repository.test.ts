import { createNativeReconstructionRepository } from '@/reconstruction';

const mockExecAsync = jest.fn();
const mockRunAsync = jest.fn();
const mockGetFirstAsync = jest.fn();
const mockGetAllAsync = jest.fn();
const mockOpenDatabaseAsync = jest.fn();

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: (...args: unknown[]) => mockOpenDatabaseAsync(...args) }));

describe('durable local reconciliation repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExecAsync.mockResolvedValue(undefined); mockRunAsync.mockResolvedValue(undefined);
    mockOpenDatabaseAsync.mockResolvedValue({ execAsync: mockExecAsync, runAsync: mockRunAsync, getFirstAsync: mockGetFirstAsync, getAllAsync: mockGetAllAsync });
    mockGetFirstAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('private_record_lifecycle')) return { state: 'connected' };
      if (sql.includes('reconciliation_checkpoint')) return { snapshot_revision: 4 };
      if (sql.includes('COUNT(*) AS count FROM maintenance_change_queue')) return { count: 1 };
      if (sql.includes('COUNT(*) AS count FROM reconciliation_queue_snapshot')) return { count: 1 };
      if (sql.includes('canonical_evidence_revision')) return { canonical_evidence_revision: 2 };
      if (sql.includes('MAX(revision)')) return { revision: 1 };
      if (sql.includes('MAX(run_id)')) return { run_id: 7 };
      return null;
    });
    mockGetAllAsync.mockResolvedValue([]);
  });

  it('snapshots and acknowledges only covered queue rows after the complete local projection is written', async () => {
    const result = await createNativeReconstructionRepository().reconcileQueued(50);

    expect(result.graph.ruleVersion).toBe('reconstruction-v1');
    expect(mockRunAsync).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO reconciliation_queue_snapshot'), 5);
    expect(mockRunAsync).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO reconciliation_lease'), 1, 1, 300050);
    expect(mockRunAsync).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM maintenance_change_queue WHERE EXISTS'), 5);
    expect(mockRunAsync).toHaveBeenCalledWith('DELETE FROM reconciliation_queue_snapshot WHERE snapshot_revision = ?', 5);
    expect(mockRunAsync.mock.calls.flat().join('\n')).toContain('reconciliation_unresolved_remap');
    expect(mockExecAsync).toHaveBeenCalledWith('COMMIT');
  });

  it('reads only coarsened map anchors and journey states from the committed graph', async () => {
    mockGetAllAsync.mockResolvedValueOnce([{ journey_state: 'inferred', latitude: 13.75632, longitude: 100.501765 }, { journey_state: 'possible-merge', latitude: null, longitude: null }]);

    const display = await createNativeReconstructionRepository().loadDurableReveal();

    expect(display).toEqual({ journeys: [
      { state: 'inferred', anchor: { latitude: 13.8, longitude: 100.5 } },
      { state: 'possible-merge', anchor: null },
    ] });
    const read = mockGetAllAsync.mock.calls[0][0] as string;
    expect(read).toContain('WITH journey_anchor AS');
    expect(read).toContain('MIN(visit.visit_id) AS visit_id');
    expect(read).toContain('WHERE journey.run_id = (SELECT MAX(run_id) FROM reconstruction_run WHERE status = \'complete\')');
    expect(read).not.toContain('source_ref');
    expect(read).not.toContain('captured_day');
  });

  it('refuses an overlapping reconciliation lease without snapshotting or acknowledging queue rows', async () => {
    mockGetFirstAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('private_record_lifecycle')) return { state: 'connected' };
      if (sql.includes('reconciliation_lease')) return { expires_at_millis: 1000 };
      return null;
    });

    await expect(createNativeReconstructionRepository().reconcileQueued(50)).rejects.toThrow('already running');
    expect(mockRunAsync.mock.calls.some(([sql]) => typeof sql === 'string' && sql.includes('reconciliation_queue_snapshot'))).toBe(false);
    expect(mockRunAsync.mock.calls.some(([sql]) => typeof sql === 'string' && sql.includes('DELETE FROM maintenance_change_queue WHERE EXISTS'))).toBe(false);
  });

  it('leaves confirmed, rejected, and owner-entered history outside the inferred remap review', async () => {
    mockGetAllAsync.mockImplementation(async (sql: string) => sql.includes('JOIN inferred_history')
      ? [{ overlay_id: 'overlay:inferred', target_id: 'journey:old', identity_lineage_id: 'lineage:old' }]
      : []);

    await createNativeReconstructionRepository().reconcileQueued(50);

    const sql = mockGetAllAsync.mock.calls.map(([statement]) => statement).join('\n');
    expect(sql).toContain("history.history_state = 'inferred'");
    expect(mockRunAsync).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO reconciliation_unresolved_remap'), 'overlay:inferred', 'journey:old', 'lineage:old', expect.stringContaining('needs owner review'));
    expect(mockRunAsync.mock.calls.flat().join('\n')).not.toContain('DELETE FROM inferred_history');
  });

  it('rolls back the snapshot and leaves its queue acknowledgement uncommitted on a projection failure', async () => {
    mockRunAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('INSERT INTO reconstruction_run')) throw new Error('write failed');
    });

    await expect(createNativeReconstructionRepository().reconcileQueued(50)).rejects.toThrow('write failed');
    expect(mockExecAsync).toHaveBeenCalledWith('ROLLBACK');
    expect(mockRunAsync.mock.calls.some(([sql]) => typeof sql === 'string' && sql.includes('DELETE FROM maintenance_change_queue WHERE EXISTS'))).toBe(false);
  });

  it('keeps queued changes pending when permitted photo access changes before acknowledgement', async () => {
    await expect(createNativeReconstructionRepository().reconcileQueued(50, async () => false)).rejects.toThrow('not permitted');
    expect(mockExecAsync).toHaveBeenCalledWith('ROLLBACK');
    expect(mockRunAsync.mock.calls.some(([sql]) => typeof sql === 'string' && sql.includes('DELETE FROM maintenance_change_queue WHERE EXISTS'))).toBe(false);
  });

  it('keeps owner history corrections pending rather than rebuilding around them', async () => {
    mockGetFirstAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('private_record_lifecycle')) return { state: 'connected' };
      if (sql.includes('reconciliation_checkpoint')) return { snapshot_revision: 4 };
      if (sql.includes('COUNT(*) AS count FROM maintenance_change_queue')) return { count: 1 };
      if (sql.includes('COUNT(*) AS count FROM reconciliation_queue_snapshot')) return { count: 1 };
      if (sql.includes('FROM correction_overlays')) return { count: 1 };
      return null;
    });

    await expect(createNativeReconstructionRepository().reconcileQueued(50)).rejects.toThrow('need owner review');
    expect(mockExecAsync).toHaveBeenCalledWith('ROLLBACK');
    expect(mockRunAsync.mock.calls.some(([sql]) => typeof sql === 'string' && sql.includes('DELETE FROM maintenance_change_queue WHERE EXISTS'))).toBe(false);
  });
});
