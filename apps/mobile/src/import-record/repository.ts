import type { CorrectionOverlay, PrivateRecordLifecycle } from '@/history-record';

import {
  ImportLifecycleBlockedError, type ImportCheckpoint, type ImportRepository, type ImportScope,
  type MaintenanceCheckpoint, type MaintenanceRepository, type MaintenanceSnapshot, type SourceCandidate,
} from './types';

type SqliteDatabase = {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, ...params: (string | number | null)[]): Promise<unknown>;
  getFirstAsync<T>(source: string, ...params: (string | number | null)[]): Promise<T | null>;
};

type CheckpointRow = {
  scope: ImportScope;
  next_offset: number;
  scanned: number;
  geotagged: number;
  unavailable: number;
  status: ImportCheckpoint['status'];
};

const CURRENT_SCHEMA_VERSION = 5;

const migrationV1 = `
  CREATE TABLE IF NOT EXISTS import_checkpoint (
    scope TEXT PRIMARY KEY NOT NULL,
    next_offset INTEGER NOT NULL,
    scanned INTEGER NOT NULL,
    geotagged INTEGER NOT NULL,
    unavailable INTEGER NOT NULL,
    status TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS import_source_index (
    asset_id TEXT PRIMARY KEY NOT NULL,
    media_type TEXT NOT NULL,
    captured_at_millis INTEGER NULL,
    modified_at_millis INTEGER NULL,
    location_available INTEGER NULL,
    availability TEXT NOT NULL
  );
  -- M1.4 owns correction lifecycle. This separate table is intentionally not
  -- modified by import upserts, so a later correction marker survives rescans.
  CREATE TABLE IF NOT EXISTS correction_markers (
    asset_id TEXT PRIMARY KEY NOT NULL,
    marker TEXT NOT NULL
  );
`;

/**
 * This migration upgrades the M1.3 index in place. The canonical evidence
 * table remains normalized and only retains the opaque source reference that
 * lets a later owner-authorized reconnect deduplicate a repeat import.
 */
const migrationV2 = `
  CREATE TABLE IF NOT EXISTS private_history_record (
    record_id INTEGER PRIMARY KEY CHECK (record_id = 1),
    schema_version INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS private_record_lifecycle (
    record_id INTEGER PRIMARY KEY CHECK (record_id = 1),
    state TEXT NOT NULL CHECK (state IN ('connected', 'disconnected'))
  );
  CREATE TABLE IF NOT EXISTS canonical_evidence (
    evidence_id TEXT PRIMARY KEY NOT NULL,
    source_ref TEXT UNIQUE NOT NULL,
    media_type TEXT NOT NULL,
    captured_at_millis INTEGER NULL,
    modified_at_millis INTEGER NULL,
    location_available INTEGER NULL,
    availability TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS inferred_history (
    history_id TEXT PRIMARY KEY NOT NULL,
    history_kind TEXT NOT NULL CHECK (history_kind IN ('place', 'visit', 'journey')),
    history_state TEXT NOT NULL CHECK (history_state IN ('inferred', 'confirmed', 'rejected', 'owner_entered')),
    provenance_version TEXT NOT NULL,
    identity_lineage_id TEXT NULL
  );
  CREATE TABLE IF NOT EXISTS correction_overlays (
    overlay_id TEXT PRIMARY KEY NOT NULL,
    target_kind TEXT NOT NULL CHECK (target_kind IN ('evidence', 'history')),
    target_id TEXT NOT NULL,
    correction_scope TEXT NOT NULL CHECK (correction_scope IN ('inclusion', 'label', 'note')),
    owner_action TEXT NOT NULL CHECK (owner_action IN ('apply', 'remove')),
    owner_value TEXT NULL,
    created_at_millis INTEGER NOT NULL,
    identity_lineage_id TEXT NULL,
    revision INTEGER NOT NULL,
    replaces_overlay_id TEXT NULL
  );
  -- There are no cache rows today. Keeping an explicit registry makes the
  -- covered deletion boundary auditable before future cache work is added.
  CREATE TABLE IF NOT EXISTS local_cache_registry (
    cache_key TEXT PRIMARY KEY NOT NULL
  );
  INSERT OR IGNORE INTO private_history_record (record_id, schema_version) VALUES (1, 2);
  INSERT OR IGNORE INTO private_record_lifecycle (record_id, state) VALUES (1, 'connected');
  INSERT OR IGNORE INTO canonical_evidence
    (evidence_id, source_ref, media_type, captured_at_millis, modified_at_millis, location_available, availability)
  SELECT asset_id, asset_id, media_type, captured_at_millis, modified_at_millis, location_available, availability
  FROM import_source_index;
`;

