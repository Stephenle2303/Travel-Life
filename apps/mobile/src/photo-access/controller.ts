import { ImportCoordinator, createNativeImportRepository, type ImportCoverage, type ImportRepository } from '@/import-record';
import { classifyAppDiagnosticError, createDiagnosticCorrelationId, recordAppDiagnostic } from '@/diagnostics/app-diagnostics';

import type { PermissionSnapshot, PhotoAccessAdapter, PhotoAccessSnapshot } from './types';

const PAGE_SIZE = 100;

export const initialPhotoAccess: PhotoAccessSnapshot = {
  scope: 'unasked',
  countStatus: 'none',
  count: 0,
  selectedCount: null,
  selectedMissingIds: 0,
  canAskAgain: true,
  message: null,
};

export class PhotoAccessController {
  private current = initialPhotoAccess;
  private serial = 0;
  private busy = false;
  private importTransition: Promise<void> = Promise.resolve();
  private previouslyGranted = false;
  private selectedIds: string[] = [];
  private readonly importer: ImportCoordinator;

  constructor(
    private readonly adapter: PhotoAccessAdapter,
    private readonly notify: (snapshot: PhotoAccessSnapshot) => void,
    notifyImport: (coverage: ImportCoverage) => void = () => {},
    private readonly repository: ImportRepository = createNativeImportRepository(),
    private readonly onCompletedLibraryImport: () => Promise<boolean | void> = async () => {},
    /** An activation-triggered maintenance scan can already own the same
     * private SQLite writer when the owner taps Import. Wait for that known
     * in-runtime writer rather than asking SQLite to race it. */
    private readonly waitForMaintenance: () => Promise<void> = async () => {},
  ) {
    this.importer = new ImportCoordinator(adapter, this.repository, notifyImport);
  }

  get snapshot() { return this.current; }
  get isBusy() { return this.busy; }
  /** Lets Atlas wait for an owner-initiated local metadata write before rebuilding. */
  whenImportIdle() { return this.importTransition; }

  private set(patch: Partial<PhotoAccessSnapshot>) {
    this.current = { ...this.current, ...patch };
    this.notify(this.current);
  }

  /** Metadata import and its follow-up Atlas rebuild are separate durable
   * operations. A protected rebuild must not tell the owner their metadata
   * import was lost or leave later Atlas actions waiting on a rejection. */
  private async refreshAtlasAfterCompletedImport(correlationId: string) {
    try {
      const atlasUpdated = await this.onCompletedLibraryImport();
      if (atlasUpdated !== false) recordAppDiagnostic({ operation: 'METADATA_IMPORT', reasonCode: 'ATLAS_UPDATED', stage: null, retryable: false, durableOutcome: 'complete', correlationId });
    } catch (error) {
      recordAppDiagnostic({ operation: 'METADATA_IMPORT', reasonCode: classifyAppDiagnosticError(error), stage: null, retryable: true, durableOutcome: 'unchanged', correlationId });
      this.set({ message: 'Metadata import is complete. Your existing Atlas stays available while its local update is recovered.' });
    }
  }

  /** ImportCoordinator records recoverable lifecycle/database failures as a
   * paused or blocked coverage state rather than rejecting its promise. The
   * controller must replace its optimistic tap acknowledgement in that case. */
  private publishImportRecovery(correlationId: string) {
    const status = this.importer.coverage.status;
    const code = status === 'blocked' ? 'BLOCKED' : 'PAUSED';
    const storageBusy = this.importer.coverage.message === 'Local storage is busy. No metadata page was committed. Retry when ready.';
    recordAppDiagnostic({ operation: 'METADATA_IMPORT', reasonCode: code, stage: null, retryable: true, durableOutcome: status === 'blocked' ? 'blocked' : 'paused', correlationId });
    this.set({
      message: status === 'blocked'
        ? 'Local metadata import is blocked. Recheck access before retrying.'
        : storageBusy
          ? 'Local metadata storage is busy. No metadata page was committed. Retry when ready.'
        : 'Local metadata import is paused. Retry when ready.',
    });
  }

  private applyPermission(permission: PermissionSnapshot | null) {
    const scope = permission?.scope === 'denied' && this.previouslyGranted
      ? 'revoked'
      : permission?.scope ?? 'unavailable';
    if (scope === 'full' || scope === 'limited') this.previouslyGranted = true;
    const changed = scope !== this.current.scope;
    if (changed) this.importer.clearIncompatibleCoverage(scope);
    this.set({
      scope,
      canAskAgain: permission?.canAskAgain ?? false,
      count: changed ? 0 : this.current.count,
      countStatus: changed ? 'none' : this.current.countStatus,
      selectedCount: changed ? null : this.current.selectedCount,
      selectedMissingIds: changed ? 0 : this.current.selectedMissingIds,
      message: null,
    });
    return scope;
  }

