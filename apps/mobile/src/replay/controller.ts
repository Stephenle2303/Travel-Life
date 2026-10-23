import { createExportManifest, planPrivateReplay } from './selection';
import type { ReplayArtifact, ReplayRenderer, ReplayRenderProgress } from './renderer';
import type { ReplayGroup, ReplayManifest, ReplayMemory, ReplayPlan, ReplayRenderSource, ReplayState } from './types';

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
    const key = replayManifestKey(manifest);
    if (this.state === 'preview-ready' && this.artifact && this.artifactKey === key) return this.artifact;
    this.cancel();
    const expected = ++this.generation;
    this.state = 'preparing';
    const abort = new AbortController();
    this.abort = abort;
    this.state = 'rendering';
    try {
      const artifact = await this.renderer.render(manifest, sources, abort.signal, onProgress);
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

function replayManifestKey(manifest: ReplayManifest) {
  return JSON.stringify([manifest.generation, manifest.direction ?? 'oldest-first', manifest.groupKeys, manifest.memoryKeys, manifest.durationSeconds, manifest.chapters]);
}
