import type { HistoryRecordRepository, LifecycleSnapshot } from './types';

const initialLifecycle: LifecycleSnapshot = { state: 'deleted', message: null, pendingAction: null };

/** Coordinates owner lifecycle choices with an import coordinator's write barrier. */
export class HistoryRecordController {
  private current = initialLifecycle;

  constructor(
    private readonly repository: HistoryRecordRepository,
    private readonly stopImports: () => Promise<void>,
    private readonly notify: (snapshot: LifecycleSnapshot) => void,
    private readonly clearDeletedState: () => void = () => {},
    private readonly prepareRemoteRemoval?: () => Promise<'complete' | 'pending'>,
  ) {}

  private lifecycleChangePending = false;
  private lifecycleGeneration = 0;

  get snapshot() { return this.current; }

  private set(snapshot: LifecycleSnapshot) {
    this.current = snapshot;
    this.notify(snapshot);
  }

  async refresh() {
    const generation = this.lifecycleGeneration;
    try {
      const lifecycle = await this.repository.getPrivateRecordLifecycle();
      if (generation !== this.lifecycleGeneration) return;
      this.set({ ...lifecycle, message: null, pendingAction: null });
    } catch {
      if (generation !== this.lifecycleGeneration) return;
      this.set({ ...this.current, message: 'Private record status could not be read. Retry when ready.' });
    }
  }

  async reconnect(): Promise<boolean> {
    if (this.lifecycleChangePending) return false;
    this.lifecycleChangePending = true;
    this.lifecycleGeneration += 1;
    this.set({ ...this.current, message: null, pendingAction: 'reconnect' });
    try {
      await this.repository.connectPrivateRecord();
      this.set({ state: 'connected', message: null, pendingAction: null });
      return true;
    } catch {
      this.set({ ...this.current, message: 'The private record could not be opened. Retry when ready.', pendingAction: null });
      return false;
    } finally {
      this.lifecycleChangePending = false;
    }
  }

  async disconnect() {
    if (this.lifecycleChangePending) return;
    this.lifecycleChangePending = true;
    this.lifecycleGeneration += 1;
    this.set({ ...this.current, message: null, pendingAction: 'disconnect' });
    try {
      await this.stopImports();
      await this.repository.disconnectPrivateRecord();
      this.set({ state: 'disconnected', message: null, pendingAction: null });
    } catch {
      this.set({ ...this.current, message: 'The photo source could not be disconnected. Your local record was kept; retry when ready.', pendingAction: null });
    } finally {
      this.lifecycleChangePending = false;
    }
  }

  async delete() {
    if (this.lifecycleChangePending) return;
    this.lifecycleChangePending = true;
    this.lifecycleGeneration += 1;
    this.set({ ...this.current, message: null, pendingAction: 'delete' });
    try {
      await this.stopImports();
      const removal = await this.prepareRemoteRemoval?.();
      await this.repository.deleteLocalHistory();
      this.clearDeletedState();
      this.set({ state: 'deleted', message: removal === 'pending' ? 'Local history was deleted. Remote removal is pending; protected owner credentials are retained for retry. Original photos were not changed.' : removal === 'complete' ? 'Local history was deleted. Remote link access removal is confirmed. Original photos and saved recipient copies were not changed.' : 'Local history was deleted from this device. Original photos and remote copies were not changed.', pendingAction: null });
    } catch {
      this.set({ ...this.current, message: 'Local history could not be deleted. Nothing was reported as removed; retry when ready.', pendingAction: null });
    } finally {
      this.lifecycleChangePending = false;
    }
  }
}
