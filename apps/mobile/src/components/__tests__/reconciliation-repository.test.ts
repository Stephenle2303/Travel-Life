import { createNativeReconstructionRepository } from '@/reconstruction';
import { applyJourneyCorrections, constructCanonicalV11Graph, mapCorrectionsToCommittedJourneys, mergeContinuousAwayJourneysV11, qualifyGraphJourneyV11, resolvePlaceCountryCode, resolveVerifiedDuplicateFamilies } from '@/reconstruction/repository';
import type { ReconstructionGraph } from '@/reconstruction';
import { projectReveal, assertRevealPayload } from '@/reveal/projection';

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
      if (sql.includes('COUNT(DISTINCT place.country_code)')) return { journey_count: 2, place_count: 3, country_count: 1, resolved_count: 3 };
      return null;
    });
    mockGetAllAsync.mockResolvedValue([]);
  });

  it('carries a supported Bali label from committed visit support through Atlas and detail while preserving owner titles', async () => {
    mockGetAllAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('WITH journey_anchor AS')) return [{ journey_id: 'private:bali', run_id: 7, journey_state: 'inferred', latitude: -8.5069, longitude: 115.2625, year: 2025, first_year: 2025, last_year: 2025, ordering: 'uncertain' }];
      if (sql.includes('AS journey_id, visit.place_id')) return ['a', 'b'].map((id) => ({ journey_id: 'private:bali', place_id: 'p', evidence_id: id, latitude: -8.5069, longitude: 115.2625, captured_day: '2025-09-10', availability: 'available' }));
      if (sql.includes('WITH visit_summary AS')) return [{ visit_id: 'v', captured_day: '2025-09-10', ordering: 'uncertain', has_precise_offset: 0 }];
      return [];
    });
    const repository = createNativeReconstructionRepository();
    const record = await repository.loadDurableReveal();
    expect(record.journeys[0].label).toBe('Bali, Indonesia');
    const model = projectReveal({ graph: null, durableRecord: record, reconstructionStatus: 'complete', reconciliationStatus: 'complete', pendingCount: 0, sourceScope: 'full', importedCount: 2 });
    expect(model.journeys[0].label).toBe('Bali, Indonesia');
    // Native map anchors have their own approved boundary; the text payload
    // must remain valid under the general reveal privacy validator.
    expect(() => assertRevealPayload({ journeys: model.journeys.map(({ mapAnchor: _anchor, ...text }) => text) })).not.toThrow();
    const id = record.journeys[0].displayId;
    expect((await repository.loadJourneyDetail(id)).detail.title).toBe('Bali, Indonesia');
    const priorFirst = mockGetFirstAsync.getMockImplementation()!;
    mockGetFirstAsync.mockImplementation(async (sql: string) => sql.includes('SELECT revision.owner_title')
      ? { owner_title: 'Our holiday', owner_date_kind: 'exact', owner_date_start: '2025-09-10' }
      : priorFirst(sql));
    expect((await repository.loadJourneyDetail(id)).detail.title).toBe('Our holiday');
    const labelQuery = mockGetAllAsync.mock.calls.find(([sql]) => sql.includes('AS journey_id, visit.place_id'))![0];
    expect(labelQuery).toContain("support.link_kind = 'visit-support'");
    expect(labelQuery).not.toContain('source_ref');
    expect(JSON.stringify(model)).not.toContain('private:bali');
    expect(JSON.stringify(model)).not.toContain('115.2625');
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
    expect(read).toContain('JOIN reconstruction_trip_qualification qualification');
    expect(read).toContain("qualification.classification IN ('AUTO_CONFIRMED', 'USER_CONFIRMED')");
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
    const statisticRead = mockGetFirstAsync.mock.calls.find(([sql]) => typeof sql === 'string' && sql.includes('COUNT(DISTINCT place.country_code)'))?.[0] as string;
    expect(statisticRead).toContain('reconstruction_trip_qualification');
    expect(statisticRead).toContain("classification IN ('AUTO_CONFIRMED', 'USER_CONFIRMED')");
    expect(statisticRead).toContain('reconstruction_place');
    expect(statisticRead).toContain('reconstruction_link');
    expect(statisticRead).not.toContain('canonical_evidence');
    expect(statisticRead).not.toContain('country_code AS');
  });

  it('promotes a far, repeated, rare local-graph episode but keeps its home place out of the candidate', () => {
    const baseIds = Array.from({ length: 12 }, (_, index) => `base-${index}`);
    const tripIds = Array.from({ length: 5 }, (_, index) => `trip-${index}`);
    const evidence = [
      ...baseIds.map((id, index) => ({ id, capturedAtMillis: Date.UTC(2025, index, 1), capturedDay: `2025-${String(index + 1).padStart(2, '0')}-01`, hasPreciseOffset: true, latitude: 13.7, longitude: 100.5, reportedAccuracyMeters: 10, availability: 'available' as const, duplicateFamilyId: null, duplicateConflict: false, excluded: false })),
      ...tripIds.map((id, index) => ({ id, capturedAtMillis: Date.UTC(2026, 0, index + 1), capturedDay: `2026-01-0${index + 1}`, hasPreciseOffset: true, latitude: 18.8 + index * 0.02, longitude: 98.9 + index * 0.02, reportedAccuracyMeters: 10, availability: 'available' as const, duplicateFamilyId: null, duplicateConflict: false, excluded: false })),
    ];
    const graph: ReconstructionGraph = {
      ruleVersion: 'reconstruction-v1', places: [
        { id: 'base', representativeId: baseIds[0], memberIds: baseIds, uncertainty: [] },
        { id: 'trip-a', representativeId: tripIds[0], memberIds: tripIds.slice(0, 3), uncertainty: [] },
        { id: 'trip-b', representativeId: tripIds[3], memberIds: tripIds.slice(3), uncertainty: [] },
      ], visits: [
        { id: 'trip-visit-a', placeId: 'trip-a', evidenceIds: tripIds.slice(0, 3), order: 'ordered' },
        { id: 'trip-visit-b', placeId: 'trip-b', evidenceIds: tripIds.slice(3), order: 'ordered' },
      ], journeys: [{ id: 'trip', visitIds: ['trip-visit-a', 'trip-visit-b'], state: 'inferred' }], possibleMerges: [], dispositions: [], memberships: [],
    };
    expect(qualifyGraphJourneyV11(graph, 'trip', evidence, new Map(evidence.map((item) => [item.id, 'image'] as const)))).toMatchObject({ classification: 'AUTO_CONFIRMED', path: 'SCORE' });
  });

  it('keeps a continuous multi-city away episode as one trip without using country as a grouping key', () => {
    const baseIds = Array.from({ length: 12 }, (_, index) => `base-${index}`);
    const evidence = [
      // Representative selection is deterministic and can land on GPS-less
      // media. Continuity must still use another coordinate-bearing home
      // support to keep this one multi-city holiday together.
      // This photo-heavy earlier stay is deliberately close to the first city.
      // It must not become a competing inferred home after the owner has
      // configured Bangkok as the dated home base.
      ...baseIds.map((id, index) => ({ id, capturedAtMillis: Date.UTC(2025, index, 1), capturedDay: `2025-${String(index + 1).padStart(2, '0')}-01`, hasPreciseOffset: true, latitude: index === 0 ? null : 25.1, longitude: index === 0 ? null : 121.5, reportedAccuracyMeters: index === 0 ? null : 10, availability: 'available' as const, duplicateFamilyId: null, duplicateConflict: false, excluded: false })),
      { id: 'city-one', capturedAtMillis: Date.UTC(2026, 9, 1), capturedDay: '2026-10-01', hasPreciseOffset: true, latitude: 25.0, longitude: 121.5, reportedAccuracyMeters: 10, availability: 'available' as const, duplicateFamilyId: null, duplicateConflict: false, excluded: false },
      { id: 'city-two', capturedAtMillis: Date.UTC(2026, 9, 8), capturedDay: '2026-10-08', hasPreciseOffset: true, latitude: 24.1, longitude: 120.7, reportedAccuracyMeters: 10, availability: 'available' as const, duplicateFamilyId: null, duplicateConflict: false, excluded: false },
    ];
    const graph: ReconstructionGraph = { ruleVersion: 'reconstruction-v1', places: [{ id: 'base', representativeId: baseIds[0], memberIds: baseIds, uncertainty: [] }, { id: 'city-one', representativeId: 'city-one', memberIds: ['city-one'], uncertainty: [] }, { id: 'city-two', representativeId: 'city-two', memberIds: ['city-two'], uncertainty: [] }], visits: [{ id: 'visit-one', placeId: 'city-one', evidenceIds: ['city-one'], order: 'ordered' }, { id: 'visit-two', placeId: 'city-two', evidenceIds: ['city-two'], order: 'ordered' }], journeys: [{ id: 'one', visitIds: ['visit-one'], state: 'inferred' }, { id: 'two', visitIds: ['visit-two'], state: 'inferred' }], possibleMerges: [], dispositions: [], memberships: [{ evidenceId: 'city-one', journeyId: 'one', state: 'inferred', reason: 'visit-support' }, { evidenceId: 'city-two', journeyId: 'two', state: 'inferred', reason: 'visit-support' }] };
    const merged = mergeContinuousAwayJourneysV11(graph, evidence, new Set(), [{ id: 'bangkok-home', latitude: 13.7, longitude: 100.5, effectiveStartDay: '2025-01-01' }]);
    expect(merged.journeys).toHaveLength(1);
    expect(merged.journeys[0].visitIds).toEqual(['visit-one', 'visit-two']);
    expect(merged.memberships.map((membership) => membership.journeyId)).toEqual([merged.journeys[0].id, merged.journeys[0].id]);
  });

  it('continues an unreviewed away episode despite an unrelated pinned correction', () => {
    const evidence = [
      ...Array.from({ length: 12 }, (_, index) => ({ id: `base-${index}`, capturedAtMillis: Date.UTC(2025, index, 1), capturedDay: `2025-${String(index + 1).padStart(2, '0')}-01`, hasPreciseOffset: true, latitude: 13.7, longitude: 100.5, reportedAccuracyMeters: 10, availability: 'available' as const, duplicateFamilyId: null, duplicateConflict: false, excluded: false })),
      { id: 'reviewed', capturedAtMillis: Date.UTC(2026, 0, 1), capturedDay: '2026-01-01', hasPreciseOffset: true, latitude: 18.8, longitude: 98.9, reportedAccuracyMeters: 10, availability: 'available' as const, duplicateFamilyId: null, duplicateConflict: false, excluded: false },
      { id: 'away-one', capturedAtMillis: Date.UTC(2026, 9, 1), capturedDay: '2026-10-01', hasPreciseOffset: true, latitude: 25, longitude: 121.5, reportedAccuracyMeters: 10, availability: 'available' as const, duplicateFamilyId: null, duplicateConflict: false, excluded: false },
      { id: 'away-two', capturedAtMillis: Date.UTC(2026, 9, 8), capturedDay: '2026-10-08', hasPreciseOffset: true, latitude: 24.1, longitude: 120.7, reportedAccuracyMeters: 10, availability: 'available' as const, duplicateFamilyId: null, duplicateConflict: false, excluded: false },
    ];
    const graph: ReconstructionGraph = { ruleVersion: 'reconstruction-v1', places: [{ id: 'base', representativeId: 'base-0', memberIds: evidence.filter((item) => item.id.startsWith('base-')).map((item) => item.id), uncertainty: [] }, { id: 'reviewed', representativeId: 'reviewed', memberIds: ['reviewed'], uncertainty: [] }, { id: 'away-one', representativeId: 'away-one', memberIds: ['away-one'], uncertainty: [] }, { id: 'away-two', representativeId: 'away-two', memberIds: ['away-two'], uncertainty: [] }], visits: [{ id: 'reviewed-visit', placeId: 'reviewed', evidenceIds: ['reviewed'], order: 'ordered' }, { id: 'away-visit-one', placeId: 'away-one', evidenceIds: ['away-one'], order: 'ordered' }, { id: 'away-visit-two', placeId: 'away-two', evidenceIds: ['away-two'], order: 'ordered' }], journeys: [{ id: 'reviewed-trip', visitIds: ['reviewed-visit'], state: 'inferred' }, { id: 'away-trip-one', visitIds: ['away-visit-one'], state: 'inferred' }, { id: 'away-trip-two', visitIds: ['away-visit-two'], state: 'inferred' }], possibleMerges: [], dispositions: [], memberships: [] };
    const merged = mergeContinuousAwayJourneysV11(graph, evidence, new Set(['reviewed-trip']));
    expect(merged.journeys.map((journey) => journey.id)).toEqual(expect.arrayContaining(['reviewed-trip', 'journey:away-visit-one|away-visit-two']));
    expect(merged.journeys).toHaveLength(2);
  });

  it('keeps compatible mixed-precision evidence in one unordered trip without inventing within-day order', () => {
    const evidence = [
      { id: 'away-early', capturedAtMillis: Date.UTC(2026, 0, 1, 9), capturedDay: '2026-01-01', hasPreciseOffset: true, latitude: 25, longitude: 121.5, reportedAccuracyMeters: 10, availability: 'available' as const, duplicateFamilyId: null, duplicateConflict: false, excluded: false },
      { id: 'away-day-only', capturedAtMillis: null, capturedDay: '2026-01-01', hasPreciseOffset: false, latitude: 25.01, longitude: 121.51, reportedAccuracyMeters: 10, availability: 'available' as const, duplicateFamilyId: null, duplicateConflict: false, excluded: false },
      { id: 'away-revisit', capturedAtMillis: Date.UTC(2026, 0, 1, 14), capturedDay: '2026-01-01', hasPreciseOffset: true, latitude: 25.02, longitude: 121.52, reportedAccuracyMeters: 10, availability: 'available' as const, duplicateFamilyId: null, duplicateConflict: false, excluded: false },
    ];
    const graph: ReconstructionGraph = { ruleVersion: 'reconstruction-v1', places: [], visits: evidence.map((item) => ({ id: `visit:${item.id}`, placeId: item.id, evidenceIds: [item.id], order: 'ordered' as const })), journeys: evidence.map((item) => ({ id: `legacy:${item.id}`, visitIds: [`visit:${item.id}`], state: 'inferred' as const })), possibleMerges: [], dispositions: [], memberships: [] };
    const result = constructCanonicalV11Graph(graph, [...evidence].reverse());
    expect(result.journeys.map((journey) => journey.visitIds).sort()).toEqual([
      ['visit:away-day-only', 'visit:away-early', 'visit:away-revisit'],
    ]);
    expect(constructCanonicalV11Graph(graph, evidence)).toEqual(result);
  });

  it('maps a place correction to the final canonical journey when continuity replaces the temporary ID', () => {
    const evidence = [
      { id: 'west', capturedAtMillis: Date.UTC(2026, 8, 10), capturedDay: '2026-09-10', hasPreciseOffset: false, latitude: -8.72, longitude: 115.17, reportedAccuracyMeters: 20, availability: 'available' as const, duplicateFamilyId: null, duplicateConflict: false, excluded: false },
      { id: 'east', capturedAtMillis: Date.UTC(2026, 8, 10, 12), capturedDay: '2026-09-10', hasPreciseOffset: false, latitude: -8.51, longitude: 115.26, reportedAccuracyMeters: 20, availability: 'available' as const, duplicateFamilyId: null, duplicateConflict: false, excluded: false },
    ];
    const temporary: ReconstructionGraph = {
      ruleVersion: 'reconstruction-v1', places: [],
      visits: [{ id: 'west-visit', placeId: 'west', evidenceIds: ['west'], order: 'uncertain' }, { id: 'east-visit', placeId: 'east', evidenceIds: ['east'], order: 'uncertain' }],
      journeys: [{ id: 'temporary-bali', visitIds: ['west-visit', 'east-visit'], state: 'inferred' }], possibleMerges: [], dispositions: [], memberships: [],
    };
    const correction = [{ revision_id: 'place-bali', action: 'place' as const, reviewed_support_json: JSON.stringify(['E:east', 'E:west']), reviewed_visits_json: JSON.stringify([['E:west'], ['E:east']]) }];
    const committed = constructCanonicalV11Graph(temporary, evidence);

    expect(committed.journeys[0].id).not.toBe('temporary-bali');
    expect(mapCorrectionsToCommittedJourneys(committed, correction).get('place-bali')).toBe(committed.journeys[0].id);
  });

  it('keeps an Android-style multi-city holiday together across a photo-silent stay when both blocks are away from a learned home', () => {
    const home = Array.from({ length: 12 }, (_, index) => ({ id: `home-${index}`, capturedAtMillis: Date.UTC(2025, index, 1), capturedDay: `2025-${String(index + 1).padStart(2, '0')}-01`, hasPreciseOffset: false, latitude: 10.29, longitude: 105.75, reportedAccuracyMeters: 20, availability: 'available' as const, duplicateFamilyId: null, duplicateConflict: false, excluded: false }));
    const bali = [
      { id: 'bali-west', capturedAtMillis: Date.UTC(2025, 8, 10), capturedDay: '2025-09-10', hasPreciseOffset: false, latitude: -8.72, longitude: 115.17, reportedAccuracyMeters: 20, availability: 'available' as const, duplicateFamilyId: null, duplicateConflict: false, excluded: false },
      { id: 'bali-east', capturedAtMillis: Date.UTC(2025, 8, 17), capturedDay: '2025-09-17', hasPreciseOffset: false, latitude: -8.51, longitude: 115.26, reportedAccuracyMeters: 20, availability: 'available' as const, duplicateFamilyId: null, duplicateConflict: false, excluded: false },
    ];
    const evidence = [...home, ...bali];
    const graph: ReconstructionGraph = { ruleVersion: 'reconstruction-v1', places: [
      { id: 'home-place', representativeId: 'home-0', memberIds: home.map((item) => item.id), uncertainty: [] },
      { id: 'bali-west-place', representativeId: 'bali-west', memberIds: ['bali-west'], uncertainty: [] },
      { id: 'bali-east-place', representativeId: 'bali-east', memberIds: ['bali-east'], uncertainty: [] },
    ], visits: [
      { id: 'west-visit', placeId: 'bali-west-place', evidenceIds: ['bali-west'], order: 'uncertain' },
      { id: 'east-visit', placeId: 'bali-east-place', evidenceIds: ['bali-east'], order: 'uncertain' },
    ], journeys: [
      { id: 'west', visitIds: ['west-visit'], state: 'inferred' }, { id: 'east', visitIds: ['east-visit'], state: 'inferred' },
    ], possibleMerges: [], dispositions: [], memberships: [], };
    expect(constructCanonicalV11Graph(graph, evidence).journeys).toEqual([
      expect.objectContaining({ visitIds: ['east-visit', 'west-visit'] }),
    ]);
  });

  it('keeps a corroborated configured-home return as a canonical boundary instead of overlapping adjacent away episodes', () => {
    const evidence = [
      { id: 'away-before', capturedAtMillis: Date.UTC(2026, 0, 1, 9), capturedDay: '2026-01-01', hasPreciseOffset: true, latitude: 25, longitude: 121.5, reportedAccuracyMeters: 10, availability: 'available' as const, duplicateFamilyId: null, duplicateConflict: false, excluded: false },
      { id: 'home-return', capturedAtMillis: Date.UTC(2026, 0, 2, 10), capturedDay: '2026-01-02', hasPreciseOffset: true, latitude: 13.7, longitude: 100.5, reportedAccuracyMeters: 10, availability: 'available' as const, duplicateFamilyId: null, duplicateConflict: false, excluded: false },
      { id: 'home-return-later', capturedAtMillis: Date.UTC(2026, 0, 2, 12), capturedDay: '2026-01-02', hasPreciseOffset: true, latitude: 13.7, longitude: 100.5, reportedAccuracyMeters: 10, availability: 'available' as const, duplicateFamilyId: null, duplicateConflict: false, excluded: false },
      { id: 'away-after', capturedAtMillis: Date.UTC(2026, 0, 3, 9), capturedDay: '2026-01-03', hasPreciseOffset: true, latitude: 24.1, longitude: 120.7, reportedAccuracyMeters: 10, availability: 'available' as const, duplicateFamilyId: null, duplicateConflict: false, excluded: false },
    ];
    const graph: ReconstructionGraph = { ruleVersion: 'reconstruction-v1', places: [], visits: evidence.map((item) => ({ id: `visit:${item.id}`, placeId: item.id, evidenceIds: [item.id], order: 'ordered' as const })), journeys: evidence.map((item) => ({ id: `legacy:${item.id}`, visitIds: [`visit:${item.id}`], state: 'inferred' as const })), possibleMerges: [], dispositions: [], memberships: [] };
    const result = constructCanonicalV11Graph(graph, evidence, new Set(), [{ id: 'bangkok', latitude: 13.7, longitude: 100.5, effectiveStartDay: '2025-01-01' }]);
    expect(result.journeys.map((journey) => journey.visitIds).sort()).toEqual([
      ['visit:away-after'], ['visit:away-before'], ['visit:home-return', 'visit:home-return-later'],
    ]);
  });

  it('keeps GPS-less associated media inside a continuous away episode without treating it as a home return', () => {
    const base = Array.from({ length: 12 }, (_, index) => ({ id: `home-${index}`, capturedAtMillis: Date.UTC(2025, index, 1), capturedDay: `2025-${String(index + 1).padStart(2, '0')}-01`, hasPreciseOffset: true, latitude: 13.7, longitude: 100.5, reportedAccuracyMeters: 10, availability: 'available' as const, duplicateFamilyId: null, duplicateConflict: false, excluded: false }));
    const evidence = [...base,
      { id: 'bali-west', capturedAtMillis: Date.UTC(2026, 8, 10), capturedDay: '2026-09-10', hasPreciseOffset: true, latitude: -8.72, longitude: 115.17, reportedAccuracyMeters: 10, availability: 'available' as const, duplicateFamilyId: null, duplicateConflict: false, excluded: false },
      { id: 'bali-memory', capturedAtMillis: Date.UTC(2026, 8, 12), capturedDay: '2026-09-12', hasPreciseOffset: true, latitude: null, longitude: null, reportedAccuracyMeters: null, availability: 'available' as const, duplicateFamilyId: null, duplicateConflict: false, excluded: false },
      { id: 'bali-east', capturedAtMillis: Date.UTC(2026, 8, 16), capturedDay: '2026-09-16', hasPreciseOffset: true, latitude: -8.51, longitude: 115.26, reportedAccuracyMeters: 10, availability: 'available' as const, duplicateFamilyId: null, duplicateConflict: false, excluded: false },
    ];
    const graph: ReconstructionGraph = { ruleVersion: 'reconstruction-v1', places: [{ id: 'home', representativeId: 'home-0', memberIds: base.map((item) => item.id), uncertainty: [] }, { id: 'west', representativeId: 'bali-west', memberIds: ['bali-west'], uncertainty: [] }, { id: 'east', representativeId: 'bali-east', memberIds: ['bali-east'], uncertainty: [] }], visits: [{ id: 'west-visit', placeId: 'west', evidenceIds: ['bali-west', 'bali-memory'], order: 'ordered' }, { id: 'east-visit', placeId: 'east', evidenceIds: ['bali-east'], order: 'ordered' }], journeys: [{ id: 'west-trip', visitIds: ['west-visit'], state: 'inferred' }, { id: 'east-trip', visitIds: ['east-visit'], state: 'inferred' }], possibleMerges: [], dispositions: [], memberships: [] };
    expect(mergeContinuousAwayJourneysV11(graph, evidence).journeys).toEqual([expect.objectContaining({ visitIds: ['west-visit', 'east-visit'] })]);
  });

  it('derives a place country from supported-member consensus instead of its unresolved representative', () => {
    const evidence = new Map([
      ['unresolved-representative', { id: 'unresolved-representative', capturedAtMillis: null, capturedDay: '2025-09-01', hasPreciseOffset: false, latitude: 91, longitude: 100, reportedAccuracyMeters: 10, availability: 'available' as const, duplicateFamilyId: null, duplicateConflict: false, excluded: false }],
      ['supported-thailand', { id: 'supported-thailand', capturedAtMillis: null, capturedDay: '2025-09-01', hasPreciseOffset: false, latitude: 13.7563, longitude: 100.5018, reportedAccuracyMeters: 10, availability: 'available' as const, duplicateFamilyId: null, duplicateConflict: false, excluded: false }],
    ]);
    expect(resolvePlaceCountryCode({ memberIds: ['unresolved-representative', 'supported-thailand'] }, evidence)).toBe('THA');
    expect(resolvePlaceCountryCode({ memberIds: ['unresolved-representative'] }, evidence)).toBeNull();
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
    mockGetAllAsync.mockReset(); mockGetAllAsync.mockResolvedValue([]);
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
    mockGetAllAsync.mockReset(); mockGetAllAsync.mockResolvedValue([]);
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
    const reviewedSnapshot = insert?.find((value: unknown) => typeof value === 'string' && value.includes('"observedSpan":"Observed 2024-01-01"'));
    expect(reviewedSnapshot).toContain('"title":"Private journey"');
    expect(reviewedSnapshot).not.toContain('private:source-a');
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
    const titleIndex = insert?.indexOf('Winter break') ?? -1;
    expect(insert?.slice(titleIndex, titleIndex + 4)).toEqual(['Winter break', 'exact', '2024-01-01', null]);
    expect(insert?.slice(-6)).toEqual([null, null, null, null, null, null]);
    expect(insert?.some((value: unknown) => typeof value === 'string' && value.includes('"observedSpan":"Observed 2024-01-01"'))).toBe(true);
    expect(mockRunAsync).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO journey_correction_application'), expect.any(String), 7, 'journey', expect.any(String));
  });

  it('persists an owner-confirmed place against the currently displayed Atlas trip without reconstructing membership', async () => {
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

    const repository = createNativeReconstructionRepository();
    const displayId = (await repository.loadDurableReveal()).journeys[0]?.displayId;
    const loaded = await repository.loadJourneyDetail(displayId!);
    await repository.saveJourneyCorrection(displayId!, 'place', loaded.snapshotToken, loaded.detail, 'command-place', {
      id: 'wikidata:Q146695', name: 'Phú Quốc', context: 'Kiên Giang, Vietnam', anchor: { latitude: 10.2, longitude: 104 },
    }, 99);

    const insert = mockRunAsync.mock.calls.find(([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO journey_correction_revision'));
    expect(insert?.[0]).toContain('owner_place_id, owner_place_name, owner_place_context, owner_latitude, owner_longitude');
    const placeIndex = insert?.indexOf('wikidata:Q146695') ?? -1;
    expect(insert?.slice(placeIndex, placeIndex + 5)).toEqual(['wikidata:Q146695', 'Phú Quốc', 'Kiên Giang, Vietnam', 10.2, 104]);
    expect(mockRunAsync).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO journey_correction_application'), expect.any(String), 7, 'private:alpha');
    const application = mockRunAsync.mock.calls.find(([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO journey_correction_application'));
    expect(application?.[3]).toBe('private:alpha');
    expect(mockRunAsync.mock.calls.some(([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO reconstruction_run'))).toBe(false);
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
