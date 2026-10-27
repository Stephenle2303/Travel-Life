import { HistoryRecordController } from '@/history-record';
import type { HistoryRecordRepository, LifecycleSnapshot } from '@/history-record';

function repository(state: 'connected' | 'disconnected' | 'deleted' = 'connected'): HistoryRecordRepository {
  return {
    getPrivateRecordLifecycle: async () => ({ state }),
    connectPrivateRecord: async () => { state = 'connected'; },
    disconnectPrivateRecord: async () => { state = 'disconnected'; },
    deleteLocalHistory: async () => { state = 'deleted'; },
    saveCorrectionOverlay: async () => {},
  };
}

describe('private record lifecycle controller', () => {
  it('persists remote removal before evidence purge and reports pending acknowledgement truthfully', async () => {
    const order: string[] = []; const local = repository(); local.deleteLocalHistory = async () => { order.push('purge'); };
    const controller = new HistoryRecordController(local, async () => {}, () => {}, () => {}, async () => { order.push('queue'); return 'pending'; });
    await controller.delete(); expect(order).toEqual(['queue', 'purge']); expect(controller.snapshot.message).toMatch(/Remote removal is pending/);
  });
  it('keeps evidence when durable removal intent cannot be saved', async () => {
    const local = repository(); local.deleteLocalHistory = jest.fn();
    const controller = new HistoryRecordController(local, async () => {}, () => {}, () => {}, async () => { throw new Error('PRIVATE_SENTINEL'); });
    await controller.delete(); expect(local.deleteLocalHistory).not.toHaveBeenCalled(); expect(controller.snapshot.message).not.toContain('PRIVATE_SENTINEL');
  });
  it('keeps disconnect, reconnect, and deletion as separate owner actions', async () => {
    const snapshots: LifecycleSnapshot[] = [];
    const stopImports = jest.fn(async () => {});
    const clearDeletedState = jest.fn();
    const controller = new HistoryRecordController(repository(), stopImports, (snapshot) => snapshots.push(snapshot), clearDeletedState);

    await controller.refresh();
    expect(controller.snapshot).toEqual({ state: 'connected', message: null, pendingAction: null });

    await controller.disconnect();
    expect(stopImports).toHaveBeenCalledTimes(1);
    expect(controller.snapshot).toEqual({ state: 'disconnected', message: null, pendingAction: null });

    await controller.reconnect();
    expect(controller.snapshot).toEqual({ state: 'connected', message: null, pendingAction: null });

    await controller.delete();
    expect(stopImports).toHaveBeenCalledTimes(2);
    expect(controller.snapshot).toEqual({ state: 'deleted', message: 'Local history was deleted from this device. Original photos and remote copies were not changed.', pendingAction: null });
    expect(clearDeletedState).toHaveBeenCalledTimes(1);
    expect(snapshots).toHaveLength(7);
  });

  it('reports lifecycle failures without claiming a successful deletion', async () => {
    const failing: HistoryRecordRepository = {
      ...repository(),
      disconnectPrivateRecord: async () => { throw new Error('disconnect failed'); },
      deleteLocalHistory: async () => { throw new Error('delete failed'); },
    };
    const controller = new HistoryRecordController(failing, async () => {}, () => {});

    await controller.disconnect();
    expect(controller.snapshot.message).toMatch(/could not be disconnected/);

    await controller.delete();
    expect(controller.snapshot.message).toMatch(/could not be deleted.*Nothing was reported as removed/);
  });

  it('serializes overlapping lifecycle actions', async () => {
    let finishDelete!: () => void;
    const deleteLocalHistory = jest.fn(() => new Promise<void>((resolve) => { finishDelete = resolve; }));
    const deleting: HistoryRecordRepository = {
      ...repository(),
      deleteLocalHistory,
    };
    const controller = new HistoryRecordController(deleting, async () => {}, () => {});

    const first = controller.delete();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const second = controller.delete();
    finishDelete();
    await Promise.all([first, second]);

    expect(controller.snapshot.state).toBe('deleted');
    expect(deleteLocalHistory).toHaveBeenCalledTimes(1);
  });

  it('publishes pending reconnect state, reports a safe failure, and lets a later retry connect', async () => {
    let rejectFirst = true;
    const connectPrivateRecord = jest.fn(async () => {
      if (rejectFirst) { rejectFirst = false; throw new Error('sqlite details stay private'); }
    });
    const snapshots: LifecycleSnapshot[] = [];
    const controller = new HistoryRecordController({ ...repository('deleted'), connectPrivateRecord }, async () => {}, (snapshot) => snapshots.push(snapshot));

    await expect(controller.reconnect()).resolves.toBe(false);
    expect(snapshots[0]).toMatchObject({ state: 'deleted', pendingAction: 'reconnect', message: null });
    expect(controller.snapshot).toEqual({ state: 'deleted', pendingAction: null, message: 'The private record could not be opened. Retry when ready.' });

    await expect(controller.reconnect()).resolves.toBe(true);
    expect(connectPrivateRecord).toHaveBeenCalledTimes(2);
    expect(controller.snapshot).toEqual({ state: 'connected', pendingAction: null, message: null });
  });

  it('does not let a stale refresh overwrite a lifecycle action and publishes every pending action', async () => {
    let resolveRefresh!: (value: { state: 'connected' }) => void;
    const snapshots: LifecycleSnapshot[] = [];
    const repo = repository();
    repo.getPrivateRecordLifecycle = () => new Promise((resolve) => { resolveRefresh = resolve; });
    const controller = new HistoryRecordController(repo, async () => {}, (snapshot) => snapshots.push(snapshot));
    const refresh = controller.refresh();
    await controller.disconnect();
    resolveRefresh({ state: 'connected' });
    await refresh;
    expect(controller.snapshot.state).toBe('disconnected');
    expect(snapshots).toContainEqual(expect.objectContaining({ pendingAction: 'disconnect' }));

    await controller.reconnect();
    const deleting = controller.delete();
    expect(controller.snapshot.pendingAction).toBe('delete');
    await deleting;
    expect(snapshots).toContainEqual(expect.objectContaining({ pendingAction: 'delete' }));
  });
});
