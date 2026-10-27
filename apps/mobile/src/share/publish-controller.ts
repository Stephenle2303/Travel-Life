import { recordAppDiagnostic } from '@/diagnostics/app-diagnostics';
import type { JourneyEligibility } from '@/reveal/types';
import type { SharePublishRequest, ShareTransportResult } from './transport';

export type FrozenShareDraft = Readonly<{
  requestId: string;
  contentDigest: string;
  capability: string;
  expiresInDays: number;
  selections: readonly Readonly<{ displayId: string; snapshotToken: number; privacyRevision: number }>[];
}>;

export type SharePublishControllerResult = ShareTransportResult | Readonly<{ status: 'skipped'; reason: 'eligibility-changed' }>;

/**
 * The caller persists a protected FrozenShareDraft before calling publish.
 * This controller intentionally receives no labels, media IDs, locations, or
 * source URIs, so neither diagnostics nor transport orchestration can leak
 * private source data.
 */
export function createSharePublishController(options: Readonly<{
  getEligibility(displayId: string, snapshotToken: number, expectedPrivacyRevision: number): Promise<JourneyEligibility>;
  transport: Readonly<{ publish(request: SharePublishRequest, signal?: AbortSignal): Promise<ShareTransportResult> }>;
}>) {
  return {
    async publish(draft: FrozenShareDraft, correlationId: string, signal?: AbortSignal): Promise<SharePublishControllerResult> {
      recordAppDiagnostic({ operation: 'SHARE_PUBLISH', reasonCode: 'START', stage: 'SHARE_ELIGIBILITY', retryable: false, durableOutcome: 'unchanged', correlationId });
      for (const selection of draft.selections) {
        let eligibility: JourneyEligibility;
        try {
          eligibility = await options.getEligibility(selection.displayId, selection.snapshotToken, selection.privacyRevision);
        } catch {
          recordAppDiagnostic({ operation: 'SHARE_PUBLISH', reasonCode: 'UNKNOWN', stage: 'SHARE_ELIGIBILITY', retryable: true, durableOutcome: 'failed', correlationId });
          return { status: 'skipped', reason: 'unavailable' };
        }
        if (!eligibility.eligible || eligibility.privacyRevision !== selection.privacyRevision) {
          recordAppDiagnostic({ operation: 'SHARE_PUBLISH', reasonCode: 'SHARE_ELIGIBILITY_CHANGED', stage: 'SHARE_ELIGIBILITY', retryable: false, durableOutcome: 'skipped', correlationId });
          return { status: 'skipped', reason: 'eligibility-changed' };
        }
      }
      const request = { contractVersion: 'travel-life-share-v1' as const, requestId: draft.requestId, contentDigest: draft.contentDigest, capability: draft.capability, expiresInDays: draft.expiresInDays };
      const result = await (signal ? options.transport.publish(request, signal) : options.transport.publish(request));
      if (result.status === 'staged' || result.status === 'activated') {
        recordAppDiagnostic({ operation: 'SHARE_PUBLISH', reasonCode: 'COMPLETE', stage: 'SHARE_ACK', retryable: false, durableOutcome: 'complete', correlationId });
      } else {
        const reasonCode = result.reason === 'session-required' ? 'SHARE_SESSION' : result.reason === 'invalid-response' ? 'SHARE_RECEIPT_CONFLICT' : result.reason === 'cancelled' ? 'SKIPPED' : 'UNKNOWN';
        recordAppDiagnostic({ operation: 'SHARE_PUBLISH', reasonCode, stage: 'SHARE_ACK', retryable: result.reason === 'unavailable', durableOutcome: result.reason === 'cancelled' ? 'skipped' : 'failed', correlationId });
      }
      return result;
    },
  };
}
