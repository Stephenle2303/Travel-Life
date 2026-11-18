import type { PermissionSnapshot, PhotoAccessAdapter } from '@/photo-access/types';
import { classifyAppDiagnosticError, createDiagnosticCorrelationId, recordAppDiagnostic, type AppDiagnosticEvent } from '@/diagnostics/app-diagnostics';

import type { ImportCheckpoint, ImportCoverage, ImportRepository, ImportScope, SourceCandidate } from './types';

const PAGE_SIZE = 100;

class ImportReadStopped extends Error {
  constructor(readonly reason: 'SKIPPED' | 'RESTRICTED' | 'BLOCKED') { super('Import read stopped.'); }
}
class ImportBoundaryError extends Error {
  constructor(readonly stage: AppDiagnosticEvent['stage'], readonly originalError: unknown) { super('Import boundary failed.'); }
}

const idleCoverage: ImportCoverage = {
  scope: null,
  accessible: null,
  scanned: 0,
  geotagged: 0,
  unavailable: 0,
  status: 'idle',
  message: null,
};

function isPermitted(scope: ImportScope, permission: PermissionSnapshot | null) {
  return scope === 'selected'
    // A system picker result is an owner-selected, independent source. It may
    // be returned even when broad library access is denied.
    ? true
    : permission?.scope === scope;
}

function checkpointToCoverage(checkpoint: ImportCheckpoint, accessible: number | null, message: string | null = null): ImportCoverage {
  return {
    scope: checkpoint.scope,
    accessible,
    scanned: checkpoint.scanned,
    geotagged: checkpoint.geotagged,
    unavailable: checkpoint.unavailable,
    status: checkpoint.status,
    message,
  };
}

function isDatabaseBusy(error: unknown) {
  return error instanceof Error && (error.message.toLowerCase().includes('database is locked') || error.message.toLowerCase().includes('database busy') || error.message.toLowerCase().includes('sqlite_busy'));
}

export class ImportCoordinator {
  private current = idleCoverage;
  private serial = 0;
  private activeCheckpoint: ImportCheckpoint | null = null;
  private pausePending: Promise<void> | null = null;
  private correlationId = createDiagnosticCorrelationId();
  private commitUnknown = false;

  private failure(stage: AppDiagnosticEvent['stage'], error: unknown, token = this.serial) {
    if (token !== this.serial || error instanceof ImportReadStopped) {
      const reasonCode = token !== this.serial ? 'SKIPPED' : (error as ImportReadStopped).reason;
      recordAppDiagnostic({ operation: 'METADATA_IMPORT', stage: error instanceof ImportReadStopped && reasonCode !== 'SKIPPED' ? 'IMPORT_ACCESS' : stage, reasonCode, retryable: false, durableOutcome: reasonCode === 'SKIPPED' ? 'skipped' : 'blocked', correlationId: this.correlationId });
      return;
    }
    recordAppDiagnostic({ operation: 'METADATA_IMPORT', stage: error instanceof ImportBoundaryError ? error.stage : stage, reasonCode: classifyAppDiagnosticError(error), retryable: true, durableOutcome: 'unknown', correlationId: this.correlationId });
  }

