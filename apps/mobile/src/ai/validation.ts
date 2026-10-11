import type { AiProposal, AiRequest } from './types';

export function validateAiProposals(proposals: AiProposal[], request: AiRequest) {
  const alternatives = new Map(request.alternatives.map((alternative) => [alternative.id, alternative]));
  const seen = new Set<string>();
  if (!Array.isArray(proposals) || proposals.length > alternatives.size) return false;
  return proposals.every((proposal) => {
    if (!proposal || typeof proposal !== 'object' || Array.isArray(proposal)) return false;
    const alternative = alternatives.get(proposal.alternativeId);
    if (!alternative || seen.has(proposal.alternativeId) || !['low', 'medium'].includes(proposal.confidence) || !['ambiguous-grouping', 'insufficient-evidence', 'no-proposal'].includes(proposal.rationaleCode) || !Array.isArray(proposal.selectedCandidateIds) || proposal.selectedCandidateIds.length > alternative.candidateIds.length) return false;
    seen.add(proposal.alternativeId);
    const selected = new Set(proposal.selectedCandidateIds);
    if (selected.size !== proposal.selectedCandidateIds.length || proposal.selectedCandidateIds.some((id) => !alternative.candidateIds.includes(id))) return false;
    return proposal.rationaleCode === 'ambiguous-grouping' ? selected.size > 0 : selected.size === 0;
  });
}
