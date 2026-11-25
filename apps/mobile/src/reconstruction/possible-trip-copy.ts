/**
 * CAP-3 (detector-v1-2.md) and M10.11 (detector-v1-3.md): the exact, closed
 * card sentence per reason code, for both the Possible-trips card (v1.2 and
 * v1.3) and v1.3's Hidden outings card. Pure and deterministic; never says
 * where the owner was not.
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
    // v1.3 only (decision 0023): the Hidden outings card's own reason —
    // reachable only through hiddenOutingReasonSentence below, never
    // through a SUGGESTED journey's reasons[0], but handled here too so
    // this switch stays exhaustive for the whole closed reason-code union.
    case 'brief-outing': return 'A short outing with only a few photos.';
    // Not part of detector-v1-2.md's 8-code card table (owner-veto, and the
    // hidden-only codes no-away-evidence/non-capture-source never reach a
    // SUGGESTED journey's reasons[0] in practice); a safe, generic fallback
    // keeps the card from ever rendering nothing.
    default: return 'This outing needs another look.';
  }
}

/** M10.11 (detector-v1-3.md): the Hidden outings card's one sentence. A
 * thin, explicit wrapper around `possibleTripReasonSentence` rather than a
 * separate switch, so the two cards' copy cannot drift — but named for the
 * card that actually calls it, since a reader of hidden-outings.tsx should
 * not have to know the Possible-trips card's history to find this. */
export function hiddenOutingReasonSentence(code: TripOutcomeReasonCode): string {
  return possibleTripReasonSentence(code, 0);
}
