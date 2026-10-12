import type { MaintenanceRepository } from '@/import-record/types';
import type { PhotoAccessAdapter } from '@/photo-access/types';
import { reconcilePermittedLibrary } from './reconcile-runner';
import type { MaintenanceView, SchedulerAdapter } from './types';

const initial: MaintenanceView = { enabled: false, status: 'disabled', lastCheckedAtMillis: null, lastUpdatedAtMillis: null, message: null, checkpoint: null };

export class MaintenanceController {
  private current = initial;
  private transition: Promise<void> = Promise.resolve();
  constructor(private readonly repository: MaintenanceRepository, private readonly photoAccess: PhotoAccessAdapter, private readonly scheduler: SchedulerAdapter, private readonly notify: (view: MaintenanceView) => void, private readonly now = () => Date.now(), private readonly reconcileHistory: () => Promise<void> = async () => {}) {}
  get snapshot() { return this.current; }
  private set(next: MaintenanceView) { this.current = next; this.notify(next); }
  private enqueue(work: () => Promise<void>) {
    const next = this.transition.then(work).catch(() => {
      this.set({ ...this.current, status: 'error', message: 'Automatic maintenance status could not be updated. Retry when ready.' });
    });
    this.transition = next;
    return next;
  }
  refresh() { return this.enqueue(() => this.refreshNow()); }
  private async refreshNow() {
    const permission = await this.photoAccess.inspect();
    if (permission?.scope !== 'full' && permission?.scope !== 'limited') {
      this.set({ ...initial, status: 'restricted', message: 'Automatic maintenance is unavailable until photo access is permitted.' });
      return;
    }
    const state = await this.repository.loadMaintenance();
    this.set({ ...state, checkpoint: await this.repository.getMaintenanceCheckpoint() });
  }
  setEnabled(enabled: boolean) { return this.enqueue(() => this.setEnabledNow(enabled)); }
  private async setEnabledNow(enabled: boolean) {
    if (!enabled) {
      await this.scheduler.unregister();
      const next = { ...this.current, enabled: false, status: 'disabled' as const, message: null };
      await this.repository.saveMaintenance(next);
      this.set({ ...next, checkpoint: this.current.checkpoint });
      return;
    }
    const lifecycle = await this.repository.getPrivateRecordLifecycle();
    const permission = await this.photoAccess.inspect();
    const coverage = permission?.scope === 'full' || permission?.scope === 'limited' ? await this.repository.loadCoverage(permission.scope) : null;
    if (lifecycle.state !== 'connected' || !coverage || coverage.status !== 'complete' || !await this.scheduler.isAvailable()) {
      const next = { ...this.current, enabled: false, status: 'restricted' as const, message: 'Automatic maintenance needs a completed import, connected record, permitted photo access, and supported device scheduling.' };
      await this.repository.saveMaintenance(next);
      this.set({ ...next, checkpoint: this.current.checkpoint });
      return;
    }
    try {
      await this.scheduler.register();
      const next = { ...this.current, enabled: true, status: 'pending' as const, message: 'Automatic maintenance is on. Your device chooses when to run it.' };
      await this.repository.saveMaintenance(next);
      this.set({ ...next, checkpoint: this.current.checkpoint });
    } catch {
      const next = { ...this.current, enabled: false, status: 'restricted' as const, message: 'Automatic maintenance could not be scheduled. Retry when ready.' };
      await this.repository.saveMaintenance(next);
      this.set({ ...next, checkpoint: this.current.checkpoint });
    }
  }
  catchUp() { return this.enqueue(() => this.catchUpNow()); }
  private async catchUpNow() {
    if (!this.current.enabled) return;
    this.set({ ...this.current, status: 'running', message: 'Checking currently permitted library changes locally.' });
    const result = await reconcilePermittedLibrary({ repository: this.repository, photoAccess: this.photoAccess, now: this.now });
    if (result === 'complete') await this.reconcileHistory();
    await this.refreshNow();
    if (result === 'restricted') this.set({ ...this.current, status: 'restricted', message: 'Photo access is limited or unavailable. No absent items were treated as deleted.' });
  }
  /** Owner-invoked scan: it never changes the scheduling preference. */
  rescan() { return this.enqueue(() => this.rescanNow()); }
  private async rescanNow() {
    this.set({ ...this.current, status: 'running', message: 'Checking currently permitted library changes locally.' });
    const result = await reconcilePermittedLibrary({ repository: this.repository, photoAccess: this.photoAccess, now: this.now, allowDisabled: true });
    if (result === 'complete') await this.reconcileHistory();
    await this.refreshNow();
    if (result === 'restricted') this.set({ ...this.current, status: 'restricted', message: 'Photo access is limited or unavailable. No absent items were treated as deleted.' });
  }
  stopForLifecycle() { return this.enqueue(async () => { await this.scheduler.unregister(); await this.setEnabledNow(false); }); }
}
