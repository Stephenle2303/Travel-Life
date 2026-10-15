import type { ReconstructionGraph } from './types';

export type ReconstructionView = { status: 'idle' | 'running' | 'complete' | 'restricted' | 'error'; graph: ReconstructionGraph | null; message: string | null };

type ReconciliationRepository = { reconcileQueued(nowMillis?: number, canUseSource?: () => Promise<boolean>): Promise<{ graph: ReconstructionGraph; newJourneyCount: number; updatedJourneyCount: number }> };

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

  /** Publish a graph which the repository has already committed atomically.
   * This avoids reopening a second reconstruction transaction after an owner
   * correction has been saved. */
  publishCommitted(graph: ReconstructionGraph) {
    if (this.suspended) return { status: 'skipped' as const };
    this.generation += 1;
    this.current = {
      status: 'complete', graph,
      message: graph.journeys.length ? 'Local inferred drafts are ready for review.' : 'No supported journey draft is available yet.',
    };
    this.notify(this.current);
    return { status: 'complete' as const };
  }

  async rebuild(): Promise<{ status: 'complete' } | { status: 'failed'; error: unknown } | { status: 'skipped' }> {
    if (this.suspended || this.runningGeneration !== null) return { status: 'skipped' };
    const generation = ++this.generation;
    this.runningGeneration = generation;
    this.current = { ...this.current, status: 'running', message: null }; this.notify(this.current);
    try {
      const graph = await this.repository.rebuild();
      if (generation !== this.generation) return { status: 'skipped' };
      this.current = { status: 'complete', graph, message: graph.journeys.length ? 'Local inferred drafts are ready for review.' : 'No supported journey draft is available yet.' };
      return { status: 'complete' };
    } catch (error) {
      if (generation !== this.generation) return { status: 'skipped' };
      const restricted = error instanceof Error && error.message.includes('not connected');
      this.current = { ...this.current, status: restricted ? 'restricted' : 'error', message: restricted ? 'Reconnect your private record before rebuilding.' : 'Local reconstruction could not finish. Your last completed result was kept.' };
      return { status: 'failed', error };
    } finally {
      if (this.runningGeneration === generation) this.runningGeneration = null;
      if (generation === this.generation) {
        this.notify(this.current);
      }
    }
  }

  /** Consumes the durable M1.5 queue through the repository's single SQLite
   * transaction. It deliberately falls back to a normal local rebuild for
   * web/test repositories that do not have the private queue. */
  async reconcile(canUseSource: () => Promise<boolean> = async () => true) {
    if (this.suspended || this.runningGeneration !== null) return;
    const generation = ++this.generation;
    this.runningGeneration = generation;
    this.current = { ...this.current, status: 'running', message: 'Reconciling local changes. Your last completed draft remains available.' };
    this.notify(this.current);
    try {
      const repository = this.repository as typeof this.repository & Partial<ReconciliationRepository>;
      const result = repository.reconcileQueued ? await repository.reconcileQueued(Date.now(), canUseSource) : { graph: await this.repository.rebuild(), newJourneyCount: 0, updatedJourneyCount: 0 };
      if (generation !== this.generation) return;
      if (repository.reconcileQueued && result.newJourneyCount === 0 && result.updatedJourneyCount === 0 && result.graph.journeys.length === 0 && this.current.graph !== null) {
        this.current = { ...this.current, status: 'complete', message: 'No local journey updates were waiting. Your private draft is unchanged.' };
        return;
      }
      this.current = {
        status: 'complete', graph: result.graph,
        message: result.newJourneyCount || result.updatedJourneyCount
          ? `${result.newJourneyCount} inferred journey update${result.newJourneyCount === 1 ? '' : 's'} is ready for review. It remains private and unpublished.`
          : 'Local changes were checked. Your private inferred draft is up to date.',
      };
    } catch (error) {
      if (generation !== this.generation) return;
      const restricted = error instanceof Error && (error.message.includes('not connected') || error.message.includes('not permitted'));
      const busy = error instanceof Error && error.message.includes('already running');
      this.current = { ...this.current, status: restricted ? 'restricted' : busy ? 'complete' : 'error', message: restricted ? 'Reconnect your private record before catching up.' : busy ? 'Another local catch-up is still running. Queued changes remain pending.' : 'Local reconciliation could not finish. Your last completed result was kept.' };
    } finally {
      if (this.runningGeneration === generation) this.runningGeneration = null;
      if (generation === this.generation) this.notify(this.current);
    }
  }
}
