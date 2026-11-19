import { canClaimPlace, type Clue, type ClueKind, type PlaceClaim } from './types';

export type NamingConfig = {
  /**
   * On-device model clues count toward agreement only after the Xiaomi 15
   * experiment shows the model answers UNKNOWN instead of bluffing. Off by default.
   */
  modelClueCounts: boolean;
};

export type NamingReason = 'no-claims' | 'model-only' | 'single-clue' | 'conflicting-clues';

export type NamingResult =
  | { status: 'owner-named'; claim: PlaceClaim }
  | { status: 'named'; level: 'country' | 'city'; claim: PlaceClaim; evidence: ClueKind[] }
  | {
    status: 'facts-only';
    reason: NamingReason;
    /** Country codes ordered by supporting clues. For quietly ranking a search box; never displayed. */
    rankingHints: string[];
  };

/**
 * A place is named only when at least two independent clues agree and no clue
 * contradicts them. When unsure the answer is facts-only, so a wrong country
 * is never produced. A conflict always abstains.
 */
export function nameWindow(clues: readonly Clue[], config: NamingConfig = { modelClueCounts: false }): NamingResult {
  const owner = clues.find((clue) => clue.kind === 'owner-answer' && clue.claim);
  if (owner?.claim) return { status: 'owner-named', claim: owner.claim };

  const claimClues = clues.filter((clue) => canClaimPlace(clue.kind) && clue.claim !== null);
  const rankingHints = hints(claimClues);
  const countable = claimClues.filter((clue) => clue.kind !== 'on-device-model' || config.modelClueCounts);
  if (countable.length === 0) {
    return { status: 'facts-only', reason: claimClues.length ? 'model-only' : 'no-claims', rankingHints };
  }
  const countries = new Set(countable.map((clue) => clue.claim!.countryCode));
  if (countries.size > 1) return { status: 'facts-only', reason: 'conflicting-clues', rankingHints };
  if (new Set(countable.map((clue) => clue.independenceKey)).size < 2) {
    return { status: 'facts-only', reason: 'single-clue', rankingHints };
  }

  const evidence = [...new Set(countable.map((clue) => clue.kind))];
  const withCity = countable.filter((clue) => clue.claim!.cityId);
  const cityIds = new Set(withCity.map((clue) => clue.claim!.cityId));
  if (cityIds.size === 1 && new Set(withCity.map((clue) => clue.independenceKey)).size >= 2) {
    const claim = withCity[0].claim!;
    return { status: 'named', level: 'city', claim, evidence };
  }
  const { countryCode, countryLabel } = countable[0].claim!;
  return { status: 'named', level: 'country', claim: { countryCode, countryLabel }, evidence };
}

function hints(claimClues: readonly Clue[]) {
  const counts = new Map<string, number>();
  for (const clue of claimClues) counts.set(clue.claim!.countryCode, (counts.get(clue.claim!.countryCode) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([code]) => code);
}
