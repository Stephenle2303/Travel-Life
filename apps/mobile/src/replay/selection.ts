import { replayChapterFrames, type ReplayChapter, type ReplayDirection, type ReplayGroup, type ReplayInterval, type ReplayManifest, type ReplayMemory, type ReplayPlan } from './types';

function day(value: string) { const parsed = Date.parse(`${value}T00:00:00.000Z`); return Number.isFinite(parsed) ? parsed : Number.NaN; }
function inside(interval: ReplayInterval | undefined, filter?: ReplayInterval) {
  // An undated attached journey remains in an unfiltered private Replay. A
  // requested exact-date filter cannot silently assign it a fabricated span.
  return !filter ? true : Boolean(interval && day(interval.startDay) >= day(filter.startDay) && day(interval.endDay) <= day(filter.endDay));
}

/**
 * Journey List ordering is presentation metadata. It deliberately does not
 * derive chronology, routes, or owner presence from the attached evidence.
 */
function comparable(group: ReplayGroup) {
  return Boolean(group.orderCertain && group.interval && Number.isFinite(day(group.interval.startDay)) && Number.isFinite(day(group.interval.endDay)));
}

function overlap(left: ReplayGroup, right: ReplayGroup) {
  if (!left.interval || !right.interval) return true;
  return day(left.interval.startDay) <= day(right.interval.endDay) && day(right.interval.startDay) <= day(left.interval.endDay);
}

/**
 * Only established non-overlapping intervals are sorted. Unknown or overlapping
 * runs deliberately retain the current Journey List-relative order so a Replay
 * card cannot imply an itinerary that the record does not support.
 */
export function orderedReplayGroups(groups: readonly ReplayGroup[], filter?: ReplayInterval, direction: ReplayDirection = 'oldest-first'): ReplayGroup[] {
  const visible = groups.filter((group) => group.eligible && inside(group.interval, filter));
  const blocks: ReplayGroup[][] = [];
  for (let index = 0; index < visible.length;) {
    const first = visible[index]!;
    if (!comparable(first)) { blocks.push([first]); index += 1; continue; }
    const block: ReplayGroup[] = [first];
    index += 1;
    while (index < visible.length && comparable(visible[index]!)) {
      block.push(visible[index]!);
      index += 1;
    }
    const uncertain = block.some((group, blockIndex) => block.slice(0, blockIndex).some((prior) => overlap(prior, group)));
    blocks.push(uncertain ? block : block.sort((left, right) => day(left.interval!.startDay) - day(right.interval!.startDay) || left.key.localeCompare(right.key)));
  }
  const orderedBlocks = direction === 'newest-first' ? [...blocks].reverse() : blocks;
  return orderedBlocks.flatMap((block) => direction === 'newest-first' && block.every(comparable) && !block.some((group, index) => block.slice(0, index).some((prior) => overlap(prior, group))) ? [...block].reverse() : block);
}

export function suggestedReplayGroups(groups: readonly ReplayGroup[]): ReplayGroup[] {
  return [...groups];
}

export function replayPanelCount(_groups: readonly ReplayGroup[], memories: readonly ReplayMemory[]): number {
  return memories.length;
}

function memoryOrder(left: ReplayMemory, right: ReplayMemory) {
  if (left.order !== undefined || right.order !== undefined) return (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER) || left.key.localeCompare(right.key);
  const leftDay = left.capture?.startDay ?? '';
  const rightDay = right.capture?.startDay ?? '';
  return leftDay.localeCompare(rightDay) || left.key.localeCompare(right.key);
}

/**
 * Metadata-only local fallback. It avoids a global quality score: take one
 * stable representative of each known day first, then evenly spread remaining
 * candidates to a maximum of six. The complete candidate list is retained for
 * Replace/Add editing; this never removes an album item.
 */
export function selectReplayMemories(candidates: readonly ReplayMemory[]): ReplayMemory[] {
  const ordered = [...candidates].sort(memoryOrder);
  const distinctDays = new Map<string, ReplayMemory>();
  const withoutDay: ReplayMemory[] = [];
  for (const memory of ordered) {
    const dayKey = memory.capture?.startDay;
    if (dayKey && !distinctDays.has(dayKey)) distinctDays.set(dayKey, memory);
    else if (!dayKey) withoutDay.push(memory);
  }
  const firstPass = [...distinctDays.values(), ...withoutDay];
  if (firstPass.length <= 6) return firstPass;
  const selected: ReplayMemory[] = [];
  for (let index = 0; index < 6; index += 1) selected.push(firstPass[Math.round(index * (firstPass.length - 1) / 5)]!);
  return selected;
}

