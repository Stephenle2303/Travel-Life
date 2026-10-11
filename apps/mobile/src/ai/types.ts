export const AI_CONTRACT_VERSION = 'travel-life-ai-v1' as const;
export const AI_RULE_VERSION = 'reconstruction-v1' as const;

export type AiConsent = { revision: number; granted: boolean };
export type AiAlternative = { id: string; kind: 'journey-group' | 'place-label'; candidateIds: string[]; relativeDayOffsets: number[]; evidenceCategories: ('geotagged' | 'gps-less' | 'manual')[] };
export type AiRequest = { contractVersion: typeof AI_CONTRACT_VERSION; consentRevision: number; ruleVersion: typeof AI_RULE_VERSION; evidenceRevision: number; correctionRevision: number; alternatives: AiAlternative[] };
export type AiLabelCode = 'possible-grouping' | 'needs-more-evidence' | 'no-suggestion';
export type AiProposal = { alternativeId: string; selectedCandidateIds: string[]; confidence: 'low' | 'medium'; rationaleCode: 'ambiguous-grouping' | 'insufficient-evidence' | 'no-proposal'; labelCode: AiLabelCode };
export type AiUsage = { inputTokens: number | null; outputTokens: number | null };
export type AiSkippedReason = 'consent-required' | 'session-required' | 'invalid-request' | 'stale' | 'disabled' | 'unauthenticated' | 'limited' | 'unavailable' | 'timeout' | 'refused' | 'invalid-response';
export type AiTransportResult = { status: 'proposal'; contractVersion: typeof AI_CONTRACT_VERSION; proposals: AiProposal[]; usage: AiUsage } | { status: 'skipped'; reason: Exclude<AiSkippedReason, 'consent-required' | 'session-required' | 'stale'>; usage: AiUsage };
export type AiResult = { status: 'proposal'; proposals: AiProposal[]; usage: AiUsage } | { status: 'skipped'; reason: AiSkippedReason; usage: AiUsage };
