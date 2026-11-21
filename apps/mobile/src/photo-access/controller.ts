import { ImportCoordinator, createNativeImportRepository, type ImportCoverage, type ImportRepository } from '@/import-record';
import { classifyAppDiagnosticError, createDiagnosticCorrelationId, recordAppDiagnostic } from '@/diagnostics/app-diagnostics';

import type { PermissionSnapshot, PhotoAccessAdapter, PhotoAccessSnapshot } from './types';
import { HomeSetupConflictError, ImportLifecycleBlockedError, type ConfiguredHomeArea, type PreparationIntent } from '@/import-record/types';
import { PresentationPersistenceError, readPresentation, savePresentation } from '@/onboarding/presentation';
import { isRecognizableRevealEnabled } from '@/navigation/app-contract';

const PAGE_SIZE = 100;

export class PreparationAccessError extends Error {
  readonly stage = 'RUN_ACCESS_INSPECT' as const;
  constructor(readonly originalError: unknown) { super('Preparation access check failed.'); }
}

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
  private intent: PreparationIntent | null = null;
  private firstRevealIntentId: string | null = null;
  private runGeneration = 0;
  private choosing = false;
  private foreground = true;
  private pausing = false;
  private sourceSuspended = false;
  private lifecyclePending = false;
  private pendingPause: PreparationIntent | null = null;
  preparation: 'idle' | 'queued' | 'importing' | 'building' | 'publishing' | 'complete' | 'paused' | 'blocked' | 'checking' | 'failed' = 'idle';

  constructor(
    private readonly adapter: PhotoAccessAdapter,
    private readonly notify: (snapshot: PhotoAccessSnapshot) => void,
    notifyImport: (coverage: ImportCoverage) => void = () => {},
    private readonly repository: ImportRepository = createNativeImportRepository(),
    private readonly onCompletedLibraryImport: (correlationId?: string, readOnly?: boolean, publishing?: () => Promise<void>, canPublish?: () => Promise<boolean>) => Promise<boolean | void> = async () => {},
    /** An activation-triggered maintenance scan can already own the same
     * private SQLite writer when the owner taps Import. Wait for that known
     * in-runtime writer rather than asking SQLite to race it. */
    private readonly waitForMaintenance: () => Promise<void> = async () => {},
  ) {
    this.importer = new ImportCoordinator(adapter, this.repository, notifyImport);
  }

  get snapshot() { return this.current; }
  get isBusy() { return this.busy; }
  get isAccountRecord() { return Boolean(this.adapter.accountAuthorized); }
  get preparationScope() { return this.intent?.scope ?? null; }
  get hasFirstRecognizableReveal() {
    return this.firstRevealIntentId !== null && this.intent?.id === this.firstRevealIntentId && this.preparation === 'complete';
  }
  dismissFirstRecognizableReveal() { this.firstRevealIntentId = null; }
  setLifecyclePending(pending: boolean) {
    this.lifecyclePending = pending;
    if (pending) {
      this.sourceSuspended = true;
      this.dismissFirstRecognizableReveal();
    }
  }
  /** Lets Atlas wait for an owner-initiated local metadata write before rebuilding. */
  whenImportIdle() { return this.importTransition; }

  /** No learned Home exists (decision 0021, H-4): required whenever the owner has not
   * configured a single real Home area, regardless of a stale pre-H-4 "skipped" receipt. */
  async requiresHomeSetup(entry?: Awaited<ReturnType<PhotoAccessController['resolveEntry']>>, correlationId = createDiagnosticCorrelationId()) {
    if (!this.repository.loadHomeSetup || this.isAccountRecord) return false;
    if ((entry ?? await this.resolveEntry(correlationId)) === 'atlas') return false;
    try { return await this.hasNoConfiguredHomeArea(); }
    catch (error) {
      recordAppDiagnostic({ operation: 'ONBOARDING_ENTRY', stage: 'HOME_SETUP_READ', reasonCode: classifyAppDiagnosticError(error), retryable: true, durableOutcome: 'unchanged', correlationId });
      throw new Error("Couldn't check your Home setup.");
    }
  }

  private async hasNoConfiguredHomeArea() {
    if (this.repository.loadConfiguredHomeAreas) return (await this.repository.loadConfiguredHomeAreas()).length === 0;
    return (await this.repository.loadHomeSetup!()) === null;
  }

  async saveInitialHomes(command: string, areas: readonly ConfiguredHomeArea[]) {
    const correlationId = createDiagnosticCorrelationId();
    const operation = 'ONBOARDING_SETUP';
    if (this.isAccountRecord || this.lifecyclePending || !this.repository.saveHomeSetup) {
      recordAppDiagnostic({ operation, stage: 'HOME_SCOPE', reasonCode: 'LIFECYCLE', retryable: false, durableOutcome: 'blocked', correlationId });
      throw new Error("Home setup isn't available in this history.");
    }
    recordAppDiagnostic({ operation, stage: 'HOME_COMMAND_COMMIT', reasonCode: 'START', retryable: false, durableOutcome: 'unchanged', correlationId });
    try {
      await this.repository.saveHomeSetup(command, areas);
      recordAppDiagnostic({ operation, stage: 'HOME_COMMAND_READBACK', reasonCode: 'COMPLETE', retryable: false, durableOutcome: 'complete', correlationId });
    } catch (error) {
      const reasonCode = error instanceof HomeSetupConflictError ? 'HISTORY_CONFLICT' : error instanceof ImportLifecycleBlockedError ? 'LIFECYCLE' : classifyAppDiagnosticError(error);
      const blocked = reasonCode === 'LIFECYCLE' || reasonCode === 'HISTORY_CONFLICT';
      recordAppDiagnostic({ operation, stage: 'HOME_COMMAND_COMMIT', reasonCode, retryable: !blocked, durableOutcome: blocked ? 'blocked' : 'unknown', correlationId });
      throw new Error("Couldn't verify your Home setup.");
    }
  }

  async resolveEntry(correlationId = createDiagnosticCorrelationId()): Promise<'welcome' | 'access' | 'atlas'> {
    try {
      const marker = await readPresentation();
      const lifecycle = await this.repository.getPrivateRecordLifecycle();
      const checkpoints = await Promise.all((['full', 'limited', 'selected'] as const).map((scope) => this.repository.getCheckpoint(scope)));
      const intent = await this.repository.loadPreparationIntent?.();
      const established = await this.repository.hasEstablishedHistory?.();
      if (marker?.disposition === 'atlas' || this.isAccountRecord || established || intent || checkpoints.some(Boolean) || lifecycle.state !== 'connected') {
        if (!this.isAccountRecord && this.repository.loadHomeSetup && await this.hasNoConfiguredHomeArea()) return 'access';
        await savePresentation('atlas', undefined, correlationId);
        return 'atlas';
      }
      return marker?.disposition === 'started' ? 'access' : 'welcome';
    } catch (error) {
      if (!(error instanceof PresentationPersistenceError)) recordAppDiagnostic({ operation: 'ONBOARDING_ENTRY', stage: 'ENTRY_READ', reasonCode: classifyAppDiagnosticError(error), retryable: true, durableOutcome: 'unknown', correlationId });
      throw new Error("Couldn't open your Atlas.");
    }
  }

  private preparationState(state: PhotoAccessController['preparation'], message: string | null = null) {
    this.preparation = state;
    this.set({ message });
  }

  private async persistIntent(intent: PreparationIntent) {
    if (!this.repository.savePreparationIntent || !this.repository.loadPreparationIntent) throw new Error('Private record intent storage is unavailable.');
    try { await this.repository.savePreparationIntent(intent); }
    catch (error) {
      // A rejected native acknowledgement may follow a committed write.
      const durable = await this.repository.loadPreparationIntent();
      if (JSON.stringify(durable) !== JSON.stringify(intent)) throw error;
    }
    this.intent = intent;
  }

  /** Saves source authority before admitting route-independent work. */
  async choosePhotos(mode: 'library' | 'selected'): Promise<boolean> {
    if (this.choosing || this.busy || this.isAccountRecord || this.lifecyclePending) return false;
    this.choosing = true;
    this.busy = true;
    const token = this.runGeneration;
    const correlationId = createDiagnosticCorrelationId();
    let stage: 'RUN_ADMISSION' | 'ACCESS_INSPECT' | 'ACCESS_REQUEST' | 'PICKER_SELECT' | 'INTENT_SAVE' = 'RUN_ADMISSION';
    let admitted = false;
    const enter = (next: typeof stage) => {
      recordAppDiagnostic({ operation: 'ONBOARDING_SETUP', stage: next, reasonCode: 'START', retryable: false, durableOutcome: 'unchanged', correlationId });
      return next;
    };
    this.preparationState('queued', 'Choosing photos…');
    try {
      stage = enter('RUN_ADMISSION');
      const entry = mode === 'library' && isRecognizableRevealEnabled() ? await this.resolveEntry(correlationId) : undefined;
      if (await this.requiresHomeSetup(entry, correlationId)) {
        this.preparationState('idle', 'Choose Home bases or skip before selecting photos.');
        return false;
      }
      if (!await this.canReadPhotoSource(correlationId, 'ONBOARDING_SETUP')) { this.preparationState('blocked', this.current.message); return false; }
      if (token !== this.runGeneration || this.lifecyclePending) return false;
      this.sourceSuspended = false;
      let scope: PreparationIntent['scope'];
      let selectedIds: string[] = [];
      let missingIds = 0;
      if (mode === 'selected') {
        stage = enter('PICKER_SELECT');
        const selected = await this.adapter.select();
        if (token !== this.runGeneration) return false;
        if (selected.canceled || selected.count === 0) {
          recordAppDiagnostic({ operation: 'ONBOARDING_SETUP', stage, reasonCode: 'SKIPPED', retryable: false, durableOutcome: 'skipped', correlationId });
          this.preparationState('idle'); return false;
        }
        scope = 'selected'; selectedIds = [...new Set(selected.stableAssetIds)]; missingIds = selected.missingAssetIds;
        this.set({ selectedCount: selected.count, selectedMissingIds: missingIds });
      } else {
        stage = enter('ACCESS_INSPECT');
        let permission = await this.adapter.inspect();
        if (token !== this.runGeneration) return false;
        if (permission?.scope === 'unasked' && permission.canAskAgain) { stage = enter('ACCESS_REQUEST'); permission = await this.adapter.request(); }
        if (token !== this.runGeneration) return false;
        const granted = this.applyPermission(permission);
        if (granted !== 'full' && granted !== 'limited') {
          recordAppDiagnostic({ operation: 'ONBOARDING_SETUP', stage, reasonCode: 'RESTRICTED', retryable: false, durableOutcome: 'restricted', correlationId });
          this.preparationState('blocked', permission ? 'Photo access is off.' : "Photo access isn't available here."); return false;
        }
        scope = granted;
      }
      if (token !== this.runGeneration) return false;
      stage = enter('INTENT_SAVE');
      const intent: PreparationIntent = { version: 1, id: createDiagnosticCorrelationId(), scope, selectedIds, missingIds, phase: 'queued' };
      this.pendingPause = null;
      await this.persistIntent(intent);
      if (token !== this.runGeneration) return false;
      await savePresentation('atlas', undefined, correlationId);
      if (token !== this.runGeneration || this.lifecyclePending) return false;
      this.firstRevealIntentId = entry && entry !== 'atlas' && scope === 'full' ? intent.id : null;
      recordAppDiagnostic({ operation: 'ONBOARDING_SETUP', stage, reasonCode: 'COMPLETE', retryable: false, durableOutcome: 'complete', correlationId });
      this.busy = false;
      this.launchPreparation(correlationId);
      admitted = true;
      return true;
    } catch (error) {
      if (!(error instanceof PresentationPersistenceError)) recordAppDiagnostic({ operation: 'ONBOARDING_SETUP', stage, reasonCode: classifyAppDiagnosticError(error), retryable: true, durableOutcome: stage === 'INTENT_SAVE' ? 'unknown' : 'unchanged', correlationId });
      this.preparationState(stage === 'INTENT_SAVE' ? 'checking' : 'failed', "Couldn't start your Atlas. Try again.");
      return false;
    } finally { this.choosing = false; if (!admitted) this.busy = false; }
  }

  private launchPreparation(correlationId: string) {
    if (this.busy || !this.intent || this.isAccountRecord || !this.foreground || this.sourceSuspended) return;
    this.busy = true;
    const intent = this.intent;
    const token = this.runGeneration;
    const current = () => token === this.runGeneration && this.foreground && !this.sourceSuspended;
    this.preparationState('queued', 'Finding your journeys…');
    const work = (async () => {
      let stage: 'RUN_ADMISSION' | 'RUN_WAIT' | 'RUN_CHECKPOINT' | 'RUN_RECONCILE' | 'RUN_ACCESS_INSPECT' = 'RUN_ADMISSION';
      try {
        if (!await this.canReadPhotoSource(correlationId) || !current()) return;
        stage = 'RUN_WAIT';
        recordAppDiagnostic({ operation: 'ONBOARDING_RUN', stage, reasonCode: 'START', retryable: false, durableOutcome: 'unchanged', correlationId });
        await this.waitForMaintenance();
        if (!current()) return;
        if (intent.scope !== 'selected') {
          stage = 'RUN_ACCESS_INSPECT';
          const permission = await this.adapter.inspect();
          if (!current()) return;
          if (permission?.scope !== intent.scope) {
            stage = 'RUN_CHECKPOINT'; await this.persistIntent({ ...intent, phase: 'blocked' });
            recordAppDiagnostic({ operation: 'ONBOARDING_RUN', stage: 'RUN_ADMISSION', reasonCode: 'RESTRICTED', retryable: false, durableOutcome: 'blocked', correlationId });
            this.preparationState('blocked', 'Photo access changed. Choose what to use next.'); return;
          }
        }
        if (!['imported', 'publishing'].includes(intent.phase)) {
          this.preparationState('importing');
          if (intent.scope === 'selected') await this.importer.importSelected(intent.selectedIds, intent.missingIds, correlationId);
          else await this.importer.start(intent.scope, null, correlationId);
          if (!current()) return;
          if (this.importer.coverage.status !== 'complete') {
            this.preparationState(this.importer.hasUnresolvedCommit ? 'checking' : this.importer.coverage.status === 'blocked' ? 'blocked' : 'failed', this.importer.hasUnresolvedCommit ? 'Checking your saved progress…' : "Couldn't finish your Atlas. Your saved history is kept.");
            return;
          }
          stage = 'RUN_CHECKPOINT'; await this.persistIntent({ ...intent, phase: 'imported' });
        }
        if (!current() || !await this.canReadPhotoSource(correlationId)) return;
        stage = 'RUN_RECONCILE';
        this.preparationState(this.intent?.phase === 'publishing' ? 'publishing' : 'building');
        const updated = await this.onCompletedLibraryImport(correlationId, this.intent?.phase === 'publishing', async () => {
          if (!current()) throw new Error('Private record changed.');
          this.preparationState('publishing');
          await this.persistIntent({ ...intent, phase: 'publishing' });
        }, async () => {
          if (!current() || !await this.canReadPhotoSource(correlationId)) return false;
          stage = 'RUN_ACCESS_INSPECT';
          try {
            if (intent.scope !== 'selected' && (await this.adapter.inspect())?.scope !== intent.scope) return false;
          } catch (error) { throw new PreparationAccessError(error); }
          return current();
        });
        if (!current()) return;
        if (updated === false) { this.preparationState('failed', "Couldn't finish your Atlas. Your saved history is kept."); return; }
        stage = 'RUN_CHECKPOINT'; await this.persistIntent({ ...intent, phase: 'complete' });
        if (current()) this.preparationState('complete');
        recordAppDiagnostic({ operation: 'ONBOARDING_RUN', stage, reasonCode: 'COMPLETE', retryable: false, durableOutcome: 'complete', correlationId });
      } catch (error) {
        if (!current()) return;
        recordAppDiagnostic({ operation: 'ONBOARDING_RUN', stage, reasonCode: classifyAppDiagnosticError(error), retryable: true, durableOutcome: 'unknown', correlationId });
        this.preparationState('checking', 'Checking your saved progress…');
      } finally {
        this.busy = false;
        if (token !== this.runGeneration && this.foreground && !this.pausing && !this.sourceSuspended) void this.resumePreparation();
      }
    })();
    this.importTransition = work;
  }

  async resumePreparation(explicit = false) {
    this.foreground = true;
    if (this.lifecyclePending) return;
    if (this.sourceSuspended && !explicit) return;
    if (this.busy || this.choosing || this.isAccountRecord || !this.repository.loadPreparationIntent) return;
    this.busy = true;
    const correlationId = createDiagnosticCorrelationId();
    const token = this.runGeneration;
    let launched = false;
    let stage: 'INTENT_READ' | 'RUN_CHECKPOINT' = 'INTENT_READ';
    try {
      let intent = await this.repository.loadPreparationIntent();
      if (token !== this.runGeneration) return;
      if (!intent) { this.intent = null; this.pendingPause = null; this.preparationState('idle'); return; }
      this.intent = intent;
      if (this.pendingPause) {
        const pending = this.pendingPause;
        if (pending.id === intent.id) {
          stage = 'RUN_CHECKPOINT';
          if (JSON.stringify(pending) !== JSON.stringify(intent)) await this.persistIntent(pending);
          this.pendingPause = null;
          this.preparationState('paused');
          return;
        }
        this.pendingPause = null;
      }
      if (intent.phase === 'complete') { this.preparationState('complete'); return; }
      if (intent.phase === 'paused' && !explicit) { this.preparationState('paused'); return; }
      if (intent.phase === 'blocked' && !explicit) { this.preparationState('blocked'); return; }
      if (explicit && this.sourceSuspended) {
        if (!await this.canReadPhotoSource(correlationId) || token !== this.runGeneration) return;
        this.sourceSuspended = false;
      }
      if (intent.phase === 'paused') {
        intent = { ...intent, phase: intent.resumePhase ?? 'queued' };
        stage = 'RUN_CHECKPOINT';
        await this.persistIntent(intent);
        if (token !== this.runGeneration) return;
      }
      this.intent = intent;
      if (intent.scope === 'selected' && intent.selectedIds.length === 0 && !['imported', 'publishing'].includes(intent.phase)) {
        this.preparationState('blocked', 'Choose photos again to continue.'); return;
      }
      this.busy = false;
      this.launchPreparation(correlationId);
      launched = true;
    } catch (error) {
      recordAppDiagnostic({ operation: 'ONBOARDING_RUN', stage, reasonCode: classifyAppDiagnosticError(error), retryable: true, durableOutcome: 'unknown', correlationId });
      this.preparationState('checking', 'Checking your saved progress…');
    } finally { if (!launched) this.busy = false; }
  }

  async pausePreparation() {
    if (!this.intent) return;
    this.pausing = true;
    ++this.runGeneration;
    const correlationId = createDiagnosticCorrelationId();
    try {
      const resumePhase = this.intent.phase === 'publishing' || this.intent.phase === 'imported' ? this.intent.phase : this.intent.resumePhase ?? 'queued';
      this.pendingPause = { ...this.intent, phase: 'paused', resumePhase };
      await this.persistIntent(this.pendingPause);
      this.pendingPause = null;
      await this.importer.cancel();
      this.preparationState('paused');
      recordAppDiagnostic({ operation: 'ONBOARDING_RUN', stage: 'RUN_CHECKPOINT', reasonCode: 'PAUSED', retryable: false, durableOutcome: 'paused', correlationId });
    } catch (error) {
      await this.importer.cancel();
      recordAppDiagnostic({ operation: 'ONBOARDING_RUN', stage: 'RUN_CHECKPOINT', reasonCode: classifyAppDiagnosticError(error), retryable: true, durableOutcome: 'unknown', correlationId });
      this.preparationState('checking', 'Checking your saved progress…');
    } finally { this.pausing = false; }
  }

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

  private async canReadPhotoSource(correlationId = createDiagnosticCorrelationId(), operation: 'ONBOARDING_SETUP' | 'ONBOARDING_RUN' = 'ONBOARDING_RUN') {
    try {
      const lifecycle = await this.repository.getPrivateRecordLifecycle();
      if (lifecycle.state === 'connected') return true;
      recordAppDiagnostic({ operation, stage: 'RUN_ADMISSION', reasonCode: 'BLOCKED', retryable: false, durableOutcome: 'blocked', correlationId });
      this.set({ message: lifecycle.state === 'disconnected'
        ? 'Photo-source reads are disconnected. Reconnect your private record before scanning.'
        : 'No private record is available. Reconnect your private record before scanning.' });
    } catch (error) {
      recordAppDiagnostic({ operation, stage: 'RUN_ADMISSION', reasonCode: classifyAppDiagnosticError(error), retryable: true, durableOutcome: 'unknown', correlationId });
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
    this.foreground = false;
    // OS permission/picker surfaces may interrupt the activity while the
    // owner's explicit choice is still pending. Lifecycle stop always fences it.
    if (!this.choosing) ++this.runGeneration;
    this.interruptCounting();
    void this.importer.cancel();
  }

  /** Provider ownership ended, unlike an OS activity opened for a native choice. */
  dispose() {
    this.sourceSuspended = true;
    this.lifecyclePending = true;
    this.foreground = false;
    ++this.runGeneration;
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
    this.sourceSuspended = true;
    ++this.runGeneration;
    this.interruptCounting();
    await this.importer.cancel();
  }

  clearDeletedRecord() {
    this.sourceSuspended = true;
    ++this.runGeneration;
    this.intent = null;
    this.pendingPause = null;
    this.preparationState('idle');
    this.interruptCounting();
    this.selectedIds = [];
    this.set({ count: 0, countStatus: 'none', selectedCount: null, selectedMissingIds: 0, message: null });
    this.importer.clear();
  }

  cancelImport() { void this.importer.cancel(); }
}
