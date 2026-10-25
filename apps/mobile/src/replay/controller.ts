import { createExportManifest, planPrivateReplay } from './selection';
import type { ReplayArtifact, ReplayRenderer, ReplayRenderProgress } from './renderer';
import type { ReplayChapter, ReplayGroup, ReplayManifest, ReplayMemory, ReplayPlan, ReplayRenderSource, ReplayState } from './types';

export class ReplayController {
  private state: ReplayState = 'idle';
  private generation = 0;
  private abort: AbortController | null = null;
  private artifact: ReplayArtifact | null = null;
  private artifactKey: string | null = null;
  constructor(private readonly renderer: ReplayRenderer) {}
  snapshot() { return { state: this.state, generation: this.generation, artifact: this.artifact }; }
  invalidate() { this.generation += 1; this.abort?.abort(); this.abort = null; this.artifact = null; this.artifactKey = null; this.state = 'stale'; }
  cancel() { this.abort?.abort(); this.abort = null; this.artifact = null; this.artifactKey = null; this.state = 'cancelled'; }
  plan(groups: readonly ReplayGroup[], memories: readonly ReplayMemory[], direction: import('./types').ReplayDirection = 'oldest-first'): ReplayPlan { return planPrivateReplay(groups, memories, undefined, direction); }
  async prepare(manifest: ReplayManifest, sources: readonly ReplayRenderSource[], onProgress?: ReplayRenderProgress): Promise<ReplayArtifact> {
    return this.prepareWith(manifest, (signal) => this.renderer.render(manifest, sources, signal, onProgress));
  }
  /** Keeps all native preparation paths behind the same single-owner gate. */
  async prepareWith(manifest: ReplayManifest, work: (signal: AbortSignal) => Promise<ReplayArtifact>): Promise<ReplayArtifact> {
    const key = replayManifestKey(manifest);
    if (this.state === 'preview-ready' && this.artifact && this.artifactKey === key) return this.artifact;
    this.cancel();
    const expected = ++this.generation;
    this.state = 'preparing';
    const abort = new AbortController();
    this.abort = abort;
    this.state = 'rendering';
    try {
      const artifact = await work(abort.signal);
      if (abort.signal.aborted || expected !== this.generation) throw new Error('STALE');
      this.artifact = artifact;
      this.artifactKey = key;
      this.state = 'preview-ready';
      return artifact;
    } catch (error) {
      if (abort.signal.aborted || expected !== this.generation) { this.state = 'cancelled'; throw error; }
      this.state = 'unavailable';
      throw error;
    } finally { if (this.abort === abort) this.abort = null; }
  }
  exportManifest(groups: readonly ReplayGroup[], memories: readonly ReplayMemory[], direction: import('./types').ReplayDirection = 'oldest-first'): ReplayManifest { return createExportManifest(this.generation, groups, memories, direction); }
  canExport(manifest: ReplayManifest) { return this.state === 'preview-ready' && this.artifactKey === replayManifestKey(manifest); }
}

/** Stable local identity for a verified private artifact; it is never logged or sent remotely. */
export function replayManifestIdentity(manifest: ReplayManifest) {
  return opaqueReplayFingerprint(['replay-playlist-v2', manifest.generation, manifest.direction ?? 'oldest-first', manifest.music ? [manifest.music.kind, manifest.music.revision] : ['silent'], manifest.groupKeys, manifest.memoryKeys, manifest.durationSeconds, manifest.chapters]);
}

/**
 * Cache identity for one private chapter.  It intentionally includes the
 * exact owner-selected inputs and every renderer-visible configuration, while
 * excluding source URIs and labels.  A changed trip can therefore invalidate
 * only its own bytes without making uncertain cache matches eligible.
 */
export function replayChapterIdentity(manifest: ReplayManifest, chapter: ReplayChapter) {
  return opaqueReplayFingerprint([
    'replay-chapter-v1',
    // A global reconstruction generation may change for another trip. It is
    // not visual chapter input, so including it would defeat unchanged-trip
    // reuse after an owner updates a different trip.
    manifest.direction ?? 'oldest-first',
    chapter.groupKey,
    chapter.memoryKeys,
    chapter.frames,
    chapter.card ? [chapter.card.labelToken, chapter.card.timeToken, chapter.card.frames] : null,
    'h264-1280x720-24fps-yuv420p',
  ]);
}

/** A stable local token, never a reversible serialization of private card text. */
function opaqueReplayFingerprint(value: unknown): string {
  const text = JSON.stringify(value);
  let first = 0x811c9dc5;
  let second = 0x01000193;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193) >>> 0;
    second = Math.imul(second ^ (code + index), 0x85ebca6b) >>> 0;
  }
  return `r2-${first.toString(16).padStart(8, '0')}${second.toString(16).padStart(8, '0')}`;
}

function replayManifestKey(manifest: ReplayManifest) { return replayManifestIdentity(manifest); }
