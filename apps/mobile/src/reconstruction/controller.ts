import type { ReconstructionGraph } from './types';
import { ReconciliationStageError } from './repository';
import { classifyAppDiagnosticError, createDiagnosticCorrelationId, recordAppDiagnostic, type AppDiagnosticOperation, type AppDiagnosticReasonCode } from '@/diagnostics/app-diagnostics';

export type ReconstructionView = { status: 'idle' | 'running' | 'complete' | 'restricted' | 'error'; graph: ReconstructionGraph | null; message: string | null };

type ReconciliationRepository = { reconcileQueued(nowMillis?: number, canUseSource?: () => Promise<boolean>): Promise<{ graph: ReconstructionGraph; newJourneyCount: number; updatedJourneyCount: number }> };

function catchUpFailureCode(error: unknown): AppDiagnosticReasonCode {
  return classifyAppDiagnosticError(error);
}

/** Owner-visible recovery guidance is fixed and aggregate-only. It never
 * echoes a native error, source identifier, SQL fragment, or correction data. */
function catchUpFailureMessage(error: unknown) {
  switch (catchUpFailureCode(error)) {
    case 'DATABASE_BUSY':
      return 'Local storage is busy while Atlas updates. Your last completed Atlas was kept. Fully reopen the app, then try once more.';
    case 'JOURNEY_REMAP':
      return 'A saved journey correction needs review before waiting local changes can rebuild. Your last completed Atlas was kept.';
    case 'HISTORY_REVIEW':
      return 'A saved history correction needs review before waiting local changes can rebuild. Your last completed Atlas was kept.';
    case 'SCHEMA':
      return 'Local Atlas storage needs a safe schema recovery. Your last completed Atlas was kept.';
    case 'ACCESS':
      return 'Reconnect permitted private photo access before Atlas can update.';
    default:
      return 'Local reconciliation could not finish. Your last completed result was kept.';
  }
}

export class ReconstructionController {
  private current: ReconstructionView = { status: 'idle', graph: null, message: null };
  private generation = 0;
  private runningGeneration: number | null = null;
  private suspended = false;

  constructor(
    private readonly repository: { rebuild(): Promise<ReconstructionGraph> },
    private readonly notify: (view: ReconstructionView) => void,
  ) {}

  get view() { return this.current; }

  clear() {
    this.generation += 1;
    this.suspended = true;
    this.current = { status: 'idle', graph: null, message: null };
    this.notify(this.current);
  }

  resume() { this.suspended = false; }

  /** An owner action may need to wait for a previously queued maintenance
   * writer. Acknowledge that wait immediately so the Atlas control never
   * appears inert, without claiming reconstruction itself has started. */
  acknowledgeQueuedMaintenanceWait() {
    if (this.suspended || this.runningGeneration !== null) return false;
    this.current = {
      ...this.current,
      status: 'running',
      message: 'Waiting for an existing local update to finish. Your last completed Atlas remains available.',
    };
    this.notify(this.current);
    return true;
  }

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
    const correlationId = createDiagnosticCorrelationId();
    if (this.suspended || this.runningGeneration !== null) {
      recordAppDiagnostic({ operation: 'ATLAS_REBUILD', reasonCode: this.runningGeneration === null ? 'SKIPPED' : 'ALREADY_RUNNING', stage: null, retryable: false, durableOutcome: 'skipped', correlationId });
      return { status: 'skipped' };
    }
    const generation = ++this.generation;
    this.runningGeneration = generation;
    this.current = { ...this.current, status: 'running', message: null }; this.notify(this.current);
    try {
      const graph = await this.repository.rebuild();
      if (generation !== this.generation) {
        recordAppDiagnostic({ operation: 'ATLAS_REBUILD', reasonCode: 'SKIPPED', stage: null, retryable: false, durableOutcome: 'skipped', correlationId });
        return { status: 'skipped' };
      }
      this.current = { status: 'complete', graph, message: graph.journeys.length ? 'Local inferred drafts are ready for review.' : 'No supported journey draft is available yet.' };
      recordAppDiagnostic({ operation: 'ATLAS_REBUILD', reasonCode: 'COMPLETE', stage: null, retryable: false, durableOutcome: 'complete', correlationId });
      return { status: 'complete' };
    } catch (error) {
      if (generation !== this.generation) {
        recordAppDiagnostic({ operation: 'ATLAS_REBUILD', reasonCode: 'SKIPPED', stage: null, retryable: false, durableOutcome: 'skipped', correlationId });
        return { status: 'skipped' };
      }
      const restricted = error instanceof Error && error.message.includes('not connected');
      recordAppDiagnostic({ operation: 'ATLAS_REBUILD', reasonCode: classifyAppDiagnosticError(error), stage: null, retryable: !restricted, durableOutcome: restricted ? 'restricted' : 'failed', correlationId });
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
  async reconcile(canUseSource: () => Promise<boolean> = async () => true, operation: Extract<AppDiagnosticOperation, 'ATLAS_CATCH_UP' | 'MAINTENANCE_RECONCILIATION'> = 'ATLAS_CATCH_UP') {
    const correlationId = createDiagnosticCorrelationId();
    if (this.suspended || this.runningGeneration !== null) {
      recordAppDiagnostic({ operation, reasonCode: 'SKIPPED', stage: null, retryable: false, durableOutcome: 'skipped', correlationId });
      return;
    }
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
        recordAppDiagnostic({ operation, reasonCode: 'COMPLETE', stage: null, retryable: false, durableOutcome: 'unchanged', correlationId });
        return;
      }
      this.current = {
        status: 'complete', graph: result.graph,
        message: result.newJourneyCount || result.updatedJourneyCount
          ? `${result.newJourneyCount} inferred journey update${result.newJourneyCount === 1 ? '' : 's'} is ready for review. It remains private and unpublished.`
          : 'Local changes were checked. Your private inferred draft is up to date.',
      };
      recordAppDiagnostic({ operation, reasonCode: 'COMPLETE', stage: null, retryable: false, durableOutcome: 'complete', correlationId });
    } catch (error) {
      if (generation !== this.generation) return;
      const reasonCode = catchUpFailureCode(error);
      const stage = error instanceof ReconciliationStageError ? error.stage : null;
      const sourceError = error instanceof ReconciliationStageError ? error.originalError : error;
      const restricted = sourceError instanceof Error && (sourceError.message.includes('not connected') || sourceError.message.includes('not permitted'));
      const busy = sourceError instanceof Error && sourceError.message.includes('already running');
      recordAppDiagnostic({ operation, reasonCode: busy ? 'ALREADY_RUNNING' : reasonCode, stage, retryable: !restricted && !busy, durableOutcome: busy ? 'unchanged' : restricted ? 'restricted' : 'failed', correlationId });
      this.current = { ...this.current, status: restricted ? 'restricted' : busy ? 'complete' : 'error', message: restricted ? 'Reconnect your private record before catching up.' : busy ? 'Another local catch-up is still running. Queued changes remain pending.' : catchUpFailureMessage(error) };
    } finally {
      if (this.runningGeneration === generation) this.runningGeneration = null;
      if (generation === this.generation) this.notify(this.current);
    }
  }
}
