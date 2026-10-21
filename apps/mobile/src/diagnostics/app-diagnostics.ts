import type { DurableRevealDiagnosticStage, ReconciliationStage } from '@/reconstruction/repository';

export type AppDiagnosticOperation =
  | 'ATLAS_REBUILD'
  | 'ATLAS_CATCH_UP'
  | 'ATLAS_DURABLE_READ'
  | 'ATLAS_REVEAL_RETRY'
  | 'METADATA_IMPORT'
  | 'MAINTENANCE_RECONCILIATION'
  | 'JOURNEY_PLACE_SAVE';

export type AppDiagnosticReasonCode =
  | 'START'
  | 'COMPLETE'
  | 'ATLAS_UPDATED'
  | 'PAUSED'
  | 'BLOCKED'
  | 'RESTRICTED'
  | 'SKIPPED'
  | 'ALREADY_RUNNING'
  | 'SCHEMA'
  | 'NATIVE_HANDLE'
  | 'DATABASE_BUSY'
  | 'TRANSACTION'
  | 'ROW_LIMIT'
  | 'HISTORY_REVIEW'
  | 'JOURNEY_REMAP'
  | 'OWNER_REVIEW'
  | 'ACCESS'
  | 'CONSTRAINT'
  | 'LIFECYCLE'
  | 'SAVE_FAILED'
  | 'UNKNOWN';

export type AppDiagnosticOutcome = 'complete' | 'unchanged' | 'paused' | 'blocked' | 'restricted' | 'skipped' | 'failed';

/** The only runtime-console payload. All fields are closed, non-identifying values. */
export type AppDiagnosticEvent = Readonly<{
  operation: AppDiagnosticOperation;
  reasonCode: AppDiagnosticReasonCode;
  stage: ReconciliationStage | DurableRevealDiagnosticStage | null;
  retryable: boolean;
  durableOutcome: AppDiagnosticOutcome;
  correlationId: string;
}>;

let sequence = 0;

/** This is local action correlation, never derived from a record, place, asset, or location. */
export function createDiagnosticCorrelationId() {
  sequence += 1;
  return `runtime-${Date.now().toString(36)}-${sequence.toString(36)}`;
}

/** Classifies an in-memory error without serializing it or returning its message. */
export function classifyAppDiagnosticError(error: unknown): AppDiagnosticReasonCode {
  const source = error instanceof Error && 'originalError' in error
    ? (error as Error & { originalError?: unknown }).originalError
    : error;
  if (!(source instanceof Error)) return 'UNKNOWN';
  if (source.name === 'LocalAtlasSchemaRecoveryError') return 'SCHEMA';
  const message = source.message.toLowerCase();
  if (message.includes('no such column') || message.includes('no such table')) return 'SCHEMA';
  if (message.includes('nullpointerexception') || message.includes('released native handle')) return 'NATIVE_HANDLE';
  if (message.includes('database is locked') || message.includes('sqlite_busy')) return 'DATABASE_BUSY';
  if (message.includes('cannot start a transaction within a transaction')) return 'TRANSACTION';
  if (message.includes('bridge limit')) return 'ROW_LIMIT';
  if (message.includes('history corrections need owner review')) return 'HISTORY_REVIEW';
  if (message.includes('needs owner remap')) return 'JOURNEY_REMAP';
  if (message.includes('need owner review')) return 'OWNER_REVIEW';
  if (message.includes('not connected') || message.includes('not permitted') || message.includes('private record')) return 'ACCESS';
  if (message.includes('constraint failed')) return 'CONSTRAINT';
  return 'UNKNOWN';
}

/** Sole production console boundary. Never add error objects, messages, stacks, or payloads here. */
export function recordAppDiagnostic(event: AppDiagnosticEvent): void {
  console.info('[Travel Life diagnostic]', event);
}
