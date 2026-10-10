import type { PermissionSnapshot, PhotoAccessAdapter } from '@/photo-access/types';

import type { ImportCheckpoint, ImportCoverage, ImportRepository, ImportScope, SourceCandidate } from './types';

const PAGE_SIZE = 100;

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

export class ImportCoordinator {
  private current = idleCoverage;
  private serial = 0;
  private activeCheckpoint: ImportCheckpoint | null = null;
  private pausePending: Promise<void> | null = null;

  constructor(
    private readonly adapter: PhotoAccessAdapter,
    private readonly repository: ImportRepository,
    private readonly notify: (coverage: ImportCoverage) => void,
  ) {}

  get coverage() { return this.current; }
  get isRunning() { return this.current.status === 'running'; }

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
        } catch {
          this.set({ ...this.current, status: 'paused', message: 'Import stopped, but its pause marker could not be saved. Retry when ready.' });
        } finally {
          if (this.pausePending === pending) this.pausePending = null;
        }
      }
      else this.set({ ...this.current, status: 'paused', message: 'Import paused. Committed pages are ready to resume.' });
    }
  }

  async start(scope: Extract<ImportScope, 'full' | 'limited'>, accessible: number | null) {
    if (this.isRunning) return;
    const token = ++this.serial;
    if (!await this.canReadCurrentSource(scope, accessible) || token !== this.serial) return;
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
    } catch {
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

  async importSelected(assetIds: string[], missingIds: number) {
    if (this.isRunning) return;
    const token = ++this.serial;
    if (!await this.canReadCurrentSource('selected', assetIds.length + missingIds) || token !== this.serial) return;
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
    } catch {
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
      candidates = await this.adapter.readSelectedMetadata(assetIds);
    } catch {
      if (token === this.serial) this.set({ ...checkpointToCoverage({ ...checkpoint, status: 'paused' }, assetIds.length + missingIds), message: 'Selected metadata could not be read. Retry when ready.' });
      return;
    }
    if (token !== this.serial) return;
    // A stable picker ID can disappear before lookup. Count it unavailable but
    // never fabricate a replacement identity or source row.
    const disappeared = Math.max(0, assetIds.length - candidates.length);
    const updated = this.advance({ ...checkpoint, status: 'complete' }, candidates, missingIds + disappeared);
    try {
      await this.repository.commitPage(updated, candidates);
    } catch {
      if (token === this.serial) this.set({ ...checkpointToCoverage({ ...checkpoint, status: 'paused' }, assetIds.length + missingIds), message: 'Selected metadata could not be saved. Retry when ready.' });
      return;
    }
    this.activeCheckpoint = updated;
    if (token === this.serial) this.set(checkpointToCoverage(updated, assetIds.length + missingIds));
  }

  private async canReadCurrentSource(scope: ImportScope, accessible: number | null) {
    try {
      const lifecycle = await this.repository.getPrivateRecordLifecycle();
      if (lifecycle.state === 'connected') return true;
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
    } catch {
      this.set({ ...idleCoverage, scope, accessible, status: 'paused', message: 'Private record status could not be read. Retry when ready.' });
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
    let checkpoint: ImportCheckpoint = { ...initial, status: 'running' };
    this.activeCheckpoint = checkpoint;
    this.set(checkpointToCoverage(checkpoint, accessible));
    try {
      while (token === this.serial) {
        const before = await this.adapter.inspect();
        if (token !== this.serial) return;
        if (!isPermitted(checkpoint.scope, before)) {
          this.set({ ...checkpointToCoverage({ ...checkpoint, status: 'paused' }, accessible), status: 'blocked', message: 'Photo access changed. No further items were read.' });
          return;
        }
        const page = await this.adapter.readMetadataPage(checkpoint.nextOffset, PAGE_SIZE);
        if (token !== this.serial) return; // A late page is intentionally discarded.
        const after = await this.adapter.inspect();
        if (token !== this.serial) return;
        if (!isPermitted(checkpoint.scope, after)) {
          this.set({ ...checkpointToCoverage({ ...checkpoint, status: 'paused' }, accessible), status: 'blocked', message: 'Photo access changed. A late page was discarded.' });
          return;
        }
        checkpoint = this.advance(checkpoint, page);
        checkpoint.status = page.length < PAGE_SIZE ? 'complete' : 'running';
        await this.repository.commitPage(checkpoint, page);
        this.activeCheckpoint = checkpoint;
        if (token !== this.serial) return;
        this.set(checkpointToCoverage(checkpoint, accessible));
        if (checkpoint.status === 'complete') return;
      }
    } catch {
      if (token === this.serial) {
        const paused = { ...checkpoint, status: 'paused' as const };
        await this.repository.commitPage(paused, []);
        this.activeCheckpoint = paused;
        if (token === this.serial) this.set({ ...checkpointToCoverage(paused, accessible), message: 'Import paused because the current device-visible scope could not be read.' });
      }
    }
  }
}
