import { DraftSaveScheduler, type DraftSaveOutcome } from './draft-save-scheduler';
import { createReplayOperationId, type ReplayMutation, type ReplayReconciliation } from './draft-repository-contract';
import type { ReplayDirection, ReplaySoundtrack } from './types';

export type ReplayEditComposition = Readonly<{ memoryKeys: readonly string[]; includedGroupKeys: readonly string[]; autoGroupKeys: readonly string[]; direction: ReplayDirection; soundtrack: ReplaySoundtrack }>;
export type ReplayEditSnapshot = ReplayEditComposition & Readonly<{ snapshotToken: number; privacyRevision: number }>;
export class ReplaySaveOutcomeError extends Error {
  constructor(readonly outcome: DraftSaveOutcome) { super('Replay draft needs recovery.'); this.name = outcome.kind === 'conflict' ? 'ReplayDraftStaleError' : 'ReplaySaveOutcomeError'; }
}
/** Owned by the connected private-record provider, above route lifetime. */
export class ReplayEditSession {
  readonly sessionId = createReplayOperationId();
  readonly selectedTasks = new Set<Promise<void>>();
  readonly contexts = new Map<string, { selected: boolean; offset: number }>();
  readonly scheduler: DraftSaveScheduler<ReplayEditSnapshot>;
  private intent: ReplayEditSnapshot | null = null;
  private update: Promise<void> | null = null;
  private taskEpoch = 0;
  constructor(write: (snapshot: ReplayEditSnapshot, revision: number | undefined, mutation: ReplayMutation) => Promise<number>, isConflict: (error: unknown) => boolean, reconcile?: (mutation: ReplayMutation, snapshot: ReplayEditSnapshot) => Promise<ReplayReconciliation>) {
    let active: { version: number; mutation: ReplayMutation } | null = null;
    this.scheduler = new DraftSaveScheduler((snapshot, version, revision) => {
      const operation = { version, mutation: { sessionId: this.sessionId, editVersion: version, operationId: createReplayOperationId() } };
      active = operation;
      return write(snapshot, revision, operation.mutation).finally(() => { if (active === operation) active = null; });
    }, isConflict, async (snapshot, version) => {
      if (!reconcile || !active || active.version !== version) return { kind: 'outcome-unknown' };
      return reconcile(active.mutation, snapshot);
    });
  }
  getIntent() { return this.intent; }
  getTaskEpoch() { return this.taskEpoch; }
  isUpdating() { return this.update !== null; }
  initialize(snapshot: ReplayEditSnapshot, revision: number | undefined) {
    if (this.intent && this.intent.snapshotToken === snapshot.snapshotToken && this.intent.privacyRevision === snapshot.privacyRevision) return this.intent;
    if (this.scheduler.getCounts().active || this.scheduler.getCounts().pending) {
      // The screen exposes recovery; a changed scope is never an uncaught
      // React effect exception or permission to keep old selected tasks alive.
      void this.fence();
      return null;
    }
    this.intent = snapshot; this.scheduler.initializeRevision(revision); return snapshot;
  }
  enqueue(snapshot: ReplayEditSnapshot, immediate = false) {
    this.intent = Object.freeze({ ...snapshot, memoryKeys: Object.freeze([...snapshot.memoryKeys]), includedGroupKeys: Object.freeze([...snapshot.includedGroupKeys]), autoGroupKeys: Object.freeze([...snapshot.autoGroupKeys]) });
    return this.requireSaved(this.scheduler.enqueue(this.intent, immediate));
  }
  async flush() { await this.requireSaved(this.scheduler.flush()); }
  private async requireSaved(result: Promise<DraftSaveOutcome>) { const outcome = await result; if (outcome.kind !== 'saved' && outcome.kind !== 'cancelled') throw new ReplaySaveOutcomeError(outcome); }
  requestUpdate(run: (snapshot: ReplayEditSnapshot) => Promise<void>) {
    if (this.update) return this.update;
    // Set the barrier synchronously, before selected work or native writes wait.
    const task = Promise.resolve().then(async () => {
      while (this.selectedTasks.size) await Promise.all([...this.selectedTasks]);
      await this.flush();
      if (!this.intent) throw new Error('Replay metadata is not ready.');
      await run(this.intent);
    });
    this.update = task;
    void task.finally(() => { if (this.update === task) this.update = null; }).catch(() => undefined);
    return task;
  }
  async fence() { this.taskEpoch += 1; return this.scheduler.fence(); }
  replaceAfterRestore(snapshot: ReplayEditSnapshot, revision: number | undefined) { this.intent = snapshot; this.scheduler.initializeRevision(revision); }
}