const migrationV3 = `
  CREATE TABLE IF NOT EXISTS maintenance_state (
    record_id INTEGER PRIMARY KEY CHECK (record_id = 1), enabled INTEGER NOT NULL,
    status TEXT NOT NULL, last_checked_at_millis INTEGER NULL,
    last_updated_at_millis INTEGER NULL, message TEXT NULL
  );
  CREATE TABLE IF NOT EXISTS maintenance_checkpoint (
    record_id INTEGER PRIMARY KEY CHECK (record_id = 1), scope TEXT NOT NULL,
    next_offset INTEGER NOT NULL, run_token INTEGER NOT NULL, status TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS maintenance_source_presence (
    asset_id TEXT PRIMARY KEY NOT NULL, last_seen_run INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS maintenance_change_queue (
    asset_id TEXT NOT NULL, change_kind TEXT NOT NULL, source_revision INTEGER NOT NULL,
    PRIMARY KEY (asset_id, change_kind, source_revision)
  );
  -- Existing imported identities must participate in the first full delta
  -- reconciliation. A limited run never consumes these presence markers.
  INSERT OR IGNORE INTO maintenance_source_presence (asset_id, last_seen_run)
    SELECT asset_id, 0 FROM import_source_index;
  INSERT OR IGNORE INTO maintenance_state
    (record_id, enabled, status, last_checked_at_millis, last_updated_at_millis, message)
    VALUES (1, 0, 'disabled', NULL, NULL, NULL);
  UPDATE private_history_record SET schema_version = 3 WHERE record_id = 1;
`;

const migrationV4 = `
  ALTER TABLE maintenance_source_presence ADD COLUMN missing_full_scans INTEGER NOT NULL DEFAULT 0;
  CREATE TABLE IF NOT EXISTS maintenance_run_sequence (record_id INTEGER PRIMARY KEY CHECK (record_id = 1), next_token INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS maintenance_lease (record_id INTEGER PRIMARY KEY CHECK (record_id = 1), run_token INTEGER NOT NULL);
  INSERT OR IGNORE INTO maintenance_run_sequence (record_id, next_token) VALUES (1, 1);
  UPDATE private_history_record SET schema_version = 4 WHERE record_id = 1;
`;

// A process may be terminated before its finally block runs. A bounded lease
// lets the next OS-scheduled worker recover instead of permanently pausing.
const migrationV5 = `
  ALTER TABLE maintenance_lease ADD COLUMN expires_at_millis INTEGER NOT NULL DEFAULT 0;
  UPDATE private_history_record SET schema_version = 5 WHERE record_id = 1;
`;

const MAINTENANCE_LEASE_MILLIS = 5 * 60 * 1000;

type SchemaRow = { version: number };
type LifecycleRow = { state: 'connected' | 'disconnected' };
type RevisionRow = { revision: number | null };
type MaintenanceStateRow = { enabled: number; status: MaintenanceSnapshot['status']; last_checked_at_millis: number | null; last_updated_at_millis: number | null; message: string | null };
type MaintenanceCheckpointRow = { scope: Extract<ImportScope, 'full' | 'limited'>; next_offset: number; run_token: number; status: MaintenanceCheckpoint['status'] };
type SourceRow = { modified_at_millis: number | null; availability: SourceCandidate['availability'] };

