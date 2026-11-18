type TransactionDatabase = { execAsync(source: string): Promise<void> };
export type NativeWriterKind = 'privacy' | 'foreground' | 'background';
type Turn = { kind: NativeWriterKind; signal?: AbortSignal; resolve(release: () => void): void; reject(error: unknown): void; removeAbort(): void };
const queue: Turn[] = [];
let active = false;
let foregroundOvertakes = 0;

export class NativeTransactionWithdrawnError extends Error {
  constructor() { super('Native transaction did not start.'); this.name = 'NativeTransactionWithdrawnError'; }
}

function drain() {
  if (active || !queue.length) return;
  const privacy = queue.findIndex((turn) => turn.kind === 'privacy');
  const background = queue.findIndex((turn) => turn.kind === 'background');
  const foreground = queue.findIndex((turn) => turn.kind === 'foreground');
  const index = privacy >= 0 ? privacy : background >= 0 && foregroundOvertakes >= 3 ? background : foreground >= 0 ? foreground : 0;
  const [turn] = queue.splice(index, 1);
  turn.removeAbort();
  active = true;
  if (turn.kind === 'background') foregroundOvertakes = 0;
  else if (turn.kind === 'foreground' && background >= 0) foregroundOvertakes += 1;
  let released = false;
  turn.resolve(() => { if (released) return; released = true; active = false; drain(); });
}

function acquireTransactionTurn(kind: NativeWriterKind = 'background', signal?: AbortSignal): Promise<() => void> {
  if (signal?.aborted) return Promise.reject(new NativeTransactionWithdrawnError());
  return new Promise((resolve, reject) => {
    const abort = () => { const index = queue.indexOf(turn); if (index < 0) return; queue.splice(index, 1); turn.removeAbort(); reject(new NativeTransactionWithdrawnError()); };
    const turn: Turn = { kind, signal, resolve, reject, removeAbort: () => signal?.removeEventListener('abort', abort) };
    signal?.addEventListener('abort', abort, { once: true });
    queue.push(turn); drain();
  });
}

function beginsTransaction(source: string) { return /^\s*BEGIN(?:\s+IMMEDIATE)?\s+TRANSACTION\s*;?\s*$/i.test(source); }
function finishesTransaction(source: string) { return /^\s*(?:COMMIT|ROLLBACK)\s*;?\s*$/i.test(source); }
const rawConnections = new WeakMap<object, TransactionDatabase>();

/** Callback ownership cannot be released by a UI deadline or a rejected COMMIT. */
export async function runOwnedTransaction<T extends TransactionDatabase, R>(database: T, options: { kind: NativeWriterKind; signal?: AbortSignal; mode?: 'read' | 'write'; onRollback?: (outcome: 'start' | 'complete' | 'failed') => void }, body: (database: T) => Promise<R>): Promise<R> {
  const release = await acquireTransactionTurn(options.kind, options.signal);
  const raw = (rawConnections.get(database) ?? database) as T;
  let began = false;
  let acknowledging = false;
  try {
    // A signal can withdraw queued work, but never cancels a running driver call.
    if (options.signal?.aborted) throw new NativeTransactionWithdrawnError();
    await raw.execAsync(options.mode === 'read' ? 'BEGIN DEFERRED TRANSACTION' : 'BEGIN IMMEDIATE TRANSACTION'); began = true;
    const result = await body(raw);
    acknowledging = true;
    await raw.execAsync('COMMIT'); began = false;
    release();
    return result;
  } catch (error) {
    if (began) {
      // If rollback itself rejects, quarantine the turn. Subsequent writers
      // must remain fenced until connection health/settlement is established.
      const notify = (outcome: 'start' | 'complete' | 'failed') => { try { options.onRollback?.(outcome); } catch { /* Diagnostics cannot change transaction ownership. */ } };
      notify('start');
      try { await raw.execAsync('ROLLBACK'); } catch (rollbackError) {
        notify('failed');
        // SQLite can acknowledge COMMIT late. Its explicit no-active-
        // transaction result proves settlement, but not the durable outcome.
        // Release only that known-safe connection and preserve the original
        // acknowledgement failure for command-receipt reconciliation.
        if (acknowledging && rollbackError instanceof Error && /cannot rollback - no transaction is active/i.test(rollbackError.message)) {
          release();
          throw error;
        }
        throw rollbackError;
      }
      notify('complete');
    }
    release(); throw error;
  }
}

/** Compatibility for existing explicit SQL owners; shares the callback gate. */
export function serializeNativeTransactions<T extends TransactionDatabase>(database: T): T {
  let release: (() => void) | null = null;
  const proxy = new Proxy(database, {
    get(target, property, receiver) {
      if (property !== 'execAsync') return Reflect.get(target, property, receiver);
      return async (source: string) => {
        if (beginsTransaction(source)) {
          const turn = await acquireTransactionTurn();
          try { await target.execAsync(source); release = turn; }
          catch (error) { turn(); throw error; }
          return;
        }
        // A failed COMMIT does not establish settlement. Its owner still has
        // the lease while it awaits ROLLBACK, including a deferred rollback.
        await target.execAsync(source);
        if (release && finishesTransaction(source)) { const completed = release; release = null; completed(); }
      };
    },
  });
  rawConnections.set(proxy, database);
  return proxy;
}
