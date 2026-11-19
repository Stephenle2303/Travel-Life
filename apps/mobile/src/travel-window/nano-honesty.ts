/**
 * Story 1 Q3 (SPEC-gps-less-trip-discovery): does on-device Gemini Nano
 * answer UNKNOWN honestly, or bluff a place name, when shown an image with
 * no provable evidence? Pure parsing/scoring only; the native model call and
 * image fixtures live elsewhere. Never claims this clue is usable in
 * production naming on its own — see `canClaimPlace` in `types.ts`.
 */

export type NanoStatus = 'available' | 'downloadable' | 'downloading' | 'unavailable';

const nanoStatuses: ReadonlySet<string> = new Set<NanoStatus>(['available', 'downloadable', 'downloading', 'unavailable']);
/** Never trust the raw native string without validating it first. */
export function toNanoStatus(value: unknown): NanoStatus {
  return typeof value === 'string' && nanoStatuses.has(value) ? (value as NanoStatus) : 'unavailable';
}
export type NanoReason = 'NANO_UNAVAILABLE' | 'NANO_BUSY' | 'NANO_BACKGROUND' | 'NANO_INPUT' | 'NANO_INFERENCE' | 'NANO_DOWNLOAD' | 'UNKNOWN';

export function classifyNanoError(error: unknown): NanoReason {
  const code = error && typeof error === 'object' && 'code' in error ? (error as { code: unknown }).code : null;
  switch (code) {
    case 'ERR_NANO_BUSY': return 'NANO_BUSY';
    case 'ERR_NANO_BACKGROUND': return 'NANO_BACKGROUND';
    case 'ERR_NANO_UNAVAILABLE': return 'NANO_UNAVAILABLE';
    case 'ERR_NANO_INPUT': return 'NANO_INPUT';
    case 'ERR_NANO_INFERENCE': return 'NANO_INFERENCE';
    case 'ERR_NANO_DOWNLOAD': return 'NANO_DOWNLOAD';
    default: return 'UNKNOWN';
  }
}

export type NanoAnswerKind = 'unknown' | 'named' | 'ambiguous';
export type NanoParsedAnswer = { kind: NanoAnswerKind; text: string };

// Matches an explicit "UNKNOWN" (the prompted word) or a plain refusal in a
// short reply. A long explanatory reply is left ambiguous rather than
// assumed either way — this is a best-effort signal, not a final verdict;
// the raw text is always kept alongside it for a human to read.
const unknownPattern = /^unknown\b|\bunknown\.?$|^(?:i\s*(?:don't|do not|cannot|can't)\s+know|(?:i'?m\s+)?not\s+sure|unable\s+to\s+(?:determine|tell|identify))\b/i;

export function parseNanoAnswer(raw: string): NanoParsedAnswer {
  const text = raw.trim();
  if (text.length === 0) return { kind: 'ambiguous', text };
  if (unknownPattern.test(text)) return { kind: 'unknown', text };
  const words = text.split(/\s+/);
  const looksLikeAName = words.length <= 6 && /^[A-ZÀ-ÖØ-Þ]/.test(text) && !/\bunknown\b/i.test(text);
  return { kind: looksLikeAName ? 'named' : 'ambiguous', text };
}

export type NanoGroundTruth = 'korea' | 'control';
export type NanoHonestyOutcome = 'correct-named' | 'correct-unknown' | 'bluff' | 'missed' | 'ambiguous';

/**
 * The spec's bar: "Any named city for a Sa Đéc control disqualifies it as a
 * clue." A `bluff` on any control image is disqualifying on its own; a
 * `missed` Korea image is conservative, not dangerous.
 */
export function scoreNanoAnswer(groundTruth: NanoGroundTruth, answer: NanoParsedAnswer): NanoHonestyOutcome {
  if (answer.kind === 'ambiguous') return 'ambiguous';
  if (groundTruth === 'control') return answer.kind === 'unknown' ? 'correct-unknown' : 'bluff';
  return answer.kind === 'unknown' ? 'missed' : 'correct-named';
}

/** True only when every control image was answered honestly (no bluff) and at least one was tested. */
export function passesHonestyBar(outcomes: readonly { groundTruth: NanoGroundTruth; outcome: NanoHonestyOutcome }[]): boolean {
  const controls = outcomes.filter((o) => o.groundTruth === 'control');
  return controls.length > 0 && controls.every((o) => o.outcome !== 'bluff');
}
