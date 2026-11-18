import type { AccountMediaError } from '@/account/media-cache';
import { classifyAppDiagnosticError, recordAppDiagnostic, type AppDiagnosticEvent } from '@/diagnostics/app-diagnostics';
import { ReplayPreparationError, replayFailureStage } from './renderer';

export class ReplayDiagnosticError extends ReplayPreparationError {
  readonly diagnosticRecorded = true;
}

/** Tracks only closed boundary names; native errors are classified and discarded. */
export function replayPreparationDiagnostics(correlationId: string) {
  let stage: AppDiagnosticEvent['stage'] = 'REPLAY_ELIGIBILITY';
  return {
    enter(next: AppDiagnosticEvent['stage']) {
      stage = next;
      recordAppDiagnostic({ operation: 'REPLAY_RENDER', stage, reasonCode: 'START', retryable: false, durableOutcome: 'unchanged', correlationId });
    },
    failure(error: unknown, publicStage?: import('./renderer').ReplayFailureStage): ReplayDiagnosticError {
      if (error instanceof ReplayDiagnosticError) return error;
      const failureStage = publicStage ?? (error instanceof ReplayPreparationError ? replayFailureStage(error) : 'REPLAY_ACCESS');
      const stale = failureStage === 'REPLAY_STALE';
      const mediaReason = error && typeof error === 'object' && 'reason' in error ? error.reason : null;
      const preparedReason = error && typeof error === 'object' && 'diagnosticReason' in error ? error.diagnosticReason : null;
      const preparedStage = error && typeof error === 'object' && 'diagnosticStage' in error ? error.diagnosticStage : null;
      const reasonCode = preparedReason === 'REPLAY_SCOPE_INVALID' || preparedReason === 'REPLAY_MAPPING_INVALID' || preparedReason === 'REPLAY_RECEIPT_CONFLICT' ? preparedReason : stale ? 'SKIPPED' : isAccountMediaReason(mediaReason)
        ? mediaReason : error instanceof ReplayPreparationError && failureStage === 'REPLAY_ACCESS' ? 'ACCESS' : classifyAppDiagnosticError(error);
      const skipped = stale || reasonCode === 'REPLAY_SCOPE_INVALID' || reasonCode === 'REPLAY_MAPPING_INVALID';
      const retryable = ['MEDIA_NETWORK', 'MEDIA_STORAGE', 'ACCOUNT_STORAGE', 'UNKNOWN', 'DATABASE_BUSY', 'REPLAY_RECEIPT_CONFLICT'].includes(reasonCode);
      const denied = isAccountMediaReason(reasonCode) && !retryable || reasonCode === 'ACCESS';
      const outputGuardStage = preparedReason === 'REPLAY_SCOPE_INVALID' || preparedReason === 'REPLAY_MAPPING_INVALID' || preparedReason === 'REPLAY_RECEIPT_CONFLICT'
        ? preparedStage === 'REPLAY_OUTPUT_LIFECYCLE' || preparedStage === 'REPLAY_OUTPUT_MAPPING' || preparedStage === 'REPLAY_OUTPUT_RUN' || preparedStage === 'REPLAY_OUTPUT_PRIVACY' || preparedStage === 'REPLAY_OUTPUT_CAS' ? preparedStage : null : null;
      recordAppDiagnostic({ operation: 'REPLAY_RENDER', stage: outputGuardStage ?? (stage === 'REPLAY_ENCODE' && error instanceof ReplayPreparationError ? failureStage : stage), reasonCode, retryable: !skipped && retryable, durableOutcome: skipped ? 'skipped' : denied ? 'blocked' : 'unchanged', correlationId });
      return new ReplayDiagnosticError(failureStage);
    },
  };
}

function isAccountMediaReason(value: unknown): value is AccountMediaError['reason'] {
  return typeof value === 'string' && ['MEDIA_ACCESS','MEDIA_NETWORK','MEDIA_VERIFY','MEDIA_STORAGE','ACCOUNT_SESSION','ACCOUNT_STORAGE','MEDIA_SCHEMA','MEDIA_CONFLICT','MEDIA_CONSENT','MEDIA_SCOPE','MEDIA_QUOTA','MEDIA_UNAVAILABLE','MEDIA_DECODE','MEDIA_ENCODE','UNKNOWN'].includes(value);
}
