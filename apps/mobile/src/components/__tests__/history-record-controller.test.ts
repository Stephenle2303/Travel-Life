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
  it('keeps disconnect, reconnect, and deletion as separate owner actions', async () => {
    const snapshots: LifecycleSnapshot[] = [];
    const stopImports = jest.fn(async () => {});
    const clearDeletedState = jest.fn();
    const controller = new HistoryRecordController(repository(), stopImports, (snapshot) => snapshots.push(snapshot), clearDeletedState);

    await controller.refresh();
    expect(controller.snapshot).toEqual({ state: 'connected', message: null });

    await controller.disconnect();
    expect(stopImports).toHaveBeenCalledTimes(1);
    expect(controller.snapshot).toEqual({ state: 'disconnected', message: null });

    await controller.reconnect();
    expect(controller.snapshot).toEqual({ state: 'connected', message: null });

    await controller.delete();
    expect(stopImports).toHaveBeenCalledTimes(2);
    expect(controller.snapshot).toEqual({ state: 'deleted', message: 'Local history was deleted from this device. Original photos and remote copies were not changed.' });
    expect(clearDeletedState).toHaveBeenCalledTimes(1);
    expect(snapshots).toHaveLength(4);
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
});
