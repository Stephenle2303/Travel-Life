import type { RevealInput, RevealModel } from './types';

const forbiddenKeys = /(?:source|filename|media|latitude|longitude|coordinate|capturedAt|capturedDay|duration|route|country|date)/i;

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
    id: `journey-${index + 1}`,
    label: `Available journey ${index + 1}`,
    status: journey.state === 'inferred' ? 'Inferred' as const : 'Needs review' as const,
    hasMapSupport: coarsenAnchor(journey.anchor) !== null,
    mapAnchor: coarsenAnchor(journey.anchor),
  }));
  const coverage = input.sourceScope === 'full'
    ? `${input.importedCount} device-visible records in the current accessible scope.`
    : input.sourceScope === 'limited'
      ? `${input.importedCount} records in the selected accessible scope.`
      : 'No accessible source coverage is available yet.';

  if (input.reconstructionStatus === 'restricted' || input.reconciliationStatus === 'restricted' || input.sourceScope === 'denied' || input.sourceScope === 'revoked') {
    return { state: 'restricted', coverage, journeys, replay: { eligible: false, reason: 'Replay is unavailable until local access is restored.' }, message: 'Access is limited. Your last committed private record stays on this device.' };
  }
  if (input.reconstructionStatus === 'running' || input.reconciliationStatus === 'running' || input.reconciliationStatus === 'pending' || input.pendingCount > 0) {
    return { state: 'processing', coverage, journeys, replay: { eligible: false, reason: 'Replay will be available after local updates finish.' }, message: 'Local updates are still being reconciled. This record is not final yet.' };
  }
  if (input.reconstructionStatus === 'error' || input.reconciliationStatus === 'error') {
    return { state: 'failed', coverage, journeys, replay: { eligible: false, reason: 'Replay is unavailable while the local record needs recovery.' }, message: 'The local reveal could not finish. Your last committed record remains available.' };
  }
  if (!journeys.length) {
    return { state: 'sparse', coverage, journeys, replay: { eligible: false, reason: 'Replay needs at least one supported revealed journey.' }, message: 'There is not enough supported local evidence to reveal a journey yet.' };
  }
  return { state: 'ready', coverage, journeys, replay: { eligible: true, reason: 'Replay can use only the observed destinations in this private reveal.' }, message: 'Available reconstructed journeys are shown as inferred local records. Photo location does not verify your presence.' };
}

export function assertRevealPayload(value: unknown): void {
  const visit = (candidate: unknown): void => {
    if (!candidate || typeof candidate !== 'object') return;
    for (const [key, child] of Object.entries(candidate as Record<string, unknown>)) {
      if (forbiddenKeys.test(key)) throw new Error(`Private field ${key} is not allowed in a reveal payload.`);
      visit(child);
    }
  };
  if (!value || typeof value !== 'object') throw new Error('Reveal payload must be an object.');
  visit(value);
}
