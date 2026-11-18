import { shareDiagnosticSink } from './share-diagnostics.ts';
const canonicalPhases = ['REBUILD_PROCESSING','REBUILD_BASELINE_GRAPH','REBUILD_BASELINE_MAPPING','REBUILD_CONSTRAINED_GRAPH','REBUILD_CONFIRMED_MAPPING','REBUILD_MEMORY_OVERLAY','REBUILD_OWNER_MERGE','REBUILD_CONTINUITY','REBUILD_MEMBERSHIP','REBUILD_FINAL_MAPPING'];
const stages = new Set(['HISTORY_PREPARE','HISTORY_CHECKPOINT_WRITE','HISTORY_CHECKPOINT_READ','HISTORY_CHECKPOINT_SEAL','HISTORY_REVIEW_RETAINED_SOURCE','HISTORY_REVIEW_CORRECTION_REMAP','HISTORY_REPLAY_GROUP_ABSENT','HISTORY_REPLAY_GROUP_TARGET','HISTORY_REVIEW_DUPLICATE','HISTORY_REVIEW_CORRECTION','HISTORY_REVIEW_REPLAY_GROUP','HISTORY_CONFIG', 'HISTORY_AUTH', 'HISTORY_SCHEMA', 'HISTORY_ACK', 'HISTORY_REBUILD', 'HISTORY_METADATA', 'HISTORY_NORMALIZE', 'HISTORY_PROJECT', 'HISTORY_REPLAY_PROJECT', 'HISTORY_REPLAY_MAP', 'HISTORY_ACTIVATE','HISTORY_AUTHORITY','HISTORY_CORRECTION','HISTORY_READ','HISTORY_STAGE','HISTORY_DELETE_LEASE','HISTORY_DELETE_CLEANUP','HISTORY_DELETE_AUTH','HISTORY_DELETE_ACK',...['HISTORY_PROJECT','HISTORY_REPLAY_PROJECT'].flatMap(prefix=>canonicalPhases.map(phase=>`${prefix}_${phase}`))]);
for (const phase of ['START', 'PAGE', 'COMMIT']) stages.add(`HISTORY_ACTIVATE_${phase}`);
const reasons = new Set(['CHECKPOINTED','START', 'COMPLETE', 'ACCOUNT_SESSION', 'HISTORY_UNAVAILABLE', 'HISTORY_FENCED', 'HISTORY_SCHEMA', 'HISTORY_REVIEW', 'HISTORY_STALE', 'HISTORY_CANCELLED', 'HISTORY_NETWORK', 'HISTORY_INCOMPLETE', 'HISTORY_CONFLICT', 'HISTORY_QUOTA', 'HISTORY_CONSENT', 'UNKNOWN']);
const outcomes = new Set(['unchanged', 'complete', 'blocked', 'skipped', 'failed', 'unknown']);
export function safeHistoryCorrelation(value: unknown): string {
  return typeof value === 'string' && (/^local_[a-f0-9]{32}$/.test(value)||/^runtime-[a-z0-9]{1,16}-[a-z0-9]{1,10}$/.test(value)) ? value : `local_${crypto.randomUUID().replaceAll('-', '')}`;
}
export function createHistoryDiagnostic(sink: (event: Record<string, unknown>) => void) {
  return (input: Record<string, unknown>) => {
    const reasonCode = reasons.has(String(input.reasonCode)) ? input.reasonCode : 'UNKNOWN';
    const event = {
      operation: 'HISTORY_SYNC',
      stage: stages.has(String(input.stage)) ? input.stage : 'HISTORY_SCHEMA',
      reasonCode,
      retryable: reasonCode === 'HISTORY_NETWORK' || reasonCode === 'UNKNOWN',
      durableOutcome: outcomes.has(String(input.durableOutcome)) ? input.durableOutcome : 'unknown',
      correlationId: safeHistoryCorrelation(input.correlationId),
    };
    try { sink(event); } catch { /* A diagnostic sink must not change durable acknowledgement. */ }
  };
}
export const historyDiagnosticSink = (event: Record<string, unknown>) => {
  // Reuse the backend's existing console boundary after our closed sanitization.
  createHistoryDiagnostic(shareDiagnosticSink)(event);
};