function toCheckpoint(row: CheckpointRow | null): ImportCheckpoint | null {
  return row && {
    scope: row.scope,
    nextOffset: row.next_offset,
    scanned: row.scanned,
    geotagged: row.geotagged,
    unavailable: row.unavailable,
    status: row.status,
  };
}

/** Opens the on-device-only SQLite index lazily, so web never initializes it. */
export function createNativeImportRepository(): ImportRepository & MaintenanceRepository {
  let database: Promise<SqliteDatabase> | null = null;

  async function open() {
    if (!database) {
      database = (async () => {
        // Native-only dependency loading keeps an unsupported runtime closed.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const sqlite = require('expo-sqlite') as { openDatabaseAsync(name: string): Promise<SqliteDatabase> };
        const db = await sqlite.openDatabaseAsync('travel-life-import-v1.db');
        await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
        try {
          await db.execAsync('CREATE TABLE IF NOT EXISTS import_schema_version (version INTEGER NOT NULL)');
          const row = await db.getFirstAsync<SchemaRow>('SELECT version FROM import_schema_version LIMIT 1');
          const version = row?.version ?? 0;
          if (version < 1) await db.execAsync(migrationV1);
          if (version < 2) await db.execAsync(migrationV2);
          if (version < 3) await db.execAsync(migrationV3);
          if (version < 4) await db.execAsync(migrationV4);
          if (version < 5) await db.execAsync(migrationV5);
          if (version === 0) await db.runAsync('INSERT INTO import_schema_version (version) VALUES (?)', CURRENT_SCHEMA_VERSION);
          else if (version < CURRENT_SCHEMA_VERSION) await db.runAsync('UPDATE import_schema_version SET version = ?', CURRENT_SCHEMA_VERSION);
          await db.execAsync('COMMIT');
        } catch (error) {
          await db.execAsync('ROLLBACK');
          throw error;
        }
        return db;
      })().catch((error) => {
        database = null;
        throw error;
      });
    }
    return database;
  }

  async function read(scope: ImportScope) {
    const db = await open();
    return toCheckpoint(await db.getFirstAsync<CheckpointRow>(
      'SELECT scope, next_offset, scanned, geotagged, unavailable, status FROM import_checkpoint WHERE scope = ?',
      scope,
    ));
  }

  async function lifecycle(db: SqliteDatabase): Promise<PrivateRecordLifecycle> {
    const row = await db.getFirstAsync<LifecycleRow>('SELECT state FROM private_record_lifecycle WHERE record_id = 1');
    return { state: row?.state ?? 'deleted' };
  }

  async function assertImportActive(db: SqliteDatabase) {
    if ((await lifecycle(db)).state !== 'connected') throw new ImportLifecycleBlockedError();
  }

  async function assertMaintenanceWritable(db: SqliteDatabase, runToken: number) {
    await assertImportActive(db);
    const state = await db.getFirstAsync<{ enabled: number }>('SELECT enabled FROM maintenance_state WHERE record_id = 1');
    const lease = await db.getFirstAsync<{ run_token: number }>('SELECT run_token FROM maintenance_lease WHERE record_id = 1');
    if (state?.enabled !== 1 || lease?.run_token !== runToken) throw new ImportLifecycleBlockedError();
  }

  async function correctionTargetExists(db: SqliteDatabase, overlay: CorrectionOverlay) {
    const target = overlay.targetKind === 'evidence'
      ? await db.getFirstAsync<{ evidence_id: string }>('SELECT evidence_id FROM canonical_evidence WHERE evidence_id = ?', overlay.targetId)
      : await db.getFirstAsync<{ history_id: string }>('SELECT history_id FROM inferred_history WHERE history_id = ?', overlay.targetId);
    return target !== null;
  }

  return {
    getCheckpoint: read,
    loadCoverage: read,
    async getPrivateRecordLifecycle() {
      return lifecycle(await open());
    },
    async connectPrivateRecord() {
      const db = await open();
      await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
      try {
        await db.runAsync('INSERT OR IGNORE INTO private_history_record (record_id, schema_version) VALUES (?, ?)', 1, 3);
        await db.runAsync('INSERT INTO private_record_lifecycle (record_id, state) VALUES (?, ?) ON CONFLICT(record_id) DO UPDATE SET state = excluded.state', 1, 'connected');
        await db.execAsync('COMMIT');
      } catch (error) {
        await db.execAsync('ROLLBACK');
        throw error;
      }
    },
    async disconnectPrivateRecord() {
      const db = await open();
      await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
      try {
        const current = await lifecycle(db);
        if (current.state === 'deleted') throw new Error('No private record is available to disconnect.');
        await db.runAsync('UPDATE private_record_lifecycle SET state = ? WHERE record_id = 1', 'disconnected');
        await db.execAsync('COMMIT');
      } catch (error) {
        await db.execAsync('ROLLBACK');
        throw error;
      }
    },
    async deleteLocalHistory() {
      const db = await open();
      await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
      try {
        await db.execAsync(`
          DELETE FROM correction_markers;
          DELETE FROM correction_overlays;
          DELETE FROM inferred_history;
          DELETE FROM canonical_evidence;
          DELETE FROM import_source_index;
          DELETE FROM import_checkpoint;
          DELETE FROM maintenance_change_queue;
          DELETE FROM maintenance_source_presence;
          DELETE FROM maintenance_checkpoint;
          DELETE FROM maintenance_state;
          DELETE FROM maintenance_lease;
          DELETE FROM maintenance_run_sequence;
          DELETE FROM local_cache_registry;
          DELETE FROM private_record_lifecycle;
          DELETE FROM private_history_record;
        `);
        await db.execAsync('COMMIT');
      } catch (error) {
        await db.execAsync('ROLLBACK');
        throw error;
      }
    },
    async saveCorrectionOverlay(overlay: CorrectionOverlay) {
      if (!overlay.overlayId || !overlay.targetId || !Number.isFinite(overlay.createdAtMillis) || (overlay.replacesOverlayId !== null && overlay.replacesOverlayId === overlay.overlayId)) {
        throw new Error('Correction overlay requires distinct stable identifiers.');
      }
      const db = await open();
      await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
      try {
        await assertImportActive(db);
        if (!await correctionTargetExists(db, overlay)) throw new Error('Correction overlay requires an existing stable target.');
        if (overlay.replacesOverlayId !== null && !(await db.getFirstAsync<{ overlay_id: string }>(
          'SELECT overlay_id FROM correction_overlays WHERE overlay_id = ? AND target_kind = ? AND target_id = ? AND correction_scope = ?',
          overlay.replacesOverlayId,
          overlay.targetKind,
          overlay.targetId,
          overlay.scope,
        ))) throw new Error('Correction overlay replacement must match its target and scope.');
        const revision = (await db.getFirstAsync<RevisionRow>(
          'SELECT MAX(revision) AS revision FROM correction_overlays WHERE target_kind = ? AND target_id = ? AND correction_scope = ?',
          overlay.targetKind,
          overlay.targetId,
          overlay.scope,
        ))?.revision ?? 0;
        await db.runAsync(
          `INSERT INTO correction_overlays
            (overlay_id, target_kind, target_id, correction_scope, owner_action, owner_value, created_at_millis, identity_lineage_id, revision, replaces_overlay_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          overlay.overlayId,
          overlay.targetKind,
          overlay.targetId,
          overlay.scope,
          overlay.action,
          overlay.ownerValue,
          overlay.createdAtMillis,
          overlay.identityLineageId,
          revision + 1,
          overlay.replacesOverlayId,
        );
        await db.execAsync('COMMIT');
      } catch (error) {
        await db.execAsync('ROLLBACK');
        throw error;
      }
    },
    async commitPage(checkpoint, candidates) {
      const db = await open();
      await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
      try {
        await assertImportActive(db);
        for (const candidate of candidates) {
          await db.runAsync(
            `INSERT INTO import_source_index
              (asset_id, media_type, captured_at_millis, modified_at_millis, location_available, availability)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(asset_id) DO UPDATE SET
              media_type = excluded.media_type,
              captured_at_millis = excluded.captured_at_millis,
              modified_at_millis = excluded.modified_at_millis,
              location_available = excluded.location_available,
             availability = excluded.availability`,
            candidate.assetId,
            candidate.mediaType,
            candidate.capturedAtMillis,
            candidate.modifiedAtMillis,
            candidate.locationAvailable === null ? null : Number(candidate.locationAvailable),
            candidate.availability,
          );
          // A later foreground import is also proof this stable identity is
          // present. Do not overwrite a live maintenance run marker.
          await db.runAsync('INSERT OR IGNORE INTO maintenance_source_presence (asset_id, last_seen_run) VALUES (?, ?)', candidate.assetId, 0);
          await db.runAsync(
            `INSERT INTO canonical_evidence
              (evidence_id, source_ref, media_type, captured_at_millis, modified_at_millis, location_available, availability)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(source_ref) DO UPDATE SET
              media_type = excluded.media_type,
              captured_at_millis = excluded.captured_at_millis,
              modified_at_millis = excluded.modified_at_millis,
              location_available = excluded.location_available,
              availability = excluded.availability`,
            candidate.assetId,
            candidate.assetId,
            candidate.mediaType,
            candidate.capturedAtMillis,
            candidate.modifiedAtMillis,
            candidate.locationAvailable === null ? null : Number(candidate.locationAvailable),
            candidate.availability,
          );
        }
        await db.runAsync(
          `INSERT INTO import_checkpoint (scope, next_offset, scanned, geotagged, unavailable, status)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(scope) DO UPDATE SET next_offset = excluded.next_offset, scanned = excluded.scanned,
             geotagged = excluded.geotagged, unavailable = excluded.unavailable, status = excluded.status`,
          checkpoint.scope,
          checkpoint.nextOffset,
          checkpoint.scanned,
          checkpoint.geotagged,
          checkpoint.unavailable,
          checkpoint.status,
        );
        await db.execAsync('COMMIT');
      } catch (error) {
        await db.execAsync('ROLLBACK');
        throw error;
      }
    },
    async loadMaintenance() {
      const row = await (await open()).getFirstAsync<MaintenanceStateRow>(
        'SELECT enabled, status, last_checked_at_millis, last_updated_at_millis, message FROM maintenance_state WHERE record_id = 1',
      );
      return row ? {
        enabled: row.enabled === 1, status: row.status, lastCheckedAtMillis: row.last_checked_at_millis,
        lastUpdatedAtMillis: row.last_updated_at_millis, message: row.message,
      } : { enabled: false, status: 'disabled', lastCheckedAtMillis: null, lastUpdatedAtMillis: null, message: null };
    },
    async saveMaintenance(snapshot) {
      const db = await open();
      await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
      try {
        await assertImportActive(db);
        await db.runAsync(
          `INSERT INTO maintenance_state (record_id, enabled, status, last_checked_at_millis, last_updated_at_millis, message)
           VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(record_id) DO UPDATE SET enabled=excluded.enabled, status=excluded.status,
           last_checked_at_millis=excluded.last_checked_at_millis, last_updated_at_millis=excluded.last_updated_at_millis, message=excluded.message`,
          1, Number(snapshot.enabled), snapshot.status, snapshot.lastCheckedAtMillis, snapshot.lastUpdatedAtMillis, snapshot.message,
        );
        await db.execAsync('COMMIT');
      } catch (error) { await db.execAsync('ROLLBACK'); throw error; }
    },
    async getMaintenanceCheckpoint() {
      const row = await (await open()).getFirstAsync<MaintenanceCheckpointRow>(
        'SELECT scope, next_offset, run_token, status FROM maintenance_checkpoint WHERE record_id = 1',
      );
      return row && { scope: row.scope, nextOffset: row.next_offset, runToken: row.run_token, status: row.status };
    },
    async reconcileMaintenancePage(checkpoint, candidates) {
      const db = await open();
      await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
      try {
        await assertMaintenanceWritable(db, checkpoint.runToken);
        for (const candidate of candidates) {
          const prior = await db.getFirstAsync<SourceRow>('SELECT modified_at_millis, availability FROM import_source_index WHERE asset_id = ?', candidate.assetId);
          const kind = !prior ? 'added' : prior.availability !== 'available' && candidate.availability === 'available' ? 'available'
            : prior.modified_at_millis !== candidate.modifiedAtMillis || prior.availability !== candidate.availability ? 'changed' : null;
          await db.runAsync(
            `INSERT INTO import_source_index (asset_id, media_type, captured_at_millis, modified_at_millis, location_available, availability)
             VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(asset_id) DO UPDATE SET media_type=excluded.media_type,
             captured_at_millis=excluded.captured_at_millis, modified_at_millis=excluded.modified_at_millis,
             location_available=excluded.location_available, availability=excluded.availability
             WHERE modified_at_millis IS NOT excluded.modified_at_millis OR availability IS NOT excluded.availability OR
             media_type IS NOT excluded.media_type OR captured_at_millis IS NOT excluded.captured_at_millis OR location_available IS NOT excluded.location_available`,
            candidate.assetId, candidate.mediaType, candidate.capturedAtMillis, candidate.modifiedAtMillis,
            candidate.locationAvailable === null ? null : Number(candidate.locationAvailable), candidate.availability,
          );
          if (kind) await db.runAsync(
            `INSERT INTO canonical_evidence
              (evidence_id, source_ref, media_type, captured_at_millis, modified_at_millis, location_available, availability)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(source_ref) DO UPDATE SET media_type=excluded.media_type,
              captured_at_millis=excluded.captured_at_millis, modified_at_millis=excluded.modified_at_millis,
              location_available=excluded.location_available, availability=excluded.availability
              WHERE modified_at_millis IS NOT excluded.modified_at_millis OR availability IS NOT excluded.availability OR
              media_type IS NOT excluded.media_type OR captured_at_millis IS NOT excluded.captured_at_millis OR location_available IS NOT excluded.location_available`,
            candidate.assetId, candidate.assetId, candidate.mediaType, candidate.capturedAtMillis,
            candidate.modifiedAtMillis, candidate.locationAvailable === null ? null : Number(candidate.locationAvailable), candidate.availability,
          );
          await db.runAsync('INSERT INTO maintenance_source_presence (asset_id, last_seen_run, missing_full_scans) VALUES (?, ?, 0) ON CONFLICT(asset_id) DO UPDATE SET last_seen_run=excluded.last_seen_run, missing_full_scans=0', candidate.assetId, checkpoint.runToken);
          if (kind) await db.runAsync('INSERT OR IGNORE INTO maintenance_change_queue (asset_id, change_kind, source_revision) VALUES (?, ?, ?)', candidate.assetId, kind, candidate.modifiedAtMillis ?? -1);
        }
        await db.runAsync(
          `INSERT INTO maintenance_checkpoint (record_id, scope, next_offset, run_token, status) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(record_id) DO UPDATE SET scope=excluded.scope, next_offset=excluded.next_offset, run_token=excluded.run_token, status=excluded.status`,
          1, checkpoint.scope, checkpoint.nextOffset, checkpoint.runToken, checkpoint.status,
        );
        await db.execAsync('COMMIT');
      } catch (error) { await db.execAsync('ROLLBACK'); throw error; }
    },
    async completeMaintenanceRun(checkpoint, completedAtMillis) {
      const db = await open();
      await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
      try {
        await assertImportActive(db);
        if (checkpoint.scope === 'full') {
          // Offset pagination can shift while the library changes. Require two
          // consecutive completed full scans before producing a deletion event.
          await db.runAsync('UPDATE maintenance_source_presence SET missing_full_scans = missing_full_scans + 1 WHERE last_seen_run <> ?', checkpoint.runToken);
          await db.runAsync('INSERT OR IGNORE INTO maintenance_change_queue (asset_id, change_kind, source_revision) SELECT asset_id, ?, ? FROM maintenance_source_presence WHERE missing_full_scans >= ?', 'deleted', -1, 2);
          await db.runAsync('DELETE FROM maintenance_source_presence WHERE missing_full_scans >= ?', 2);
        }
        await db.runAsync('UPDATE maintenance_checkpoint SET status = ? WHERE record_id = 1', 'complete');
        await db.runAsync('UPDATE maintenance_state SET status=?, last_checked_at_millis=?, last_updated_at_millis=?, message=NULL WHERE record_id=1', 'checked', completedAtMillis, completedAtMillis);
        await db.execAsync('COMMIT');
      } catch (error) { await db.execAsync('ROLLBACK'); throw error; }
    },
    async pauseMaintenance(checkpoint, message) {
      await this.reconcileMaintenancePage({ ...checkpoint, status: 'paused' }, []);
      await this.saveMaintenance({ ...(await this.loadMaintenance()), status: 'paused', message });
    },
    async acquireMaintenanceLease(nowMillis) {
      const db = await open();
      await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
      try {
        await assertImportActive(db);
        const state = await db.getFirstAsync<{ enabled: number }>('SELECT enabled FROM maintenance_state WHERE record_id = 1');
        const existingLease = await db.getFirstAsync<{ run_token: number; expires_at_millis: number }>('SELECT run_token, expires_at_millis FROM maintenance_lease WHERE record_id = 1');
        if (state?.enabled !== 1 || (existingLease && existingLease.expires_at_millis > nowMillis)) {
          await db.execAsync('COMMIT'); return null;
        }
        const sequence = await db.getFirstAsync<{ next_token: number }>('SELECT next_token FROM maintenance_run_sequence WHERE record_id = 1');
        const token = sequence?.next_token ?? 1;
        await db.runAsync('INSERT INTO maintenance_run_sequence (record_id, next_token) VALUES (?, ?) ON CONFLICT(record_id) DO UPDATE SET next_token=excluded.next_token', 1, token + 1);
        await db.runAsync(
          'INSERT INTO maintenance_lease (record_id, run_token, expires_at_millis) VALUES (?, ?, ?) ON CONFLICT(record_id) DO UPDATE SET run_token=excluded.run_token, expires_at_millis=excluded.expires_at_millis',
          1, token, nowMillis + MAINTENANCE_LEASE_MILLIS,
        );
        await db.execAsync('COMMIT'); return token;
      } catch (error) { await db.execAsync('ROLLBACK'); throw error; }
    },
    async renewMaintenanceLease(runToken, nowMillis) {
      const db = await open();
      await db.runAsync(
        'UPDATE maintenance_lease SET expires_at_millis = ? WHERE record_id = 1 AND run_token = ?',
        nowMillis + MAINTENANCE_LEASE_MILLIS, runToken,
      );
      return (await db.getFirstAsync<{ run_token: number }>('SELECT run_token FROM maintenance_lease WHERE record_id = 1 AND run_token = ?', runToken)) !== null;
    },
    async releaseMaintenanceLease(runToken) {
      const db = await open();
      await db.runAsync('DELETE FROM maintenance_lease WHERE record_id = 1 AND run_token = ?', runToken);
    },
  };
}
