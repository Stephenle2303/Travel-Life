import type { ReconstructionGraph } from './types';

/** Visit support only: associated memories are not evidence of a visit. */
export function indexJourneySupport(graph: ReconstructionGraph): ReadonlyMap<string, ReadonlySet<string>> {
  const visits = new Map(graph.visits.map(visit => [visit.id, visit]));
  const index = new Map<string, Set<string>>();
  for (const journey of graph.journeys) for (const visitId of journey.visitIds) {
    for (const id of visits.get(visitId)?.evidenceIds ?? []) {
      const targets = index.get(id) ?? new Set<string>();
      targets.add(journey.id); index.set(id, targets);
    }
  }
  return index;
}

/** Complete support must have exactly one common target. Missing, split and
 * overlapping support stays unresolved, exactly as the exhaustive graph scan. */
export function uniqueSupportJourney(support: readonly string[], index: ReadonlyMap<string, ReadonlySet<string>>): string | null {
  if (!support.length) return null;
  let smallest: ReadonlySet<string> | undefined;
  for (const id of support) {
    const targets = index.get(id);
    if (!targets?.size) return null;
    if (!smallest || targets.size < smallest.size) smallest = targets;
  }
  let match: string | null = null;
  for (const target of smallest!) if (support.every(id => index.get(id)!.has(target))) {
    if (match !== null) return null;
    match = target;
  }
  return match;
}
