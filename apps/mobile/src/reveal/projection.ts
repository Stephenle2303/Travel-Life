import type { AtlasExploration, InferredStatistics, RevealInput, RevealJourney, RevealModel } from './types';

const forbiddenKeys = /(?:source|filename|media|latitude|longitude|coordinate|capturedAt|capturedDay|duration|route|country(?:Code|Name|Label)?|date)/i;

function coarsenAnchor(anchor: { latitude: number; longitude: number } | null) {
  if (!anchor || !Number.isFinite(anchor.latitude) || !Number.isFinite(anchor.longitude)
    || anchor.latitude < -90 || anchor.latitude > 90 || anchor.longitude < -180 || anchor.longitude > 180) return null;
  return { latitude: Math.round(anchor.latitude * 10) / 10, longitude: Math.round(anchor.longitude * 10) / 10 };
}

/**
 * Deliberately projects aggregate reconstruction output into owner-readable
 * reveal data. Raw evidence rows and coordinate-bearing records are rejected
 * at this boundary before they can reach a screen or telemetry code.
 */
export function projectReveal(input: RevealInput): RevealModel {
  const graph = input.graph;
  const sourceJourneys = input.durableRecord?.journeys ?? graph?.journeys.map((journey) => ({ state: journey.state, anchor: null })) ?? [];
  const journeys = sourceJourneys.map((journey, index) => ({
    id: 'displayId' in journey ? journey.displayId : `journey-${index + 1}`,
    // A coarse anchor is never a destination claim. Titles from owner claims
    // stay in the selected local detail boundary, so this redacted list uses a
    // truthful neutral fallback.
    label: 'Private journey',
    status: journey.state === 'inferred' ? 'Inferred' as const : 'Needs review' as const,
    years: 'years' in journey ? journey.years : [],
    periodLabel: 'periodLabel' in journey ? journey.periodLabel : 'Date unknown',
    ordering: 'ordering' in journey && journey.ordering === 'uncertain' ? 'Order uncertain' as const : 'Chronological' as const,
    hasMapSupport: coarsenAnchor(journey.anchor) !== null,
    mapAnchor: coarsenAnchor(journey.anchor),
  }));
  const coverage = input.sourceScope === 'full'
    ? `${input.importedCount} device-visible records in the current accessible scope.`
    : input.sourceScope === 'limited'
      ? `${input.importedCount} records in the selected accessible scope.`
      : 'No accessible source coverage is available yet.';

  if (input.reconstructionStatus === 'restricted' || input.reconciliationStatus === 'restricted' || input.sourceScope === 'denied' || input.sourceScope === 'revoked') {
    return { state: 'restricted', coverage, journeys, statistics: null, replay: { eligible: false, reason: 'Replay is unavailable until local access is restored.' }, message: 'Access is limited. Your last committed private record stays on this device.' };
  }
  if (input.reconstructionStatus === 'running' || input.reconciliationStatus === 'running' || input.reconciliationStatus === 'pending' || input.pendingCount > 0) {
    return { state: 'processing', coverage, journeys, statistics: null, replay: { eligible: false, reason: 'Replay will be available after local updates finish.' }, message: 'Local updates are still being reconciled. This record is not final yet.' };
  }
  if (input.reconstructionStatus === 'error' || input.reconciliationStatus === 'error') {
    return { state: 'failed', coverage, journeys, statistics: null, replay: { eligible: false, reason: 'Replay is unavailable while the local record needs recovery.' }, message: 'The local reveal could not finish. Your last committed record remains available.' };
  }
  if (!journeys.length) {
    return { state: 'sparse', coverage, journeys, statistics: null, diagnostics: input.durableRecord?.diagnostics ?? null, replay: { eligible: false, reason: 'Replay needs at least one supported revealed journey.' }, message: input.durableRecord?.diagnostics ? 'There is not enough supported local evidence to reveal a journey yet.' : 'No completed local reconstruction diagnostics are available yet.' };
  }
  return { state: 'ready', coverage, journeys, statistics: input.durableRecord?.statistics ?? null, replay: { eligible: true, reason: 'Replay can use only the observed destinations in this private reveal.' }, message: 'Available reconstructed journeys are shown as inferred local records. Photo location does not verify your presence.' };
}

/** Derives the one safe Atlas state shared by Map and Timeline. */
export function deriveAtlasExploration(journeys: RevealJourney[], exploration: AtlasExploration) {
  const years = [...new Set(journeys.flatMap((journey) => journey.years))].sort((a, b) => b - a);
  const visibleJourneys = exploration.year === null
    ? journeys
    : journeys.filter((journey) => journey.years.includes(exploration.year!));
  const selectedJourneyId = visibleJourneys.some((journey) => journey.id === exploration.selectedJourneyId)
    ? exploration.selectedJourneyId
    : null;
  return { years, visibleJourneys, selectedJourneyId };
}

export function assertRevealPayload(value: unknown): void {
  const visit = (candidate: unknown): void => {
    if (!candidate || typeof candidate !== 'object') return;
    for (const [key, child] of Object.entries(candidate as Record<string, unknown>)) {
      if (key === 'statistics') { assertStatistics(child); continue; }
      if (forbiddenKeys.test(key)) throw new Error(`Private field ${key} is not allowed in a reveal payload.`);
      visit(child);
    }
  };
  if (!value || typeof value !== 'object') throw new Error('Reveal payload must be an object.');
  visit(value);
}

function assertStatistics(value: unknown): asserts value is InferredStatistics {
  if (!value || typeof value !== 'object') throw new Error('Reveal statistics must be an aggregate object.');
  const statistics = value as Record<string, unknown>;
  const allowed = ['journeyCount', 'placeCount', 'supportedCountryCount', 'countryStatus'];
  if (Object.keys(statistics).some((key) => !allowed.includes(key)) || !Number.isInteger(statistics.journeyCount) || !Number.isInteger(statistics.placeCount) || !Number.isInteger(statistics.supportedCountryCount) || (statistics.countryStatus !== 'supported' && statistics.countryStatus !== 'unavailable')) throw new Error('Reveal statistics must contain only validated aggregates.');
}
