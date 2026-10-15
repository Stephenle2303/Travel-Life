import { serializeNativeTransactions } from '@/database/native-transaction';

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
});
