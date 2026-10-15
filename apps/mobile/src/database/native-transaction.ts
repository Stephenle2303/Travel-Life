type TransactionDatabase = {
  execAsync(source: string): Promise<void>;
};

let tail: Promise<void> = Promise.resolve();

async function acquireTransactionTurn(): Promise<() => void> {
  let release!: () => void;
  const next = new Promise<void>((resolve) => { release = resolve; });
  const previous = tail;
  tail = next;
  await previous;
  return release;
}

function beginsTransaction(source: string) {
  return /^\s*BEGIN(?:\s+IMMEDIATE)?\s+TRANSACTION\s*;?\s*$/i.test(source);
}

function finishesTransaction(source: string) {
  return /^\s*(?:COMMIT|ROLLBACK)\s*;?\s*$/i.test(source);
}

/**
 * Expo SQLite can reuse one native connection for separate repository objects.
 * Keep explicit transactions exclusive across those objects so a foreground
 * read/write and an OS-invoked maintenance task cannot nest BEGIN statements.
 */
export function serializeNativeTransactions<T extends TransactionDatabase>(database: T): T {
  let release: (() => void) | null = null;

  return new Proxy(database, {
    get(target, property, receiver) {
      if (property !== 'execAsync') return Reflect.get(target, property, receiver);
      return async (source: string) => {
        if (beginsTransaction(source)) {
          const turn = await acquireTransactionTurn();
          try {
            await target.execAsync(source);
            release = turn;
          } catch (error) {
            turn();
            throw error;
          }
          return;
        }

        try {
          await target.execAsync(source);
        } finally {
          if (release && finishesTransaction(source)) {
            const completed = release;
            release = null;
            completed();
          }
        }
      };
    },
  });
}
