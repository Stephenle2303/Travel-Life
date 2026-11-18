import type { MaintenanceRepository } from '@/import-record/types';
import type { PhotoAccessAdapter } from '@/photo-access/types';
import { hasLibraryProcessingAuthority, MaintenanceSourceError, reconcilePermittedLibrary } from './reconcile-runner';
import type { MaintenanceView, SchedulerAdapter } from './types';
import { classifyAppDiagnosticError, createDiagnosticCorrelationId, recordAppDiagnostic } from '@/diagnostics/app-diagnostics';

const initial: MaintenanceView = { enabled: false, status: 'disabled', lastCheckedAtMillis: null, lastUpdatedAtMillis: null, message: null, checkpoint: null };

export class MaintenanceController {
  private current = initial;
  private transition: Promise<void> = Promise.resolve();
  constructor(private readonly repository: MaintenanceRepository, private readonly photoAccess: PhotoAccessAdapter, private readonly scheduler: SchedulerAdapter, private readonly notify: (view: MaintenanceView) => void, private readonly now = () => Date.now(), private readonly reconcileHistory: () => Promise<void> = async () => {}) {}
  get snapshot() { return this.current; }
  private set(next: MaintenanceView) { this.current = next; this.notify(next); }
  private enqueue(work: () => Promise<void>) {
    const next = this.transition.then(work).catch((error) => {
      recordAppDiagnostic({ operation: error instanceof MaintenanceSourceError ? 'ONBOARDING_UPDATES' : 'MAINTENANCE_RECONCILIATION', reasonCode: classifyAppDiagnosticError(error), stage: error instanceof MaintenanceSourceError ? 'UPDATE_SOURCE' : null, retryable: true, durableOutcome: 'failed', correlationId: createDiagnosticCorrelationId() });
      this.set({ ...this.current, status: 'error', message: 'Automatic maintenance status could not be updated. Retry when ready.' });
    });
    this.transition = next;
    return next;
  }
  /** Lets a foreground owner action wait for an already queued local maintenance write. */
  whenIdle() { return this.transition; }
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
    const correlationId = createDiagnosticCorrelationId();
    let stage: 'UPDATE_PREFERENCE' | 'UPDATE_SCHEDULE' | 'UPDATE_SOURCE' | 'UPDATE_ACCESS' | 'UPDATE_COVERAGE' = 'UPDATE_PREFERENCE';
    recordAppDiagnostic({ operation: 'ONBOARDING_UPDATES', stage, reasonCode: 'START', retryable: false, durableOutcome: 'unchanged', correlationId });
    try {
      if (enabled) {
        stage = 'UPDATE_SOURCE';
        if (!await hasLibraryProcessingAuthority(this.repository)) {
          this.set({ ...this.current, status: 'restricted', message: 'Only your selected photos are connected. Choose library access before checking for new photos.' });
          recordAppDiagnostic({ operation: 'ONBOARDING_UPDATES', stage, reasonCode: 'RESTRICTED', retryable: false, durableOutcome: 'restricted', correlationId });
          return;
        }
      }
      stage = 'UPDATE_PREFERENCE';
      // Preference is independent of scheduler availability. Persist it first so
      // a disabled worker stays disabled even if native unregister cannot ack.
      const preference = { ...this.current, enabled, status: enabled ? 'restricted' as const : 'disabled' as const, message: null };
      await this.repository.saveMaintenance(preference);
      this.set(preference);
      if (!enabled) {
        stage = 'UPDATE_SCHEDULE';
        await this.scheduler.unregister();
        recordAppDiagnostic({ operation: 'ONBOARDING_UPDATES', stage, reasonCode: 'COMPLETE', retryable: false, durableOutcome: 'complete', correlationId });
        return;
      }
      stage = 'UPDATE_SOURCE';
      const lifecycle = await this.repository.getPrivateRecordLifecycle();
      stage = 'UPDATE_ACCESS';
      const permission = await this.photoAccess.inspect();
      stage = 'UPDATE_COVERAGE';
      const coverage = permission?.scope === 'full' || permission?.scope === 'limited' ? await this.repository.loadCoverage(permission.scope) : null;
      stage = 'UPDATE_SCHEDULE';
      if (lifecycle.state !== 'connected' || !coverage || coverage.status !== 'complete' || !await this.scheduler.isAvailable()) {
        const next = { ...this.current, status: 'restricted' as const, message: 'Updates are limited by your device. Your preference is saved; a completed library import and current access are required.' };
        await this.repository.saveMaintenance(next); this.set(next);
        recordAppDiagnostic({ operation: 'ONBOARDING_UPDATES', stage, reasonCode: 'RESTRICTED', retryable: false, durableOutcome: 'restricted', correlationId });
        return;
      }
      await this.scheduler.register();
      stage = 'UPDATE_PREFERENCE';
      const next = { ...this.current, enabled: true, status: 'pending' as const, message: 'Automatic maintenance is on. Your device chooses when to run it.' };
      await this.repository.saveMaintenance(next); this.set(next);
      recordAppDiagnostic({ operation: 'ONBOARDING_UPDATES', stage, reasonCode: 'COMPLETE', retryable: false, durableOutcome: 'complete', correlationId });
    } catch (error) {
      recordAppDiagnostic({ operation: 'ONBOARDING_UPDATES', stage, reasonCode: classifyAppDiagnosticError(error), retryable: true, durableOutcome: stage === 'UPDATE_PREFERENCE' ? 'unknown' : 'restricted', correlationId });
      this.set({ ...this.current, status: 'restricted', message: stage === 'UPDATE_PREFERENCE' ? 'Checking your saved update preference. Try again.' : 'Updates are limited by your device. Retry scheduling in Settings.' });
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
    if (!await hasLibraryProcessingAuthority(this.repository)) {
      this.set({ ...this.current, status: 'restricted', message: 'Only your selected photos are connected. Choose library access before checking for new photos.' });
      recordAppDiagnostic({ operation: 'ONBOARDING_UPDATES', stage: 'UPDATE_SOURCE', reasonCode: 'RESTRICTED', retryable: false, durableOutcome: 'restricted', correlationId: createDiagnosticCorrelationId() });
      return;
    }
    this.set({ ...this.current, status: 'running', message: 'Checking currently permitted library changes locally.' });
    const result = await reconcilePermittedLibrary({ repository: this.repository, photoAccess: this.photoAccess, now: this.now, allowDisabled: true });
    if (result === 'complete') await this.reconcileHistory();
    await this.refreshNow();
    if (result === 'restricted') this.set({ ...this.current, status: 'restricted', message: 'Photo access is limited or unavailable. No absent items were treated as deleted.' });
  }
  stopForLifecycle() { return this.enqueue(() => this.setEnabledNow(false)); }
}
