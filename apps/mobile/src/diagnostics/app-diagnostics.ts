import type { DurableRevealDiagnosticStage, ReconciliationStage } from '@/reconstruction/repository';
import type { AtlasProfileStage } from './atlas-phase-profile';

export type AppDiagnosticOperation =
  | 'ATLAS_REBUILD'
  | 'ATLAS_CATCH_UP'
  | 'ATLAS_DURABLE_READ'
  | 'ATLAS_REBUILD_PROFILE'
  | 'ATLAS_DURABLE_READ_PROFILE'
  | 'ATLAS_REVEAL_RETRY'
  | 'METADATA_IMPORT'
  | 'MAINTENANCE_RECONCILIATION'
  | 'JOURNEY_PLACE_SAVE'
  | 'JOURNEY_PRIVACY_SAVE'
  | 'JOURNEY_PRIVACY_READ'
  | 'REPLAY_DRAFT_SAVE'
  | 'REPLAY_DRAFT_RECOVERY'
  | 'REPLAY_AUDIO_SELECTION'
  | 'REPLAY_RENDER'
  | 'REPLAY_EXPORT'
  | 'SHARE_PREVIEW'
  | 'SHARE_DERIVATIVE'
  | 'SHARE_PUBLISH'
  | 'SHARE_RECONCILE'
  | 'SHARE_MANAGE'
  | 'SHARE_DELETE_ALL';

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
  | 'REPLAY_SCOPE_INVALID'
  | 'REPLAY_MAPPING_INVALID'
  | 'REPLAY_MEMORY_MAPPING'
  | 'REPLAY_GROUP_MAPPING'
  | 'REPLAY_AUTOMATIC_SCOPE'
  | 'REPLAY_RECEIPT_CONFLICT'
  | 'REPLAY_REVISION_CONFLICT'
  | 'REPLAY_BRANCH_CONFLICT'
  | 'SHARE_ELIGIBILITY_CHANGED'
  | 'SHARE_MANIFEST_INVALID'
  | 'SHARE_DERIVATIVE_INVALID'
  | 'SHARE_QUOTA'
  | 'SHARE_SESSION'
  | 'SHARE_RECEIPT_CONFLICT'
  | 'SHARE_DELETE_FENCED'
  | 'SHARE_REVOKED'
  | 'SHARE_STORAGE'
  | 'SHARE_NETWORK'
  | 'SHARE_CODEC'
  | 'SHARE_DECODE'
  | 'SHARE_ENCODE'
  | 'SHARE_VERIFY'
  | 'UNKNOWN';

export type AppDiagnosticOutcome = 'complete' | 'unchanged' | 'paused' | 'blocked' | 'restricted' | 'skipped' | 'failed';

/** The only runtime-console payload. All fields are closed, non-identifying values. */
export type AppDiagnosticEvent = Readonly<{
  operation: AppDiagnosticOperation;
  reasonCode: AppDiagnosticReasonCode;
  stage: ReconciliationStage | DurableRevealDiagnosticStage | AtlasProfileStage | 'PRIVACY_REVIEW_DETAIL' | 'PRIVACY_REVIEW_SCOPE' | 'PRIVACY_POLICY_LIST' | 'REPLAY_ACCESS' | 'REPLAY_SCOPE' | 'REPLAY_DECODE' | 'REPLAY_ENCODE' | 'REPLAY_OUTPUT' | 'REPLAY_HANDOFF' | 'REPLAY_STALE' | 'REPLAY_UNAVAILABLE' | 'REPLAY_RECOVERY_READ' | 'REPLAY_RECOVERY_RESET' | 'REPLAY_RECOVERY_STAGE' | 'SHARE_COPY' | 'SHARE_DECODE' | 'SHARE_ENCODE' | 'SHARE_VERIFY' | 'SHARE_ELIGIBILITY' | 'SHARE_SERIALIZE' | 'SHARE_DERIVATIVE_ENCODE' | 'SHARE_DERIVATIVE_VERIFY' | 'SHARE_AUTH' | 'SHARE_QUOTA' | 'SHARE_UPLOAD' | 'SHARE_ACTIVATE' | 'SHARE_ACK' | 'SHARE_RECONCILE' | 'SHARE_REVOKE' | 'SHARE_EXPIRY' | 'SHARE_DELETE_FENCE' | 'SHARE_REMOVAL_QUEUE' | null;
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
  if (message.includes('privacy review') || message.includes('privacy scope') || message.includes('privacy command') || message.includes('privacy restore is stale')) return 'OWNER_REVIEW';
  if (message.includes('not connected') || message.includes('not permitted') || message.includes('private record')) return 'ACCESS';
  if (message.includes('constraint failed')) return 'CONSTRAINT';
  return 'UNKNOWN';
}

/** Sole production console boundary. Never add error objects, messages, stacks, or payloads here. */
export function recordAppDiagnostic(event: AppDiagnosticEvent): void {
  console.info('[Travel Life diagnostic]', event);
}
