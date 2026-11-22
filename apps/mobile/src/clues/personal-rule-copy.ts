/**
 * CAP-7's "Settings -> What Travel Life learned" copy (personal-
 * learning.md). Pure and closed, same convention as `review-card-copy.ts`
 * and `reconstruction/possible-trip-copy.ts` — never a raw kind or scope
 * value reaching the UI.
 */
export function personalRuleSentence(kind: string): string {
  switch (kind) {
    case 'pair-preference': return "You said two trips weren't the same trip. Travel Life won't suggest merging them again.";
    default: return "Travel Life learned a preference from a decision you made.";
  }
}
