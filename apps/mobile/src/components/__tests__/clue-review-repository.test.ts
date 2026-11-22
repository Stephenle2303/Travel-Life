import { createNativeReconstructionRepository } from '@/reconstruction';
import { ensureNativeImportSchema } from '@/import-record/repository';

const mockExecAsync = jest.fn();
const mockRunAsync = jest.fn();
const mockGetFirstAsync = jest.fn();
const mockGetAllAsync = jest.fn();
const mockOpenDatabaseAsync = jest.fn();

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: (...args: unknown[]) => mockOpenDatabaseAsync(...args) }));
jest.mock('@/import-record/repository', () => ({
  ...jest.requireActual('@/import-record/repository'),
  ensureNativeImportSchema: jest.fn(async () => undefined),
}));

const oneCameraEvidenceRow = {
  evidence_id: 'e1', media_type: 'image', captured_at_millis: 1_700_000_000_000, captured_day: '2026-01-01',
  has_precise_offset: 0, availability: 'available', latitude: null, longitude: null, reported_accuracy_meters: null,
  platform_duplicate_family_id: null, source_origin: 'camera', support_eligible: 1, duplicate_tuple_version: null, duplicate_tuple_fingerprint: null,
};

describe('CAP-3 owner-facing review-card repository surface', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAllAsync.mockReset(); mockGetAllAsync.mockResolvedValue([]);
    mockExecAsync.mockResolvedValue(undefined); mockRunAsync.mockResolvedValue(undefined);
    mockOpenDatabaseAsync.mockResolvedValue({ execAsync: mockExecAsync, runAsync: mockRunAsync, getFirstAsync: mockGetFirstAsync, getAllAsync: mockGetAllAsync });
    mockGetFirstAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT version FROM import_schema_version')) return { version: 52 };
      if (sql.includes('private_record_lifecycle')) return { state: 'connected' };
      if (sql.includes('MAX(run_id)')) return { run_id: 7 };
      if (sql.includes('canonical_evidence_revision')) return { canonical_evidence_revision: 2 };
      if (sql.includes('MAX(revision)')) return { revision: 1 };
      return null;
    });
  });

  describe('loadPendingClueReviewCards', () => {
    it('returns pending cards newest first with a computed period label, skipping resolved cards', async () => {
      mockGetAllAsync.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM clue_review_card')) return [
          { card_id: 'review-b', journey_id: 'j1', reason: 'would-lower-atlas-trip', created_at_millis: 2000 },
          { card_id: 'review-a', journey_id: 'j1', reason: 'protected-confirmed-trip', created_at_millis: 1000 },
        ];
        if (sql.includes('FROM reconstruction_journey journey')) return [{ journey_id: 'j1', first_day: '2026-03-01', last_day: '2026-03-05' }];
        return [];
      });
      const cards = await createNativeReconstructionRepository().loadPendingClueReviewCards();
      expect(cards.map((card) => card.cardId)).toEqual(['review-b', 'review-a']);
      expect(cards[0].reason).toBe('would-lower-atlas-trip');
      expect(cards[0].periodLabel).toBeTruthy();
      const query = mockGetAllAsync.mock.calls.find(([sql]) => sql.includes('FROM clue_review_card'))![0];
      expect(query).toContain("WHERE state = 'pending'");
    });

    it('returns an empty list without querying journey periods when there is nothing pending', async () => {
      const cards = await createNativeReconstructionRepository().loadPendingClueReviewCards();
      expect(cards).toEqual([]);
      expect(mockGetAllAsync.mock.calls.some(([sql]) => sql.includes('FROM reconstruction_journey journey'))).toBe(false);
    });
  });

  describe('reviewClueCard', () => {
    const pendingClue = {
      clueId: 'clue-e1', kind: 'photo-source', subject: { evidenceKeys: ['E:e1'] }, value: { source: 'camera' },
      strength: 'strong', independenceKey: 'photo-source:E:e1', producerId: 'photo-source-metadata', producerVersion: 1,
      inputsRevision: { evidenceRevision: 2, homeRevision: 0, correctionRevision: 1 }, state: 'active', createdAtMillis: 1000,
    };

    it('dismisses a pending card without activating its clue or touching the Atlas', async () => {
      mockGetFirstAsync.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM clue_review_card WHERE card_id')) return { clue_json: JSON.stringify(pendingClue) };
        if (sql.includes('private_record_lifecycle')) return { state: 'connected' };
        return null;
      });
      const repository = createNativeReconstructionRepository();
      const rebuild = jest.spyOn(repository, 'rebuild').mockResolvedValue({} as never);
      const result = await repository.reviewClueCard('review-1', 'dismiss');
      expect(result).toBe('dismissed');
      expect(mockRunAsync).toHaveBeenCalledWith(expect.stringContaining("UPDATE clue_review_card SET state = 'dismissed'"), 'review-1');
      expect(mockRunAsync.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO travel_clue'))).toBe(false);
      expect(rebuild).not.toHaveBeenCalled();
    });

    it('reports stale instead of applying a card that no longer exists in the pending state', async () => {
      mockGetFirstAsync.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM clue_review_card WHERE card_id')) return null;
        return null;
      });
      const repository = createNativeReconstructionRepository();
      const rebuild = jest.spyOn(repository, 'rebuild').mockResolvedValue({} as never);
      expect(await repository.reviewClueCard('missing', 'approve')).toBe('stale');
      expect(mockExecAsync).toHaveBeenCalledWith('ROLLBACK');
      expect(rebuild).not.toHaveBeenCalled();
    });

    it('approves a card whose clue is unaffiliated with any journey, activating it and triggering one rebuild', async () => {
      mockGetFirstAsync.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM clue_review_card WHERE card_id')) return { clue_json: JSON.stringify(pendingClue) };
        if (sql.includes('private_record_lifecycle')) return { state: 'connected' };
        if (sql.includes('MAX(run_id)')) return { run_id: 7 };
        if (sql.includes('canonical_evidence_revision')) return { canonical_evidence_revision: 2 };
        if (sql.includes('MAX(revision)')) return { revision: 1 };
        return null;
      });
      const repository = createNativeReconstructionRepository();
      const rebuild = jest.spyOn(repository, 'rebuild').mockResolvedValue({} as never);
      const result = await repository.reviewClueCard('review-1', 'approve', 5000);
      expect(result).toBe('approved');
      expect(mockRunAsync).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO travel_clue'), ...[
        'clue-e1', 'photo-source', JSON.stringify(pendingClue.subject), JSON.stringify(pendingClue.value), 'strong', 'photo-source:E:e1',
        'photo-source-metadata', 1, 2, 0, 1, 'active', 1000,
      ]);
      expect(mockRunAsync).toHaveBeenCalledWith(expect.stringContaining("UPDATE clue_review_card SET state = 'approved'"), 'review-1');
      expect(rebuild).toHaveBeenCalledWith(5000);
    });

    it('stays stale and never activates when the gate still finds the clue unsafe for its journey', async () => {
      const journeyClue = { ...pendingClue, clueId: 'clue-e1-journey' };
      mockGetFirstAsync.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM clue_review_card WHERE card_id')) return { clue_json: JSON.stringify(journeyClue) };
        if (sql.includes('private_record_lifecycle')) return { state: 'connected' };
        if (sql.includes('MAX(run_id)')) return { run_id: 7 };
        if (sql.includes('canonical_evidence_revision')) return { canonical_evidence_revision: 2 };
        if (sql.includes('MAX(revision)')) return { revision: 1 };
        return null;
      });
      mockGetAllAsync.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM canonical_evidence')) return [oneCameraEvidenceRow];
        if (sql.includes('visit_id, place_id FROM reconstruction_visit')) return [{ visit_id: 'v1', place_id: 'p1' }];
        if (sql.includes('FROM reconstruction_link')) return [{ parent_id: 'v1', child_id: 'e1', link_kind: 'visit-support' }, { parent_id: 'j1', child_id: 'v1', link_kind: 'journey-visit' }];
        if (sql.includes('journey_id, classification FROM reconstruction_trip_qualification')) return [{ journey_id: 'j1', classification: 'USER_CONFIRMED' }];
        return [];
      });
      const repository = createNativeReconstructionRepository();
      const rebuild = jest.spyOn(repository, 'rebuild').mockResolvedValue({} as never);
      const result = await repository.reviewClueCard('review-2', 'approve');
      expect(result).toBe('stale');
      expect(mockExecAsync).toHaveBeenCalledWith('ROLLBACK');
      expect(mockRunAsync.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO travel_clue'))).toBe(false);
      expect(rebuild).not.toHaveBeenCalled();
    });
  });

  it('gates every review-card write through the additive import schema first', async () => {
    mockGetFirstAsync.mockImplementation(async (sql: string) => (sql.includes('FROM clue_review_card WHERE card_id') ? null : null));
    await createNativeReconstructionRepository().reviewClueCard('x', 'dismiss');
    expect(ensureNativeImportSchema).toHaveBeenCalled();
  });

  describe('rejectSameTripSuggestion (CAP-7 personal learning)', () => {
    it('reports stale, with a diagnostic, for a display id this session never resolved', async () => {
      const diagnostic = jest.spyOn(console, 'info').mockImplementation(() => {});
      try {
        const result = await createNativeReconstructionRepository().rejectSameTripSuggestion('not-a-real-id', 'also-not-real');
        expect(result).toBe('stale');
        expect(diagnostic).toHaveBeenCalledWith('[Travel Life diagnostic]', expect.objectContaining({ operation: 'PERSONAL_RULE_SAVE', stage: 'RULE_DERIVE', reasonCode: 'HISTORY_STALE', durableOutcome: 'unchanged' }));
        expect(mockExecAsync).toHaveBeenCalledWith('ROLLBACK');
        expect(mockRunAsync.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO personal_rule'))).toBe(false);
      } finally { diagnostic.mockRestore(); }
    });

    it('reports a redacted diagnostic, and rolls back, when resolving the pair fails', async () => {
      mockGetAllAsync.mockImplementation(async (sql: string) => {
        if (sql.includes('WITH journey_metadata AS')) return [
          { journey_id: 'journey-a', reasons_json: '["few-photos"]', first_year: 2026, last_year: 2026, first_day: '2026-03-01', last_day: '2026-03-01', located_count: 2 },
          { journey_id: 'journey-b', reasons_json: '["few-photos"]', first_year: 2026, last_year: 2026, first_day: '2026-03-08', last_day: '2026-03-08', located_count: 2 },
        ];
        if (sql.includes('WITH journey_evidence AS')) throw new Error('database is locked: private-reject-sentinel');
        return [];
      });
      const repository = createNativeReconstructionRepository();
      const [tripA, tripB] = await repository.loadPossibleTrips();
      const diagnostic = jest.spyOn(console, 'info').mockImplementation(() => {});
      try {
        await expect(repository.rejectSameTripSuggestion(tripA.displayId, tripB.displayId)).rejects.toThrow();
        expect(diagnostic).toHaveBeenCalledWith('[Travel Life diagnostic]', expect.objectContaining({ operation: 'PERSONAL_RULE_SAVE', stage: 'RULE_DERIVE', reasonCode: 'DATABASE_BUSY', durableOutcome: 'failed', retryable: true }));
        expect(JSON.stringify(diagnostic.mock.calls)).not.toContain('private-reject-sentinel');
        expect(mockExecAsync).toHaveBeenCalledWith('ROLLBACK');
      } finally { diagnostic.mockRestore(); }
    });

    it('reports stale, never writing a rule, when the two journeys have no active same-trip clue between them', async () => {
      mockGetAllAsync.mockImplementation(async (sql: string) => {
        if (sql.includes('WITH journey_metadata AS')) return [
          { journey_id: 'journey-a', reasons_json: '["few-photos"]', first_year: 2026, last_year: 2026, first_day: '2026-03-01', last_day: '2026-03-01', located_count: 2 },
          { journey_id: 'journey-b', reasons_json: '["few-photos"]', first_year: 2026, last_year: 2026, first_day: '2026-03-08', last_day: '2026-03-08', located_count: 2 },
        ];
        if (sql.includes('WITH journey_evidence AS')) return [{ evidence_id: 'e-unused', platform_duplicate_family_id: null }];
        if (sql.includes("kind = 'same-trip'")) return [];
        return [];
      });
      const repository = createNativeReconstructionRepository();
      const [tripA, tripB] = await repository.loadPossibleTrips();
      const result = await repository.rejectSameTripSuggestion(tripA.displayId, tripB.displayId);
      expect(result).toBe('stale');
      expect(mockExecAsync).toHaveBeenCalledWith('ROLLBACK');
      expect(mockRunAsync.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO personal_rule'))).toBe(false);
    });
  });

  describe("runCluePass's wall-clock budget and resumable cursor", () => {
    const threeCameraRows = ['e1', 'e2', 'e3'].map((id) => ({ ...oneCameraEvidenceRow, evidence_id: id }));

    it('stops mid-table once the wall-clock budget is spent, independent of the item budget, and persists where it stopped', async () => {
      mockGetAllAsync.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM canonical_evidence')) return threeCameraRows;
        return [];
      });
      // One call for the correlation id, one for loopStartedAt, then one
      // check per loop iteration: e1 (elapsed 0, under budget), e2 (elapsed
      // 50, still under), e3's check (elapsed 150, over the 100ms budget —
      // cut off before e3 is ever looked at).
      const clock = [0, 0, 0, 50, 150];
      jest.spyOn(Date, 'now').mockImplementation(() => clock.shift() ?? 150);
      const diagnostic = jest.spyOn(console, 'info').mockImplementation(() => {});
      const repository = createNativeReconstructionRepository();
      const rebuild = jest.spyOn(repository, 'rebuild').mockResolvedValue({} as never);
      try {
        const result = await repository.runCluePass(5000, 1000, 100);
        expect(result.produced).toBe(2);
        expect(result.activated).toBe(2);
        expect(mockRunAsync).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO clue_pass_checkpoint'), 'photo-source-metadata', 'e2', 5000);
        expect(diagnostic).toHaveBeenCalledWith('[Travel Life diagnostic]', expect.objectContaining({ operation: 'AI_CLUE_PASS', stage: 'CLUE_PRODUCE', reasonCode: 'BUDGET_EXHAUSTED', durableOutcome: 'complete' }));
        expect(rebuild).toHaveBeenCalledWith(5000);
      } finally { diagnostic.mockRestore(); jest.spyOn(Date, 'now').mockRestore(); }
    });

    it('resumes strictly after a persisted cursor rather than rescanning from the start', async () => {
      mockGetFirstAsync.mockImplementation(async (sql: string) => {
        if (sql.includes('cursor_evidence_id FROM clue_pass_checkpoint')) return { cursor_evidence_id: 'e1' };
        if (sql.includes('SELECT version FROM import_schema_version')) return { version: 52 };
        if (sql.includes('private_record_lifecycle')) return { state: 'connected' };
        if (sql.includes('MAX(run_id)')) return { run_id: 7 };
        if (sql.includes('canonical_evidence_revision')) return { canonical_evidence_revision: 2 };
        if (sql.includes('MAX(revision)')) return { revision: 1 };
        return null;
      });
      mockGetAllAsync.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM canonical_evidence')) return threeCameraRows;
        return [];
      });
      const repository = createNativeReconstructionRepository();
      const rebuild = jest.spyOn(repository, 'rebuild').mockResolvedValue({} as never);
      const result = await repository.runCluePass(5000, 1000);
      // e1 is before the cursor: never reconsidered. e2 and e3 are the
      // only ones produced.
      expect(result.produced).toBe(2);
      expect(rebuild).toHaveBeenCalledWith(5000);
      expect(mockRunAsync).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO clue_pass_checkpoint'), 'photo-source-metadata', null, 5000);
    });
  });

  describe("runCluePass's \"trips updated\" notice", () => {
    function setUpOneActivatableClue(classificationCallResults: { journey_id: string; classification: string }[][]) {
      let classificationCall = 0;
      mockGetAllAsync.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM canonical_evidence')) return [oneCameraEvidenceRow];
        if (sql.includes('journey_id, classification FROM reconstruction_trip_qualification')) {
          const result = classificationCallResults[classificationCall] ?? [];
          classificationCall += 1;
          return result;
        }
        return [];
      });
    }

    it('writes a "trips updated" notice once a triggered rebuild changes which journeys are shown on Atlas', async () => {
      setUpOneActivatableClue([[], [{ journey_id: 'j-new', classification: 'AUTO_CONFIRMED' }]]);
      const repository = createNativeReconstructionRepository();
      const rebuild = jest.spyOn(repository, 'rebuild').mockResolvedValue({} as never);
      const diagnostic = jest.spyOn(console, 'info').mockImplementation(() => {});
      try {
        const result = await repository.runCluePass(5000);
        expect(result).toEqual({ status: 'complete', produced: 1, activated: 1, reviewCards: 0, rebuildTriggered: true });
        expect(rebuild).toHaveBeenCalledWith(5000);
        expect(mockRunAsync).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO clue_pass_notice'), 'Travel Life updated 1 trip.', 5000);
        expect(diagnostic).toHaveBeenCalledWith('[Travel Life diagnostic]', expect.objectContaining({ operation: 'AI_CLUE_PASS', stage: 'CLUE_NOTICE', reasonCode: 'COMPLETE', durableOutcome: 'complete' }));
      } finally { diagnostic.mockRestore(); }
    });

    it('writes no notice when the triggered rebuild activates a clue but leaves every journey\'s Atlas visibility unchanged', async () => {
      const unchanged = [{ journey_id: 'j-same', classification: 'AUTO_CONFIRMED' }];
      setUpOneActivatableClue([unchanged, unchanged]);
      const repository = createNativeReconstructionRepository();
      const rebuild = jest.spyOn(repository, 'rebuild').mockResolvedValue({} as never);
      const diagnostic = jest.spyOn(console, 'info').mockImplementation(() => {});
      try {
        const result = await repository.runCluePass(5000);
        expect(result).toEqual({ status: 'complete', produced: 1, activated: 1, reviewCards: 0, rebuildTriggered: true });
        expect(rebuild).toHaveBeenCalledWith(5000);
        expect(mockRunAsync.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO clue_pass_notice'))).toBe(false);
        expect(diagnostic).toHaveBeenCalledWith('[Travel Life diagnostic]', expect.objectContaining({ operation: 'AI_CLUE_PASS', stage: 'CLUE_NOTICE', reasonCode: 'SKIPPED', durableOutcome: 'skipped' }));
      } finally { diagnostic.mockRestore(); }
    });

    it('reports a redacted diagnostic, and still returns success, when computing the notice itself fails', async () => {
      let classificationCall = 0;
      const sentinel = 'private-notice-sentinel';
      mockGetAllAsync.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM canonical_evidence')) return [oneCameraEvidenceRow];
        if (sql.includes('journey_id, classification FROM reconstruction_trip_qualification')) {
          classificationCall += 1;
          if (classificationCall === 1) return [];
          throw new Error(`database is locked: ${sentinel}`);
        }
        return [];
      });
      const repository = createNativeReconstructionRepository();
      const rebuild = jest.spyOn(repository, 'rebuild').mockResolvedValue({} as never);
      const diagnostic = jest.spyOn(console, 'info').mockImplementation(() => {});
      try {
        const result = await repository.runCluePass(5000);
        expect(result).toEqual({ status: 'complete', produced: 1, activated: 1, reviewCards: 0, rebuildTriggered: true });
        expect(rebuild).toHaveBeenCalledWith(5000);
        expect(mockRunAsync.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO clue_pass_notice'))).toBe(false);
        expect(diagnostic).toHaveBeenCalledWith('[Travel Life diagnostic]', expect.objectContaining({ operation: 'AI_CLUE_PASS', stage: 'CLUE_NOTICE', reasonCode: 'DATABASE_BUSY', durableOutcome: 'unchanged', retryable: true }));
        expect(JSON.stringify(diagnostic.mock.calls)).not.toContain(sentinel);
      } finally { diagnostic.mockRestore(); }
    });
  });
});
