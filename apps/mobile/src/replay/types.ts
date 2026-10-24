/** Private, ephemeral Replay planning data. Source identifiers stay below this boundary. */
export type ReplayInterval = Readonly<{ startDay: string; endDay: string }>;
export type ReplayMemory = Readonly<{
  /** Opaque, session-scoped display token; never an evidence or media identifier. */
  key: string;
  groupKey: string;
  kind: 'photo' | 'video';
  available: boolean;
  eligible: boolean;
  /** Presentation preference loaded from the private draft; never evidence. */
  intent?: 'keep' | 'exclude';
  /** Owner presentation order from the private draft, never observed chronology. */
  order?: number;
  capture?: ReplayInterval;
}>;
export type ReplayGroup = Readonly<{
  key: string;
  label: string;
  /** Missing means the Journey List has no exact date span; never use sentinels. */
  interval?: ReplayInterval;
  inferred: boolean;
  eligible: boolean;
  orderCertain: boolean;
  /** Presentation provenance only. It is never converted into observed chronology. */
  state?: 'inferred' | 'confirmed' | 'owner-entered';
}>;
/** Private presentation only. It never changes Journey List facts or evidence. */
export type ReplayDirection = 'oldest-first' | 'newest-first';
/** Opaque private renderer input; never a source URI, name, or MIME value. */
export type ReplaySoundtrack = Readonly<{ kind: 'bundled'; revision: 'happy-moments-1.4' }> | Readonly<{ kind: 'custom'; revision: string; localUri: string }>;
export type ReplayChapterCard = Readonly<{
  /** Sanitized local text tokens only; never an identifier or a native source value. */
  labelToken: string;
  timeToken: string;
  /** Cards borrow from, rather than add to, the chapter's exact frame budget. */
  frames: number;
}>;
export type ReplayPlan = Readonly<{
  groups: readonly ReplayGroup[];
  /** All allowed, locally-readable album attachments. They remain editable candidates. */
  candidateMemories: readonly ReplayMemory[];
  /** The automatic chapter subset. Items outside it are editorially unselected, not removed. */
  memories: readonly ReplayMemory[];
  chapters: readonly ReplayChapter[];
  editoriallyOmittedMemoryCount: number;
  omittedGroups: number;
  /** Kept for compatibility with existing callers; it now counts selected scenes. */
  panelCount: number;
  durationSeconds: number;
}>;
export type ReplayChapter = Readonly<{
  groupKey: string;
  memoryKeys: readonly string[];
  frames: number;
  /** Omitted only for legacy manifests; new planners always provide a card. */
  card?: ReplayChapterCard;
}>;
export type ReplayState = 'idle' | 'sparse' | 'preparing' | 'rendering' | 'preview-ready' | 'cancelled' | 'stale' | 'failed' | 'unavailable';
export type ReplayManifest = Readonly<{
  /** Fixed bundled score only; legacy manifests remain silent. */
  music?: ReplaySoundtrack;
  generation: number;
  groupKeys: readonly string[];
  memoryKeys: readonly string[];
  durationSeconds: number;
  /** Exact 24fps chapter budgets. Missing only for legacy callers. */
  chapters?: readonly ReplayChapter[];
  /** Private presentation order; export review is invalid when it changes. */
  direction?: ReplayDirection;
}>;
/**
 * A renderer-only local handle.  It is created by PhotoAccessProvider and must
 * never be placed in React state, diagnostics, or a persisted record.
 */
export type ReplayRenderSource = Readonly<{ memoryKey: string; groupKey: string; kind: 'photo' | 'video'; uri: string }>;
export type ReplayPreparedPreview = Readonly<{
  uri: string;
  durationSeconds: number;
  renderedMemoryCount: number;
  omittedMemoryCount: number;
}>;
/** Opaque durable-cache metadata. It never contains a media URI or source reference. */
export type ReplayPreparedArtifactRecord = Readonly<{
  identity: string;
  fileKey: string;
  durationSeconds: number;
  renderedMemoryCount: number;
}>;
/**
 * Provider-only current-run input. `previewSourceRefs` is consumed immediately
 * by the local photo adapter and is never exposed to a screen or diagnostics.
 */
export type ReplayManifestInput = Readonly<{
  snapshotToken: number;
  privacyRevision: number;
  /** Private draft preference; absent/invalid data deliberately defaults oldest-first. */
  direction?: ReplayDirection;
  soundtrack?: ReplaySoundtrack;
  preparedArtifact?: ReplayPreparedArtifactRecord;
  groups: readonly ReplayGroup[];
  memories: readonly ReplayMemory[];
  previewSourceRefs?: readonly (string | null)[];
}>;

/** Initial accepted chapter policy. It is applied after automatic selection. */
export function replayChapterFrames(selectedMemoryCount: number): number {
  if (!Number.isInteger(selectedMemoryCount) || selectedMemoryCount < 0) throw new Error('Replay memory count is invalid.');
  const seconds = selectedMemoryCount === 0 ? 3
    : selectedMemoryCount === 1 ? 5
      : selectedMemoryCount === 2 ? 8
        : selectedMemoryCount === 3 ? 15
          : selectedMemoryCount === 4 ? 16
            : selectedMemoryCount === 5 ? 18 : 20;
  return seconds * 24;
}

export function replayDuration(selectedMemoryCount: number): number {
  return replayChapterFrames(selectedMemoryCount) / 24;
}
