import { validateAiProposals } from './validation';
import type { AiRequest, AiResult, AiTransportResult } from './types';
import type { AnonymousSessionProvider } from './session';

const emptyUsage = { inputTokens: null, outputTokens: null };
const safeTokenCount = (value: unknown, maximum: number) => value === null || (typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 0 && value <= maximum);
const usageIsSafe = (usage: unknown): usage is { inputTokens: number | null; outputTokens: number | null } => Boolean(usage && typeof usage === 'object' && !Array.isArray(usage) && Object.keys(usage as object).length === 2 && ['inputTokens', 'outputTokens'].every((key) => key in (usage as object)) && safeTokenCount((usage as { inputTokens: unknown }).inputTokens, 2000) && safeTokenCount((usage as { outputTokens: unknown }).outputTokens, 800));
const skippedReasons = new Set(['disabled', 'unauthenticated', 'invalid-request', 'limited', 'unavailable', 'timeout', 'refused', 'invalid-response']);

export function createAiTransport(options: { endpoint: string | undefined; publishableKey: string | undefined; session: AnonymousSessionProvider; fetcher?: typeof fetch }) {
  const fetcher = options.fetcher ?? fetch;
  return {
    async request(input: { request: AiRequest; expectedConsentRevision: number; currentEvidenceRevision: number; currentCorrectionRevision: number; consentGranted: boolean }): Promise<AiResult> {
      if (!input.consentGranted || input.request.consentRevision !== input.expectedConsentRevision) return { status: 'skipped', reason: 'consent-required', usage: emptyUsage };
      if (input.request.evidenceRevision !== input.currentEvidenceRevision || input.request.correctionRevision !== input.currentCorrectionRevision) return { status: 'skipped', reason: 'stale', usage: emptyUsage };
      if (!options.endpoint || !options.publishableKey) return { status: 'skipped', reason: 'disabled', usage: emptyUsage };
      let session;
      try { session = await options.session.getAnonymousSession(); } catch { return { status: 'skipped', reason: 'session-required', usage: emptyUsage }; }
      if (!session || session.expiresAtMillis <= Date.now()) return { status: 'skipped', reason: 'session-required', usage: emptyUsage };
      try {
        const response = await fetcher(options.endpoint, { method: 'POST', headers: { authorization: `Bearer ${session.accessToken}`, apikey: options.publishableKey, 'content-type': 'application/json' }, body: JSON.stringify(input.request) });
        const parsed = await response.json().catch(() => null) as AiTransportResult | null;
        if (!parsed || (parsed.status !== 'proposal' && parsed.status !== 'skipped') || !usageIsSafe(parsed.usage)) return { status: 'skipped', reason: 'invalid-response', usage: emptyUsage };
        if (parsed.status === 'skipped') return skippedReasons.has(parsed.reason) ? parsed : { status: 'skipped', reason: 'invalid-response', usage: emptyUsage };
        if (parsed.contractVersion !== input.request.contractVersion || !validateAiProposals(parsed.proposals, input.request)) return { status: 'skipped', reason: 'invalid-response', usage: parsed.usage };
        return { status: 'proposal', proposals: parsed.proposals, usage: parsed.usage };
      } catch { return { status: 'skipped', reason: 'unavailable', usage: emptyUsage }; }
    },
  };
}
