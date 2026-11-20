import type { CaptureRecord, Clue, EdgeFix } from './types';

const minute = 60_000;
const hour = 60 * minute;

/**
 * Provisional defaults. The spec freezes these after the Xiaomi 15 evidence
 * experiment (Story 1); do not treat them as measured.
 */
export const windowDefaults = {
  minCaptures: 25,
  minSpanMillis: 20 * hour,
  maxGapMillis: 36 * hour,
  maxSpanMillis: 30 * 24 * hour,
  edgeMarginMillis: 24 * hour,
  shiftShare: 0.6,
  shiftMinSamples: 5,
  /** A sign/landmark clue must repeat in this many independent keys to start a story. */
  minProviderClueKeys: 2,
} as const;
export type WindowConfig = { -readonly [K in keyof typeof windowDefaults]: number };

export type CandidateWindow = {
  startMillis: number;
  endMillis: number;
  cameraCount: number;
  /** Metadata clues only: burst, offset-shift and edge-located. */
  clues: Clue[];
  /** Median clock shift against home in minutes, or null when no shift clue exists. */
  shiftMinutes: number | null;
};

export type WindowReason = 'travel-looking' | 'no-strong-clue' | 'single-provider-clue';
export type WindowAssessment = {
  travelLooking: boolean;
  reason: WindowReason;
};

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

/** `camera` and `imported` (decision 0020) are equally trusted for detection; everything else is not. */
function trustedForDetection(provenance: CaptureRecord['provenance']) {
  return provenance === 'camera' || provenance === 'imported';
}

/** The offset the owner's library most often records. Home dominates a normal library. */
export function inferHomeOffsetMinutes(records: readonly CaptureRecord[]): number | null {
  const counts = new Map<number, number>();
  for (const record of records) {
    if (!trustedForDetection(record.provenance) || record.utcOffsetMinutes === null) continue;
    counts.set(record.utcOffsetMinutes, (counts.get(record.utcOffsetMinutes) ?? 0) + 1);
  }
  let best: number | null = null;
  for (const [offset, count] of counts) {
    if (best === null || count > counts.get(best)! || (count === counts.get(best) && offset < best)) best = offset;
  }
  return best;
}

type Segment = CaptureRecord[];

function segments(records: readonly CaptureRecord[], config: WindowConfig): Segment[] {
  // Only the owner's own GPS-less camera or imported-library captures can
  // form a window (decision 0020). Unknown provenance never counts toward a burst.
  const eligible = records
    .filter((record) => trustedForDetection(record.provenance) && !record.located)
    .sort((a, b) => a.capturedAtMillis - b.capturedAtMillis || a.id.localeCompare(b.id));
  const result: Segment[] = [];
  let current: Segment = [];
  let lastOffset: number | null = null;
  for (const record of eligible) {
    const previous = current.at(-1);
    const gapBreak = previous && record.capturedAtMillis - previous.capturedAtMillis > config.maxGapMillis;
    // A change of recorded offset is a natural boundary between home and away.
    const regimeBreak = lastOffset !== null && record.utcOffsetMinutes !== null && record.utcOffsetMinutes !== lastOffset;
    if (current.length && (gapBreak || regimeBreak)) {
      result.push(current);
      current = [];
    }
    current.push(record);
    if (record.utcOffsetMinutes !== null) lastOffset = record.utcOffsetMinutes;
  }
  if (current.length) result.push(current);
  return result;
}

export function findCandidateWindows(
  records: readonly CaptureRecord[],
  home: { offsetMinutes: number | null },
  edgeFixes: readonly EdgeFix[] = [],
  overrides: Partial<WindowConfig> = {},
): CandidateWindow[] {
  const config: WindowConfig = { ...windowDefaults, ...overrides };
  const windows: CandidateWindow[] = [];
  for (const segment of segments(records, config)) {
    const startMillis = segment[0].capturedAtMillis;
    const endMillis = segment.at(-1)!.capturedAtMillis;
    const span = endMillis - startMillis;
    if (segment.length < config.minCaptures || span < config.minSpanMillis || span > config.maxSpanMillis) continue;

    const clues: Clue[] = [{ kind: 'burst', independenceKey: 'metadata:burst', claim: null }];
    let shiftMinutes: number | null = null;
    const samples = segment.flatMap((record) => (record.utcOffsetMinutes === null ? [] : [record.utcOffsetMinutes]));
    if (home.offsetMinutes !== null && samples.length >= config.shiftMinSamples) {
      const differing = samples.filter((offset) => offset !== home.offsetMinutes);
      if (differing.length / samples.length >= config.shiftShare) {
        shiftMinutes = median(differing) - home.offsetMinutes;
        // Metadata clues never carry a place claim: one offset spans several countries.
        clues.push({ kind: 'offset-shift', independenceKey: 'metadata:offset', claim: null });
      }
    }
    edgeFixes.forEach((fix) => {
      if (!fix.farFromHome) return;
      const before = fix.capturedAtMillis < startMillis && startMillis - fix.capturedAtMillis <= config.edgeMarginMillis;
      const after = fix.capturedAtMillis > endMillis && fix.capturedAtMillis - endMillis <= config.edgeMarginMillis;
      if (before || after) {
        clues.push({ kind: 'edge-located', independenceKey: before ? 'location:before' : 'location:after', claim: fix.claim });
      }
    });
    windows.push({ startMillis, endMillis, cameraCount: segment.length, clues, shiftMinutes });
  }
  return windows;
}

const providerKinds = new Set(['script', 'sign-place', 'landmark']);

/**
 * A window is travel-looking only with a strong clue on top of the burst. A
 * burst alone never qualifies, and a single sign or landmark clue is not
 * enough: a Korean menu in a home town must not start a story.
 */
export function assessWindow(
  window: CandidateWindow,
  providerClues: readonly Clue[] = [],
  overrides: Partial<WindowConfig> = {},
): WindowAssessment {
  const config: WindowConfig = { ...windowDefaults, ...overrides };
  if (window.clues.some((clue) => clue.kind === 'offset-shift' || clue.kind === 'edge-located')) {
    return { travelLooking: true, reason: 'travel-looking' };
  }
  const keys = new Set(providerClues.filter((clue) => providerKinds.has(clue.kind)).map((clue) => clue.independenceKey));
  if (keys.size >= config.minProviderClueKeys) return { travelLooking: true, reason: 'travel-looking' };
  return { travelLooking: false, reason: keys.size > 0 ? 'single-provider-clue' : 'no-strong-clue' };
}
