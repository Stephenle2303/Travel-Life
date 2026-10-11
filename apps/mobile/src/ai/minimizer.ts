import { AI_CONTRACT_VERSION, AI_RULE_VERSION, type AiAlternative, type AiRequest } from './types';

type LocalCandidate = { localId: string; relativeDayOffset: number; evidenceCategory: AiAlternative['evidenceCategories'][number] };
type LocalAlternative = { localAlternativeId: string; kind: AiAlternative['kind']; candidates: LocalCandidate[] };

const opaque = (prefix: string, number: number) => `${prefix}_${number.toString(36)}`;

/** Maps local identities to request-scoped opaque references; mapping never leaves the device. */
export function buildMinimizedAiRequest(input: { consentRevision: number; evidenceRevision: number; correctionRevision: number; alternatives: LocalAlternative[] }) {
  if (!Number.isInteger(input.consentRevision) || !Number.isInteger(input.evidenceRevision) || !Number.isInteger(input.correctionRevision) || input.consentRevision < 0 || input.evidenceRevision < 0 || input.correctionRevision < 0 || input.alternatives.length === 0 || input.alternatives.length > 12) return null;
  const opaqueToLocal = new Map<string, string>();
  const alternatives: AiAlternative[] = [];
  for (const [alternativeIndex, alternative] of input.alternatives.entries()) {
    if (!alternative || (alternative.kind !== 'journey-group' && alternative.kind !== 'place-label') || alternative.candidates.length === 0 || alternative.candidates.length > 8) return null;
    const candidateIds: string[] = [];
    const relativeDayOffsets: number[] = [];
    const evidenceCategories: AiAlternative['evidenceCategories'] = [];
    for (const [candidateIndex, candidate] of alternative.candidates.entries()) {
      if (!candidate || !candidate.localId || !Number.isInteger(candidate.relativeDayOffset) || Math.abs(candidate.relativeDayOffset) > 3650 || !['geotagged', 'gps-less', 'manual'].includes(candidate.evidenceCategory)) return null;
      const candidateId = opaque('c', alternativeIndex * 8 + candidateIndex);
      opaqueToLocal.set(candidateId, candidate.localId);
      candidateIds.push(candidateId); relativeDayOffsets.push(candidate.relativeDayOffset); evidenceCategories.push(candidate.evidenceCategory);
    }
    alternatives.push({ id: opaque('a', alternativeIndex), kind: alternative.kind, candidateIds, relativeDayOffsets, evidenceCategories });
  }
  const request: AiRequest = { contractVersion: AI_CONTRACT_VERSION, consentRevision: input.consentRevision, ruleVersion: AI_RULE_VERSION, evidenceRevision: input.evidenceRevision, correctionRevision: input.correctionRevision, alternatives };
  return { request, opaqueToLocal };
}
