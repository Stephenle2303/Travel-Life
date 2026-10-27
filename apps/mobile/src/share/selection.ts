import type { FrozenShareDraft } from './publish-controller';

export type ShareJourneyCandidate = Readonly<{
  displayId: string;
  snapshotToken: number;
  privacyRevision: number;
  eligible: boolean;
}>;

type ShareJourneySelection = FrozenShareDraft['selections'][number];

const toSelection = (candidate: ShareJourneyCandidate): ShareJourneySelection => ({
  displayId: candidate.displayId,
  snapshotToken: candidate.snapshotToken,
  privacyRevision: candidate.privacyRevision,
});

export function clearShareSelection(): ShareJourneySelection[] { return []; }

/** Scope is supplied by the current visible Journey List; never scan hidden records. */
export function selectAllEligibleJourneys(candidates: readonly ShareJourneyCandidate[]): ShareJourneySelection[] {
  return candidates.filter((candidate) => candidate.eligible).map(toSelection);
}

export function toggleShareJourney(selected: readonly ShareJourneySelection[], candidate: ShareJourneyCandidate): ShareJourneySelection[] {
  const has = selected.some((entry) => entry.displayId === candidate.displayId);
  if (has) return selected.filter((entry) => entry.displayId !== candidate.displayId);
  return candidate.eligible ? [...selected, toSelection(candidate)] : [...selected];
}
