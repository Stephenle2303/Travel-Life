import type { DurableRevealDiagnosticStage, ReconciliationStage } from '@/reconstruction/repository';
import type { AtlasProfileStage } from './atlas-phase-profile';

export type AppDiagnosticOperation =
  | 'JOURNEY_MEDIA_INSPECT' | 'ATLAS_CLARIFY' | 'ATLAS_PREVIEW' | 'ATLAS_MAP' | 'POSSIBLE_TRIP_REVIEW'
  | 'ONBOARDING_ENTRY' | 'ONBOARDING_SETUP' | 'ONBOARDING_RUN' | 'ONBOARDING_UPDATES' | 'VISUAL_PLACE_REVIEW'
  | 'PRIVATE_MEDIA'
  | 'HISTORY_TRANSFER'
  | 'ACCOUNT_REQUEST' | 'ACCOUNT_VERIFY' | 'ACCOUNT_RESTORE' | 'ACCOUNT_REFRESH' | 'ACCOUNT_SIGN_OUT'
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
  | 'SHARE_DELETE_ALL'
  | 'TRAVEL_WINDOW_SCAN'
  // AI clue layer background pass (CAP-3, delivery-and-diagnostics.md).
  | 'AI_CLUE_PASS'
  | 'PERSONAL_RULE_SAVE';

export type AppDiagnosticReasonCode =
  | 'MAP_STYLE_UNAVAILABLE'
  | 'VISUAL_NO_READABLE_TEXT' | 'VISUAL_NO_PLACE_MATCH' | 'VISUAL_NO_LANDMARK_MATCH' | 'VISUAL_PLACE_CONFLICT' | 'VISUAL_EPISODE_SUPPORT' | 'VISUAL_ALBUM_SUPPORT'
  | 'MEDIA_METADATA_MISMATCH' | 'MEDIA_ASSET_MISMATCH' | 'MEDIA_ACCESS' | 'MEDIA_NETWORK' | 'MEDIA_VERIFY' | 'MEDIA_STORAGE'
  | 'MEDIA_SCHEMA' | 'MEDIA_CONFLICT' | 'MEDIA_CONSENT' | 'MEDIA_SCOPE' | 'MEDIA_QUOTA' | 'MEDIA_UNAVAILABLE' | 'MEDIA_DECODE' | 'MEDIA_ENCODE'
  | 'ACCOUNT_REAUTH' | 'HISTORY_REVIEW'
  | 'HISTORY_SCHEMA' | 'HISTORY_VERSION_UNSUPPORTED' | 'HISTORY_FENCED' | 'HISTORY_CONSENT' | 'HISTORY_CONFLICT' | 'HISTORY_QUOTA' | 'HISTORY_STALE' | 'HISTORY_INCOMPLETE' | 'HISTORY_NETWORK' | 'HISTORY_READ_TIMEOUT' | 'HISTORY_STORAGE'
  | 'ACCOUNT_DISABLED' | 'ACCOUNT_INPUT' | 'ACCOUNT_RATE_LIMIT' | 'ACCOUNT_NETWORK' | 'ACCOUNT_PROVIDER' | 'ACCOUNT_CODE' | 'ACCOUNT_SESSION' | 'ACCOUNT_STORAGE'
  // trip-detector-v1.2's own closed Possible-trip/hidden reason codes
  // (detector-v1-2.md), mirrored here so a rebuild's classification mix is
  // observable without logging any journey content: ATLAS_REBUILD_PROFILE's
  // REBUILD_QUALIFY_PROFILE stage emits one of these per journey (M10.2's
  // device-aggregate read counts them by reasonCode within one
  // correlationId). The same closed set also names the Possible-trip card's
  // "Set Home" action for `home-not-set`, once that card is built (CAP-7).
  | 'HOME_NOT_SET' | 'TIME_CONFLICT' | 'NO_LOCATION' | 'WEAK_LOCATION' | 'NEAR_HOME'
  | 'FREQUENT_PLACE' | 'FEW_PHOTOS' | 'SINGLE_MOMENT' | 'OWNER_VETO' | 'NO_AWAY_EVIDENCE' | 'NON_CAPTURE_SOURCE'
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
  | 'NANO_UNAVAILABLE' | 'NANO_BUSY' | 'NANO_BACKGROUND' | 'NANO_INPUT' | 'NANO_INFERENCE' | 'NANO_DOWNLOAD'
  // AI clue layer background pass (CAP-3, spec-ai-clue-layer/delivery-and-diagnostics.md).
  | 'MODEL_UNAVAILABLE' | 'BUDGET_EXHAUSTED' | 'CLUE_INVALID'
  | 'UNKNOWN';

