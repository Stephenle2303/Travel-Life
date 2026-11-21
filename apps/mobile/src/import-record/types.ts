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

/** Private owner-entered local context. Coordinates never leave SQLite and
 * titles are deliberately absent from automatic detection outputs. */
export type ConfiguredHomeArea = {
  id: string;
  /** Owner-entered local display text. It is never input to reconstruction. */
  label: string | null;
  origin: 'observed-area' | 'legacy' | 'manual-pin';
  latitude: number;
  longitude: number;
  effectiveStartDay: string | null;
  effectiveEndDay: string | null;
  radiusMeters: number;
};

export class HomeSetupConflictError extends Error {}

export type ManualJourneyDate = { kind: 'exact'; day: string } | { kind: 'approximate'; startDay: string; endDay: string };
/** An owner assertion stored outside all reconstruction and evidence tables. */
export type ManualJourneyInput = {
  commandKey: string;
  label: string;
  context: string;
  anchor: { latitude: number; longitude: number };
  date: ManualJourneyDate;
  /** Every overlap visible at review time; the repository rechecks this set atomically. */
  reviewedOverlapIds: string[];
};

export interface ImportRepository extends HistoryRecordRepository {
  loadFirstRevealReceipt?(): Promise<import('@/reconstruction/first-reveal-question').FirstRevealReceipt | null>;
  /** The fence must use the caller's in-memory authority, not open another SQLite writer. */
  saveFirstRevealReceipt?(mutation: import('@/reconstruction/first-reveal-question').FirstRevealMutation, verifyCurrent: () => boolean | Promise<boolean>, correlationId?: string): Promise<
    { status: 'saved'; receipt: import('@/reconstruction/first-reveal-question').FirstRevealReceipt } | { status: 'stale' | 'conflict' }
  >;
  loadHomeSetup?(): Promise<'saved' | 'skipped' | null>;
  saveHomeSetup?(command: string, areas: readonly ConfiguredHomeArea[]): Promise<void>;
  hasEstablishedHistory?(): Promise<boolean>;
  loadPreparationIntent?(): Promise<PreparationIntent | null>;
  savePreparationIntent?(intent: PreparationIntent): Promise<void>;
  getCheckpoint(scope: ImportScope): Promise<ImportCheckpoint | null>;
  commitPage(checkpoint: ImportCheckpoint, candidates: SourceCandidate[]): Promise<void>;
  loadCoverage(scope: ImportScope): Promise<ImportCheckpoint | null>;
  loadConfiguredHomeAreas?(): Promise<ConfiguredHomeArea[]>;
  saveConfiguredHomeArea?(area: ConfiguredHomeArea): Promise<void>;
  renameConfiguredHomeArea?(id: string, label: string): Promise<void>;
  deleteConfiguredHomeArea?(id: string): Promise<void>;
  /** AI clue layer (decision 0022, M11.1). CAP-5's photo-source producer
   * exists (`clues/producers/photo-source.ts`) but nothing calls it in
   * production yet — CAP-3's background pass isn't wired in. */
  loadClues?(): Promise<import('@/clues/types').ClueRecord[]>;
  saveClues?(clues: readonly import('@/clues/types').ClueRecord[]): Promise<void>;
  updateClueStates?(updates: readonly { clueId: string; state: import('@/clues/types').ClueLifecycleState }[]): Promise<void>;
  /** CAP-3: a clue the pass held back instead of silently lowering an
   * already-confirmed journey (background-and-surfacing.md's "never"
   * rule). */
  loadClueReviewCards?(state?: 'pending' | 'approved' | 'dismissed'): Promise<import('./repository').ClueReviewCard[]>;
  saveClueReviewCards?(cards: readonly import('./repository').ClueReviewCard[]): Promise<void>;
  resolveClueReviewCard?(cardId: string, state: 'approved' | 'dismissed'): Promise<void>;
  /** M10.8 (CAP-8) adoption: which detector rule a rebuild qualifies with.
   * Defaults to the current, sole active rule; v1.1 stays selectable only
   * for an owner-initiated rollback (byte-unchanged rule files, M10.8's
   * rollback proof). */
  loadDetectorPolicy?(): Promise<import('@/reconstruction/types').DetectorPolicy>;
  setDetectorPolicy?(ruleVersion: import('@/reconstruction/types').DetectorPolicy, nowMillis?: number): Promise<void>;
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
  queuedChangeCount?: number;
  unresolvedRemapCount?: number;
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
export type PreparationIntent = {
  version: 1;
  id: string;
  scope: ImportScope;
  selectedIds: string[];
  missingIds: number;
  phase: 'queued' | 'imported' | 'publishing' | 'complete' | 'paused' | 'interrupted' | 'blocked';
  /** Explicit pause does not erase the last verified preparation boundary. */
  resumePhase?: 'queued' | 'imported' | 'publishing';
};

/** Returned when a lifecycle transition has made an import write unsafe. */
export class ImportLifecycleBlockedError extends Error {
  constructor() {
    super('The private record is not connected for import.');
    this.name = 'ImportLifecycleBlockedError';
  }
}