  private async canReadPhotoSource() {
    try {
      const lifecycle = await this.repository.getPrivateRecordLifecycle();
      if (lifecycle.state === 'connected') return true;
      this.set({ message: lifecycle.state === 'disconnected'
        ? 'Photo-source reads are disconnected. Reconnect your private record before scanning.'
        : 'No private record is available. Reconnect your private record before scanning.' });
    } catch {
      this.set({ message: 'Private record status could not be read. Retry when ready.' });
    }
    return false;
  }

  async refresh(recountCompleted = false) {
    const token = ++this.serial;
    const wasComplete = this.current.countStatus === 'complete';
    if (this.current.countStatus === 'counting') {
      this.set({ countStatus: 'incomplete', message: 'Counting was interrupted. Retry when ready.' });
    }
    try {
      const permission = await this.adapter.inspect();
      if (token === this.serial) {
        const scope = this.applyPermission(permission);
        if ((scope === 'full' || scope === 'limited') && !this.importer.isRunning) {
          await this.importer.restore(scope);
        }
        if (recountCompleted && wasComplete && (scope === 'full' || scope === 'limited')) {
          this.set({ count: 0, countStatus: 'none' });
          await this.countAccessible();
        }
      }
    } catch {
      if (token === this.serial) this.set({ scope: 'unavailable', count: 0, countStatus: 'none', selectedCount: null, selectedMissingIds: 0, message: 'Photo access is unavailable on this device.' });
    }
  }

  private interruptCounting() {
    ++this.serial;
    if (this.current.countStatus === 'counting') {
      this.set({ countStatus: 'incomplete', message: 'Counting was interrupted. Retry when ready.' });
    }
  }

  interrupt() {
    this.interruptCounting();
    void this.importer.cancel();
  }

  async requestBroad() {
    if (this.busy) return;
    if (!await this.canReadPhotoSource()) return;
    this.busy = true;
    const token = ++this.serial;
    try {
      const current = await this.adapter.inspect();
      if (token !== this.serial) return;
      if (!current) { this.applyPermission(null); return; }
      // Never request again after a denial, or to expand an existing limited grant.
      const permission = current.scope === 'unasked' && current.canAskAgain
        ? await this.adapter.request()
        : current;
      if (token !== this.serial) return;
      const scope = this.applyPermission(permission);
      if (scope === 'full' || scope === 'limited') await this.countAccessible();
    } catch {
      if (token === this.serial) this.set({ scope: 'unavailable', count: 0, countStatus: 'none', selectedCount: null, selectedMissingIds: 0, message: 'Photo access could not be checked.' });
    } finally {
      this.busy = false;
    }
  }

  async countAccessible() {
    if (this.current.countStatus === 'counting') return;
    if (!await this.canReadPhotoSource()) return;
    const token = ++this.serial;
    let count = 0;
    let permission: PermissionSnapshot | null;
    try {
      permission = await this.adapter.inspect();
    } catch {
      if (token === this.serial) this.set({ scope: 'unavailable', count: 0, countStatus: 'none', selectedCount: null, selectedMissingIds: 0, message: 'Photo access could not be checked.' });
      return;
    }
    if (token !== this.serial) return;
    const scope = this.applyPermission(permission);
    if (scope !== 'full' && scope !== 'limited') return;
    try {
      this.set({ count: 0, countStatus: 'counting' });
      while (token === this.serial) {
        const pageCount = await this.adapter.readPage(count, PAGE_SIZE);
        if (token !== this.serial) return;
        count += pageCount;
        this.set({ count });
        if (pageCount < PAGE_SIZE) {
          this.set({ countStatus: 'complete' });
          return;
        }
      }
    } catch {
      if (token !== this.serial) return;
      try {
        const current = await this.adapter.inspect();
        if (token !== this.serial) return;
        const currentScope = this.applyPermission(current);
        if (currentScope !== 'full' && currentScope !== 'limited') return;
        this.set({ count, countStatus: 'incomplete', message: 'Only a partial device-visible count is available. Retry to check again.' });
      } catch {
        if (token === this.serial) this.set({ scope: 'unavailable', count: 0, countStatus: 'none', selectedCount: null, selectedMissingIds: 0, message: 'Photo access could not be checked.' });
      }
    }
  }