export type AppDiagnosticOutcome = 'complete' | 'unchanged' | 'paused' | 'blocked' | 'restricted' | 'skipped' | 'failed' | 'unknown';

/** The only runtime-console payload. All fields are closed, non-identifying values. */
export type AppDiagnosticEvent = Readonly<{
  operation: AppDiagnosticOperation;
  reasonCode: AppDiagnosticReasonCode;
  stage: 'QUESTION_OFFER_SAVE' | 'QUESTION_DECISION_COMMIT' | 'MEDIA_ASSOCIATION_CHECK' | 'MEDIA_ORIGINAL_CHECK' | 'MEDIA_SLOT_CHECK' | 'HOME_CONTEXT_READ' | 'HOME_SETUP_READ' | 'HOME_SCOPE' | 'HOME_COMMAND_COMMIT' | 'HOME_COMMAND_READBACK' | 'MAP_STYLE' | 'PREVIEW_LIFECYCLE' | 'PREVIEW_READ' | 'PREVIEW_MEDIA' | 'HISTORY_OPEN_AUTH' | 'HISTORY_OPEN_REPLICA' | 'HISTORY_OPEN_SCOPE' | 'HISTORY_OPEN_PREFERENCE' | 'HISTORY_OPEN_BIND' | 'HISTORY_PULL' | 'HISTORY_REPLICA_STAGE' | 'HISTORY_REBUILD' | 'HISTORY_READ' | 'HISTORY_AUTHORITY' | 'HISTORY_POINTER'
    | 'CANDIDATE_INPUT_READ' | 'CANDIDATE_CLASSIFY' | 'CANDIDATE_PRESENTATION' | 'CANDIDATE_READBACK' | 'HOME_SEARCH_INDEX' | JourneyPreviewStage
    // CAP-3's real Possible-trips card (detector-v1-2.md), reusing the
    // existing POSSIBLE_TRIP_REVIEW operation: the dev-preview shadow path's
    // CANDIDATE_* stages above are untouched.
    | 'POSSIBLE_TRIPS_LIST_READ' | 'POSSIBLE_TRIP_SET_HOME'
    | 'HINT_ELIGIBILITY' | 'DATE_SEARCH' | 'MEDIA_SCOPE' | 'CONSENT_CHECK' | 'CONSENT_WRITE' | 'RECOGNITION' | 'LANDMARK_MODEL' | 'LANDMARK_MATCH' | 'RESULT_VALIDATE' | 'NANO_STATUS' | 'NANO_DOWNLOAD' | 'NANO_INFERENCE'
    | 'TRAVEL_WINDOW_CACHE_READ' | 'TRAVEL_WINDOW_CACHE_WRITE' | 'TRAVEL_WINDOW_REVIEW'
    | 'PACK_LOAD' | 'PACK_VALIDATE' | 'REGION_ROUTE' | 'CAPTURE_METADATA_READ'
    | 'TRIP_QUALIFY' | 'ALBUM_ASSOCIATE' | 'PROPOSAL_STAGE' | 'PROPOSAL_READBACK' | 'REVIEW_COMMIT' | 'REVIEW_READBACK'
    | 'POSSIBLE_TRIP_SAVE' | 'POSSIBLE_TRIP_REBUILD' | 'POSSIBLE_TRIP_ACK' | 'POSSIBLE_TRIP_READBACK' | 'POSSIBLE_TRIP_PUBLISH'
    | 'ACCOUNT_SYNC_WAIT' | 'ACCOUNT_SYNC_CONSENT' | 'ACCOUNT_SYNC_HISTORY' | 'ACCOUNT_SYNC_MEDIA' | 'ACCOUNT_SYNC_OPEN' | 'MEDIA_REPLAY_SCOPE' | 'MEDIA_REPLAY_MAPPING'
    | 'MEDIA_REPLAY_REPLICA' | 'MEDIA_REPLAY_MANIFEST' | 'MEDIA_REPLAY_SOUNDTRACK'
    | 'MEDIA_REPLAY_MAPPING_SQL_TIMEOUT' | 'MEDIA_REPLAY_MAPPING_DEADLINE'
    | 'MEDIA_REPLAY_MAPPING_CONFIG' | 'MEDIA_REPLAY_MAPPING_SESSION_READ' | 'MEDIA_REPLAY_MAPPING_SESSION_UNAVAILABLE'
    | 'MEDIA_REPLAY_MAPPING_REQUEST' | 'MEDIA_REPLAY_MAPPING_RESPONSE_JSON' | 'MEDIA_REPLAY_MAPPING_HTTP_AUTH'
    | 'MEDIA_REPLAY_MAPPING_HTTP_FORBIDDEN'
    | 'MEDIA_REPLAY_MAPPING_HTTP_RETRY' | 'MEDIA_REPLAY_MAPPING_HTTP_REJECT' | 'MEDIA_REPLAY_MAPPING_RESPONSE_SHAPE' | 'MEDIA_REPLAY_MAPPING_RESPONSE_ERROR'
    | 'HISTORY_PROVIDER_ACCOUNT' | 'HISTORY_PROVIDER_LOCAL' | 'HISTORY_PROVIDER_BIND' | 'HISTORY_CONSUMER_ACCOUNT' | 'HISTORY_CONSUMER_LOCAL' | 'HISTORY_CONSUMER_UNMOUNT'
    | 'HISTORY_CONTEXT_USER_LOCAL' | 'HISTORY_CONTEXT_OWNER_CHANGE' | 'HISTORY_CONTEXT_AUTH_LOST' | 'HISTORY_CONTEXT_SCOPE_CHANGED' | 'HISTORY_CONTEXT_AUTHORITY_LOST' | 'HISTORY_CONTEXT_UPLOADS_STOPPED' | 'HISTORY_CONTEXT_DELETED' | 'HISTORY_CONTEXT_SUSPEND'
    | 'HISTORY_EXPORT_OPEN' | 'HISTORY_EXPORT_SCHEMA' | 'HISTORY_EXPORT_TRANSACTION' | 'HISTORY_EXPORT_BEGIN' | 'HISTORY_EXPORT_COMMIT' | 'HISTORY_EXPORT_ROLLBACK' | 'HISTORY_EXPORT_LIFECYCLE' | 'HISTORY_EXPORT_CANDIDATE_COMPATIBILITY' | 'HISTORY_EXPORT_CLOSE'
    | `HISTORY_EXPORT_REPLAY_${'JSON'|'FIELDS'|'ARRAYS'|'ARRAY_TYPE'|'ARRAY_COUNT'|'ARRAY_ITEM_TYPE'|'ARRAY_ITEM_SIZE'|'ARRAY_DUPLICATE'|'DIRECTION'|'AUDIO'|'SIZE'|'ROW'}`
    | `HISTORY_EXPORT_${'EVIDENCE'|'OVERLAY'|'JOURNEY_CORRECTION'|'MEMORY_CORRECTION'|'PRIVACY'|'HOME'|'MANUAL'|'REPLAY'}_${'READ'|'VALIDATE'}`
    | 'ENTRY_READ' | 'ENTRY_MIGRATE' | 'ACCESS_INSPECT' | 'ACCESS_REQUEST' | 'ACCESS_SETTINGS' | 'UPDATE_OFFER_READ' | 'PICKER_SELECT' | 'INTENT_SAVE'
    | 'RUN_ADMISSION' | 'RUN_WAIT' | 'RUN_CHECKPOINT' | 'RUN_RECONCILE' | 'INTENT_READ' | 'RUN_ACCESS_INSPECT' | 'IMPORT_ACCESS' | 'IMPORT_READ' | 'IMPORT_COMMIT' | 'IMPORT_CHECKPOINT' | 'UPDATE_PREFERENCE' | 'UPDATE_SCHEDULE' | 'UPDATE_SOURCE' | 'UPDATE_ACCESS' | 'UPDATE_COVERAGE'
    | 'HISTORY_LEASE' | 'HISTORY_SCHEDULE'
    | 'HISTORY_CORRECTION'
    | 'HISTORY_SESSION_LIST' | 'HISTORY_SESSION_REVOKE'
    | 'HISTORY_DELETE_STATUS' | 'HISTORY_DELETE_CLEANUP' | 'HISTORY_DELETE_AUTH' | 'HISTORY_DELETE_ACK'
    | 'MEDIA_COPY' | 'MEDIA_DECODE' | 'MEDIA_ENCODE' | 'MEDIA_STAGE' | 'MEDIA_ACK' | 'MEDIA_UPLOAD' | 'MEDIA_ACTIVATE' | 'MEDIA_CLEANUP'
    | 'MEDIA_SERVICE_REQUEST' | 'MEDIA_SERVICE_HTTP_RETRY' | 'MEDIA_SERVICE_HTTP_REJECT' | 'MEDIA_SERVICE_BOOT' | 'MEDIA_SERVICE_WORKER_ERROR' | 'MEDIA_SERVICE_WORKER_LIMIT'
    | 'MEDIA_SERVICE_RESPONSE_JSON' | 'MEDIA_SERVICE_DEADLINE' | 'MEDIA_SERVICE_SESSION' | 'MEDIA_SERVICE_SESSION_DEADLINE' | 'MEDIA_SERVICE_AUTH' | 'MEDIA_SERVICE_SCHEMA'
    | 'MEDIA_RECONCILE' | 'MEDIA_SERVICE_UPLOAD_LEASE'
    | 'MEDIA_AUTH' | 'MEDIA_FETCH' | 'MEDIA_VERIFY' | 'MEDIA_CACHE' | 'HISTORY_AUTH' | 'HISTORY_CONSENT' | 'HISTORY_SCHEMA' | 'HISTORY_EXPORT' | 'HISTORY_STAGE' | 'HISTORY_ACK' | 'HISTORY_RESTORE' | 'HISTORY_DELETE' | 'ACCOUNT_CONFIG' | 'ACCOUNT_INPUT' | 'ACCOUNT_PROVIDER' | 'ACCOUNT_SECURE_READ' | 'ACCOUNT_SECURE_WRITE' | 'ACCOUNT_SECURE_DELETE' | 'ACCOUNT_SESSION' | ReconciliationStage | DurableRevealDiagnosticStage | AtlasProfileStage | 'PRIVACY_REVIEW_DETAIL' | 'PRIVACY_REVIEW_SCOPE' | 'PRIVACY_POLICY_LIST' | 'REPLAY_ACCOUNT' | 'REPLAY_LOCAL' | `REPLAY_OUTPUT_${'DIRECTORY' | 'COPY' | 'VERIFY' | 'IDENTITY' | 'SAVE' | 'CLEANUP' | 'LIFECYCLE' | 'MAPPING' | 'RUN' | 'PRIVACY' | 'CAS'}` | 'REPLAY_MANIFEST' | 'REPLAY_PREVIEWS' | 'REPLAY_SOUNDTRACK' | 'REPLAY_ELIGIBILITY' | 'REPLAY_ACCESS' | 'REPLAY_SCOPE' | 'REPLAY_DECODE' | 'REPLAY_ENCODE' | 'REPLAY_OUTPUT' | 'REPLAY_HANDOFF' | 'REPLAY_STALE' | 'REPLAY_UNAVAILABLE' | 'REPLAY_RECOVERY_READ' | 'REPLAY_RECOVERY_RESET' | 'REPLAY_RECOVERY_STAGE' | 'SHARE_COPY' | 'SHARE_DECODE' | 'SHARE_ENCODE' | 'SHARE_VERIFY' | 'SHARE_ELIGIBILITY' | 'SHARE_SERIALIZE' | 'SHARE_DERIVATIVE_ENCODE' | 'SHARE_DERIVATIVE_VERIFY' | 'SHARE_AUTH' | 'SHARE_QUOTA' | 'SHARE_UPLOAD' | 'SHARE_ACTIVATE' | 'SHARE_ACK' | 'SHARE_RECONCILE' | 'SHARE_REVOKE' | 'SHARE_EXPIRY' | 'SHARE_DELETE_FENCE' | 'SHARE_REMOVAL_QUEUE'
    // AI clue layer background pass (CAP-3). REBUILD_CLUES is ATLAS_REBUILD's
    // own added stage (delivery-and-diagnostics.md); the rest belong to
    // AI_CLUE_PASS/PERSONAL_RULE_SAVE.
    | 'REBUILD_CLUES'
    | 'CLUE_SCHEDULE' | 'CLUE_PRODUCE' | 'CLUE_VALIDATE' | 'CLUE_COMMIT' | 'CLUE_REBUILD' | 'CLUE_NOTICE'
    | 'RULE_DERIVE' | 'RULE_COMMIT' | 'RULE_REMOVE'
    | null;
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
export type JourneyPreviewStage = 'PREVIEW_SCOPE' | 'PREVIEW_READ' | 'PREVIEW_SUPPORT_READ' | 'PREVIEW_MEDIA' | 'PREVIEW_VERIFY';

export class JourneyPreviewBoundaryError extends Error {
  constructor(readonly stage: JourneyPreviewStage, readonly originalError: unknown, readonly reported = false) {
    super('Journey is no longer available.');
  }
}

export function classifyAppDiagnosticError(error: unknown): AppDiagnosticReasonCode {
  const source = error instanceof Error && 'originalError' in error
    ? (error as Error & { originalError?: unknown }).originalError
    : error;
  if (!(source instanceof Error)) return 'UNKNOWN';
  if (source.name === 'LocalAtlasSchemaRecoveryError') return 'SCHEMA';
  const message = source.message.toLowerCase();
  if (message === 'journey changed. reopen atlas.' || message === 'journey preview scope changed.'
    || message === 'review is stale. reload the journey before saving.') return 'HISTORY_STALE';
  if (message.includes('row too big to fit into cursorwindow')) return 'ROW_LIMIT';
  if (message === 'onboarding schema is invalid.') return 'SCHEMA';
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
