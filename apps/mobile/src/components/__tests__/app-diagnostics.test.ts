import { classifyAppDiagnosticError, createDiagnosticCorrelationId, recordAppDiagnostic } from '@/diagnostics/app-diagnostics';
import { DurableRevealStageError, durableRevealFailureStage } from '@/reconstruction/repository';

describe('app diagnostics', () => {
  it.each([
    ['no such table: manual_journey', 'DURABLE_MANUAL_TABLE'],
    ['no such column: date_start', 'DURABLE_MANUAL_START_FIELD'],
    ['no such column: manual_journey.date_end', 'DURABLE_MANUAL_END_FIELD'],
    ['no such column: owner_context', 'DURABLE_MANUAL_CONTEXT_FIELD'],
    ['no such column: private_unknown_field', 'DURABLE_MANUAL_READ'],
    ['no such column: date_start_extra', 'DURABLE_MANUAL_READ'],
  ])('classifies known manual schema signatures without exposing native detail: %s', (message, stage) => {
    const error = new DurableRevealStageError('DURABLE_MANUAL_READ', new Error(`${message}; private-sentinel`));
    expect(durableRevealFailureStage(error)).toBe(stage);
    expect(classifyAppDiagnosticError(error)).toBe('SCHEMA');
    expect(error.message).not.toContain('private-sentinel');
  });
  it('keeps native schema detail in memory while reporting only the closed durable stage', () => {
    const log = jest.spyOn(console, 'info').mockImplementation(() => {});
    try {
      const error = new DurableRevealStageError('DURABLE_OWNER_PLACE_READ', new Error('no such column: private_place_name SELECT secret_source_ref'));
      expect(error.message).toBe('Local Atlas read did not finish.');
      expect(classifyAppDiagnosticError(error)).toBe('SCHEMA');
      expect(durableRevealFailureStage(new Error('DURABLE_OWNER_PLACE_READ'))).toBeNull();
      expect(durableRevealFailureStage({ stage: 'DURABLE_OWNER_PLACE_READ', originalError: error.originalError })).toBeNull();
      recordAppDiagnostic({ operation: 'ATLAS_DURABLE_READ', reasonCode: classifyAppDiagnosticError(error), stage: durableRevealFailureStage(error), retryable: true, durableOutcome: 'unchanged', correlationId: createDiagnosticCorrelationId() });
      expect(log.mock.calls[0][1]).toMatchObject({ reasonCode: 'SCHEMA', stage: 'DURABLE_OWNER_PLACE_READ' });
      expect(JSON.stringify(log.mock.calls)).not.toMatch(/private_place_name|SELECT|secret_source_ref|originalError/);
    } finally { log.mockRestore(); }
  });
  it('emits only the fixed structured event shape', () => {
    const log = jest.spyOn(console, 'info').mockImplementation(() => {});
    try {
      const correlationId = createDiagnosticCorrelationId();
      recordAppDiagnostic({ operation: 'ATLAS_REBUILD', reasonCode: 'DATABASE_BUSY', stage: null, retryable: true, durableOutcome: 'failed', correlationId });
      expect(log).toHaveBeenCalledWith('[Travel Life diagnostic]', {
        operation: 'ATLAS_REBUILD', reasonCode: 'DATABASE_BUSY', stage: null,
        retryable: true, durableOutcome: 'failed', correlationId,
      });
      expect(JSON.stringify(log.mock.calls)).not.toContain('private-place-name');
    } finally {
      log.mockRestore();
    }
  });
  it('allows a redacted selected-share publication boundary without a capability or payload', () => {
    const log = jest.spyOn(console, 'info').mockImplementation(() => {});
    try {
      recordAppDiagnostic({ operation: 'SHARE_PUBLISH', reasonCode: 'SHARE_DELETE_FENCED', stage: 'SHARE_ACTIVATE', retryable: false, durableOutcome: 'blocked', correlationId: createDiagnosticCorrelationId() });
      expect(JSON.stringify(log.mock.calls)).not.toMatch(/capability|token|private-sentinel|payload/i);
      expect(log.mock.calls[0][1]).toMatchObject({ operation: 'SHARE_PUBLISH', reasonCode: 'SHARE_DELETE_FENCED', stage: 'SHARE_ACTIVATE' });
    } finally { log.mockRestore(); }
  });
});