  private async readWithRetry<T>(read: () => Promise<T>, token: number, scope: ImportScope): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      try { return await read(); }
      catch (error) {
        if (token !== this.serial) throw new ImportReadStopped('SKIPPED');
        const category = classifyAppDiagnosticError(error);
        if (attempt >= 2 || token !== this.serial || (category !== 'DATABASE_BUSY' && category !== 'NATIVE_HANDLE')) throw error;
        await new Promise<void>((resolve) => setTimeout(resolve, attempt === 0 ? 1000 : 3000));
        if (token !== this.serial) throw new ImportReadStopped('SKIPPED');
        try {
          const lifecycle = await this.repository.getPrivateRecordLifecycle();
          if (token !== this.serial) throw new ImportReadStopped('SKIPPED');
          if (lifecycle.state !== 'connected') throw new ImportReadStopped('BLOCKED');
          if (scope !== 'selected') {
            const permission = await this.adapter.inspect();
            if (token !== this.serial) throw new ImportReadStopped('SKIPPED');
            if (!isPermitted(scope, permission)) throw new ImportReadStopped('RESTRICTED');
          }
        } catch (guardError) {
          if (guardError instanceof ImportReadStopped) throw guardError;
          throw new ImportBoundaryError('IMPORT_ACCESS', guardError);
        }
      }
    }
  }

  private async commitPageWithAcknowledgement(checkpoint: ImportCheckpoint, candidates: SourceCandidate[]) {
    // Aggregate counts cannot prove that this exact page/selection committed.
    // A rejected acknowledgement stays unresolved until an acknowledged,
    // authorized stable-ID rescan completes; never infer success from counts.
    try { await this.repository.commitPage(checkpoint, candidates); }
    catch (error) { this.commitUnknown = true; throw error; }
  }

  constructor(
    private readonly adapter: PhotoAccessAdapter,
    private readonly repository: ImportRepository,
    private readonly notify: (coverage: ImportCoverage) => void,
  ) {}

  get coverage() { return this.current; }
  get isRunning() { return this.current.status === 'running'; }
  get hasUnresolvedCommit() { return this.commitUnknown; }

  private set(next: ImportCoverage) {
    this.current = next;
    this.notify(next);
  }

  async restore(scope: Extract<ImportScope, 'full' | 'limited'>) {
    if (this.isRunning) return;
    if (!await this.canReadCurrentSource(scope, null)) return;
    const checkpoint = await this.repository.loadCoverage(scope);
    if (!checkpoint) return;
    // A process cannot continue work that was running before it ended. Persist a
    // paused marker so the screen offers an explicit resume rather than a fake
    // in-progress state.
    const paused = checkpoint.status === 'running' ? { ...checkpoint, status: 'paused' as const } : checkpoint;
    if (paused !== checkpoint) await this.repository.commitPage(paused, []);
    this.activeCheckpoint = paused;
    this.set(checkpointToCoverage(paused, null));
  }

  clearIncompatibleCoverage(scope: PermissionSnapshot['scope'] | 'revoked' | 'unavailable') {
    if (this.current.scope !== null && this.current.scope !== 'selected' && this.current.scope !== scope) {
      this.activeCheckpoint = null;
      this.set(idleCoverage);
    }
  }

  clear() {
    this.activeCheckpoint = null;
    this.set(idleCoverage);
  }

  async cancel() {
    ++this.serial;
    if (this.current.status === 'running') {
      const checkpoint = this.activeCheckpoint && { ...this.activeCheckpoint, status: 'paused' as const };
      if (checkpoint) {
        const pending = this.repository.commitPage(checkpoint, []);
        this.pausePending = pending;
        try {
          await pending;
          this.activeCheckpoint = checkpoint;
          this.set({ ...this.current, status: 'paused', message: 'Import paused. Committed pages are ready to resume.' });
        } catch (error) {
          this.failure('IMPORT_CHECKPOINT', error);
          this.set({ ...this.current, status: 'paused', message: 'Import stopped, but its pause marker could not be saved. Retry when ready.' });
        } finally {
          if (this.pausePending === pending) this.pausePending = null;
        }
      }
      else this.set({ ...this.current, status: 'paused', message: 'Import paused. Committed pages are ready to resume.' });
    }
  }

  async start(scope: Extract<ImportScope, 'full' | 'limited'>, accessible: number | null, correlationId = createDiagnosticCorrelationId()) {
    if (this.isRunning) return;
    this.commitUnknown = false;
    this.correlationId = correlationId;
    const token = ++this.serial;
    if (!await this.canReadCurrentSource(scope, accessible, token) || token !== this.serial) return;
    if (this.pausePending) {
      try {
        await this.pausePending;
      } catch {
        // cancel() already exposes the failed pause write as recoverable UI state.
      }
    }
    let saved: ImportCheckpoint | null;
    try {
      saved = await this.repository.getCheckpoint(scope);
    } catch (error) {
      this.failure('IMPORT_CHECKPOINT', error, token);
      if (token === this.serial) {
        this.set({ ...idleCoverage, scope, accessible, status: 'paused', message: 'Local import progress could not be read. Retry when ready.' });
      }
      return;
    }
    if (token !== this.serial) return;
    // Offset queries can shift after an interruption. Scan from zero on every
    // explicit restart; stable-ID upserts retain the durable index safely.
    const checkpoint = saved ? {
      scope, nextOffset: 0, scanned: 0, geotagged: 0, unavailable: 0, status: 'paused' as const,
    } : {
      scope, nextOffset: 0, scanned: 0, geotagged: 0, unavailable: 0, status: 'paused' as const,
    };
    this.activeCheckpoint = checkpoint;
    await this.runPages(token, checkpoint, accessible);
  }

  async importSelected(assetIds: string[], missingIds: number, correlationId = createDiagnosticCorrelationId()) {
    if (this.isRunning) return;
    this.commitUnknown = false;
    this.correlationId = correlationId;
    const token = ++this.serial;
    if (!await this.canReadCurrentSource('selected', assetIds.length + missingIds, token) || token !== this.serial) return;
    if (this.pausePending) {
      try {
        await this.pausePending;
      } catch {
        // cancel() already exposes the failed pause write as recoverable UI state.
      }
    }
    let saved: ImportCheckpoint | null;
    try {
      saved = await this.repository.getCheckpoint('selected');
    } catch (error) {
      this.failure('IMPORT_CHECKPOINT', error, token);
      if (token === this.serial) {
        this.set({ ...idleCoverage, scope: 'selected', accessible: assetIds.length + missingIds, status: 'paused', message: 'Local import progress could not be read. Retry when ready.' });
      }
      return;
    }
    if (token !== this.serial) return;
    const checkpoint = saved ? {
      scope: 'selected' as const, nextOffset: 0, scanned: 0, geotagged: 0, unavailable: 0, status: 'paused' as const,
    } : {
      scope: 'selected' as const, nextOffset: 0, scanned: 0, geotagged: 0, unavailable: 0, status: 'paused' as const,
    };
    this.activeCheckpoint = checkpoint;
    this.set(checkpointToCoverage({ ...checkpoint, status: 'running' }, assetIds.length + missingIds));
    let candidates: SourceCandidate[];
    try {
      candidates = await this.readWithRetry(() => this.adapter.readSelectedMetadata(assetIds), token, 'selected');
    } catch (error) {
      this.failure('IMPORT_READ', error, token);
      if (token === this.serial) this.set({ ...checkpointToCoverage({ ...checkpoint, status: 'paused' }, assetIds.length + missingIds), status: error instanceof ImportReadStopped ? 'blocked' : 'paused', message: 'Selected metadata could not be read. Retry when ready.' });
      return;
    }
    if (token !== this.serial) return;
    if (!await this.canReadCurrentSource('selected', assetIds.length + missingIds, token) || token !== this.serial) return;
    // A stable picker ID can disappear before lookup. Count it unavailable but
    // never fabricate a replacement identity or source row.
    const disappeared = Math.max(0, assetIds.length - candidates.length);
    const updated = this.advance({ ...checkpoint, status: 'complete' }, candidates, missingIds + disappeared);
    try {
      await this.commitPageWithAcknowledgement(updated, candidates);
    } catch (error) {
      this.failure('IMPORT_COMMIT', error, token);
      if (token === this.serial) this.set({ ...checkpointToCoverage({ ...checkpoint, status: 'paused' }, assetIds.length + missingIds), message: 'Selected metadata could not be saved. Retry when ready.' });
      return;
    }
    this.activeCheckpoint = updated;
    if (token === this.serial) this.set(checkpointToCoverage(updated, assetIds.length + missingIds));
  }

  private async canReadCurrentSource(scope: ImportScope, accessible: number | null, token = this.serial) {
    try {
      const lifecycle = await this.repository.getPrivateRecordLifecycle();
      if (token !== this.serial) return false;
      if (lifecycle.state === 'connected') return true;
      recordAppDiagnostic({ operation: 'METADATA_IMPORT', stage: 'IMPORT_READ', reasonCode: 'BLOCKED', retryable: false, durableOutcome: 'blocked', correlationId: this.correlationId });
      this.activeCheckpoint = null;
      this.set({
        ...idleCoverage,
        scope,
        accessible,
        status: 'blocked',
        message: lifecycle.state === 'disconnected'
          ? 'Photo-source reads are disconnected. Reconnect your private record before importing.'
          : 'No private record is available. Reconnect your private record before importing.',
      });
    } catch (error) {
      this.failure('IMPORT_CHECKPOINT', error, token);
      if (token === this.serial) this.set({ ...idleCoverage, scope, accessible, status: 'paused', message: 'Private record status could not be read. Retry when ready.' });
    }
    return false;
  }

  private advance(checkpoint: ImportCheckpoint, candidates: SourceCandidate[], extraUnavailable = 0): ImportCheckpoint {
    return {
      ...checkpoint,
      nextOffset: checkpoint.nextOffset + candidates.length,
      scanned: checkpoint.scanned + candidates.length,
      geotagged: checkpoint.geotagged + candidates.filter((candidate) => candidate.locationAvailable === true).length,
      unavailable: checkpoint.unavailable + candidates.filter((candidate) => candidate.availability === 'unavailable').length + extraUnavailable,
    };
  }

  private async runPages(token: number, initial: ImportCheckpoint, accessible: number | null) {
    let stage: AppDiagnosticEvent['stage'] = 'IMPORT_READ';
    let checkpoint: ImportCheckpoint = { ...initial, status: 'running' };
    // Only this checkpoint has definitely reached durable storage. Keep it so
    // a failed page write never appears committed and never requires another
    // write while SQLite is reporting that it is busy.
    let lastCommitted: ImportCheckpoint = initial;
    this.activeCheckpoint = checkpoint;
    this.set(checkpointToCoverage(checkpoint, accessible));
    try {
      while (token === this.serial) {
        stage = 'IMPORT_READ';
        if (!await this.canReadCurrentSource(checkpoint.scope, accessible, token) || token !== this.serial) return;
        stage = 'IMPORT_ACCESS';
        const before = await this.adapter.inspect();
        if (token !== this.serial) return;
        if (!isPermitted(checkpoint.scope, before)) {
          recordAppDiagnostic({ operation: 'METADATA_IMPORT', stage: 'IMPORT_ACCESS', reasonCode: 'RESTRICTED', retryable: false, durableOutcome: 'blocked', correlationId: this.correlationId });
          this.set({ ...checkpointToCoverage({ ...checkpoint, status: 'paused' }, accessible), status: 'blocked', message: 'Photo access changed. No further items were read.' });
          return;
        }
        stage = 'IMPORT_READ';
        const page = await this.readWithRetry(() => this.adapter.readMetadataPage(checkpoint.nextOffset, PAGE_SIZE), token, checkpoint.scope);
        if (token !== this.serial) return; // A late page is intentionally discarded.
        stage = 'IMPORT_ACCESS';
        const after = await this.adapter.inspect();
        if (token !== this.serial) return;
        if (!await this.canReadCurrentSource(checkpoint.scope, accessible, token) || token !== this.serial) return;
        if (!isPermitted(checkpoint.scope, after)) {
          recordAppDiagnostic({ operation: 'METADATA_IMPORT', stage: 'IMPORT_ACCESS', reasonCode: 'RESTRICTED', retryable: false, durableOutcome: 'blocked', correlationId: this.correlationId });
          this.set({ ...checkpointToCoverage({ ...checkpoint, status: 'paused' }, accessible), status: 'blocked', message: 'Photo access changed. A late page was discarded.' });
          return;
        }
        checkpoint = this.advance(checkpoint, page);
        checkpoint.status = page.length < PAGE_SIZE ? 'complete' : 'running';
        stage = 'IMPORT_COMMIT';
        await this.commitPageWithAcknowledgement(checkpoint, page);
        lastCommitted = checkpoint;
        this.activeCheckpoint = checkpoint;
        if (token !== this.serial) return;
        this.set(checkpointToCoverage(checkpoint, accessible));
        if (checkpoint.status === 'complete') return;
      }
    } catch (error) {
      this.failure(stage, error, token);
      if (token === this.serial) {
        const paused = { ...lastCommitted, status: 'paused' as const };
        if (error instanceof ImportReadStopped) {
          this.set({ ...checkpointToCoverage(paused, accessible), status: 'blocked', message: 'Photo access changed. Choose what to use next.' });
          return;
        }
        // A busy commit has made no durable change. Do not immediately submit
        // a second pause-marker write to the same locked database; preserve
        // the last durable checkpoint and let the owner retry safely.
        if (stage === 'IMPORT_COMMIT' || isDatabaseBusy(error)) {
          this.activeCheckpoint = paused;
          this.set({ ...checkpointToCoverage(paused, accessible), message: stage === 'IMPORT_COMMIT' ? 'Checking saved metadata progress. Retry when ready.' : 'Local storage is busy. No metadata page was committed. Retry when ready.' });
          return;
        }
        try {
          await this.repository.commitPage(paused, []);
        } catch {
          this.activeCheckpoint = paused;
          this.set({ ...checkpointToCoverage(paused, accessible), message: 'Import paused, but its local progress marker could not be saved. Retry when ready.' });
          return;
        }
        this.activeCheckpoint = paused;
        if (token === this.serial) this.set({ ...checkpointToCoverage(paused, accessible), message: 'Import paused because the current device-visible scope could not be read.' });
      }
    }
  }
}
