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
    mockGetAllAsync.mockReset(); mockGetAllAsync.mockResolvedValue([]);
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
      if (sql.includes('COUNT(DISTINCT country_code)')) return { journey_count: 2, place_count: 3, country_count: 1 };
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

  it('reads only redacted chronology, coarsened anchors, and journey states from the committed graph', async () => {
    mockGetAllAsync.mockResolvedValueOnce([{ journey_id: 'private:alpha', journey_state: 'inferred', latitude: 13.75632, longitude: 100.501765, display_ordinal: 1, year: 2024, first_year: 2024, last_year: 2025, ordering: 'chronological' }, { journey_id: 'private:beta', journey_state: 'possible-merge', latitude: null, longitude: null, display_ordinal: 2, year: null, first_year: null, last_year: null, ordering: 'uncertain' }]);

    const display = await createNativeReconstructionRepository().loadDurableReveal();

    expect(display.journeys).toMatchObject([
      { state: 'inferred', anchor: { latitude: 13.8, longitude: 100.5 }, years: [2024], periodLabel: '2024–2025', ordering: 'chronological' },
      { state: 'possible-merge', anchor: null, years: [], periodLabel: 'Date unknown', ordering: 'uncertain' },
    ]);
    expect(display.journeys.map((journey) => journey.displayId)).toEqual(expect.arrayContaining([expect.stringMatching(/^atlas-/)]));
    expect(JSON.stringify(display)).not.toContain('private:');
    const read = mockGetAllAsync.mock.calls[0][0] as string;
    expect(read).toContain('WITH journey_anchor AS');
    expect(read).toContain('MIN(visit.visit_id) AS visit_id');
    expect(read).toContain('WHERE journey.run_id = ?');
    expect(mockGetFirstAsync).toHaveBeenCalledWith('SELECT MAX(run_id) AS run_id FROM reconstruction_run WHERE status = \'complete\'');
    expect(read).not.toContain('source_ref');
    expect(read).toContain('journey_years');
    expect(read).toContain('first_year_count');
    expect(read).not.toContain('source_ref');
  });

  it('reads aggregate counts from one completed run without memberships or country detail', async () => {
    mockGetAllAsync.mockResolvedValueOnce([]);
    const display = await createNativeReconstructionRepository().loadDurableReveal();
    expect(display.statistics).toEqual({ journeyCount: 2, placeCount: 3, supportedCountryCount: 1, countryStatus: 'supported' });
    const statisticRead = mockGetFirstAsync.mock.calls.find(([sql]) => typeof sql === 'string' && sql.includes('COUNT(DISTINCT country_code)'))?.[0] as string;
    expect(statisticRead).toContain('reconstruction_journey');
    expect(statisticRead).toContain('reconstruction_place');
    expect(statisticRead).not.toContain('reconstruction_link');
    expect(statisticRead).not.toContain('canonical_evidence');
    expect(statisticRead).not.toContain('country_code AS');
  });

  it('resolves an opaque journey locally with separate visit support and membership-only memories', async () => {
    mockGetAllAsync.mockResolvedValueOnce([{ journey_id: 'private:alpha', journey_state: 'inferred', latitude: null, longitude: null, year: null, first_year: null, last_year: null, ordering: 'uncertain' }]);
    const repository = createNativeReconstructionRepository();
    const displayId = (await repository.loadDurableReveal()).journeys[0]?.displayId;
    mockGetAllAsync.mockReset();
    mockGetAllAsync
      .mockResolvedValueOnce([{ captured_day: '2024-01-01', has_precise_offset: 0, ordering: 'uncertain' }])
      .mockResolvedValueOnce([
        { captured_day: '2024-01-01', availability: 'available', source_ref: 'private:source-a', association: 'visit-support', disposition: null },
        { captured_day: null, availability: 'unavailable', source_ref: 'private:source-b', association: 'membership:inferred:ordered-24-hour-bracket', disposition: 'unresolved' },
      ]);

    const result = await repository.loadJourneyDetail(displayId!);

    expect(result.detail.memories.map((memory) => memory.association)).toEqual([
      'Supports an observed visit; this is not proof of owner presence.',
      'Associated with this journey as a memory (inferred ordered 24 hour bracket); separate from destination support.',
    ]);
    expect(result.detail.uncertainty).toEqual(expect.arrayContaining(['Visit ordering is uncertain.', 'Date precision is limited for part of this journey.', 'A source remains unresolved and is not treated as visit support.', 'A GPS-less or date-limited memory is associated with this journey without destination support.']));
    expect(result.previewSourceRefs).toEqual(['private:source-a', null]);
    expect(JSON.stringify(result.detail)).not.toContain('private:');
    expect(mockGetAllAsync.mock.calls[1][0]).toContain("link_kind LIKE 'membership:%'");
    expect(mockGetAllAsync.mock.calls[1][0]).toContain("'visit-support' AS association");
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
