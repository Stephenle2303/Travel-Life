import { applyJourneyCorrections } from '@/reconstruction/repository';
import type { ReconstructionGraph } from '@/reconstruction/types';

const graph: ReconstructionGraph = {
  ruleVersion: 'reconstruction-v1',
  places: [],
  visits: [
    { id: 'visit:a', placeId: 'place:a', evidenceIds: ['a', 'b'], order: 'ordered' },
    { id: 'visit:c', placeId: 'place:c', evidenceIds: ['c'], order: 'ordered' },
  ],
  journeys: [
    { id: 'journey:a', visitIds: ['visit:a'], state: 'inferred' },
    { id: 'journey:c', visitIds: ['visit:c'], state: 'inferred' },
  ],
  memberships: [
    { evidenceId: 'a', journeyId: 'journey:a', state: 'inferred', reason: 'visit-support' },
    { evidenceId: 'c', journeyId: 'journey:c', state: 'inferred', reason: 'visit-support' },
  ],
  possibleMerges: [{ fromJourneyId: 'journey:a', toJourneyId: 'journey:c', reason: 'adjacent-gap' }],
  dispositions: [],
};

describe('journey correction application', () => {
  it('keeps an exact confirmation attached to its successor and preserves later inferred evidence', () => {
    const result = applyJourneyCorrections(graph, [{ revision_id: 'confirm-a', action: 'confirm', reviewed_support_json: JSON.stringify(['E:a']) }]);
    expect(result.matches.get('confirm-a')).toBe('journey:a');
    expect(result.graph.journeys).toHaveLength(2);
  });

  it('maps an owner claim only when its complete reviewed support has one successor', () => {
    const result = applyJourneyCorrections(graph, [{ revision_id: 'claim-a', action: 'claim', reviewed_support_json: JSON.stringify(['E:a', 'E:b']) }]);
    expect(result.matches.get('claim-a')).toBe('journey:a');
    expect(result.graph).toEqual(graph);

    const ambiguousGraph: ReconstructionGraph = { ...graph, journeys: [...graph.journeys, { id: 'journey:a-copy', visitIds: ['visit:a'], state: 'inferred' }] };
    expect(() => applyJourneyCorrections(ambiguousGraph, [{ revision_id: 'claim-ambiguous', action: 'claim', reviewed_support_json: JSON.stringify(['E:a', 'E:b']) }])).toThrow('needs owner remap');
  });

  it('removes a rejected grouping while keeping its source visits and places available', () => {
    const result = applyJourneyCorrections(graph, [{ revision_id: 'reject-a', action: 'reject', reviewed_support_json: JSON.stringify(['E:a', 'E:b']) }]);
    expect(result.graph.journeys.map((journey) => journey.id)).toEqual(['journey:c']);
    expect(result.graph.visits.map((visit) => visit.id)).toEqual(['visit:a', 'visit:c']);
    expect(result.graph.memberships.map((membership) => membership.journeyId)).toEqual(['journey:c']);
  });

  it('removes one reviewed destination from a journey without removing its visit or source support', () => {
    const combined: ReconstructionGraph = {
      ...graph,
      journeys: [{ id: 'journey:combined', visitIds: ['visit:a', 'visit:c'], state: 'inferred' }],
      memberships: [
        { evidenceId: 'a', journeyId: 'journey:combined', state: 'inferred', reason: 'visit-support' },
        { evidenceId: 'c', journeyId: 'journey:combined', state: 'inferred', reason: 'visit-support' },
      ],
      possibleMerges: [],
    };
    const result = applyJourneyCorrections(combined, [{
      revision_id: 'remove-a', action: 'remove-visit', reviewed_support_json: JSON.stringify(['E:a', 'E:b']), reviewed_visits_json: JSON.stringify([['E:a', 'E:b']]),
    }]);
    expect(result.graph.journeys[0]?.visitIds).toEqual(['visit:c']);
    expect(result.graph.visits.map((visit) => visit.id)).toEqual(['visit:a', 'visit:c']);
    expect(result.graph.memberships.map((membership) => membership.evidenceId)).toEqual(['c']);
  });

  it('fails closed when reviewed support no longer maps to a candidate journey', () => {
    expect(() => applyJourneyCorrections(graph, [{ revision_id: 'missing', action: 'confirm', reviewed_support_json: JSON.stringify(['E:missing']) }])).toThrow('needs owner remap');
  });

  it('fails closed when reviewed support is divided between successors', () => {
    const splitGraph: ReconstructionGraph = {
      ...graph,
      visits: [
        ...graph.visits.map((visit) => visit.id === 'visit:a' ? { ...visit, evidenceIds: ['a'] } : visit),
        { id: 'visit:b', placeId: 'place:a', evidenceIds: ['b'], order: 'ordered' },
      ],
      journeys: [
        { id: 'successor:a', visitIds: ['visit:a'], state: 'inferred' },
        { id: 'successor:b', visitIds: ['visit:b'], state: 'inferred' },
      ],
    };
    expect(() => applyJourneyCorrections(splitGraph, [
      { revision_id: 'split-support', action: 'confirm', reviewed_support_json: JSON.stringify(['E:a', 'E:b']) },
    ])).toThrow('needs owner remap');
  });

  it('keeps a later independent visit while removing a rejected reviewed visit from automatic membership', () => {
    const extendedGraph: ReconstructionGraph = {
      ...graph,
      visits: [...graph.visits, { id: 'visit:later', placeId: 'place:later', evidenceIds: ['later'], order: 'ordered' }],
      journeys: [{ id: 'journey:extended', visitIds: ['visit:a', 'visit:later'], state: 'inferred' }, graph.journeys[1]],
      memberships: [
        { evidenceId: 'a', journeyId: 'journey:extended', state: 'inferred', reason: 'visit-support' },
        { evidenceId: 'later', journeyId: 'journey:extended', state: 'inferred', reason: 'visit-support' },
        graph.memberships[1],
      ],
    };
    const result = applyJourneyCorrections(extendedGraph, [{
      revision_id: 'reject-reviewed-visit', action: 'reject', reviewed_support_json: JSON.stringify(['E:a', 'E:b']), reviewed_visits_json: JSON.stringify([['E:a', 'E:b']]),
    }]);
    expect(result.graph.journeys.find((journey) => journey.id === 'journey:extended')?.visitIds).toEqual(['visit:later']);
    expect(result.graph.memberships.map((membership) => membership.evidenceId)).toEqual(['later', 'c']);
  });

  it('fails closed when the same reviewed support maps to multiple successors', () => {
    const ambiguousGraph: ReconstructionGraph = {
      ...graph,
      journeys: [...graph.journeys, { id: 'journey:a-copy', visitIds: ['visit:a'], state: 'inferred' }],
    };
    expect(() => applyJourneyCorrections(ambiguousGraph, [
      { revision_id: 'ambiguous-support', action: 'reject', reviewed_support_json: JSON.stringify(['E:a', 'E:b']) },
    ])).toThrow('needs owner remap');
  });

  it('fails closed when one reviewed support unit is duplicated despite a unique full-set match', () => {
    const partiallyAmbiguousGraph: ReconstructionGraph = {
      ...graph,
      visits: [...graph.visits, { id: 'visit:a-copy', placeId: 'place:a', evidenceIds: ['a'], order: 'ordered' }],
      journeys: [...graph.journeys, { id: 'journey:a-copy', visitIds: ['visit:a-copy'], state: 'inferred' }],
    };
    expect(() => applyJourneyCorrections(partiallyAmbiguousGraph, [
      { revision_id: 'partially-ambiguous-support', action: 'confirm', reviewed_support_json: JSON.stringify(['E:a', 'E:b']) },
    ])).toThrow('needs owner remap');
  });

  it('fails closed when a reviewed support unit is duplicated inside the same successor journey', () => {
    const duplicatedWithinJourney: ReconstructionGraph = {
      ...graph,
      visits: [...graph.visits, { id: 'visit:a-copy', placeId: 'place:a', evidenceIds: ['a'], order: 'ordered' }],
      journeys: [{ id: 'journey:a', visitIds: ['visit:a', 'visit:a-copy'], state: 'inferred' }, graph.journeys[1]],
    };

    expect(() => applyJourneyCorrections(duplicatedWithinJourney, [{
      revision_id: 'same-successor-duplicate',
      action: 'confirm',
      reviewed_support_json: JSON.stringify(['E:a', 'E:b']),
      reviewed_visits_json: JSON.stringify([['E:a', 'E:b']]),
    }])).toThrow('needs owner remap');
  });

  it('fails closed when reviewed visit sets overlap instead of partitioning the saved scope', () => {
    expect(() => applyJourneyCorrections(graph, [{
      revision_id: 'overlapping-reviewed-sets',
      action: 'confirm',
      reviewed_support_json: JSON.stringify(['E:a', 'E:b']),
      reviewed_visits_json: JSON.stringify([['E:a'], ['E:a', 'E:b']]),
    }])).toThrow('needs owner remap');
  });
});
