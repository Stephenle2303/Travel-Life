import type { LibraryScope } from '@/photo-access/types';
import type { HistoryRecordRepository } from '@/history-record';

export type SourceAvailability = 'available' | 'unavailable' | 'unknown';

/**
 * Deliberately normalized metadata. It never carries a filename, URI, EXIF
 * blob or media itself. Coordinates are permitted only in this device-local
 * boundary and must never be logged, synced, or exposed by UI state.
 */
export type SourceCandidate = {
  assetId: string;
  mediaType: 'image' | 'video';
  capturedAtMillis: number | null;
  capturedDay: string | null;
  hasPreciseOffset: boolean;
  modifiedAtMillis: number | null;
  locationAvailable: boolean | null;
  latitude?: number | null;
  longitude?: number | null;
  reportedAccuracyMeters?: number | null;
  /** A stable family relationship supplied by a platform integration. This is
   * deliberately absent for Expo Media Library until a documented native
   * capability exists. */
  platformDuplicateFamilyId?: string | null;
  /** Private provenance used only when verifying a platform family tuple. */
  sourceOrigin?: string | null;
  /** Whether this source is eligible to support a reconstructed visit. */
  supportEligible?: boolean | null;
  availability: SourceAvailability;
};

export type ImportScope = Extract<LibraryScope, 'full' | 'limited'> | 'selected';

export type ImportCheckpoint = {
  scope: ImportScope;
  nextOffset: number;
  scanned: number;
  geotagged: number;
  unavailable: number;
  status: 'paused' | 'running' | 'complete';
};

export type ImportCoverage = {
  scope: ImportScope | null;
  accessible: number | null;
  scanned: number;
  geotagged: number;
  unavailable: number;
  status: 'idle' | 'running' | 'paused' | 'complete' | 'blocked';
  message: string | null;
};

export interface ImportRepository extends HistoryRecordRepository {
  getCheckpoint(scope: ImportScope): Promise<ImportCheckpoint | null>;
  commitPage(checkpoint: ImportCheckpoint, candidates: SourceCandidate[]): Promise<void>;
  loadCoverage(scope: ImportScope): Promise<ImportCheckpoint | null>;
}

/**
 * Persistence boundary used by the headless M1.5 reconciler. Values are
 * aggregate status and normalized source metadata only; no media is read.
 */
export type MaintenanceStatus = 'disabled' | 'pending' | 'running' | 'checked' | 'restricted' | 'paused' | 'error';

export type MaintenanceSnapshot = {
  enabled: boolean;
  status: MaintenanceStatus;
  lastCheckedAtMillis: number | null;
  lastUpdatedAtMillis: number | null;
  message: string | null;
};

export type MaintenanceCheckpoint = {
  scope: Extract<ImportScope, 'full' | 'limited'>;
  nextOffset: number;
  runToken: number;
  status: 'paused' | 'running' | 'complete';
};

export type MaintenanceChangeKind = 'added' | 'changed' | 'available' | 'deleted';

/** Aggregate-only state for the local M2.6 consumer. Queue identifiers remain
 * inside SQLite and are never exposed to React state or logs. */
export type ReconciliationStatus = 'idle' | 'pending' | 'running' | 'complete' | 'restricted' | 'error';

export type ReconciliationSnapshot = {
  status: ReconciliationStatus;
  pendingCount: number;
  lastCheckedAtMillis: number | null;
  lastUpdatedAtMillis: number | null;
  newJourneyCount: number;
  updatedJourneyCount: number;
  message: string | null;
};

export interface MaintenanceRepository extends ImportRepository {
  loadMaintenance(): Promise<MaintenanceSnapshot>;
  saveMaintenance(snapshot: MaintenanceSnapshot): Promise<void>;
  getMaintenanceCheckpoint(): Promise<MaintenanceCheckpoint | null>;
  reconcileMaintenancePage(checkpoint: MaintenanceCheckpoint, candidates: SourceCandidate[]): Promise<void>;
  completeMaintenanceRun(checkpoint: MaintenanceCheckpoint, completedAtMillis: number): Promise<void>;
  pauseMaintenance(checkpoint: MaintenanceCheckpoint, message: string): Promise<void>;
  acquireMaintenanceLease(nowMillis: number, allowDisabled?: boolean): Promise<number | null>;
  renewMaintenanceLease(runToken: number, nowMillis: number): Promise<boolean>;
  releaseMaintenanceLease(runToken: number): Promise<void>;
  loadReconciliation?(): Promise<ReconciliationSnapshot>;
}

/** Returned when a lifecycle transition has made an import write unsafe. */
export class ImportLifecycleBlockedError extends Error {
  constructor() {
    super('The private record is not connected for import.');
    this.name = 'ImportLifecycleBlockedError';
  }
}
