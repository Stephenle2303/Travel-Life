import { clearShareSelection, selectAllEligibleJourneys, toggleShareJourney, type ShareJourneyCandidate } from '@/share/selection';

const candidates: ShareJourneyCandidate[] = [
  { displayId: 'journey-a', snapshotToken: 7, privacyRevision: 4, eligible: true },
  { displayId: 'journey-b', snapshotToken: 7, privacyRevision: 4, eligible: false },
  { displayId: 'journey-c', snapshotToken: 8, privacyRevision: 5, eligible: true },
];

describe('selected-share journey selection', () => {
  it('starts empty and select-all includes only the displayed eligible candidates', () => {
    expect(selectAllEligibleJourneys(candidates)).toEqual([
      { displayId: 'journey-a', snapshotToken: 7, privacyRevision: 4 },
      { displayId: 'journey-c', snapshotToken: 8, privacyRevision: 5 },
    ]);
  });

  it('does not add an ineligible journey through a direct toggle', () => {
    expect(toggleShareJourney([], candidates[1])).toEqual([]);
  });

  it('removes an existing selection and clear does not retain hidden values', () => {
    const selected = toggleShareJourney(selectAllEligibleJourneys(candidates), candidates[0]);
    expect(selected).toEqual([{ displayId: 'journey-c', snapshotToken: 8, privacyRevision: 5 }]);
    expect(clearShareSelection()).toEqual([]);
  });
});
