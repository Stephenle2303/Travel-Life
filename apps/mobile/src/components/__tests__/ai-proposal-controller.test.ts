import { AiProposalController, deriveAmbiguousAlternatives } from '@/ai';
import type { ReconstructionGraph } from '@/reconstruction';

const graph: ReconstructionGraph = { ruleVersion: 'reconstruction-v1', places: [], visits: [], journeys: [{ id: 'j-one', visitIds: [], state: 'inferred' }, { id: 'j-two', visitIds: [], state: 'inferred' }], possibleMerges: [{ fromJourneyId: 'j-one', toJourneyId: 'j-two', reason: 'adjacent-gap', aiCandidates: [{ localId: 'j-one', relativeDayOffset: 0, evidenceCategory: 'geotagged' }, { localId: 'j-two', relativeDayOffset: 2, evidenceCategory: 'gps-less' }] }], dispositions: [], memberships: [] };
const revisions = { consentRevision: 1, evidenceRevision: 2, correctionRevision: 3, consentGranted: true };

describe('AI proposal review controller', () => {
  it('derives only bounded existing possible-merge alternatives', () => {
    expect(deriveAmbiguousAlternatives(graph)).toEqual([expect.objectContaining({ kind: 'journey-group', candidates: [expect.objectContaining({ localId: 'j-one' }), expect.objectContaining({ localId: 'j-two' })] })]);
  });
  it('keeps the local graph unchanged and maps only a current opaque proposal', async () => {
    const notify = jest.fn();
    const controller = new AiProposalController({ request: async () => ({ status: 'proposal', proposals: [{ alternativeId: 'a_0', selectedCandidateIds: ['c_0', 'c_1'], confidence: 'low', rationaleCode: 'ambiguous-grouping', labelCode: 'possible-grouping' }], usage: { inputTokens: 1, outputTokens: 1 } }) }, notify);
    await controller.request(graph, revisions);
    expect(controller.view).toMatchObject({ status: 'proposal', proposals: [{ label: 'Possible journey grouping', candidateIds: ['j-one', 'j-two'] }] });
    expect(graph.journeys).toHaveLength(2);
  });
  it('shows no-eligibility, declined, stale, and skipped states without a graph mutation', async () => {
    const notify = jest.fn();
    const stale = new AiProposalController({ request: async () => ({ status: 'skipped', reason: 'stale', usage: { inputTokens: null, outputTokens: null } }) }, notify);
    await stale.request({ ...graph, possibleMerges: [] }, revisions);
    expect(stale.view.status).toBe('no-eligible-ambiguity');
    await stale.request(graph, { ...revisions, consentGranted: false });
    expect(stale.view.status).toBe('declined');
    await stale.request(graph, revisions);
    expect(stale.view.status).toBe('stale');
  });
  it('shows constrained or invalid results as a local-safe skipped state', async () => {
    const controller = new AiProposalController({ request: async () => ({ status: 'skipped', reason: 'invalid-response', usage: { inputTokens: null, outputTokens: null } }) }, jest.fn());
    await controller.request(graph, revisions);
    expect(controller.view).toMatchObject({ status: 'skipped', proposals: [] });
    expect(graph.journeys).toHaveLength(2);
  });
  it('shows the disabled preview without fabricating consent or revisions', () => {
    const request = jest.fn();
    const controller = new AiProposalController({ request }, jest.fn());
    controller.showDisabledPreview();
    expect(controller.view.status).toBe('skipped');
    expect(request).not.toHaveBeenCalled();
  });
  it('discards delayed results after a lifecycle clear, concurrent request, or revision change', async () => {
    let resolve!: (result: any) => void;
    const delayed = new Promise<any>((done) => { resolve = done; });
    let current = revisions;
    const controller = new AiProposalController({ request: async () => delayed }, jest.fn(), () => current);
    const pending = controller.request(graph, revisions);
    controller.clear();
    resolve({ status: 'proposal', proposals: [{ alternativeId: 'a_0', selectedCandidateIds: ['c_0', 'c_1'], confidence: 'low', rationaleCode: 'ambiguous-grouping', labelCode: 'possible-grouping' }], usage: { inputTokens: 1, outputTokens: 1 } });
    await pending;
    expect(controller.view.status).toBe('idle');
    const second = controller.request(graph, revisions);
    current = { ...revisions, evidenceRevision: 4 };
    await second;
    expect(controller.view.status).toBe('stale');
  });
  it('keeps the newest result when two requests resolve in reverse order', async () => {
    const resolvers: ((result: any) => void)[] = [];
    const controller = new AiProposalController({ request: () => new Promise<any>((resolve) => resolvers.push(resolve)) }, jest.fn());
    const first = controller.request(graph, revisions);
    const second = controller.request(graph, revisions);
    const proposal = { status: 'proposal' as const, proposals: [{ alternativeId: 'a_0', selectedCandidateIds: ['c_0', 'c_1'], confidence: 'low' as const, rationaleCode: 'ambiguous-grouping' as const, labelCode: 'possible-grouping' as const }], usage: { inputTokens: 1, outputTokens: 1 } };
    resolvers[1](proposal);
    await second;
    resolvers[0]({ ...proposal, proposals: [{ ...proposal.proposals[0], labelCode: 'needs-more-evidence' }] });
    await first;
    expect(controller.view).toMatchObject({ status: 'proposal', proposals: [{ label: 'Possible journey grouping' }] });
  });
  it('converts a rejected transport request to a local-safe skipped state', async () => {
    const controller = new AiProposalController({ request: async () => { throw new Error('offline'); } }, jest.fn());
    await expect(controller.request(graph, revisions)).resolves.toBeUndefined();
    expect(controller.view.status).toBe('skipped');
  });
  it('cancels an in-flight optional request without allowing its late proposal to replace the local state', async () => {
    let resolve!: (result: any) => void;
    let receivedSignal: AbortSignal | undefined;
    const controller = new AiProposalController({ request: ({ signal }) => { receivedSignal = signal; return new Promise<any>((done) => { resolve = done; }); } }, jest.fn());
    const pending = controller.request(graph, revisions);
    expect(controller.view.status).toBe('requesting');
    controller.cancel();
    expect(receivedSignal?.aborted).toBe(true);
    resolve({ status: 'proposal', proposals: [{ alternativeId: 'a_0', selectedCandidateIds: ['c_0', 'c_1'], confidence: 'low', rationaleCode: 'ambiguous-grouping', labelCode: 'possible-grouping' }], usage: { inputTokens: 1, outputTokens: 1 } });
    await pending;
    expect(controller.view).toMatchObject({ status: 'cancelled', proposals: [] });
    expect(graph.journeys).toHaveLength(2);
  });
});