  async manageLimited() {
    if (this.busy || this.current.scope !== 'limited' || this.current.countStatus === 'counting') return;
    if (!await this.canReadPhotoSource()) return;
    this.busy = true;
    try {
      const permission = await this.adapter.inspect();
      if (!permission || permission.scope !== 'limited') { this.applyPermission(permission); return; }
      await this.adapter.manageLimited();
      this.applyPermission(await this.adapter.inspect());
      await this.countAccessible();
    } catch {
      try {
        this.applyPermission(await this.adapter.inspect());
        this.set({ message: 'Selection could not be updated. Check device settings or retry.' });
      } catch {
        this.set({ scope: 'unavailable', count: 0, countStatus: 'none', selectedCount: null, selectedMissingIds: 0, message: 'Photo access could not be checked.' });
      }
    } finally {
      this.busy = false;
    }
  }

  async selectPhotos() {
    if (this.busy) return;
    if (!await this.canReadPhotoSource()) return;
    this.busy = true;
    try {
      const result = await this.adapter.select();
      if (result.canceled) return;
      this.set({
        selectedCount: result.count,
        selectedMissingIds: result.missingAssetIds,
        count: 0,
        countStatus: 'none',
        message: null,
      });
      this.selectedIds = result.stableAssetIds;
    } catch {
      this.set({ message: 'Selection was unavailable. You can try again.' });
    } finally {
      this.busy = false;
    }
  }

  async startImport() {
    const scope = this.current.scope;
    if (this.busy || (scope !== 'full' && scope !== 'limited')) return;
    const correlationId = createDiagnosticCorrelationId();
    recordAppDiagnostic({ operation: 'METADATA_IMPORT', reasonCode: 'START', stage: null, retryable: false, durableOutcome: 'unchanged', correlationId });
    // The first repository/lifecycle read can wait behind SQLite. A tap must
    // still receive an immediate visible acknowledgement before that await.
    this.set({ message: 'Starting local metadata import…' });
    const work = (async () => {
      this.busy = true;
      try {
        await this.waitForMaintenance();
        await this.importer.start(scope, this.current.countStatus === 'complete' ? this.current.count : null);
        if (this.importer.coverage.status === 'complete') {
          recordAppDiagnostic({ operation: 'METADATA_IMPORT', reasonCode: 'COMPLETE', stage: null, retryable: false, durableOutcome: 'complete', correlationId });
          await this.refreshAtlasAfterCompletedImport(correlationId);
        } else this.publishImportRecovery(correlationId);
      } catch (error) {
        const code = classifyAppDiagnosticError(error);
        recordAppDiagnostic({ operation: 'METADATA_IMPORT', reasonCode: code, stage: null, retryable: true, durableOutcome: 'failed', correlationId });
        this.set({ message: 'Local metadata import could not be completed. Try again when ready.' });
      } finally {
        this.busy = false;
      }
    })();
    this.importTransition = work;
    await work;
  }

  async importSelected() {
    if (this.busy || this.current.selectedCount === null) return;
    const correlationId = createDiagnosticCorrelationId();
    recordAppDiagnostic({ operation: 'METADATA_IMPORT', reasonCode: 'START', stage: null, retryable: false, durableOutcome: 'unchanged', correlationId });
    this.set({ message: 'Starting selected metadata import…' });
    const work = (async () => {
      this.busy = true;
      try {
        await this.waitForMaintenance();
        await this.importer.importSelected(this.selectedIds, this.current.selectedMissingIds);
        if (this.importer.coverage.status === 'complete') {
          recordAppDiagnostic({ operation: 'METADATA_IMPORT', reasonCode: 'COMPLETE', stage: null, retryable: false, durableOutcome: 'complete', correlationId });
          await this.refreshAtlasAfterCompletedImport(correlationId);
        } else this.publishImportRecovery(correlationId);
      } catch (error) {
        recordAppDiagnostic({ operation: 'METADATA_IMPORT', reasonCode: classifyAppDiagnosticError(error), stage: null, retryable: true, durableOutcome: 'failed', correlationId });
        this.set({ message: 'Selected metadata import could not be completed. Try again when ready.' });
      } finally {
        this.busy = false;
      }
    })();
    this.importTransition = work;
    await work;
  }

  async stopImport() {
    this.interruptCounting();
    await this.importer.cancel();
  }

  clearDeletedRecord() {
    this.interruptCounting();
    this.selectedIds = [];
    this.set({ count: 0, countStatus: 'none', selectedCount: null, selectedMissingIds: 0, message: null });
    this.importer.clear();
  }

  cancelImport() { void this.importer.cancel(); }
}
