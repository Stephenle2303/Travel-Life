import type { AppDiagnosticEvent, AppDiagnosticReasonCode } from '@/diagnostics/app-diagnostics';

/** Closed propagation only; never retains a native error, owner data or message. */
export class AccountSyncStepError extends Error {
  constructor(readonly reason: AppDiagnosticReasonCode, readonly boundary: AppDiagnosticEvent['stage'], readonly diagnosticRecorded = false) {
    super('Account sync did not complete.');
  }
}
export type AccountSyncActionOptions = { correlationId?: string; propagateErrors?: boolean };