function sanitizeCardToken(value: string, fallback: string) {
  // These tokens are later embedded in a closed local draw-text expression.
  // Exclude quotes, colons, percent and backslashes rather than escaping raw
  // owner text at the native boundary.
  const normalized = value.normalize('NFKC').replace(/[^\p{L}\p{N} ,.\-&]/gu, ' ').replace(/\s+/g, ' ').trim();
  return (normalized || fallback).slice(0, 80);
}

function cardTimeToken(group: ReplayGroup) {
  if (!group.interval) return 'Time unknown';
  const start = group.interval.startDay;
  const end = group.interval.endDay;
  const startMonth = start.slice(0, 7);
  const endMonth = end.slice(0, 7);
  // Reduce day precision to an honest existing month/year presentation.
  return startMonth === endMonth ? startMonth.replace('-', ' ') : `${startMonth.replace('-', ' ')} to ${endMonth.replace('-', ' ')}`;
}

function chapterFor(group: ReplayGroup, memoryKeys: readonly string[]): ReplayChapter {
  const frames = replayChapterFrames(memoryKeys.length);
  return {
    groupKey: group.key,
    memoryKeys,
    frames,
    card: { labelToken: sanitizeCardToken(group.label, 'Private journey'), timeToken: cardTimeToken(group), frames: Math.min(24, frames) },
  };
}

export function planPrivateReplay(groups: readonly ReplayGroup[], memories: readonly ReplayMemory[], filter?: ReplayInterval, direction: ReplayDirection = 'oldest-first'): ReplayPlan {
  const ordered = orderedReplayGroups(groups, filter, direction);
  const selected = suggestedReplayGroups(ordered);
  const groupKeys = new Set(selected.map((group) => group.key));
  // Excluded moments remain candidates so the owner can add them back in the
  // optional editor. Their persisted intent only prevents automatic inclusion.
  const candidates = memories.filter((memory) => memory.eligible && memory.available && groupKeys.has(memory.groupKey) && inside(memory.capture, filter));
  const chapters: ReplayChapter[] = selected.map((group) => {
    const groupCandidates = candidates.filter((memory) => memory.groupKey === group.key && memory.intent !== 'exclude');
    const kept = groupCandidates.filter((memory) => memory.intent === 'keep');
    const automatic = selectReplayMemories(groupCandidates.filter((memory) => memory.intent !== 'keep'));
    const chosen = [...kept, ...automatic.filter((memory) => !kept.some((keptMemory) => keptMemory.key === memory.key))];
    return chapterFor(group, chosen.map((memory) => memory.key));
  });
  const selectedKeys = new Set(chapters.flatMap((chapter) => chapter.memoryKeys));
  const selectedMemories = candidates.filter((memory) => selectedKeys.has(memory.key)).sort(memoryOrder);
  return {
    groups: selected,
    candidateMemories: candidates,
    memories: selectedMemories,
    chapters,
    editoriallyOmittedMemoryCount: candidates.length - selectedMemories.length,
    omittedGroups: ordered.length - selected.length,
    panelCount: selectedMemories.length,
    durationSeconds: chapters.reduce((total, chapter) => total + chapter.frames, 0) / 24,
  };
}

/** Export deliberately begins empty; this verifies an exact subset rather than silently sampling it. */
export function createExportManifest(generation: number, groups: readonly ReplayGroup[], memories: readonly ReplayMemory[], direction: ReplayDirection = 'oldest-first'): ReplayManifest {
  if (groups.length < 1) throw new Error('Choose at least one trip before export.');
  const groupKeys = new Set(groups.map((group) => group.key));
  if (memories.some((memory) => !memory.eligible || !memory.available || !groupKeys.has(memory.groupKey))) throw new Error('Selected media is no longer eligible.');
  const chapters = groups.map((group) => {
    // Export receives the owner's exact ordered choices. It may not apply the
    // automatic curation policy again or silently remove a selected moment.
    const selected = memories.filter((memory) => memory.groupKey === group.key);
    return chapterFor(group, selected.map((memory) => memory.key));
  });
  const selectedKeys = new Set(chapters.flatMap((chapter) => chapter.memoryKeys));
  return {
    generation,
    groupKeys: groups.map((group) => group.key),
    memoryKeys: memories.filter((memory) => selectedKeys.has(memory.key)).map((memory) => memory.key),
    durationSeconds: chapters.reduce((total, chapter) => total + chapter.frames, 0) / 24,
    chapters,
    direction,
  };
}
