/**
 * CAP-3 (detector-v1-2.md): the exact, closed Possible-trip card sentence per
 * reason code. Pure and deterministic; never says where the owner was not.
 */
import type { TripOutcomeReasonCode } from './types';

export function possibleTripReasonSentence(code: TripOutcomeReasonCode, locatedCount: number): string {
  switch (code) {
    case 'home-not-set': return "Your Home isn't set for this time.";
    case 'time-conflict': return "Photo dates and locations don't line up.";
    case 'no-location': return 'These photos have no location data.';
    case 'weak-location': return 'Photo locations are too imprecise to confirm.';
    case 'near-home': return "It's close to your Home, so it may be an everyday outing.";
    case 'frequent-place': return 'You come here often, so it may be everyday life.';
    case 'few-photos': return locatedCount === 1 ? 'Only 1 photo has a location.' : `Only ${Math.max(0, locatedCount)} photos have a location.`;
    case 'single-moment': return 'All photos are from one place and moment.';
    // Not part of detector-v1-2.md's 8-code card table (owner-veto, and the
    // hidden-only codes no-away-evidence/non-capture-source never reach a
    // SUGGESTED journey's reasons[0] in practice); a safe, generic fallback
    // keeps the card from ever rendering nothing.
    default: return 'This outing needs another look.';
  }
}
