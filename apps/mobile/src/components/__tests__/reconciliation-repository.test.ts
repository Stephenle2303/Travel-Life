import { createNativeReconstructionRepository } from '@/reconstruction';
import { applyJourneyCorrections, resolveVerifiedDuplicateFamilies } from '@/reconstruction/repository';
import type { ReconstructionGraph } from '@/reconstruction';

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
      if (sql.includes('COUNT(DISTINCT country_code)')) return { journey_count: 2, place_count: 3, country_count: 1, resolved_count: 3 };
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

  it('waits for an in-progress database writer when opening the reconstruction connection', async () => {
    await createNativeReconstructionRepository().loadDurableReveal();
    expect(mockExecAsync).toHaveBeenCalledWith('PRAGMA busy_timeout = 30000');
  });

  it('reads only aggregate sparse diagnostics from the completed run', async () => {
    mockGetFirstAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('private_record_lifecycle')) return { state: 'connected' };
      if (sql.includes('MAX(run_id)')) return { run_id: 7 };
      if (sql.includes('FROM reconstruction_disposition WHERE run_id = ?')) return { assessed: 2989, supported: 0, places: 0, visits: 0, missing_day: 1032, invalid_day: 0, unavailable: 0, duplicate_conflict: 0, insufficient_location: 1957, excluded: 0 };
      return null;
    });
    const display = await createNativeReconstructionRepository().loadDurableReveal();
    expect(display.diagnostics).toEqual({ assessed: 2989, supported: 0, places: 0, visits: 0, missingDay: 1032, invalidDay: 0, unavailable: 0, duplicateConflict: 0, insufficientLocation: 1957, excluded: 0 });
    const read = mockGetFirstAsync.mock.calls.find(([sql]) => typeof sql === 'string' && sql.includes('FROM reconstruction_disposition WHERE run_id = ?'))?.[0] as string;
    expect(read).toContain('reconstruction_visit');
    expect(read).not.toContain('evidence_id');
    expect(read).not.toContain('latitude');
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
      'Supports an observed visit; it does not prove owner presence.',
      'Associated with this journey as a memory (inferred ordered 24 hour bracket); separate from destination support. This source is unresolved; it is reviewable without being visit support.',
    ]);
    expect(result.detail.uncertainty).toEqual(expect.arrayContaining(['Visit ordering is uncertain.', 'Date precision is limited for part of this journey.', 'A source remains unresolved and is not treated as visit support.', 'A GPS-less or date-limited memory is associated with this journey without destination support.']));
    expect(result.previewSourceRefs).toEqual(['private:source-a', null]);
    expect(JSON.stringify(result.detail)).not.toContain('private:');
    expect(mockGetAllAsync.mock.calls[1][0]).toContain("link_kind LIKE 'membership:%'");
    expect(mockGetAllAsync.mock.calls[1][0]).toContain("'visit-support' AS association");
  });

  it('keeps an unknown associated-media reference available for bounded local resolution', async () => {
    mockGetAllAsync.mockResolvedValueOnce([{ journey_id: 'private:alpha', journey_state: 'inferred', latitude: null, longitude: null, year: null, first_year: null, last_year: null, ordering: 'uncertain' }]);
    const repository = createNativeReconstructionRepository();
    const displayId = (await repository.loadDurableReveal()).journeys[0]?.displayId;
    mockGetAllAsync.mockReset();
    mockGetAllAsync
      .mockResolvedValueOnce([{ captured_day: '2024-01-01', has_precise_offset: 0, ordering: 'uncertain' }])
      .mockResolvedValueOnce([
        { captured_day: '2024-01-01', availability: 'available', source_ref: 'private:source-a', association: 'visit-support', disposition: null },
        { captured_day: null, availability: 'unknown', source_ref: 'private:source-b', association: 'membership:inferred:ordered-24-hour-bracket', disposition: null },
      ]);

    const result = await repository.loadJourneyDetail(displayId!);

    expect(result.previewSourceRefs).toEqual(['private:source-a', 'private:source-b']);
  });

  it('stores the exact owner-visible snapshot only against its current completed run', async () => {
    mockGetFirstAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('private_record_lifecycle')) return { state: 'connected' };
      if (sql.includes('MAX(run_id)')) return { run_id: 7 };
      if (sql.includes('COUNT(DISTINCT country_code)')) return { journey_count: 1, place_count: 1, country_count: 1, resolved_count: 1 };
      return null;
    });
    mockGetAllAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('WITH journey_anchor AS')) return [{ journey_id: 'private:alpha', run_id: 7, journey_state: 'inferred', latitude: null, longitude: null, display_ordinal: 1, year: 2024, first_year: 2024, last_year: 2024, ordering: 'chronological' }];
      if (sql.includes('WITH visit_summary AS')) return [{ captured_day: '2024-01-01', has_precise_offset: 0, ordering: 'chronological' }];
      if (sql.includes('WITH journey_evidence AS')) return [{ captured_day: '2024-01-01', availability: 'available', source_ref: 'private:source-a', association: 'visit-support', disposition: null }];
      if (sql.includes('SELECT DISTINCT support.child_id AS evidence_id')) return [{ evidence_id: 'evidence-a' }];
      return [];
    });

    const repository = createNativeReconstructionRepository();
    const displayId = (await repository.loadDurableReveal()).journeys[0]?.displayId;
    const loaded = await repository.loadJourneyDetail(displayId!);
    await repository.saveJourneyCorrection(displayId!, 'confirm', loaded.snapshotToken, loaded.detail, 'command-1', 99);

    const insert = mockRunAsync.mock.calls.find(([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO journey_correction_revision'));
    expect(insert?.[0]).toContain('reviewed_snapshot_json');
    expect(insert?.[5]).toBe(JSON.stringify(['E:evidence-a']));
    expect(insert?.[8]).toContain('"title":"Private journey"');
    expect(insert?.[8]).toContain('"observedSpan":"Observed 2024-01-01"');
    expect(insert?.[8]).not.toContain('private:source-a');
    // The correction revision and its successor projection share the one
    // write transaction. A nested rebuild must not publish an intermediate run.
    expect(mockExecAsync.mock.calls.filter(([sql]) => sql === 'BEGIN IMMEDIATE TRANSACTION')).toHaveLength(1);
    expect(mockExecAsync.mock.calls.filter(([sql]) => sql === 'COMMIT')).toHaveLength(1);
  });

  it('persists a valid owner claim as a remappable revision without changing observed evidence', async () => {
    mockGetFirstAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('private_record_lifecycle')) return { state: 'connected' };
      if (sql.includes('MAX(run_id)')) return { run_id: 7 };
      return null;
    });
    mockGetAllAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('WITH journey_anchor AS')) return [{ journey_id: 'private:alpha', run_id: 7, journey_state: 'inferred', latitude: null, longitude: null, display_ordinal: 1, year: 2024, first_year: 2024, last_year: 2024, ordering: 'chronological' }];
      if (sql.includes('WITH visit_summary AS')) return [{ captured_day: '2024-01-01', has_precise_offset: 0, ordering: 'chronological' }];
      if (sql.includes('WITH journey_evidence AS')) return [];
      if (sql.includes('SELECT DISTINCT support.child_id AS evidence_id')) return [{ evidence_id: 'evidence-a', visit_id: 'visit:evidence-a' }];
      if (sql.includes('FROM journey_correction_revision WHERE state')) return [{ revision_id: 'claim-revision', action: 'claim', reviewed_support_json: JSON.stringify(['E:evidence-a']), reviewed_visits_json: JSON.stringify([['E:evidence-a']]) }];
      if (sql.includes('FROM canonical_evidence')) return [{ evidence_id: 'evidence-a', captured_at_millis: 0, captured_day: '2024-01-01', has_precise_offset: 1, latitude: 13, longitude: 100, reported_accuracy_meters: 10, availability: 'available' }];
      return [];
    });
    const repository = createNativeReconstructionRepository();
    const displayId = (await repository.loadDurableReveal()).journeys[0]?.displayId;
    const loaded = await repository.loadJourneyDetail(displayId!);
    await repository.saveJourneyCorrection(displayId!, 'claim', loaded.snapshotToken, loaded.detail, 'command-claim', { title: 'Winter break', date: { kind: 'exact', day: '2024-01-01' } }, 99);

    const insert = mockRunAsync.mock.calls.find(([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO journey_correction_revision'));
    expect(insert?.[0]).toContain('owner_title, owner_date_kind, owner_date_start, owner_date_end');
    expect(insert?.slice(-5, -1)).toEqual(['Winter break', 'exact', '2024-01-01', null]);
    expect(insert?.at(-1)).toBeNull();
    expect(insert?.[8]).toContain('"observedSpan":"Observed 2024-01-01"');
    expect(mockRunAsync).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO journey_correction_application'), expect.any(String), 7, 'journey', expect.any(String));
  });

  it('rejects malformed or inverted owner dates before writing a claim revision', async () => {
    mockGetFirstAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('private_record_lifecycle')) return { state: 'connected' };
      if (sql.includes('MAX(run_id)')) return { run_id: 7 };
      return null;
    });
    mockGetAllAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('WITH journey_anchor AS')) return [{ journey_id: 'private:alpha', run_id: 7, journey_state: 'inferred', latitude: null, longitude: null, display_ordinal: 1, year: 2024, first_year: 2024, last_year: 2024, ordering: 'chronological' }];
      if (sql.includes('WITH visit_summary AS')) return [{ captured_day: '2024-01-01', has_precise_offset: 0, ordering: 'chronological' }];
      if (sql.includes('WITH journey_evidence AS')) return [];
      return [];
    });
    const repository = createNativeReconstructionRepository();
    const displayId = (await repository.loadDurableReveal()).journeys[0]?.displayId;
    const loaded = await repository.loadJourneyDetail(displayId!);

    await expect(repository.saveJourneyCorrection(displayId!, 'claim', loaded.snapshotToken, loaded.detail, 'command-invalid-day', { title: 'Private', date: { kind: 'exact', day: '2024-02-31' } }, 99)).rejects.toThrow('exact owner date');
    await expect(repository.saveJourneyCorrection(displayId!, 'claim', loaded.snapshotToken, loaded.detail, 'command-inverted', { title: 'Private', date: { kind: 'approximate', startDay: '2024-03-10', endDay: '2024-03-01' } }, 99)).rejects.toThrow('ordered approximate date interval');
    expect(mockRunAsync.mock.calls.some(([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO journey_correction_revision'))).toBe(false);
  });

  it('records a rejection as a durable grouping constraint without a removed generated journey target', async () => {
    mockGetFirstAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('private_record_lifecycle')) return { state: 'connected' };
      if (sql.includes('MAX(run_id)')) return { run_id: 7 };
      if (sql.includes('COUNT(DISTINCT country_code)')) return { journey_count: 1, place_count: 1, country_count: 1, resolved_count: 1 };
      return null;
    });
    mockGetAllAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('WITH journey_anchor AS')) return [{ journey_id: 'private:alpha', run_id: 7, journey_state: 'inferred', latitude: null, longitude: null, display_ordinal: 1, year: 2024, first_year: 2024, last_year: 2024, ordering: 'chronological' }];
      if (sql.includes('WITH visit_summary AS')) return [{ captured_day: '2024-01-01', has_precise_offset: 0, ordering: 'chronological' }];
      if (sql.includes('WITH journey_evidence AS')) return [{ captured_day: '2024-01-01', availability: 'available', source_ref: 'private:source-a', association: 'visit-support', disposition: null }];
      if (sql.includes('SELECT DISTINCT support.child_id AS evidence_id')) return [{ evidence_id: 'evidence-a', visit_id: 'visit:evidence-a' }];
      if (sql.includes('FROM journey_correction_revision WHERE state')) return [{ revision_id: 'rejection-revision', action: 'reject', reviewed_support_json: JSON.stringify(['E:evidence-a']), reviewed_visits_json: JSON.stringify([['E:evidence-a']]) }];
      if (sql.includes('FROM canonical_evidence')) return [{ evidence_id: 'evidence-a', captured_at_millis: 0, captured_day: '2024-01-01', has_precise_offset: 1, latitude: 13, longitude: 100, reported_accuracy_meters: 10, availability: 'available' }];
      return [];
    });

    const repository = createNativeReconstructionRepository();
    const displayId = (await repository.loadDurableReveal()).journeys[0]?.displayId;
    const loaded = await repository.loadJourneyDetail(displayId!);
    await repository.saveJourneyCorrection(displayId!, 'reject', loaded.snapshotToken, loaded.detail, 'command-reject', 99);

    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO journey_correction_application'),
      expect.any(String),
      7,
      'grouping-constraint',
      null,
    );
  });

  it('rolls back a correction revision when its in-transaction projection write fails', async () => {
    mockGetFirstAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('private_record_lifecycle')) return { state: 'connected' };
      if (sql.includes('MAX(run_id)')) return { run_id: 7 };
      return null;
    });
    mockGetAllAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('WITH journey_anchor AS')) return [{ journey_id: 'private:alpha', run_id: 7, journey_state: 'inferred', latitude: null, longitude: null, display_ordinal: 1, year: 2024, first_year: 2024, last_year: 2024, ordering: 'chronological' }];
      if (sql.includes('WITH visit_summary AS')) return [{ captured_day: '2024-01-01', has_precise_offset: 0, ordering: 'chronological' }];
      if (sql.includes('WITH journey_evidence AS')) return [];
      if (sql.includes('SELECT DISTINCT support.child_id AS evidence_id')) return [{ evidence_id: 'evidence-a', visit_id: 'visit:evidence-a' }];
      return [];
    });
    mockRunAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('INSERT INTO reconstruction_run')) throw new Error('projection write failed');
    });
    const repository = createNativeReconstructionRepository();
    const displayId = (await repository.loadDurableReveal()).journeys[0]?.displayId;
    const loaded = await repository.loadJourneyDetail(displayId!);

    await expect(repository.saveJourneyCorrection(displayId!, 'confirm', loaded.snapshotToken, loaded.detail, 'command-rollback', 99)).rejects.toThrow('projection write failed');
    expect(mockRunAsync.mock.calls.some(([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO journey_correction_revision'))).toBe(true);
    expect(mockExecAsync).toHaveBeenCalledWith('ROLLBACK');
    expect(mockExecAsync).not.toHaveBeenCalledWith('COMMIT');
  });

  it('rejects a stale correction preview before writing a revision', async () => {
    mockGetFirstAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('private_record_lifecycle')) return { state: 'connected' };
      if (sql.includes('MAX(run_id)')) return { run_id: 7 };
      return null;
    });
    mockGetAllAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('WITH journey_anchor AS')) return [{ journey_id: 'private:alpha', run_id: 7, journey_state: 'inferred', latitude: null, longitude: null, display_ordinal: 1, year: 2024, first_year: 2024, last_year: 2024, ordering: 'chronological' }];
      if (sql.includes('WITH visit_summary AS')) return [{ captured_day: '2024-01-01', has_precise_offset: 0, ordering: 'chronological' }];
      if (sql.includes('WITH journey_evidence AS')) return [];
      return [];
    });
    const repository = createNativeReconstructionRepository();
    const displayId = (await repository.loadDurableReveal()).journeys[0]?.displayId;
    const loaded = await repository.loadJourneyDetail(displayId!);
    mockGetFirstAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('private_record_lifecycle')) return { state: 'connected' };
      if (sql.includes('MAX(run_id)')) return { run_id: 8 };
      return null;
    });

    await expect(repository.saveJourneyCorrection(displayId!, 'confirm', loaded.snapshotToken, loaded.detail, 'command-stale', 99)).rejects.toThrow('Review is stale');
    expect(mockRunAsync.mock.calls.some(([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO journey_correction_revision'))).toBe(false);
    expect(mockExecAsync).toHaveBeenCalledWith('ROLLBACK');
  });

  it('rolls back when the private record disconnects before correction commit', async () => {
    let lifecycleReads = 0;
    mockGetFirstAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('private_record_lifecycle')) {
        lifecycleReads += 1;
        return { state: lifecycleReads >= 5 ? 'disconnected' : 'connected' };
      }
      if (sql.includes('MAX(run_id)')) return { run_id: 7 };
      return null;
    });
    mockGetAllAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('WITH journey_anchor AS')) return [{ journey_id: 'private:alpha', run_id: 7, journey_state: 'inferred', latitude: null, longitude: null, display_ordinal: 1, year: 2024, first_year: 2024, last_year: 2024, ordering: 'chronological' }];
      if (sql.includes('WITH visit_summary AS')) return [{ captured_day: '2024-01-01', has_precise_offset: 0, ordering: 'chronological' }];
      if (sql.includes('WITH journey_evidence AS')) return [];
      if (sql.includes('SELECT DISTINCT support.child_id AS evidence_id')) return [{ evidence_id: 'evidence-a', visit_id: 'visit:evidence-a' }];
      return [];
    });
    const repository = createNativeReconstructionRepository();
    const displayId = (await repository.loadDurableReveal()).journeys[0]?.displayId;
    const loaded = await repository.loadJourneyDetail(displayId!);

    await expect(repository.saveJourneyCorrection(displayId!, 'confirm', loaded.snapshotToken, loaded.detail, 'command-disconnect', 99)).rejects.toThrow('Private record is unavailable');
    expect(mockRunAsync.mock.calls.some(([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO journey_correction_revision'))).toBe(true);
    expect(mockExecAsync).toHaveBeenCalledWith('ROLLBACK');
    expect(mockExecAsync).not.toHaveBeenCalledWith('COMMIT');
  });

  it('returns an idempotent correction command without writing another projection', async () => {
    let commandAlreadyCommitted = false;
    mockGetFirstAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('private_record_lifecycle')) return { state: 'connected' };
      if (sql.includes('MAX(run_id)')) return { run_id: 7 };
      if (sql.includes('command_key') && commandAlreadyCommitted) return { revision_id: 'revision-1', action: 'confirm' };
      return null;
    });
    mockGetAllAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('WITH journey_anchor AS')) return [{ journey_id: 'private:alpha', run_id: 7, journey_state: 'inferred', latitude: null, longitude: null, display_ordinal: 1, year: 2024, first_year: 2024, last_year: 2024, ordering: 'chronological' }];
      if (sql.includes('WITH visit_summary AS')) return [{ captured_day: '2024-01-01', has_precise_offset: 0, ordering: 'chronological' }];
      if (sql.includes('WITH journey_evidence AS')) return [];
      return [];
    });
    const repository = createNativeReconstructionRepository();
    const displayId = (await repository.loadDurableReveal()).journeys[0]?.displayId;
    const loaded = await repository.loadJourneyDetail(displayId!);
    commandAlreadyCommitted = true;
    const result = await repository.saveJourneyCorrection(displayId!, 'confirm', loaded.snapshotToken, loaded.detail, 'command-1', 99);

    expect(result).toEqual({ revisionId: 'revision-1', state: 'confirmed', graph: null });
    expect(mockRunAsync).not.toHaveBeenCalled();
    expect(mockExecAsync.mock.calls.filter(([sql]) => sql === 'BEGIN IMMEDIATE TRANSACTION')).toHaveLength(1);
    expect(mockExecAsync.mock.calls.filter(([sql]) => sql === 'COMMIT')).toHaveLength(1);
  });

  it('records an unresolved remap separately without demoting the committed application', async () => {
    mockGetFirstAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('private_record_lifecycle')) return { state: 'connected' };
      if (sql.includes('SELECT source_run_id FROM journey_correction_revision')) return { source_run_id: 7 };
      return null;
    });

    await createNativeReconstructionRepository().markJourneyCorrectionPending('revision-1');

    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO journey_correction_candidate'),
      expect.stringMatching(/^candidate-revision-1-/),
      'revision-1',
      7,
      expect.any(String),
      expect.any(Number),
    );
    expect(mockRunAsync.mock.calls.some(([sql]) => typeof sql === 'string' && sql.includes('UPDATE journey_correction_application'))).toBe(false);
    expect(mockExecAsync).toHaveBeenCalledWith('COMMIT');
  });

  it('records an ambiguous memory correction in its own durable remap queue', async () => {
    mockGetFirstAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('private_record_lifecycle')) return { state: 'connected' };
      if (sql.includes('journey_memory_correction_revision')) return { source_run_id: 7 };
      return null;
    });

    await createNativeReconstructionRepository().markJourneyCorrectionPending('memory-revision-1');

    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO journey_memory_correction_candidate'),
      expect.stringMatching(/^memory-candidate-memory-revision-1-/),
      'memory-revision-1',
      7,
      expect.stringContaining('no longer maps uniquely'),
      expect.any(Number),
    );
    expect(mockRunAsync.mock.calls.some(([sql]) => typeof sql === 'string' && sql.includes('UPDATE journey_memory_correction_application'))).toBe(false);
    expect(mockExecAsync).toHaveBeenCalledWith('COMMIT');
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

