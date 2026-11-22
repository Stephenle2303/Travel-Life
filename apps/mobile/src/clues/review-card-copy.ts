/**
 * CAP-3's owner-facing review-card copy. Pure and closed, same convention
 * as `reconstruction/possible-trip-copy.ts` — never says where the owner
 * was not, never exposes a raw reason code to the UI.
 */
export function reviewCardReasonSentence(reason: string): string {
  switch (reason) {
    case 'would-lower-atlas-trip': return 'A new detail would change one of your confirmed trips.';
    case 'protected-confirmed-trip': return 'A new detail touches a trip you already confirmed a different way.';
    default: return 'A new detail needs your review before it changes anything.';
  }
}
