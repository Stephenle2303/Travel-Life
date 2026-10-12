import type { ReconstructionGraph } from './types';

export type ReconstructionView = { status: 'idle' | 'running' | 'complete' | 'restricted' | 'error'; graph: ReconstructionGraph | null; message: string | null };

export class ReconstructionController {
  private current: ReconstructionView = { status: 'idle', graph: null, message: null };
  private generation = 0;
  private runningGeneration: number | null = null;
  private suspended = false;

  constructor(private readonly repository: { rebuild(): Promise<ReconstructionGraph> }, private readonly notify: (view: ReconstructionView) => void) {}

  get view() { return this.current; }

  clear() {
    this.generation += 1;
    this.suspended = true;
    this.current = { status: 'idle', graph: null, message: null };
    this.notify(this.current);
  }

  resume() { this.suspended = false; }

  async rebuild() {
    if (this.suspended || this.runningGeneration !== null) return;
    const generation = ++this.generation;
    this.runningGeneration = generation;
    this.current = { ...this.current, status: 'running', message: null }; this.notify(this.current);
    try {
      const graph = await this.repository.rebuild();
      if (generation !== this.generation) return;
      this.current = { status: 'complete', graph, message: graph.journeys.length ? 'Local inferred drafts are ready for review.' : 'No supported journey draft is available yet.' };
    } catch (error) {
      if (generation !== this.generation) return;
      const restricted = error instanceof Error && error.message.includes('not connected');
      this.current = { ...this.current, status: restricted ? 'restricted' : 'error', message: restricted ? 'Reconnect your private record before rebuilding.' : 'Local reconstruction could not finish. Your last completed result was kept.' };
    } finally {
      if (this.runningGeneration === generation) this.runningGeneration = null;
      if (generation === this.generation) {
        this.notify(this.current);
      }
    }
  }
}