describe('verified duplicate-family correction identity', () => {
  const row = (evidence_id: string, fingerprint = 'tuple-v1', family = 'family-a') => ({
    evidence_id, captured_at_millis: 1, captured_day: '2024-01-01', has_precise_offset: 1 as const,
    availability: 'available' as const, latitude: 1, longitude: 2, reported_accuracy_meters: 10,
    platform_duplicate_family_id: family, source_origin: 'platform', support_eligible: 1,
    duplicate_tuple_version: 1, duplicate_tuple_fingerprint: fingerprint,
  });
  const graph: ReconstructionGraph = {
    ruleVersion: 'reconstruction-v1', places: [], visits: [{ id: 'visit:a', placeId: 'place:a', evidenceIds: ['a'], order: 'ordered' }],
    journeys: [{ id: 'journey:a', visitIds: ['visit:a'], state: 'inferred' }], memberships: [], possibleMerges: [], dispositions: [],
  };

  it('uses one F support key only for a complete equal platform family and remaps its correction', () => {
    const families = resolveVerifiedDuplicateFamilies([row('a'), row('b')]);
    expect(families.keyForEvidence('a')).toBe('F:family-a');
    const snapshots = families.snapshotsFor(['F:family-a']);
    const applied = applyJourneyCorrections(graph, [{
      revision_id: 'family-correction', action: 'confirm', reviewed_support_json: JSON.stringify(['F:family-a']),
      reviewed_visits_json: JSON.stringify([['F:family-a']]), reviewed_family_snapshot_json: JSON.stringify(snapshots),
    }], false, families);
    expect(applied.matches.get('family-correction')).toBe('journey:a');
  });

  it('fails closed for a conflicting or changed family snapshot', () => {
    const conflicted = resolveVerifiedDuplicateFamilies([row('a'), row('b', 'different')]);
    expect(conflicted.keyForEvidence('a')).toBe('E:a');
    expect(conflicted.conflictForEvidence('a')).toBe(true);

    const original = resolveVerifiedDuplicateFamilies([row('a'), row('b')]);
    const changed = resolveVerifiedDuplicateFamilies([row('a', 'tuple-v2'), row('b', 'tuple-v2')]);
    const correction = {
      revision_id: 'changed-family', action: 'confirm' as const, reviewed_support_json: JSON.stringify(['F:family-a']),
      reviewed_visits_json: JSON.stringify([['F:family-a']]), reviewed_family_snapshot_json: JSON.stringify(original.snapshotsFor(['F:family-a'])),
    };
    expect(() => applyJourneyCorrections(graph, [correction], false, changed)).toThrow('owner remap');
  });
});
