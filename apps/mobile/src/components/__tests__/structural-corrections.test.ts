import { applyOwnerJourneyMerges, applyStructuralBoundaries, predecessorWideScopeRevisions, structuralBoundaryEvidenceIds } from '@/reconstruction/repository';
import { reconstructV1, type ReconstructionEvidence } from '@/reconstruction';

function evidence(id: string, day: number, longitude: number): ReconstructionEvidence {
  return { id, capturedAtMillis: Date.UTC(2024, 0, day), capturedDay: `2024-01-${String(day).padStart(2, '0')}`, hasPreciseOffset: true, latitude: 13.7, longitude, reportedAccuracyMeters: 10, availability: 'available', duplicateFamilyId: null, duplicateConflict: false, excluded: false };
}

describe('durable structural journey corrections', () => {
  it('uses only the reviewed left visit support as an owner-selected split boundary', () => {
    expect(structuralBoundaryEvidenceIds([
      {
        revision_id: 'split-1',
        action: 'split',
        reviewed_support_json: JSON.stringify(['E:left-a', 'E:left-b', 'E:right-a']),
        reviewed_visits_json: JSON.stringify([['E:left-a', 'E:left-b'], ['E:right-a']]),
        structural_boundary_json: JSON.stringify(['E:left-a', 'E:left-b']),
      },
    ])).toEqual(new Set(['left-a', 'left-b']));
  });

  it('fails closed when a split boundary is not an exact reviewed visit', () => {
    expect(() => structuralBoundaryEvidenceIds([
      {
        revision_id: 'split-1',
        action: 'split',
        reviewed_support_json: JSON.stringify(['E:left-a', 'E:right-a']),
        reviewed_visits_json: JSON.stringify([['E:left-a'], ['E:right-a']]),
        structural_boundary_json: JSON.stringify(['E:left-a', 'E:right-a']),
      },
    ])).toThrow('owner remap');
  });

  it('forces a rebuilt successor journey boundary without changing the observed evidence', () => {
    const corrections = [{
      revision_id: 'split-1', action: 'split' as const,
      reviewed_support_json: JSON.stringify(['E:left', 'E:right']),
      reviewed_visits_json: JSON.stringify([['E:left'], ['E:right']]),
      structural_boundary_json: JSON.stringify(['E:left']),
    }];
    const rebuilt = reconstructV1(applyStructuralBoundaries([evidence('left', 1, 100), evidence('right', 2, 101)], corrections));

    expect(rebuilt.journeys).toHaveLength(2);
    expect(rebuilt.visits.flatMap((visit) => visit.evidenceIds).sort()).toEqual(['left', 'right']);
  });

  it('merges only two adjacent strictly ordered owner-visible journeys', () => {
    const graph = reconstructV1([evidence('left', 1, 100), evidence('right', 5, 101)]);
    const merged = applyOwnerJourneyMerges(graph, [{
      revision_id: 'merge-1', action: 'merge',
      reviewed_support_json: JSON.stringify(['E:left', 'E:right']),
      reviewed_visits_json: JSON.stringify([['E:left'], ['E:right']]),
      structural_boundary_json: JSON.stringify({ left: ['E:left'], right: ['E:right'] }),
    }]);

    expect(merged.journeys).toHaveLength(1);
    expect(merged.journeys[0]?.visitIds).toHaveLength(2);
  });

  it('moves only predecessor-wide confirmation and owner claims into scope review', () => {
    expect(predecessorWideScopeRevisions([
      { revision_id: 'confirm', action: 'confirm', reviewed_support_json: '[]' },
      { revision_id: 'claim', action: 'claim', reviewed_support_json: '[]' },
      { revision_id: 'reject', action: 'reject', reviewed_support_json: '[]' },
      { revision_id: 'split', action: 'split', reviewed_support_json: '[]' },
    ])).toEqual(['confirm', 'claim']);
  });
});
