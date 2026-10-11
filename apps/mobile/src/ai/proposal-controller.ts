import { buildMinimizedAiRequest } from './minimizer';
import { validateAiProposals } from './validation';
import type { AiRequest, AiResult } from './types';
import type { ReconstructionGraph } from '@/reconstruction';

export type AiReviewRevisions = { consentRevision: number; evidenceRevision: number; correctionRevision: number; consentGranted: boolean };
export type AiReviewView = { status: 'idle' | 'requesting' | 'proposal' | 'no-eligible-ambiguity' | 'declined' | 'stale' | 'skipped'; message: string; proposals: { label: string; candidateIds: string[] }[] };
const idle: AiReviewView = { status: 'idle', message: 'Optional AI suggestions are not requested.', proposals: [] };

/** Maps only existing local journey alternatives; it never applies a suggestion to the graph. */
export function deriveAmbiguousAlternatives(graph: ReconstructionGraph) {
  return graph.possibleMerges.filter((merge) => merge.aiCandidates && merge.aiCandidates.length > 0).slice(0, 12).map((merge) => ({
    localAlternativeId: `${merge.fromJourneyId}|${merge.toJourneyId}`,
    kind: 'journey-group' as const,
    candidates: merge.aiCandidates!,
  }));
}

function label(code: 'possible-grouping' | 'needs-more-evidence' | 'no-suggestion') {
  return code === 'possible-grouping' ? 'Possible journey grouping' : code === 'needs-more-evidence' ? 'More evidence is needed' : 'No suggestion';
}

export class AiProposalController {
  private current = idle;
  private generation = 0;
  constructor(private readonly transport: { request(input: { request: AiRequest; expectedConsentRevision: number; currentEvidenceRevision: number; currentCorrectionRevision: number; consentGranted: boolean }): Promise<AiResult> }, private readonly notify: (view: AiReviewView) => void, private readonly currentRevisions?: () => AiReviewRevisions) {}
  get view() { return this.current; }
  clear() { this.generation += 1; this.current = idle; this.notify(this.current); }
  /** Used while the production proxy kill switch is off; it performs no consent or network work. */
  showDisabledPreview() {
    this.generation += 1;
    this.current = { status: 'skipped', message: 'Optional AI is unavailable right now. Your local draft remains available.', proposals: [] };
    this.notify(this.current);
  }
  async request(graph: ReconstructionGraph | null, revisions: AiReviewRevisions) {
    const generation = ++this.generation;
    if (!revisions.consentGranted) { this.current = { status: 'declined', message: 'Optional AI was not used. Your local draft remains available.', proposals: [] }; this.notify(this.current); return; }
    const alternatives = graph ? deriveAmbiguousAlternatives(graph) : [];
    const minimized = buildMinimizedAiRequest({ ...revisions, alternatives });
    if (!minimized) { this.current = { status: 'no-eligible-ambiguity', message: 'No bounded ambiguity is available for an optional AI suggestion.', proposals: [] }; this.notify(this.current); return; }
    this.current = { status: 'requesting', message: 'Requesting an optional inferred suggestion.', proposals: [] }; this.notify(this.current);
    let result: AiResult;
    try {
      result = await this.transport.request({ request: minimized.request, expectedConsentRevision: revisions.consentRevision, currentEvidenceRevision: revisions.evidenceRevision, currentCorrectionRevision: revisions.correctionRevision, consentGranted: revisions.consentGranted });
    } catch {
      if (generation !== this.generation) return;
      this.current = { status: 'skipped', message: 'Optional AI was not used. Your local draft remains available.', proposals: [] };
      this.notify(this.current);
      return;
    }
    const current = this.currentRevisions?.() ?? revisions;
    if (generation !== this.generation) return;
    if (current.consentRevision !== revisions.consentRevision || current.evidenceRevision !== revisions.evidenceRevision || current.correctionRevision !== revisions.correctionRevision || current.consentGranted !== revisions.consentGranted) {
      this.current = { status: 'stale', message: 'The local record changed, so the optional suggestion was discarded.', proposals: [] }; this.notify(this.current); return;
    }
    if (result.status === 'proposal') {
      if (!validateAiProposals(result.proposals, minimized.request)) { this.current = { status: 'skipped', message: 'The optional suggestion could not be verified against this local draft.', proposals: [] }; this.notify(this.current); return; }
      const proposals = result.proposals.map((proposal) => ({ label: label(proposal.labelCode), candidateIds: proposal.selectedCandidateIds.map((id) => minimized.opaqueToLocal.get(id)).filter((id): id is string => Boolean(id)) }));
      if (proposals.some((proposal) => proposal.candidateIds.length === 0)) { this.current = { status: 'skipped', message: 'The optional suggestion could not be verified against this local draft.', proposals: [] }; }
      else this.current = { status: 'proposal', message: 'Inferred suggestion only. It has not changed your local draft.', proposals };
    } else this.current = { status: result.reason === 'stale' ? 'stale' : 'skipped', message: result.reason === 'stale' ? 'The local record changed, so the optional suggestion was discarded.' : 'Optional AI was not used. Your local draft remains available.', proposals: [] };
    this.notify(this.current);
  }
}
