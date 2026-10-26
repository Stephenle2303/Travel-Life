/** Public deadlines settle callers, never the separately owned native operation. */
import type { ReplayReconciliation } from './draft-repository-contract';
export type DraftSaveOutcome = { kind: 'saved'; version: number; revision: number } | { kind: 'failed' | 'conflict' | 'outcome-unknown' | 'cancelled'; version: number };
export type DraftSaveStatus = 'idle' | 'pending' | 'saving' | 'waiting' | 'outcome-unknown' | 'failed' | 'conflict';
type Snapshot<T> = { value: T; version: number; epoch: number; recovery?: 'conflict' | 'scope-invalid'; promise: Promise<DraftSaveOutcome>; settle(outcome: DraftSaveOutcome): void };
export class DraftSaveScheduler<T> {
  private active: Snapshot<T> | null = null;
  private pending: Snapshot<T> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private firstPendingAt = 0;
  private epoch = 0;
  private version = 0;
  private revision: number | undefined;
  private status: DraftSaveStatus = 'idle';
  private listeners = new Set<() => void>();
  private last: DraftSaveOutcome = { kind: 'cancelled', version: 0 };
  private checking: { snapshot: Snapshot<T>; result: Promise<DraftSaveOutcome> } | null = null;
  constructor(private readonly write: (value: T, version: number, revision: number | undefined) => Promise<number>, private readonly isConflict: (error: unknown) => boolean, private readonly reconcile?: (value: T, version: number) => Promise<ReplayReconciliation>) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getStatus = () => this.status;
  getVersion = () => this.version;
  getRevision = () => this.revision;
  getCounts = () => ({ active: Number(Boolean(this.active)), pending: Number(Boolean(this.pending)) });
  initializeRevision(revision: number | undefined) { if (!this.active && !this.pending) this.revision = revision; }
  private publish(status: DraftSaveStatus) { this.status = status; for (const listener of this.listeners) listener(); }
  enqueue(value: T, immediate = false): Promise<DraftSaveOutcome> {
    const version = ++this.version;
    // All superseded callers join one bounded completion record; no array of
    // historical snapshots/waiters is retained by the scheduler.
    if (this.pending) { this.pending.value = value; this.pending.version = version; }
    else {
      let settle!: (outcome: DraftSaveOutcome) => void;
      const promise = new Promise<DraftSaveOutcome>((resolve) => { settle = resolve; });
      this.pending = { value, version, epoch: this.epoch, promise, settle };
      this.firstPendingAt = Date.now();
    }
    const result = this.pending.promise;
    // The active deadline may already have fired before this waiter existed.
    // Retain latest intent, but never leave its public acknowledgement unbounded.
    if (this.active && (this.status === 'outcome-unknown' || this.active.epoch !== this.epoch || this.active.recovery)) {
      this.pending.settle({ kind: this.active.recovery ? 'conflict' : 'outcome-unknown', version });
    }
    if (!this.active) {
      this.publish('pending');
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => this.start(), Math.max(0, Math.min(250, 1000 - (Date.now() - this.firstPendingAt))));
      if (immediate) this.start();
    }
    return result;
  }
  flush(): Promise<DraftSaveOutcome> {
    const result = this.pending?.promise ?? this.active?.promise;
    if (!this.active && this.pending && this.status !== 'failed' && this.status !== 'conflict') this.start();
    return result ?? Promise.resolve(this.last);
  }
  /** Reconciliation observes the same operation; it never calls write again. */
  checkAgain(): Promise<DraftSaveOutcome> {
    const snapshot = this.active;
    if (!snapshot) return Promise.resolve(this.last);
    if (snapshot.recovery && snapshot.epoch === this.epoch) return Promise.resolve({ kind: 'conflict', version: snapshot.version });
    const unknown: DraftSaveOutcome = { kind: 'outcome-unknown', version: snapshot.version };
    if (!this.reconcile) return Promise.resolve(unknown);
    // A timed-out read stays owned internally. Repeated checks never queue
    // another read while the same native reconciliation is unresolved.
    if (this.checking?.snapshot === snapshot) return Promise.resolve(unknown);
    let timeout!: ReturnType<typeof setTimeout>;
    const deadline = new Promise<DraftSaveOutcome>((resolve) => { timeout = setTimeout(() => resolve(unknown), 8000); });
    const result = Promise.resolve().then(() => this.reconcile!(snapshot.value, snapshot.version)).then((receipt): DraftSaveOutcome => {
      if (this.active !== snapshot) return unknown;
      if (receipt.kind === 'conflict' || receipt.kind === 'scope-invalid') {
        snapshot.recovery = receipt.kind;
        this.last = { kind: 'conflict', version: snapshot.version };
        snapshot.settle(this.last);
        this.pending?.settle({ kind: 'conflict', version: this.pending.version });
        this.pending = null;
        this.publish('conflict');
        return this.last;
      }
      if (receipt.kind !== 'acknowledged') return unknown;
      if (snapshot.epoch !== this.epoch) {
        // A durable receipt can settle ownership after a restore fence, but
        // must never revive the discarded composition or its saved status.
        this.active = null;
        this.pending?.settle({ kind: 'cancelled', version: this.pending.version });
        this.pending = null;
        this.last = { kind: 'cancelled', version: snapshot.version };
        this.publish('idle');
        return this.last;
      }
      // The repository returns acknowledged only after its owned read commits.
      this.revision = receipt.revision;
      this.last = { kind: 'saved', version: snapshot.version, revision: receipt.revision };
      snapshot.settle(this.last); this.active = null;
      this.publish(this.pending ? 'pending' : 'idle');
      const saved = this.last;
      if (this.pending) this.start();
      return saved;
    }, () => unknown).finally(() => {
      clearTimeout(timeout);
      if (this.checking?.snapshot === snapshot) this.checking = null;
    });
    this.checking = { snapshot, result };
    return Promise.race([result, deadline]);
  }
  private start() {
    if (this.active || !this.pending) return;
    if (this.timer) clearTimeout(this.timer); this.timer = null;
    const snapshot = this.pending; this.pending = null; this.active = snapshot;
    this.publish('saving');
    const waiting = setTimeout(() => { if (this.active === snapshot && snapshot.epoch === this.epoch && !snapshot.recovery) this.publish('waiting'); }, 2000);
    const unknown = setTimeout(() => {
      if (this.active !== snapshot || snapshot.epoch !== this.epoch || snapshot.recovery) return;
      this.last = { kind: 'outcome-unknown', version: snapshot.version };
      snapshot.settle(this.last);
      // Pending callers also settle at the recovery boundary. Retain only the
      // latest snapshot for eventual safe continuation after native settlement.
      this.pending?.settle({ kind: 'outcome-unknown', version: this.pending.version });
      this.publish('outcome-unknown');
    }, 8000);
    void Promise.resolve().then(() => this.write(snapshot.value, snapshot.version, this.revision)).then((revision) => {
      if (this.active !== snapshot || snapshot.epoch !== this.epoch || snapshot.recovery) return;
      this.revision = revision;
      this.last = { kind: 'saved', version: snapshot.version, revision };
      snapshot.settle(this.last);
      this.publish(this.pending ? 'pending' : 'idle');
    }, (error: unknown) => {
      if (this.active !== snapshot || snapshot.epoch !== this.epoch || snapshot.recovery) return;
      const kind = this.isConflict(error) ? 'conflict' : 'failed';
      this.last = { kind, version: snapshot.version }; snapshot.settle(this.last);
      this.pending?.settle({ kind, version: this.pending.version });
      this.pending = null;
      this.publish(kind);
    }).finally(() => {
      clearTimeout(waiting); clearTimeout(unknown);
      if (this.active !== snapshot) return;
      this.active = null;
      if (snapshot.epoch !== this.epoch) this.publish('idle');
      if (snapshot.epoch === this.epoch && this.pending && this.status !== 'failed' && this.status !== 'conflict') this.start();
    });
  }
  /** Fence callbacks immediately, then wait for the actual owned operation. */
  async fence(): Promise<DraftSaveOutcome> {
    this.epoch += 1;
    if (this.timer) clearTimeout(this.timer); this.timer = null;
    this.pending?.settle({ kind: 'cancelled', version: this.pending.version }); this.pending = null;
    const active = this.active;
    if (active) {
      active.settle({ kind: 'cancelled', version: active.version });
      this.last = { kind: 'outcome-unknown', version: active.version };
      this.publish('outcome-unknown');
      // Do not mistake its public 8s result for native settlement.
      return { kind: 'outcome-unknown', version: active.version };
    }
    this.last = { kind: 'cancelled', version: this.version }; this.publish('idle');
    return this.last;
  }
}
