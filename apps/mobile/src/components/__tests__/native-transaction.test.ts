import { runOwnedTransaction, serializeNativeTransactions } from '@/database/native-transaction';

describe('native SQLite transaction serialization', () => {
  it('does not allow separate repository wrappers to begin transactions concurrently', async () => {
    const execAsync = jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined);
    const first = serializeNativeTransactions({ execAsync });
    const second = serializeNativeTransactions({ execAsync });

    await first.execAsync('BEGIN IMMEDIATE TRANSACTION');
    const pendingSecondBegin = second.execAsync('BEGIN IMMEDIATE TRANSACTION');
    await Promise.resolve();
    expect(execAsync).toHaveBeenCalledTimes(1);

    await first.execAsync('COMMIT');
    await pendingSecondBegin;
    expect(execAsync.mock.calls.map(([sql]) => sql)).toEqual([
      'BEGIN IMMEDIATE TRANSACTION',
      'COMMIT',
      'BEGIN IMMEDIATE TRANSACTION',
    ]);

    await second.execAsync('ROLLBACK');
  });

  it('retains ownership after rejected COMMIT until native rollback actually settles', async () => {
    let settle!: () => void;
    const rollback = new Promise<void>((resolve) => { settle = resolve; });
    const execAsync = jest.fn(async (sql: string) => { if (sql === 'COMMIT') throw new Error('synthetic acknowledgement'); if (sql === 'ROLLBACK') await rollback; });
    const first = serializeNativeTransactions({ execAsync });
    const secondExec = jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined);
    const second = serializeNativeTransactions({ execAsync: secondExec });
    await first.execAsync('BEGIN IMMEDIATE TRANSACTION');
    await expect(first.execAsync('COMMIT')).rejects.toThrow();
    const pending = second.execAsync('BEGIN IMMEDIATE TRANSACTION');
    await Promise.resolve(); await Promise.resolve();
    expect(secondExec).not.toHaveBeenCalled();
    const rollingBack = first.execAsync('ROLLBACK');
    await Promise.resolve();
    expect(secondExec).not.toHaveBeenCalled();
    settle(); await rollingBack; await pending; await second.execAsync('ROLLBACK');
  });

  it('withdraws queued callback work without starting it or releasing the active writer', async () => {
    let settle!: () => void;
    const held = new Promise<void>((resolve) => { settle = resolve; });
    const db = { execAsync: jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined) };
    const running = runOwnedTransaction(db, { kind: 'background' }, async () => held);
    await Promise.resolve(); await Promise.resolve();
    const controller = new AbortController();
    const body = jest.fn(async () => undefined);
    const pending = runOwnedTransaction(db, { kind: 'foreground', signal: controller.signal }, body);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'NativeTransactionWithdrawnError' });
    expect(body).not.toHaveBeenCalled();
    expect(db.execAsync.mock.calls.map(([sql]) => sql)).toEqual(['BEGIN IMMEDIATE TRANSACTION']);
    settle(); await running;
  });

  it('allows at most three foreground overtakes of a waiting background owner', async () => {
    const blocker = serializeNativeTransactions({ execAsync: async (_sql: string) => undefined });
    await blocker.execAsync('BEGIN IMMEDIATE TRANSACTION');
    const order: string[] = [];
    const db = { execAsync: async (_sql: string) => undefined };
    const background = runOwnedTransaction(db, { kind: 'background' }, async () => { order.push('background'); });
    const foreground = Array.from({ length: 5 }, (_, index) => runOwnedTransaction(db, { kind: 'foreground' }, async () => { order.push(`foreground-${index}`); }));
    await blocker.execAsync('COMMIT');
    await Promise.all([background, ...foreground]);
    expect(order.indexOf('background')).toBe(3);
  });
});
