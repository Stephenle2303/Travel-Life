import type { HistoryRecordRepository, LifecycleSnapshot } from './types';

const initialLifecycle: LifecycleSnapshot = { state: 'deleted', message: null };

/** Coordinates owner lifecycle choices with an import coordinator's write barrier. */
export class HistoryRecordController {
  private current = initialLifecycle;

  constructor(
    private readonly repository: HistoryRecordRepository,
    private readonly stopImports: () => Promise<void>,
    private readonly notify: (snapshot: LifecycleSnapshot) => void,
    private readonly clearDeletedState: () => void = () => {},
  ) {}

  private lifecycleChangePending = false;

  get snapshot() { return this.current; }

  private set(snapshot: LifecycleSnapshot) {
    this.current = snapshot;
    this.notify(snapshot);
  }

  async refresh() {
    try {
      this.set({ ...(await this.repository.getPrivateRecordLifecycle()), message: null });
    } catch {
      this.set({ ...this.current, message: 'Private record status could not be read. Retry when ready.' });
    }
  }

  async reconnect() {
    if (this.lifecycleChangePending) return;
    this.lifecycleChangePending = true;
    try {
      await this.repository.connectPrivateRecord();
      this.set({ state: 'connected', message: null });
    } catch {
      this.set({ ...this.current, message: 'The private record could not be reconnected. Retry when ready.' });
    } finally {
      this.lifecycleChangePending = false;
    }
  }

  async disconnect() {
    if (this.lifecycleChangePending) return;
    this.lifecycleChangePending = true;
    try {
      await this.stopImports();
      await this.repository.disconnectPrivateRecord();
      this.set({ state: 'disconnected', message: null });
    } catch {
      this.set({ ...this.current, message: 'The photo source could not be disconnected. Your local record was kept; retry when ready.' });
    } finally {
      this.lifecycleChangePending = false;
    }
  }

  async delete() {
    if (this.lifecycleChangePending) return;
    this.lifecycleChangePending = true;
    try {
      await this.stopImports();
      await this.repository.deleteLocalHistory();
      this.clearDeletedState();
      this.set({ state: 'deleted', message: 'Local history was deleted from this device. Original photos and remote copies were not changed.' });
    } catch {
      this.set({ ...this.current, message: 'Local history could not be deleted. Nothing was reported as removed; retry when ready.' });
    } finally {
      this.lifecycleChangePending = false;
    }
  }
}
