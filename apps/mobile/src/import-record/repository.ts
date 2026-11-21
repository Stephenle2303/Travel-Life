import type { CorrectionOverlay, PrivateRecordLifecycle } from '@/history-record';
import { runOwnedTransaction, serializeNativeTransactions } from '@/database/native-transaction';
import { nextFirstRevealReceipt, type FirstRevealReceipt } from '@/reconstruction/first-reveal-question';
import { classifyAppDiagnosticError, createDiagnosticCorrelationId, recordAppDiagnostic } from '@/diagnostics/app-diagnostics';
import { assertReplicaOpen, trackReplicaConnection } from '@/account/replica-connections';

import {
  HomeSetupConflictError, ImportLifecycleBlockedError, type ConfiguredHomeArea, type ImportCheckpoint, type ImportRepository, type ImportScope,
  type MaintenanceCheckpoint, type MaintenanceRepository, type MaintenanceSnapshot, type ReconciliationSnapshot, type SourceCandidate,
} from './types';
import type { ClueKind, ClueLifecycleState, ClueRecord } from '@/clues/types';

type SqliteDatabase = {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, ...params: (string | number | null)[]): Promise<unknown>;
  getFirstAsync<T>(source: string, ...params: (string | number | null)[]): Promise<T | null>;
  getAllAsync<T>(source: string, ...params: (string | number | null)[]): Promise<T[]>;
};

type CheckpointRow = {
  scope: ImportScope;
  next_offset: number;
  scanned: number;
  geotagged: number;
  unavailable: number;
  status: ImportCheckpoint['status'];
};

export type ClueRow = {
  clue_id: string; kind: ClueKind; subject_json: string; value_json: string; strength: ClueRecord['strength'];
  independence_key: string; producer_id: string; producer_version: string; evidence_revision: number;
  home_revision: number; correction_revision: number; state: ClueLifecycleState; created_at_millis: number;
};

/** Reconstructs the closed, kind-discriminated `ClueRecord` from a stored
 * row. `value_json` is trusted local storage, the same way other correction
 * JSON blobs in this file are — this repository never validates clue
 * producer output, only round-trips it (clues/store.ts validates meaning).
 * Exported so `reconstruction/repository.ts`'s rebuild (same database, its
 * own raw `travel_clue` read) uses the identical row mapping — one clue
 * reader, not two that could silently disagree. Returns `null` for a
 * malformed row (bad JSON) rather than throwing: one corrupted clue must
 * never abort the whole rebuild, same as a malformed correction row is
 * never guessed at, just skipped. */
export function clueFromRow(row: ClueRow): ClueRecord | null {
  try {
    const base = {
      clueId: row.clue_id, subject: JSON.parse(row.subject_json), strength: row.strength, independenceKey: row.independence_key,
      producerId: row.producer_id, producerVersion: row.producer_version,
      inputsRevision: { evidenceRevision: row.evidence_revision, homeRevision: row.home_revision, correctionRevision: row.correction_revision },
      state: row.state, createdAtMillis: row.created_at_millis,
    };
    return { ...base, kind: row.kind, value: JSON.parse(row.value_json) } as ClueRecord;
  } catch { return null; }
}

export const CURRENT_SCHEMA_VERSION = 50;
const validCivilDay = (day: string | null) => Boolean(day && /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(day)
  && new Date(`${day}T00:00:00.000Z`).toISOString().slice(0, 10) === day);

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

// Exact coordinates are stored only in the private on-device record. They are
// intentionally absent from coverage, UI state, logs, caches, and sync APIs.
const migrationV6 = `
  ALTER TABLE import_source_index ADD COLUMN latitude REAL NULL;
  ALTER TABLE import_source_index ADD COLUMN longitude REAL NULL;
  ALTER TABLE import_source_index ADD COLUMN reported_accuracy_meters REAL NULL;
  ALTER TABLE canonical_evidence ADD COLUMN latitude REAL NULL;
  ALTER TABLE canonical_evidence ADD COLUMN longitude REAL NULL;
  ALTER TABLE canonical_evidence ADD COLUMN reported_accuracy_meters REAL NULL;
  UPDATE private_history_record SET schema_version = 6 WHERE record_id = 1;
`;

const migrationV7 = `
  CREATE TABLE IF NOT EXISTS reconstruction_run (
    run_id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_version TEXT NOT NULL,
    evidence_revision INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('complete', 'pending', 'restricted')),
    completed_at_millis INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS reconstruction_place (
    place_id TEXT PRIMARY KEY NOT NULL,
    run_id INTEGER NOT NULL,
    representative_evidence_id TEXT NOT NULL,
    uncertainty_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS reconstruction_visit (
    visit_id TEXT PRIMARY KEY NOT NULL,
    run_id INTEGER NOT NULL,
    place_id TEXT NOT NULL,
    ordering TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS reconstruction_journey (
    journey_id TEXT PRIMARY KEY NOT NULL,
    run_id INTEGER NOT NULL,
    journey_state TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS reconstruction_link (
    run_id INTEGER NOT NULL,
    link_kind TEXT NOT NULL,
    parent_id TEXT NOT NULL,
    child_id TEXT NOT NULL,
    PRIMARY KEY (run_id, link_kind, parent_id, child_id)
  );
  CREATE TABLE IF NOT EXISTS reconstruction_disposition (
    run_id INTEGER NOT NULL,
    evidence_id TEXT NOT NULL,
    disposition_state TEXT NOT NULL,
    reasons_json TEXT NOT NULL,
    PRIMARY KEY (run_id, evidence_id)
  );
  UPDATE private_history_record SET schema_version = 7 WHERE record_id = 1;
`;

// The device's recorded civil capture date is distinct from an instant.  Keep
// both private so reconstruction can decline to invent a timezone offset.
const migrationV8 = `
  ALTER TABLE import_source_index ADD COLUMN captured_day TEXT NULL;
  ALTER TABLE import_source_index ADD COLUMN has_precise_offset INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE canonical_evidence ADD COLUMN captured_day TEXT NULL;
  ALTER TABLE canonical_evidence ADD COLUMN has_precise_offset INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE private_history_record ADD COLUMN canonical_evidence_revision INTEGER NOT NULL DEFAULT 0;
  UPDATE private_history_record SET schema_version = 8 WHERE record_id = 1;
`;

// The queue itself contains opaque source references and is consumed only in
// the same private SQLite transaction that publishes a complete graph.
const migrationV9 = `
  CREATE TABLE IF NOT EXISTS reconciliation_state (
    record_id INTEGER PRIMARY KEY CHECK (record_id = 1),
    status TEXT NOT NULL, last_checked_at_millis INTEGER NULL,
    last_updated_at_millis INTEGER NULL, new_journey_count INTEGER NOT NULL DEFAULT 0,
    updated_journey_count INTEGER NOT NULL DEFAULT 0, message TEXT NULL
  );
  INSERT OR IGNORE INTO reconciliation_state
    (record_id, status, last_checked_at_millis, last_updated_at_millis, new_journey_count, updated_journey_count, message)
    VALUES (1, 'idle', NULL, NULL, 0, 0, NULL);
  UPDATE private_history_record SET schema_version = 9 WHERE record_id = 1;
`;

// A snapshot has immutable opaque queue keys. It lets a later producer write
// a newer revision without a successful reconciliation acknowledging it.
const migrationV10 = `
  CREATE TABLE IF NOT EXISTS reconciliation_checkpoint (
    record_id INTEGER PRIMARY KEY CHECK (record_id = 1),
    snapshot_revision INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL,
    started_at_millis INTEGER NULL, message TEXT NULL
  );
  CREATE TABLE IF NOT EXISTS reconciliation_queue_snapshot (
    snapshot_revision INTEGER NOT NULL, asset_id TEXT NOT NULL,
    change_kind TEXT NOT NULL, source_revision INTEGER NOT NULL,
    PRIMARY KEY (snapshot_revision, asset_id, change_kind, source_revision)
  );
  CREATE TABLE IF NOT EXISTS reconciliation_unresolved_remap (
    overlay_id TEXT PRIMARY KEY NOT NULL, target_id TEXT NOT NULL,
    identity_lineage_id TEXT NULL, reason TEXT NOT NULL
  );
  INSERT OR IGNORE INTO reconciliation_checkpoint (record_id, snapshot_revision, status, started_at_millis, message)
    VALUES (1, 0, 'idle', NULL, NULL);
  UPDATE private_history_record SET schema_version = 10 WHERE record_id = 1;
`;

const migrationV11 = `
  CREATE TABLE IF NOT EXISTS reconciliation_lease (
    record_id INTEGER PRIMARY KEY CHECK (record_id = 1), owner_token INTEGER NOT NULL,
    expires_at_millis INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS reconciliation_run_sequence (
    record_id INTEGER PRIMARY KEY CHECK (record_id = 1), next_token INTEGER NOT NULL
  );
  INSERT OR IGNORE INTO reconciliation_run_sequence (record_id, next_token) VALUES (1, 1);
  UPDATE private_history_record SET schema_version = 11 WHERE record_id = 1;
`;

// Country metadata is derived only from the durable reconstructed place during
// an on-device rebuild. It never changes canonical evidence or leaves SQLite.
const migrationV12 = `
  ALTER TABLE reconstruction_place ADD COLUMN country_code TEXT NULL;
  ALTER TABLE reconstruction_place ADD COLUMN country_dataset_version TEXT NULL;
  UPDATE private_history_record SET schema_version = 12 WHERE record_id = 1;
`;

// Corrections deliberately retain canonical evidence ids and a completed-run
// snapshot. Generated reconstruction ids are never used as durable identity.
const migrationV13 = `
  CREATE TABLE IF NOT EXISTS journey_correction_revision (
    revision_id TEXT PRIMARY KEY NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('confirm', 'reject')),
    source_run_id INTEGER NOT NULL,
    journey_id TEXT NOT NULL,
    reviewed_support_json TEXT NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('effective', 'pending_remap', 'superseded')),
    created_at_millis INTEGER NOT NULL,
    replaces_revision_id TEXT NULL
  );
  CREATE INDEX IF NOT EXISTS journey_correction_target ON journey_correction_revision (journey_id, source_run_id, created_at_millis);
  UPDATE private_history_record SET schema_version = 13 WHERE record_id = 1;
`;

// An application records the exact generated successor for one immutable owner
// revision. It is separate from the revision because generated journey IDs may
// change across a later complete rebuild.
const migrationV14 = `
  CREATE TABLE IF NOT EXISTS journey_correction_application (
    revision_id TEXT NOT NULL,
    run_id INTEGER NOT NULL,
    journey_id TEXT NOT NULL,
    application_state TEXT NOT NULL CHECK (application_state IN ('effective', 'pending_remap')),
    PRIMARY KEY (revision_id, run_id)
  );
  CREATE INDEX IF NOT EXISTS journey_correction_application_run ON journey_correction_application (run_id, journey_id);
  UPDATE private_history_record SET schema_version = 14 WHERE record_id = 1;
`;

const migrationV15 = `
  ALTER TABLE journey_correction_revision ADD COLUMN reviewed_snapshot_json TEXT NOT NULL DEFAULT '{}';
  UPDATE private_history_record SET schema_version = 15 WHERE record_id = 1;
`;

const migrationV16 = `
  CREATE TABLE IF NOT EXISTS journey_correction_candidate (
    candidate_id TEXT PRIMARY KEY NOT NULL,
    revision_id TEXT NOT NULL,
    base_run_id INTEGER NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('pending_remap', 'resolved', 'superseded')),
    reason TEXT NOT NULL,
    created_at_millis INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS journey_correction_candidate_revision ON journey_correction_candidate (revision_id, state);
  UPDATE private_history_record SET schema_version = 16 WHERE record_id = 1;
`;

// Store each reviewed visit separately. A flattened journey-wide list cannot
// distinguish an exact successor from a split reviewed visit on a later rebuild.
const migrationV17 = `
  ALTER TABLE journey_correction_revision ADD COLUMN reviewed_visits_json TEXT NOT NULL DEFAULT '[]';
  ALTER TABLE journey_correction_revision ADD COLUMN command_key TEXT NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS journey_correction_command ON journey_correction_revision (command_key) WHERE command_key IS NOT NULL;
  UPDATE private_history_record SET schema_version = 17 WHERE record_id = 1;
`;

// A rejection is enforced as a durable grouping constraint and can deliberately
// remove its predecessor journey. Its application therefore has no generated
// journey target. Rebuild this narrow table to represent either case explicitly.
const migrationV18 = `
  DROP INDEX IF EXISTS journey_correction_application_run;
  ALTER TABLE journey_correction_application RENAME TO journey_correction_application_legacy;
  CREATE TABLE journey_correction_application (
    revision_id TEXT NOT NULL,
    run_id INTEGER NOT NULL,
    target_kind TEXT NOT NULL CHECK (target_kind IN ('journey', 'grouping-constraint')),
    journey_id TEXT NULL,
    application_state TEXT NOT NULL CHECK (application_state IN ('effective', 'pending_remap')),
    PRIMARY KEY (revision_id, run_id),
    CHECK ((target_kind = 'journey' AND journey_id IS NOT NULL) OR (target_kind = 'grouping-constraint' AND journey_id IS NULL))
  );
  INSERT INTO journey_correction_application (revision_id, run_id, target_kind, journey_id, application_state)
    SELECT revision_id, run_id, 'journey', journey_id, application_state
    FROM journey_correction_application_legacy;
  DROP TABLE journey_correction_application_legacy;
  CREATE INDEX journey_correction_application_run ON journey_correction_application (run_id, target_kind, journey_id);
  UPDATE private_history_record SET schema_version = 18 WHERE record_id = 1;
`;

// Owner-written labels and dates are claims, not reconstructed evidence. They
// stay on the immutable correction revision so an exact successor remap can
// carry them without changing visits, places, or source support.
const migrationV19 = `
  ALTER TABLE journey_correction_revision ADD COLUMN owner_title TEXT NULL;
  ALTER TABLE journey_correction_revision ADD COLUMN owner_date_kind TEXT NULL CHECK (owner_date_kind IN ('exact', 'approximate'));
  ALTER TABLE journey_correction_revision ADD COLUMN owner_date_start TEXT NULL;
  ALTER TABLE journey_correction_revision ADD COLUMN owner_date_end TEXT NULL;
  UPDATE private_history_record SET schema_version = 19 WHERE record_id = 1;
`;

// SQLite cannot extend the original action CHECK in place. Rebuild the
// immutable revision table so claim revisions share the existing remap and
// audit trail while confirmation and rejection semantics remain unchanged.
const migrationV20 = `
  DROP INDEX IF EXISTS journey_correction_target;
  DROP INDEX IF EXISTS journey_correction_command;
  ALTER TABLE journey_correction_revision RENAME TO journey_correction_revision_legacy;
  CREATE TABLE journey_correction_revision (
    revision_id TEXT PRIMARY KEY NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('confirm', 'reject', 'claim')),
    source_run_id INTEGER NOT NULL,
    journey_id TEXT NOT NULL,
    reviewed_support_json TEXT NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('effective', 'pending_remap', 'superseded')),
    created_at_millis INTEGER NOT NULL,
    replaces_revision_id TEXT NULL,
    reviewed_snapshot_json TEXT NOT NULL DEFAULT '{}',
    reviewed_visits_json TEXT NOT NULL DEFAULT '[]',
    command_key TEXT NULL,
    owner_title TEXT NULL,
    owner_date_kind TEXT NULL CHECK (owner_date_kind IN ('exact', 'approximate')),
    owner_date_start TEXT NULL,
    owner_date_end TEXT NULL
  );
  INSERT INTO journey_correction_revision
    (revision_id, action, source_run_id, journey_id, reviewed_support_json, state, created_at_millis, replaces_revision_id, reviewed_snapshot_json, reviewed_visits_json, command_key, owner_title, owner_date_kind, owner_date_start, owner_date_end)
    SELECT revision_id, action, source_run_id, journey_id, reviewed_support_json, state, created_at_millis, replaces_revision_id, reviewed_snapshot_json, reviewed_visits_json, command_key, owner_title, owner_date_kind, owner_date_start, owner_date_end
    FROM journey_correction_revision_legacy;
  DROP TABLE journey_correction_revision_legacy;
  CREATE INDEX journey_correction_target ON journey_correction_revision (journey_id, source_run_id, created_at_millis);
  CREATE UNIQUE INDEX journey_correction_command ON journey_correction_revision (command_key) WHERE command_key IS NOT NULL;
  UPDATE private_history_record SET schema_version = 20 WHERE record_id = 1;
`;

// Photo-to-journey choices are distinct from visit support. Each immutable
// revision retains the selected photo and the reviewed target support needed
// to remap its one primary membership without exposing media identifiers in UI.
const migrationV21 = `
  CREATE TABLE IF NOT EXISTS journey_memory_correction_revision (
    revision_id TEXT PRIMARY KEY NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('assign', 'move', 'reject', 'unassign')),
    source_run_id INTEGER NOT NULL,
    source_evidence_id TEXT NOT NULL,
    journey_id TEXT NOT NULL,
    reviewed_support_json TEXT NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('effective', 'pending_remap', 'superseded')),
    created_at_millis INTEGER NOT NULL,
    replaces_revision_id TEXT NULL,
    command_key TEXT NOT NULL UNIQUE
  );
  CREATE TABLE IF NOT EXISTS journey_memory_correction_application (
    revision_id TEXT NOT NULL,
    run_id INTEGER NOT NULL,
    journey_id TEXT NULL,
    application_state TEXT NOT NULL CHECK (application_state IN ('effective', 'pending_remap')),
    PRIMARY KEY (revision_id, run_id)
  );
  CREATE INDEX IF NOT EXISTS journey_memory_correction_target ON journey_memory_correction_revision (source_evidence_id, created_at_millis);
  CREATE INDEX IF NOT EXISTS journey_memory_correction_application_run ON journey_memory_correction_application (run_id, journey_id);
  UPDATE private_history_record SET schema_version = 21 WHERE record_id = 1;
`;

// Structural corrections must remain immutable and auditable. SQLite cannot
// widen the v20 action CHECK, so carry every existing revision forward before
// allowing a reviewed split boundary to be stored.
const migrationV22 = `
  DROP INDEX IF EXISTS journey_correction_target;
  DROP INDEX IF EXISTS journey_correction_command;
  ALTER TABLE journey_correction_revision RENAME TO journey_correction_revision_legacy;
  CREATE TABLE journey_correction_revision (
    revision_id TEXT PRIMARY KEY NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('confirm', 'reject', 'claim', 'split')),
    source_run_id INTEGER NOT NULL,
    journey_id TEXT NOT NULL,
    reviewed_support_json TEXT NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('effective', 'pending_remap', 'superseded')),
    created_at_millis INTEGER NOT NULL,
    replaces_revision_id TEXT NULL,
    reviewed_snapshot_json TEXT NOT NULL DEFAULT '{}',
    reviewed_visits_json TEXT NOT NULL DEFAULT '[]',
    command_key TEXT NULL,
    owner_title TEXT NULL,
    owner_date_kind TEXT NULL CHECK (owner_date_kind IN ('exact', 'approximate')),
    owner_date_start TEXT NULL,
    owner_date_end TEXT NULL,
    structural_boundary_json TEXT NULL
  );
  INSERT INTO journey_correction_revision
    (revision_id, action, source_run_id, journey_id, reviewed_support_json, state, created_at_millis, replaces_revision_id, reviewed_snapshot_json, reviewed_visits_json, command_key, owner_title, owner_date_kind, owner_date_start, owner_date_end)
    SELECT revision_id, action, source_run_id, journey_id, reviewed_support_json, state, created_at_millis, replaces_revision_id, reviewed_snapshot_json, reviewed_visits_json, command_key, owner_title, owner_date_kind, owner_date_start, owner_date_end
    FROM journey_correction_revision_legacy;
  DROP TABLE journey_correction_revision_legacy;
  CREATE INDEX journey_correction_target ON journey_correction_revision (journey_id, source_run_id, created_at_millis);
  CREATE UNIQUE INDEX journey_correction_command ON journey_correction_revision (command_key) WHERE command_key IS NOT NULL;
  UPDATE private_history_record SET schema_version = 22 WHERE record_id = 1;
`;

const migrationV23 = `
  DROP INDEX IF EXISTS journey_correction_target;
  DROP INDEX IF EXISTS journey_correction_command;
  ALTER TABLE journey_correction_revision RENAME TO journey_correction_revision_legacy;
  CREATE TABLE journey_correction_revision (
    revision_id TEXT PRIMARY KEY NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('confirm', 'reject', 'claim', 'split', 'merge')),
    source_run_id INTEGER NOT NULL,
    journey_id TEXT NOT NULL,
    reviewed_support_json TEXT NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('effective', 'pending_remap', 'superseded')),
    created_at_millis INTEGER NOT NULL,
    replaces_revision_id TEXT NULL,
    reviewed_snapshot_json TEXT NOT NULL DEFAULT '{}',
    reviewed_visits_json TEXT NOT NULL DEFAULT '[]',
    command_key TEXT NULL,
    owner_title TEXT NULL,
    owner_date_kind TEXT NULL CHECK (owner_date_kind IN ('exact', 'approximate')),
    owner_date_start TEXT NULL,
    owner_date_end TEXT NULL,
    structural_boundary_json TEXT NULL
  );
  INSERT INTO journey_correction_revision SELECT * FROM journey_correction_revision_legacy;
  DROP TABLE journey_correction_revision_legacy;
  CREATE INDEX journey_correction_target ON journey_correction_revision (journey_id, source_run_id, created_at_millis);
  CREATE UNIQUE INDEX journey_correction_command ON journey_correction_revision (command_key) WHERE command_key IS NOT NULL;
  UPDATE private_history_record SET schema_version = 23 WHERE record_id = 1;
`;

// A valid structural save publishes successors immediately, but predecessor-wide
// claims cannot be silently copied to those successors. Keep the private source
// revision and each affected successor in an explicit owner-review queue.
const migrationV24 = `
  CREATE TABLE IF NOT EXISTS journey_correction_scope_review (
    scope_review_id TEXT PRIMARY KEY NOT NULL,
    structural_revision_id TEXT NOT NULL,
    predecessor_revision_id TEXT NOT NULL,
    run_id INTEGER NOT NULL,
    journey_id TEXT NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('pending_scope_review', 'resolved', 'discarded')),
    created_at_millis INTEGER NOT NULL,
    UNIQUE (structural_revision_id, predecessor_revision_id, run_id, journey_id)
  );
  CREATE INDEX IF NOT EXISTS journey_correction_scope_review_target ON journey_correction_scope_review (run_id, journey_id, state);
  UPDATE private_history_record SET schema_version = 24 WHERE record_id = 1;
`;

const migrationV25 = `
  DROP INDEX IF EXISTS journey_correction_target;
  DROP INDEX IF EXISTS journey_correction_command;
  ALTER TABLE journey_correction_revision RENAME TO journey_correction_revision_legacy;
  CREATE TABLE journey_correction_revision (
    revision_id TEXT PRIMARY KEY NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('confirm', 'reject', 'claim', 'split', 'merge', 'remove-visit')),
    source_run_id INTEGER NOT NULL,
    journey_id TEXT NOT NULL,
    reviewed_support_json TEXT NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('effective', 'pending_remap', 'superseded')),
    created_at_millis INTEGER NOT NULL,
    replaces_revision_id TEXT NULL,
    reviewed_snapshot_json TEXT NOT NULL DEFAULT '{}',
    reviewed_visits_json TEXT NOT NULL DEFAULT '[]',
    command_key TEXT NULL,
    owner_title TEXT NULL,
    owner_date_kind TEXT NULL CHECK (owner_date_kind IN ('exact', 'approximate')),
    owner_date_start TEXT NULL,
    owner_date_end TEXT NULL,
    structural_boundary_json TEXT NULL
  );
  INSERT INTO journey_correction_revision SELECT * FROM journey_correction_revision_legacy;
  DROP TABLE journey_correction_revision_legacy;
  CREATE INDEX journey_correction_target ON journey_correction_revision (journey_id, source_run_id, created_at_millis);
  CREATE UNIQUE INDEX journey_correction_command ON journey_correction_revision (command_key) WHERE command_key IS NOT NULL;
  UPDATE private_history_record SET schema_version = 25 WHERE record_id = 1;
`;

// Memory corrections have their own immutable revision table, so an ambiguous
// remap needs an equally separate review queue rather than a fake journey row.
const migrationV26 = `
  CREATE TABLE IF NOT EXISTS journey_memory_correction_candidate (
    candidate_id TEXT PRIMARY KEY NOT NULL,
    revision_id TEXT NOT NULL,
    base_run_id INTEGER NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('pending_remap', 'resolved', 'superseded')),
    reason TEXT NOT NULL,
    created_at_millis INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS journey_memory_correction_candidate_revision ON journey_memory_correction_candidate (revision_id, state);
  UPDATE private_history_record SET schema_version = 26 WHERE record_id = 1;
`;

// Family identity is private import metadata. A fingerprint records the exact
// versioned tuple observed at import time; it is never exposed outside SQLite.
const migrationV27 = `
  ALTER TABLE import_source_index ADD COLUMN platform_duplicate_family_id TEXT NULL;
  ALTER TABLE import_source_index ADD COLUMN source_origin TEXT NULL;
  ALTER TABLE import_source_index ADD COLUMN support_eligible INTEGER NULL;
  ALTER TABLE import_source_index ADD COLUMN duplicate_tuple_version INTEGER NULL;
  ALTER TABLE import_source_index ADD COLUMN duplicate_tuple_fingerprint TEXT NULL;
  ALTER TABLE canonical_evidence ADD COLUMN platform_duplicate_family_id TEXT NULL;
  ALTER TABLE canonical_evidence ADD COLUMN source_origin TEXT NULL;
  ALTER TABLE canonical_evidence ADD COLUMN support_eligible INTEGER NULL;
  ALTER TABLE canonical_evidence ADD COLUMN duplicate_tuple_version INTEGER NULL;
  ALTER TABLE canonical_evidence ADD COLUMN duplicate_tuple_fingerprint TEXT NULL;
  UPDATE private_history_record SET schema_version = 27 WHERE record_id = 1;
`;

const migrationV28 = `
  ALTER TABLE journey_correction_revision ADD COLUMN reviewed_family_snapshot_json TEXT NOT NULL DEFAULT '{}';
  ALTER TABLE journey_memory_correction_revision ADD COLUMN reviewed_family_snapshot_json TEXT NOT NULL DEFAULT '{}';
  UPDATE private_history_record SET schema_version = 28 WHERE record_id = 1;
`;

// Qualification is a private, versioned projection. Keeping it separate from
// legacy journey_state prevents a rule change from rewriting correction-safe
// reconstruction identities or making a draft visible by accident.
const migrationV29 = `
  CREATE TABLE IF NOT EXISTS reconstruction_trip_qualification (
    run_id INTEGER NOT NULL,
    journey_id TEXT NOT NULL,
    classification TEXT NOT NULL CHECK (classification IN ('AUTO_CONFIRMED', 'USER_CONFIRMED', 'SUGGESTED', 'NOT_TRIP', 'UNCONFIRMED', 'REJECTED')),
    score INTEGER NOT NULL,
    qualification_path TEXT NULL,
    reasons_json TEXT NOT NULL,
    PRIMARY KEY (run_id, journey_id)
  );
  CREATE INDEX IF NOT EXISTS reconstruction_trip_qualification_primary
    ON reconstruction_trip_qualification (run_id, classification);
  -- Existing V1 rows have never passed the V1.1 context gates. Backfill them
  -- as private suggestions so an app upgrade cannot expose them through a
  -- missing qualification row or silently call them confirmed.
  INSERT OR IGNORE INTO reconstruction_trip_qualification
    (run_id, journey_id, classification, score, qualification_path, reasons_json)
    SELECT run_id, journey_id, 'SUGGESTED', 0, NULL, '["v1-1-context-not-yet-qualified"]'
    FROM reconstruction_journey;
  UPDATE private_history_record SET schema_version = 29 WHERE record_id = 1;
`;

const migrationV30 = `
  CREATE TABLE IF NOT EXISTS configured_home_area (
    area_id TEXT PRIMARY KEY,
    latitude REAL NOT NULL CHECK (latitude >= -90 AND latitude <= 90),
    longitude REAL NOT NULL CHECK (longitude >= -180 AND longitude <= 180),
    effective_start_day TEXT NULL,
    effective_end_day TEXT NULL,
    radius_meters REAL NOT NULL CHECK (radius_meters > 0 AND radius_meters <= 50000),
    CHECK (effective_start_day IS NULL OR effective_end_day IS NULL OR effective_start_day <= effective_end_day)
  );
  UPDATE private_history_record SET schema_version = 30 WHERE record_id = 1;
`;

// Labels are owner-entered local presentation metadata.  Existing areas remain
// active but deliberately unnamed; no city name is fabricated from coordinates.
const migrationV31 = `
  ALTER TABLE configured_home_area ADD COLUMN owner_label TEXT NULL;
  ALTER TABLE configured_home_area ADD COLUMN origin TEXT NOT NULL DEFAULT 'legacy' CHECK (origin IN ('observed-area', 'legacy'));
  UPDATE private_history_record SET schema_version = 31 WHERE record_id = 1;
`;

// Owner-selected place labels/anchors are local corrections, never imported
// evidence. Recreate this constrained table because SQLite cannot widen the
// existing action CHECK in place.
const migrationV32 = `
  DROP INDEX IF EXISTS journey_correction_target;
  DROP INDEX IF EXISTS journey_correction_command;
  ALTER TABLE journey_correction_revision RENAME TO journey_correction_revision_legacy;
  CREATE TABLE journey_correction_revision (
    revision_id TEXT PRIMARY KEY NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('confirm', 'reject', 'claim', 'place', 'split', 'merge', 'remove-visit')),
    source_run_id INTEGER NOT NULL,
    journey_id TEXT NOT NULL,
    reviewed_support_json TEXT NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('effective', 'pending_remap', 'superseded')),
    created_at_millis INTEGER NOT NULL,
    replaces_revision_id TEXT NULL,
    reviewed_snapshot_json TEXT NOT NULL DEFAULT '{}',
    reviewed_visits_json TEXT NOT NULL DEFAULT '[]',
    command_key TEXT NULL,
    owner_title TEXT NULL,
    owner_date_kind TEXT NULL CHECK (owner_date_kind IN ('exact', 'approximate')),
    owner_date_start TEXT NULL,
    owner_date_end TEXT NULL,
    structural_boundary_json TEXT NULL,
    reviewed_family_snapshot_json TEXT NOT NULL DEFAULT '{}',
    owner_place_id TEXT NULL,
    owner_place_name TEXT NULL,
    owner_place_context TEXT NULL,
    owner_latitude REAL NULL CHECK (owner_latitude >= -90 AND owner_latitude <= 90),
    owner_longitude REAL NULL CHECK (owner_longitude >= -180 AND owner_longitude <= 180)
  );
  INSERT INTO journey_correction_revision
    (revision_id, action, source_run_id, journey_id, reviewed_support_json, state, created_at_millis, replaces_revision_id, reviewed_snapshot_json, reviewed_visits_json, command_key, owner_title, owner_date_kind, owner_date_start, owner_date_end, structural_boundary_json, reviewed_family_snapshot_json)
  SELECT revision_id, action, source_run_id, journey_id, reviewed_support_json, state, created_at_millis, replaces_revision_id, reviewed_snapshot_json, reviewed_visits_json, command_key, owner_title, owner_date_kind, owner_date_start, owner_date_end, structural_boundary_json, reviewed_family_snapshot_json
  FROM journey_correction_revision_legacy;
  DROP TABLE journey_correction_revision_legacy;
  CREATE INDEX journey_correction_target ON journey_correction_revision (journey_id, source_run_id, created_at_millis);
  CREATE UNIQUE INDEX journey_correction_command ON journey_correction_revision (command_key) WHERE command_key IS NOT NULL;
  UPDATE private_history_record SET schema_version = 32 WHERE record_id = 1;
`;

// Manual assertions deliberately do not reuse reconstruction_journey, visit,
// evidence, qualification, or correction rows.  They can therefore survive a
// replacement reconstruction without acquiring fabricated support.
const manualJourneyTableSchema = `
  CREATE TABLE IF NOT EXISTS manual_journey (
    manual_id TEXT PRIMARY KEY NOT NULL,
    command_key TEXT NOT NULL UNIQUE,
    owner_label TEXT NOT NULL,
    owner_context TEXT NOT NULL,
    latitude REAL NOT NULL CHECK (latitude >= -90 AND latitude <= 90),
    longitude REAL NOT NULL CHECK (longitude >= -180 AND longitude <= 180),
    date_kind TEXT NOT NULL CHECK (date_kind IN ('exact', 'approximate')),
    date_start TEXT NOT NULL,
    date_end TEXT NOT NULL,
    created_at_millis INTEGER NOT NULL
  );
`;

const migrationV33 = `
  ${manualJourneyTableSchema}
  CREATE INDEX IF NOT EXISTS manual_journey_dates ON manual_journey (date_start, date_end);
  UPDATE private_history_record SET schema_version = 33 WHERE record_id = 1;
`;

const migrationV34 = `
  CREATE TABLE IF NOT EXISTS journey_privacy_revision (
    revision INTEGER PRIMARY KEY AUTOINCREMENT,
    policy_id TEXT NOT NULL,
    command_key TEXT NOT NULL UNIQUE,
    action TEXT NOT NULL CHECK (action IN ('hide', 'exclude', 'restore')),
    target_kind TEXT NOT NULL CHECK (target_kind IN ('manual', 'inferred')),
    manual_id TEXT,
    source_run_id INTEGER NOT NULL,
    reviewed_evidence_json TEXT NOT NULL CHECK (json_valid(reviewed_evidence_json) AND json_type(reviewed_evidence_json) = 'array'),
    reviewed_family_json TEXT NOT NULL CHECK (json_valid(reviewed_family_json) AND json_type(reviewed_family_json) = 'array'),
    reviewed_label TEXT NOT NULL,
    created_at_millis INTEGER NOT NULL,
    CHECK ((target_kind = 'manual' AND manual_id IS NOT NULL AND action <> 'exclude') OR (target_kind = 'inferred' AND manual_id IS NULL))
  );
  CREATE INDEX IF NOT EXISTS journey_privacy_policy_revision ON journey_privacy_revision (policy_id, revision);
  UPDATE private_history_record SET schema_version = MAX(schema_version, 34) WHERE record_id = 1;
`;

/**
 * Replay preferences are presentation-only private state. Evidence identifiers
 * stay in this native database; React receives opaque Replay tokens only.
 */
const migrationV35 = `
  CREATE TABLE IF NOT EXISTS replay_draft (
    record_id INTEGER PRIMARY KEY CHECK (record_id = 1),
    revision INTEGER NOT NULL,
    committed_overrides_json TEXT NOT NULL CHECK (json_valid(committed_overrides_json) AND json_type(committed_overrides_json) = 'object'),
    updated_at_millis INTEGER NOT NULL
  );
  UPDATE private_history_record SET schema_version = MAX(schema_version, 35) WHERE record_id = 1;
`;

// The marker is intentionally separate from the physical upgrade below. A
// retained forward-compatible table may already have these columns while its
// version marker is old, so `ALTER TABLE` must be layout-gated.
const migrationV36 = `
  UPDATE private_history_record SET schema_version = MAX(schema_version, 36) WHERE record_id = 1;
`;


const migrationV38 = `
  CREATE TABLE IF NOT EXISTS atlas_preparation_intent (
    record_id INTEGER PRIMARY KEY CHECK (record_id = 1), payload TEXT NOT NULL
  );
  UPDATE private_history_record SET schema_version = MAX(schema_version, 38) WHERE record_id = 1;
`;

const migrationV39 = `
  ALTER TABLE configured_home_area RENAME TO configured_home_area_v38;
  CREATE TABLE configured_home_area (
    area_id TEXT PRIMARY KEY,
    latitude REAL NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude REAL NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    effective_start_day TEXT NULL,
    effective_end_day TEXT NULL,
    radius_meters REAL NOT NULL CHECK (radius_meters > 0 AND radius_meters <= 50000),
    owner_label TEXT NULL,
    origin TEXT NOT NULL DEFAULT 'legacy' CHECK (origin IN ('observed-area','legacy','manual-pin')),
    CHECK (effective_start_day IS NULL OR effective_end_day IS NULL OR effective_start_day <= effective_end_day)
  );
  INSERT INTO configured_home_area
    SELECT area_id,latitude,longitude,effective_start_day,effective_end_day,radius_meters,owner_label,origin FROM configured_home_area_v38;
  DROP TABLE configured_home_area_v38;
  CREATE TABLE IF NOT EXISTS home_setup_receipt (
    record_id INTEGER PRIMARY KEY CHECK (record_id = 1),
    command_key TEXT NOT NULL,
    payload TEXT NOT NULL,
    disposition TEXT NOT NULL CHECK (disposition IN ('saved','skipped'))
  );
  CREATE TABLE IF NOT EXISTS home_projection_context (
    record_id INTEGER PRIMARY KEY CHECK (record_id = 1),
    revision INTEGER NOT NULL CHECK (revision >= 0)
  );
  INSERT OR IGNORE INTO home_projection_context VALUES (1, 0);
  ALTER TABLE reconstruction_run ADD COLUMN home_revision INTEGER NOT NULL DEFAULT 0;
  CREATE TRIGGER IF NOT EXISTS home_projection_insert AFTER INSERT ON configured_home_area
  BEGIN UPDATE home_projection_context SET revision = revision + 1 WHERE record_id = 1; END;
  CREATE TRIGGER IF NOT EXISTS home_projection_edit AFTER UPDATE OF latitude, longitude, radius_meters, effective_start_day, effective_end_day ON configured_home_area
  WHEN OLD.latitude IS NOT NEW.latitude OR OLD.longitude IS NOT NEW.longitude OR OLD.radius_meters IS NOT NEW.radius_meters
    OR OLD.effective_start_day IS NOT NEW.effective_start_day OR OLD.effective_end_day IS NOT NEW.effective_end_day
  BEGIN UPDATE home_projection_context SET revision = revision + 1 WHERE record_id = 1; END;
  CREATE TRIGGER IF NOT EXISTS home_projection_remove AFTER DELETE ON configured_home_area
  BEGIN UPDATE home_projection_context SET revision = revision + 1 WHERE record_id = 1; END;
  UPDATE private_history_record SET schema_version = MAX(schema_version, 39) WHERE record_id = 1;
`;

const migrationV40 = `
  UPDATE private_history_record SET schema_version = MAX(schema_version, 40) WHERE record_id = 1;
`;

const migrationV41 = `
  CREATE TABLE IF NOT EXISTS first_reveal_receipt (
    record_id INTEGER PRIMARY KEY CHECK (record_id = 1),
    offer_key TEXT NOT NULL,
    scope TEXT NOT NULL,
    command TEXT NOT NULL,
    decision TEXT NOT NULL CHECK (decision IN ('offer','yes','no','dismiss','retire','undo')),
    revision INTEGER NOT NULL CHECK (revision > 0)
  );
  CREATE TABLE IF NOT EXISTS first_reveal_command (
    command TEXT PRIMARY KEY NOT NULL,
    decision TEXT NOT NULL CHECK (decision IN ('offer','yes','no','dismiss','retire','undo')),
    revision INTEGER UNIQUE NOT NULL CHECK (revision > 0)
  );
  UPDATE private_history_record SET schema_version = MAX(schema_version, 41) WHERE record_id = 1;
`;

const migrationV43 = `
  CREATE TABLE IF NOT EXISTS visual_place_review (
    cluster_key TEXT PRIMARY KEY NOT NULL,
    manual_id TEXT UNIQUE,
    place_id TEXT,
    decision TEXT NOT NULL CHECK (decision IN ('dismissed', 'confirmed')),
    CHECK ((decision = 'confirmed' AND manual_id IS NOT NULL AND place_id IS NOT NULL)
      OR (decision = 'dismissed' AND manual_id IS NULL AND place_id IS NULL))
  );
  CREATE TABLE IF NOT EXISTS visual_place_album (
    manual_id TEXT NOT NULL,
    slot INTEGER NOT NULL CHECK (slot >= 1 AND slot <= 4),
    evidence_id TEXT NOT NULL UNIQUE,
    source_ref TEXT NOT NULL,
    PRIMARY KEY (manual_id, slot)
  );
  UPDATE private_history_record SET schema_version = MAX(schema_version, 43) WHERE record_id = 1;
`;

const migrationV44 = `
  CREATE TABLE IF NOT EXISTS visual_discovery_state (
    record_id INTEGER PRIMARY KEY CHECK (record_id = 1),
    enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
    revision INTEGER NOT NULL DEFAULT 0,
    scope TEXT,
    checkpoint TEXT,
    proposal TEXT
  );
  INSERT OR IGNORE INTO visual_discovery_state (record_id) VALUES (1);
  CREATE INDEX IF NOT EXISTS visual_discovery_capture_cursor ON canonical_evidence (captured_at_millis DESC, evidence_id DESC)
    WHERE media_type = 'image' AND latitude IS NULL AND longitude IS NULL AND captured_at_millis IS NOT NULL;
  UPDATE private_history_record SET schema_version = MAX(schema_version, 44) WHERE record_id = 1;
`;

const migrationV45 = `
  ALTER TABLE visual_place_album RENAME TO visual_place_album_v43;
  CREATE TABLE visual_place_album (
    manual_id TEXT NOT NULL,
    slot INTEGER NOT NULL CHECK (slot BETWEEN 1 AND 512),
    evidence_id TEXT NOT NULL UNIQUE,
    source_ref TEXT NOT NULL,
    PRIMARY KEY (manual_id, slot)
  );
  INSERT INTO visual_place_album (manual_id, slot, evidence_id, source_ref)
    SELECT manual_id, slot, evidence_id, source_ref FROM visual_place_album_v43;
  DROP TABLE visual_place_album_v43;
  CREATE TABLE IF NOT EXISTS visual_place_trip (
    manual_id TEXT PRIMARY KEY NOT NULL,
    command TEXT NOT NULL UNIQUE,
    stops TEXT NOT NULL,
    membership TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS visual_place_disposition (
    command TEXT PRIMARY KEY NOT NULL,
    decision TEXT NOT NULL CHECK (decision IN ('confirmed', 'dismissed')),
    manual_id TEXT NULL
  );
  UPDATE private_history_record SET schema_version = MAX(schema_version, 45) WHERE record_id = 1;
`;

// GPS-less trip discovery (decision 0019/0020). A fully independent cache and
// review state, never reading or writing canonical_evidence or any
// reconstruction_* table — see travel-window/storage.ts.
const migrationV46 = `
  CREATE TABLE IF NOT EXISTS travel_window_capture (
    asset_id TEXT PRIMARY KEY NOT NULL,
    captured_at_millis INTEGER NOT NULL,
    utc_offset_minutes INTEGER,
    provenance TEXT NOT NULL,
    located INTEGER NOT NULL DEFAULT 0 CHECK (located IN (0, 1))
  );
  CREATE INDEX IF NOT EXISTS travel_window_capture_time ON travel_window_capture (captured_at_millis);
  CREATE TABLE IF NOT EXISTS travel_window_state (
    record_id INTEGER PRIMARY KEY CHECK (record_id = 1),
    enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
    backfill_cursor_millis INTEGER,
    backfill_complete INTEGER NOT NULL DEFAULT 0 CHECK (backfill_complete IN (0, 1)),
    newest_cursor_millis INTEGER
  );
  INSERT OR IGNORE INTO travel_window_state (record_id) VALUES (1);
  CREATE TABLE IF NOT EXISTS travel_window_trip (
    manual_id TEXT PRIMARY KEY NOT NULL,
    command TEXT NOT NULL UNIQUE,
    member_ids TEXT NOT NULL,
    review_ids TEXT NOT NULL,
    owner_place_name TEXT
  );
  CREATE TABLE IF NOT EXISTS travel_window_disposition (
    command TEXT PRIMARY KEY NOT NULL,
    decision TEXT NOT NULL CHECK (decision IN ('confirmed', 'dismissed')),
    manual_id TEXT NULL,
    CHECK ((decision = 'confirmed' AND manual_id IS NOT NULL) OR (decision = 'dismissed' AND manual_id IS NULL))
  );
  UPDATE private_history_record SET schema_version = MAX(schema_version, 46) WHERE record_id = 1;
`;

// `located` (migrationV46) was always written false by every real caller
// until the fix in capture-metadata.ts/TravelLifeSignageModule.kt: any
// device that already ran a travel_window_capture backfill under schema 46
// has GPS-evidenced captures cached as if they were GPS-less, which can
// re-offer an already-recognized trip. Clearing the cache and cursor forces
// a clean rescan under the fixed logic; trip/disposition decisions the
// owner already made are untouched.
const migrationV47 = `
  DELETE FROM travel_window_capture;
  UPDATE travel_window_state SET backfill_cursor_millis = NULL, backfill_complete = 0, newest_cursor_millis = NULL WHERE record_id = 1;
  UPDATE private_history_record SET schema_version = MAX(schema_version, 47) WHERE record_id = 1;
`;

// Lets a confirmed GPS-less trip become a real Atlas journey (decision
// 0019/0020's own acceptance line: "the whole trip... available immediately,
// including Replay eligibility through the existing gates"). Mirrors
// visual_place_album exactly (manual_id, slot, evidence_id, source_ref),
// except with no slot cap: decision 0019's own membership rule is
// "deliberately no size cap" (travel-window/membership.ts).
const migrationV48 = `
  CREATE TABLE IF NOT EXISTS travel_window_album (
    manual_id TEXT NOT NULL,
    slot INTEGER NOT NULL CHECK (slot >= 1),
    evidence_id TEXT NOT NULL UNIQUE,
    source_ref TEXT NOT NULL,
    PRIMARY KEY (manual_id, slot)
  );
  UPDATE private_history_record SET schema_version = MAX(schema_version, 48) WHERE record_id = 1;
`;

// AI clue layer (decision 0022, CAP-1/M11.1). A clue is evidence an AI
// producer adds; it is never a trip, membership or classification write
// (clue-contract.md). `subject_json`/`value_json` hold the closed,
// kind-discriminated shapes `clues/types.ts` defines; this table only
// persists them, it never interprets them. No producer exists yet
// (CAP-4/5/6), so this table stays empty in production until one does.
const migrationV49 = `
  CREATE TABLE IF NOT EXISTS travel_clue (
    clue_id TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('place', 'photo-source', 'same-trip', 'capture-offset', 'landmark', 'sign-place', 'sign-script')),
    subject_json TEXT NOT NULL,
    value_json TEXT NOT NULL,
    strength TEXT NOT NULL CHECK (strength IN ('weak', 'strong')),
    independence_key TEXT NOT NULL,
    producer_id TEXT NOT NULL,
    producer_version TEXT NOT NULL,
    evidence_revision INTEGER NOT NULL,
    home_revision INTEGER NOT NULL,
    correction_revision INTEGER NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('active', 'superseded', 'retracted')),
    created_at_millis INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS travel_clue_state ON travel_clue (state);
  UPDATE private_history_record SET schema_version = MAX(schema_version, 49) WHERE record_id = 1;
`;

// M10.8 (CAP-8) adoption. A single row names which detector rule the
// rebuild's qualification pass uses; the comparison itself needs no stored
// snapshot (compareDetectorPolicy computes the alternate rule fresh, in
// memory, against the current graph — see delivery-and-diagnostics.md).
const migrationV50 = `
  CREATE TABLE IF NOT EXISTS detector_policy (
    record_id INTEGER PRIMARY KEY CHECK (record_id = 1),
    rule_version TEXT NOT NULL CHECK (rule_version IN ('trip-detector-v1.1', 'trip-detector-v1.2')),
    activated_at_millis INTEGER NOT NULL
  );
  UPDATE private_history_record SET schema_version = MAX(schema_version, 50) WHERE record_id = 1;
`;

const migrationV42 = `
  CREATE TABLE IF NOT EXISTS recognizable_candidate_rejection (
    command_key TEXT PRIMARY KEY NOT NULL,
    policy_version TEXT NOT NULL,
    support_signature TEXT NOT NULL,
    UNIQUE (policy_version, support_signature)
  );
  UPDATE private_history_record SET schema_version = MAX(schema_version, 42) WHERE record_id = 1;
`;

async function migrateHomeProjection(db: SqliteDatabase) {
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(reconstruction_run)');
  if (!columns.some((column) => column.name === 'home_revision')) {
    await db.execAsync(migrationV39);
  } else {
    const tables = await db.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('home_setup_receipt', 'home_projection_context')");
    if (tables.length !== 2) throw new Error('Home projection schema is incomplete.');
  }
  await db.getFirstAsync('SELECT record_id, command_key, payload, disposition FROM home_setup_receipt LIMIT 1');
  await db.execAsync(migrationV40);
}

const migrationV37 = `
  CREATE TABLE IF NOT EXISTS replay_mutation_receipt (
    operation_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    edit_version INTEGER NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('stage', 'commit', 'restore')),
    payload_digest TEXT NOT NULL,
    snapshot_token INTEGER NOT NULL,
    privacy_revision INTEGER NOT NULL,
    resulting_revision INTEGER NOT NULL,
    created_at_millis INTEGER NOT NULL
  );
  UPDATE private_history_record SET schema_version = MAX(schema_version, 37) WHERE record_id = 1;
`;

/** Canonical constraints are required for immutable revisions and command identity. */
export const journeyPrivacyTableDefinition = migrationV34.slice(0, migrationV34.indexOf(';') + 1).trim();
function normalizePrivacyDefinition(sql: string) {
  return sql.replace(/IF NOT EXISTS/gi, '').replace(/\s+/g, '').replace(/;$/, '').toLowerCase();
}

/** Validate physical policy constraints even when an abandoned newer marker survives. */
async function ensureJourneyPrivacyLayout(db: SqliteDatabase) {
  try {
    await db.getAllAsync('SELECT revision, policy_id, command_key, action, target_kind, manual_id, source_run_id, reviewed_evidence_json, reviewed_family_json, reviewed_label, created_at_millis FROM journey_privacy_revision LIMIT 0');
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    if (/no such table:\s*journey_privacy_revision\b/i.test(error.message)) {
      await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
      try { await db.execAsync(migrationV34); await db.execAsync('COMMIT'); }
      catch (failure) { await db.execAsync('ROLLBACK'); throw failure; }
      // Continue below: successful creation is not a substitute for read-back.
    }
    else if (error.message.toLowerCase().includes('no such column')) throw new LocalAtlasSchemaRecoveryError();
    else throw error;
  }
  const table = await db.getFirstAsync<{ sql: string }>("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'journey_privacy_revision'");
  if (typeof table?.sql !== 'string' || normalizePrivacyDefinition(table.sql) !== normalizePrivacyDefinition(journeyPrivacyTableDefinition)) throw new LocalAtlasSchemaRecoveryError();
}

const MAINTENANCE_LEASE_MILLIS = 5 * 60 * 1000;

type SchemaRow = { version: number };
type LifecycleRow = { state: 'connected' | 'disconnected' };
type RevisionRow = { revision: number | null };
type MaintenanceStateRow = { enabled: number; status: MaintenanceSnapshot['status']; last_checked_at_millis: number | null; last_updated_at_millis: number | null; message: string | null };
type MaintenanceCheckpointRow = { scope: Extract<ImportScope, 'full' | 'limited'>; next_offset: number; run_token: number; status: MaintenanceCheckpoint['status'] };
type SourceRow = { modified_at_millis: number | null; availability: SourceCandidate['availability']; platform_duplicate_family_id?: string | null; duplicate_tuple_fingerprint?: string | null };
type ReconciliationStateRow = { status: ReconciliationSnapshot['status']; last_checked_at_millis: number | null; last_updated_at_millis: number | null; new_journey_count: number; updated_journey_count: number; message: string | null; queued_change_count: number; unresolved_remap_count: number };

export class LocalAtlasSchemaRecoveryError extends Error {
  constructor() {
    super('Local Atlas schema recovery could not finish.');
    this.name = 'LocalAtlasSchemaRecoveryError';
  }
}

const retainedManualTable = 'manual_journey_retained_schema';
type ManualLayout = 'current' | 'missing' | 'incompatible';

async function readManualLayout(db: SqliteDatabase): Promise<ManualLayout> {
  try {
    // Preparing a zero-row query validates physical columns without reading
    // owner values or trusting a potentially retained newer version marker.
    await db.getAllAsync('SELECT manual_id, command_key, owner_label, owner_context, latitude, longitude, date_kind, date_start, date_end, created_at_millis FROM manual_journey LIMIT 0');
    return 'current';
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    const message = error.message.toLowerCase();
    if (/no such table:\s*manual_journey\b/.test(message)) return 'missing';
    if (message.includes('no such column:')) return 'incompatible';
    throw error;
  }
}

async function assertEmptyManualRecovery(db: SqliteDatabase, layout: Exclude<ManualLayout, 'current'>) {
  if (layout === 'incompatible') {
    const rows = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM manual_journey');
    if (rows?.count !== 0) throw new LocalAtlasSchemaRecoveryError();
  }
  const archive = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM sqlite_master WHERE name = ?', retainedManualTable);
  if (archive?.count !== 0) throw new LocalAtlasSchemaRecoveryError();
}

async function ensureManualJourneyLayout(db: SqliteDatabase) {
  const layout = await readManualLayout(db);
  if (layout === 'current') return;
  await assertEmptyManualRecovery(db, layout);
  await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
  try {
    // Another writer may have repaired the table or populated it while this
    // connection waited for its serialized writer turn. Recheck both facts.
    const lockedLayout = await readManualLayout(db);
    if (lockedLayout !== 'current') {
      await assertEmptyManualRecovery(db, lockedLayout);
      if (lockedLayout === 'incompatible') await db.execAsync(`ALTER TABLE manual_journey RENAME TO ${retainedManualTable}`);
      await db.execAsync(manualJourneyTableSchema);
      // The original date index remains attached to the archived empty table.
      // A distinct fixed name creates an actual index on the canonical table.
      await db.execAsync('CREATE INDEX manual_journey_recovery_dates ON manual_journey (date_start, date_end)');
    }
    await db.execAsync('COMMIT');
  } catch (error) {
    try { await db.execAsync('ROLLBACK'); }
    catch { /* Preserve the primary failure if rollback also fails. */ }
    throw error;
  }
}

type TableColumn = { name: string };
async function ensureReplayDraftWorkingLayout(db: SqliteDatabase) {
  const columns = await db.getAllAsync<TableColumn>('PRAGMA table_info(replay_draft)');
  const names = new Set(columns.map((column) => column.name));
  if (names.has('working_overrides_json') && names.has('working_base_revision') && names.has('working_revision') && names.has('working_session_id') && names.has('working_edit_version') && await db.getFirstAsync("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'replay_mutation_receipt'")) return;
  await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
  try {
    const lockedColumns = await db.getAllAsync<TableColumn>('PRAGMA table_info(replay_draft)');
    const lockedNames = new Set(lockedColumns.map((column) => column.name));
    if (!lockedNames.has('working_overrides_json')) await db.execAsync("ALTER TABLE replay_draft ADD COLUMN working_overrides_json TEXT NULL CHECK (working_overrides_json IS NULL OR (json_valid(working_overrides_json) AND json_type(working_overrides_json) = 'object'))");
    if (!lockedNames.has('working_base_revision')) await db.execAsync('ALTER TABLE replay_draft ADD COLUMN working_base_revision INTEGER NULL');
    if (!lockedNames.has('working_revision')) await db.execAsync('ALTER TABLE replay_draft ADD COLUMN working_revision INTEGER NOT NULL DEFAULT 0');
    if (!lockedNames.has('working_session_id')) await db.execAsync('ALTER TABLE replay_draft ADD COLUMN working_session_id TEXT NULL');
    if (!lockedNames.has('working_edit_version')) await db.execAsync('ALTER TABLE replay_draft ADD COLUMN working_edit_version INTEGER NOT NULL DEFAULT 0');
    await db.execAsync(migrationV37);
    await db.execAsync('COMMIT');
  } catch (error) {
    try { await db.execAsync('ROLLBACK'); } catch { /* Keep the primary failure. */ }
    throw error;
  }
}

/** Decision 0019/0020's tables were added at schema 46 (travel_window_album at 48); an abandoned marker from earlier iteration can leave a device already at or past that version without them. */
async function readTravelWindowLayout(db: SqliteDatabase): Promise<'current' | 'missing'> {
  try {
    await db.getAllAsync('SELECT asset_id, captured_at_millis, utc_offset_minutes, provenance, located FROM travel_window_capture LIMIT 0');
    await db.getAllAsync('SELECT record_id, backfill_cursor_millis, backfill_complete, newest_cursor_millis FROM travel_window_state LIMIT 0');
    await db.getAllAsync('SELECT manual_id, command, member_ids, review_ids, owner_place_name FROM travel_window_trip LIMIT 0');
    await db.getAllAsync('SELECT command, decision, manual_id FROM travel_window_disposition LIMIT 0');
    await db.getAllAsync('SELECT manual_id, slot, evidence_id, source_ref FROM travel_window_album LIMIT 0');
    return 'current';
  } catch (error) {
    if (!(error instanceof Error) || !/no such table:\s*travel_window_/i.test(error.message)) throw error;
    return 'missing';
  }
}

async function ensureTravelWindowLayout(db: SqliteDatabase) {
  if ((await readTravelWindowLayout(db)) === 'current') return;
  await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
  try {
    // Another writer may have repaired this while this connection waited for
    // its serialized turn. migrationV46/V48 are idempotent (CREATE TABLE IF
    // NOT EXISTS / INSERT OR IGNORE), so re-running them is always safe.
    if ((await readTravelWindowLayout(db)) !== 'current') { await db.execAsync(migrationV46); await db.execAsync(migrationV48); }
    await db.execAsync('COMMIT');
  } catch (error) {
    try { await db.execAsync('ROLLBACK'); } catch { /* Keep the primary failure. */ }
    throw error;
  }
}

/** Ensures independently opened repositories read the current private schema. */
export async function ensureNativeImportSchema(db: SqliteDatabase) {
  let currentSchema: SchemaRow | null = null;
  try {
    currentSchema = await db.getFirstAsync<SchemaRow>('SELECT version FROM import_schema_version LIMIT 1');
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('no such table: import_schema_version')) throw error;
  }
  // A device may retain an abandoned newer marker from a removed experimental
  // migration. Its additive tables are harmless; never try to downgrade or
  // rerun the full migration chain during a normal Atlas/import entry.
  if ((currentSchema?.version ?? 0) >= CURRENT_SCHEMA_VERSION) {
    await ensureManualJourneyLayout(db);
    await ensureJourneyPrivacyLayout(db);
    await ensureReplayDraftWorkingLayout(db);
    await ensureTravelWindowLayout(db);
    return;
  }
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
    if (version < 6) await db.execAsync(migrationV6);
    if (version < 7) await db.execAsync(migrationV7);
    if (version < 8) await db.execAsync(migrationV8);
    if (version < 9) await db.execAsync(migrationV9);
    if (version < 10) await db.execAsync(migrationV10);
    if (version < 11) await db.execAsync(migrationV11);
    if (version < 12) await db.execAsync(migrationV12);
    if (version < 13) await db.execAsync(migrationV13);
    if (version < 14) await db.execAsync(migrationV14);
    if (version < 15) await db.execAsync(migrationV15);
    if (version < 16) await db.execAsync(migrationV16);
    if (version < 17) await db.execAsync(migrationV17);
    if (version < 18) await db.execAsync(migrationV18);
    if (version < 19) await db.execAsync(migrationV19);
    if (version < 20) await db.execAsync(migrationV20);
    if (version < 21) await db.execAsync(migrationV21);
    if (version < 22) await db.execAsync(migrationV22);
    if (version < 23) await db.execAsync(migrationV23);
    if (version < 24) await db.execAsync(migrationV24);
    if (version < 25) await db.execAsync(migrationV25);
    if (version < 26) await db.execAsync(migrationV26);
    if (version < 27) await db.execAsync(migrationV27);
    if (version < 28) await db.execAsync(migrationV28);
    if (version < 29) await db.execAsync(migrationV29);
    if (version < 30) await db.execAsync(migrationV30);
    if (version < 31) await db.execAsync(migrationV31);
    if (version < 32) await db.execAsync(migrationV32);
    if (version < 33) await db.execAsync(migrationV33);
    if (version < 34) await db.execAsync(migrationV34);
    if (version < 35) await db.execAsync(migrationV35);
    if (version < 36) await db.execAsync(migrationV36);
    if (version < 37) await db.execAsync(migrationV37);
    if (version < 38) await db.execAsync(migrationV38);
    if (version < 40) await migrateHomeProjection(db);
    if (version < 41) await db.execAsync(migrationV41);
    if (version < 42) await db.execAsync(migrationV42);
    if (version < 43) await db.execAsync(migrationV43);
    if (version < 44) await db.execAsync(migrationV44);
    if (version < 45) await db.execAsync(migrationV45);
    if (version < 46) await db.execAsync(migrationV46);
    if (version < 47) await db.execAsync(migrationV47);
    if (version < 48) await db.execAsync(migrationV48);
    if (version < 49) await db.execAsync(migrationV49);
    if (version < 50) await db.execAsync(migrationV50);
    if (version === 0) await db.runAsync('INSERT INTO import_schema_version (version) VALUES (?)', CURRENT_SCHEMA_VERSION);
    else if (version < CURRENT_SCHEMA_VERSION) await db.runAsync('UPDATE import_schema_version SET version = ?', CURRENT_SCHEMA_VERSION);
    await db.execAsync('COMMIT');
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
  await ensureManualJourneyLayout(db);
  await ensureJourneyPrivacyLayout(db);
  await ensureReplayDraftWorkingLayout(db);
  await ensureTravelWindowLayout(db);
}

const DUPLICATE_TUPLE_VERSION = 1;
function normalizedFamilyId(value: string | null | undefined) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized.length ? normalized : null;
}
function duplicateTuple(candidate: SourceCandidate) {
  const tuple = [
    candidate.capturedDay ?? null, candidate.capturedAtMillis ?? null, Boolean(candidate.hasPreciseOffset),
    candidate.latitude ?? null, candidate.longitude ?? null, candidate.reportedAccuracyMeters ?? null,
    candidate.sourceOrigin ?? null, candidate.supportEligible ?? null,
  ];
  return JSON.stringify(tuple);
}

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
export function createNativeImportRepository(options?: { databaseName: string }): ImportRepository & MaintenanceRepository {
  const databaseName = options?.databaseName ?? 'travel-life-import-v1.db';
  if (databaseName !== 'travel-life-import-v1.db' && !/^travel-life-account-[a-f0-9-]{36}\.db$/.test(databaseName)) throw new Error('Private record namespace is invalid.');
  let database: Promise<SqliteDatabase> | null = null;

  async function open() {
    if (!database) {
      database = (async () => {
        // Native-only dependency loading keeps an unsupported runtime closed.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const sqlite = require('expo-sqlite') as { openDatabaseAsync(name: string, options?: { useNewConnection?: boolean }): Promise<SqliteDatabase> };
        // Android can retain a released cached Expo SQLite handle after a JS
        // reload while the process survives. Every repository instance owns a
        // fresh handle; the existing global transaction gate still serializes
        // writers across import, maintenance and reconstruction repositories.
        assertReplicaOpen(databaseName);
        const db = serializeNativeTransactions(trackReplicaConnection(databaseName,await sqlite.openDatabaseAsync(databaseName, { useNewConnection: true })));
        // A rebuild or maintenance transaction may be finishing on the other
        // connection when the app reloads. Wait for that writer to finish.
        await db.execAsync('PRAGMA busy_timeout = 30000');
        let currentSchema: SchemaRow | null = null;
        try {
          currentSchema = await db.getFirstAsync<SchemaRow>('SELECT version FROM import_schema_version LIMIT 1');
        } catch (error) {
          if (!(error instanceof Error) || !error.message.includes('no such table: import_schema_version')) throw error;
        }
        // Most opens only read the existing schema. Avoid taking a write lock
        // during startup when there is nothing to migrate.
        if ((currentSchema?.version ?? 0) >= CURRENT_SCHEMA_VERSION) {
          await ensureManualJourneyLayout(db);
          await ensureReplayDraftWorkingLayout(db);
          await ensureTravelWindowLayout(db);
          return db;
        }
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
          if (version < 6) await db.execAsync(migrationV6);
          if (version < 7) await db.execAsync(migrationV7);
          if (version < 8) await db.execAsync(migrationV8);
          if (version < 9) await db.execAsync(migrationV9);
          if (version < 10) await db.execAsync(migrationV10);
          if (version < 11) await db.execAsync(migrationV11);
          if (version < 12) await db.execAsync(migrationV12);
          if (version < 13) await db.execAsync(migrationV13);
          if (version < 14) await db.execAsync(migrationV14);
          if (version < 15) await db.execAsync(migrationV15);
          if (version < 16) await db.execAsync(migrationV16);
          if (version < 17) await db.execAsync(migrationV17);
          if (version < 18) await db.execAsync(migrationV18);
          if (version < 19) await db.execAsync(migrationV19);
          if (version < 20) await db.execAsync(migrationV20);
          if (version < 21) await db.execAsync(migrationV21);
          if (version < 22) await db.execAsync(migrationV22);
          if (version < 23) await db.execAsync(migrationV23);
          if (version < 24) await db.execAsync(migrationV24);
          if (version < 25) await db.execAsync(migrationV25);
          if (version < 26) await db.execAsync(migrationV26);
          if (version < 27) await db.execAsync(migrationV27);
          if (version < 28) await db.execAsync(migrationV28);
          if (version < 29) await db.execAsync(migrationV29);
          if (version < 30) await db.execAsync(migrationV30);
          if (version < 31) await db.execAsync(migrationV31);
          if (version < 32) await db.execAsync(migrationV32);
          if (version < 33) await db.execAsync(migrationV33);
          if (version < 34) await db.execAsync(migrationV34);
          if (version < 35) await db.execAsync(migrationV35);
          if (version < 36) await db.execAsync(migrationV36);
    if (version < 37) await db.execAsync(migrationV37);
    if (version < 38) await db.execAsync(migrationV38);
          if (version < 40) await migrateHomeProjection(db);
          if (version < 41) await db.execAsync(migrationV41);
          if (version < 42) await db.execAsync(migrationV42);
          if (version < 43) await db.execAsync(migrationV43);
          if (version < 44) await db.execAsync(migrationV44);
          if (version < 45) await db.execAsync(migrationV45);
          if (version < 46) await db.execAsync(migrationV46);
          if (version < 47) await db.execAsync(migrationV47);
          if (version < 48) await db.execAsync(migrationV48);
          if (version < 49) await db.execAsync(migrationV49);
          if (version < 50) await db.execAsync(migrationV50);
          if (version === 0) await db.runAsync('INSERT INTO import_schema_version (version) VALUES (?)', CURRENT_SCHEMA_VERSION);
          else if (version < CURRENT_SCHEMA_VERSION) await db.runAsync('UPDATE import_schema_version SET version = ?', CURRENT_SCHEMA_VERSION);
          await db.execAsync('COMMIT');
          await ensureManualJourneyLayout(db);
          await ensureReplayDraftWorkingLayout(db);
          await ensureTravelWindowLayout(db);
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

  function isReleasedNativeHandle(error: unknown) {
    return error instanceof Error && /nullpointerexception|released native handle/i.test(error.message);
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

  function homeAreaLabel(area: ConfiguredHomeArea) {
    const label = area.label?.trim() || null;
    if (!area.id || (area.label !== null && !label) || !Number.isFinite(area.latitude) || !Number.isFinite(area.longitude) || !Number.isFinite(area.radiusMeters)
      || area.latitude < -90 || area.latitude > 90 || area.longitude < -180 || area.longitude > 180 || area.radiusMeters <= 0 || area.radiusMeters > 50_000
      || (!validCivilDay(area.effectiveStartDay) && area.effectiveStartDay !== null) || (!validCivilDay(area.effectiveEndDay) && area.effectiveEndDay !== null)
      || (area.effectiveStartDay !== null && area.effectiveEndDay !== null && area.effectiveStartDay > area.effectiveEndDay)) throw new Error('Configured home area is invalid.');
    return label;
  }

  function writeHomeArea(db: SqliteDatabase, area: ConfiguredHomeArea, label: string | null) {
    return db.runAsync('INSERT INTO configured_home_area (area_id, owner_label, origin, latitude, longitude, effective_start_day, effective_end_day, radius_meters) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(area_id) DO UPDATE SET owner_label=excluded.owner_label, origin=excluded.origin, latitude=excluded.latitude, longitude=excluded.longitude, effective_start_day=excluded.effective_start_day, effective_end_day=excluded.effective_end_day, radius_meters=excluded.radius_meters', area.id, label, area.origin, area.latitude, area.longitude, area.effectiveStartDay, area.effectiveEndDay, area.radiusMeters);
  }

  async function assertMaintenanceWritable(db: SqliteDatabase, runToken: number) {
    await assertImportActive(db);
    const lease = await db.getFirstAsync<{ run_token: number }>('SELECT run_token FROM maintenance_lease WHERE record_id = 1');
    // The lease is acquired only by enabled scheduled work or an explicit
    // foreground rescan. It is the write authority; scheduler preference is
    // never silently changed by a manual scan.
    if (lease?.run_token !== runToken) throw new ImportLifecycleBlockedError();
  }

  async function correctionTargetExists(db: SqliteDatabase, overlay: CorrectionOverlay) {
    const target = overlay.targetKind === 'evidence'
      ? await db.getFirstAsync<{ evidence_id: string }>('SELECT evidence_id FROM canonical_evidence WHERE evidence_id = ?', overlay.targetId)
      : await db.getFirstAsync<{ history_id: string }>('SELECT history_id FROM inferred_history WHERE history_id = ?', overlay.targetId);
    return target !== null;
  }

  return {
    async hasEstablishedHistory() {
      const db = await open();
      const row = await db.getFirstAsync<{ established: number }>('SELECT EXISTS(SELECT 1 FROM canonical_evidence UNION ALL SELECT 1 FROM manual_journey UNION ALL SELECT 1 FROM reconstruction_run) AS established');
      return row?.established === 1;
    },
    async loadPreparationIntent() {
      const db = await open();
      const row = await db.getFirstAsync<{ payload: string }>('SELECT payload FROM atlas_preparation_intent WHERE record_id = 1');
      if (!row) return null;
      let value: unknown;
      try { value = JSON.parse(row.payload); }
      catch { throw new Error('Onboarding schema is invalid.'); }
      const { validatePreparationIntent } = await import('@/onboarding/intent');
      return validatePreparationIntent(value);
    },
    async savePreparationIntent(intent) {
      const { validatePreparationIntent } = await import('@/onboarding/intent');
      validatePreparationIntent(intent);
      const db = await open();
      await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
      try {
        await assertImportActive(db);
        await db.runAsync('INSERT INTO atlas_preparation_intent (record_id, payload) VALUES (1, ?) ON CONFLICT(record_id) DO UPDATE SET payload = excluded.payload', JSON.stringify(intent));
        await db.execAsync('COMMIT');
      } catch (error) { await db.execAsync('ROLLBACK'); throw error; }
    },
    getCheckpoint: read,
    loadCoverage: read,
    async getPrivateRecordLifecycle() {
      try {
        return await lifecycle(await open());
      } catch (error) {
        if (!isReleasedNativeHandle(error)) throw error;
        // Do not retry a mutation after a native failure. This is the initial
        // lifecycle read only, before import creates any metadata writes.
        database = null;
        return lifecycle(await open());
      }
    },
    async loadFirstRevealReceipt() {
      const db = await open();
      await assertImportActive(db);
      const row = await db.getFirstAsync<FirstRevealReceipt>('SELECT offer_key AS offerKey, scope, command, decision, revision FROM first_reveal_receipt WHERE record_id = 1');
      return row ? { ...row } : null;
    },
    async saveFirstRevealReceipt(mutation, verifyCurrent, correlationId = createDiagnosticCorrelationId()) {
      const stage = mutation.decision === 'offer' ? 'QUESTION_OFFER_SAVE' : 'QUESTION_DECISION_COMMIT';
      const operation = 'ATLAS_CLARIFY';
      recordAppDiagnostic({ operation, stage, reasonCode: 'START', retryable: false, durableOutcome: 'unchanged', correlationId });
      try {
        const outcome = await runOwnedTransaction(await open(), { kind: 'foreground' }, async (db) => {
          await assertImportActive(db);
          if (!await verifyCurrent()) return { status: 'stale' } as const;
          const prior = await db.getFirstAsync<FirstRevealReceipt>('SELECT offer_key AS offerKey, scope, command, decision, revision FROM first_reveal_receipt WHERE record_id = 1');
          const next = nextFirstRevealReceipt(prior, mutation);
          if (!next) return { status: 'conflict' } as const;
          if (next !== prior) {
            if (await db.getFirstAsync('SELECT 1 FROM first_reveal_command WHERE command = ?', next.command)) {
              return { status: 'conflict' } as const;
            }
            await db.runAsync('INSERT INTO first_reveal_command(command, decision, revision) VALUES (?, ?, ?)', next.command, next.decision, next.revision);
            await db.runAsync(`INSERT INTO first_reveal_receipt(record_id, offer_key, scope, command, decision, revision) VALUES (1, ?, ?, ?, ?, ?)
              ON CONFLICT(record_id) DO UPDATE SET command=excluded.command, decision=excluded.decision, revision=excluded.revision`,
            next.offerKey, next.scope, next.command, next.decision, next.revision);
          }
          // A fence change while writing rolls back the entire receipt.
          if (!await verifyCurrent()) throw new ImportLifecycleBlockedError();
          return { status: 'saved', receipt: { ...next } } as const;
        });
        recordAppDiagnostic({ operation, stage, reasonCode: outcome.status === 'saved' ? 'COMPLETE' : outcome.status === 'stale' ? 'HISTORY_STALE' : 'HISTORY_CONFLICT',
          retryable: false, durableOutcome: outcome.status === 'saved' ? 'complete' : 'skipped', correlationId });
        return outcome;
      } catch (error) {
        const blocked = error instanceof ImportLifecycleBlockedError;
        recordAppDiagnostic({ operation, stage, reasonCode: blocked ? 'HISTORY_FENCED' : classifyAppDiagnosticError(error),
          retryable: !blocked, durableOutcome: blocked ? 'blocked' : 'unknown', correlationId });
        throw error;
      }
    },
    async loadHomeSetup() {
      const db = await open();
      const receipt = await db.getFirstAsync<{ disposition: 'saved' | 'skipped' }>('SELECT disposition FROM home_setup_receipt WHERE record_id = 1');
      return receipt?.disposition ?? null;
    },
    async saveHomeSetup(command, areas) {
      if (databaseName !== 'travel-life-import-v1.db') throw new ImportLifecycleBlockedError();
      if (!command || areas.length === 0 || new Set(areas.map((area) => area.id)).size !== areas.length || areas.some((area) => area.origin !== 'manual-pin' || !area.label?.trim())) throw new Error('At least one Home base is required.');
      const entries = areas.map((area) => ({ ...area, label: homeAreaLabel(area) }));
      const payload = JSON.stringify(entries);
      const db = await open();
      const readReceipt = () => db.getFirstAsync<{ command_key: string; payload: string }>('SELECT command_key, payload FROM home_setup_receipt WHERE record_id = 1');
      await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
      try {
        await assertImportActive(db);
        const receipt = await readReceipt();
        if (receipt && (receipt.command_key !== command || receipt.payload !== payload)) throw new HomeSetupConflictError();
        if (!receipt) {
          for (const area of entries) await writeHomeArea(db, area, area.label);
          await db.runAsync('INSERT INTO home_setup_receipt (record_id, command_key, payload, disposition) VALUES (1, ?, ?, ?)', command, payload, 'saved');
        }
        await db.execAsync('COMMIT');
      } catch (error) {
        try { await db.execAsync('ROLLBACK'); } catch { /* Preserve the initial failure. */ }
        if (error instanceof HomeSetupConflictError || error instanceof ImportLifecycleBlockedError) throw error;
        const receipt = await readReceipt();
        await assertImportActive(db);
        if (receipt?.command_key !== command || receipt.payload !== payload) throw error;
      }
    },
    async loadConfiguredHomeAreas() {
      const db = await open();
      const rows = await db.getAllAsync<{ area_id: string; owner_label: string | null; origin: ConfiguredHomeArea['origin']; latitude: number; longitude: number; effective_start_day: string | null; effective_end_day: string | null; radius_meters: number }>(
        'SELECT area_id, owner_label, origin, latitude, longitude, effective_start_day, effective_end_day, radius_meters FROM configured_home_area ORDER BY effective_start_day, area_id',
      );
      return rows.map((row) => ({ id: row.area_id, label: row.owner_label, origin: row.origin, latitude: row.latitude, longitude: row.longitude, effectiveStartDay: row.effective_start_day, effectiveEndDay: row.effective_end_day, radiusMeters: row.radius_meters }));
    },
    async saveConfiguredHomeArea(area) {
      const label = homeAreaLabel(area);
      const db = await open();
      await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
      try {
        await assertImportActive(db);
        await writeHomeArea(db, area, label);
        await db.execAsync('COMMIT');
      } catch (error) { await db.execAsync('ROLLBACK'); throw error; }
    },
    async renameConfiguredHomeArea(id, label) {
      const trimmed = label.trim();
      if (!id || !trimmed) throw new Error('Home base name is required.');
      const db = await open();
      await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
      try { await assertImportActive(db); await db.runAsync('UPDATE configured_home_area SET owner_label = ? WHERE area_id = ?', trimmed, id); await db.execAsync('COMMIT'); }
      catch (error) { await db.execAsync('ROLLBACK'); throw error; }
    },
    // H-4's "keep at least one Home" is a Settings-UI rule (mobile-screens.tsx), not a
    // repository invariant: the engine itself must be able to observe a zero-Home record
    // (e.g. hasPendingHomeProjection after the owner's last Home is removed).
    async deleteConfiguredHomeArea(id) {
      if (!id) throw new Error('Configured home area requires an identifier.');
      const db = await open();
      await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
      try { await assertImportActive(db); await db.runAsync('DELETE FROM configured_home_area WHERE area_id = ?', id); await db.execAsync('COMMIT'); }
      catch (error) { await db.execAsync('ROLLBACK'); throw error; }
    },
    // AI clue layer (decision 0022, CAP-1/M11.1): pure persistence only. This
    // repository never interprets a clue's kind/value/strength — that is
    // clues/store.ts and clues/consumption.ts's job, run by the reconstruction
    // rebuild against whatever rows round-trip through here unchanged.
    async loadClues() {
      const db = await open();
      const rows = await db.getAllAsync<ClueRow>(
        'SELECT clue_id, kind, subject_json, value_json, strength, independence_key, producer_id, producer_version, evidence_revision, home_revision, correction_revision, state, created_at_millis FROM travel_clue ORDER BY created_at_millis, clue_id',
      );
      return rows.map(clueFromRow).filter((clue): clue is ClueRecord => clue !== null);
    },
    async saveClues(clues) {
      if (!clues.length) return;
      const db = await open();
      await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
      try {
        await assertImportActive(db);
        for (const clue of clues) {
          if (!clue.clueId || !clue.producerId || !clue.producerVersion || !clue.independenceKey) throw new Error('Clue record is invalid.');
          await db.runAsync(
            `INSERT INTO travel_clue (clue_id, kind, subject_json, value_json, strength, independence_key, producer_id, producer_version, evidence_revision, home_revision, correction_revision, state, created_at_millis)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(clue_id) DO UPDATE SET kind = excluded.kind, subject_json = excluded.subject_json, value_json = excluded.value_json,
               strength = excluded.strength, independence_key = excluded.independence_key, producer_id = excluded.producer_id,
               producer_version = excluded.producer_version, evidence_revision = excluded.evidence_revision, home_revision = excluded.home_revision,
               correction_revision = excluded.correction_revision, state = excluded.state`,
            clue.clueId, clue.kind, JSON.stringify(clue.subject), JSON.stringify(clue.value), clue.strength, clue.independenceKey,
            clue.producerId, clue.producerVersion, clue.inputsRevision.evidenceRevision, clue.inputsRevision.homeRevision,
            clue.inputsRevision.correctionRevision, clue.state, clue.createdAtMillis,
          );
        }
        await db.execAsync('COMMIT');
      } catch (error) { await db.execAsync('ROLLBACK'); throw error; }
    },
    async updateClueStates(updates) {
      if (!updates.length) return;
      const db = await open();
      await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
      try {
        await assertImportActive(db);
        for (const update of updates) await db.runAsync('UPDATE travel_clue SET state = ? WHERE clue_id = ?', update.state, update.clueId);
        await db.execAsync('COMMIT');
      } catch (error) { await db.execAsync('ROLLBACK'); throw error; }
    },
    async connectPrivateRecord() {
      const db = await open();
      await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
      try {
        await db.runAsync('INSERT OR IGNORE INTO private_history_record (record_id, schema_version) VALUES (?, ?)', 1, CURRENT_SCHEMA_VERSION);
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
        const legacyContinuity = await db.getFirstAsync<{ count: number }>(
          'SELECT COUNT(*) AS count FROM sqlite_master WHERE type = ? AND name = ?',
          'table', 'legacy_atlas_continuity',
        );
        if (legacyContinuity?.count) await db.execAsync('DELETE FROM legacy_atlas_continuity');
        await db.execAsync(`
          DELETE FROM correction_markers;
          DELETE FROM correction_overlays;
          DELETE FROM journey_correction_revision;
          DELETE FROM journey_correction_candidate;
          DELETE FROM journey_correction_application;
          DELETE FROM journey_correction_scope_review;
          DELETE FROM journey_memory_correction_revision;
          DELETE FROM journey_memory_correction_application;
          DELETE FROM journey_memory_correction_candidate;
          DELETE FROM inferred_history;
          DELETE FROM canonical_evidence;
          DELETE FROM import_source_index;
          DELETE FROM import_checkpoint;
          DELETE FROM atlas_preparation_intent;
          DELETE FROM maintenance_change_queue;
          DELETE FROM maintenance_source_presence;
          DELETE FROM maintenance_checkpoint;
          DELETE FROM maintenance_state;
          DELETE FROM maintenance_lease;
          DELETE FROM maintenance_run_sequence;
          DELETE FROM reconciliation_state;
          DELETE FROM reconciliation_checkpoint;
          DELETE FROM reconciliation_queue_snapshot;
          DELETE FROM reconciliation_unresolved_remap;
          DELETE FROM reconciliation_lease;
          DELETE FROM reconciliation_run_sequence;
          DELETE FROM local_cache_registry;
          DELETE FROM reconstruction_trip_qualification;
          DELETE FROM travel_clue;
          DELETE FROM configured_home_area;
          DELETE FROM home_setup_receipt;
          DELETE FROM first_reveal_receipt;
          DELETE FROM first_reveal_command;
          DELETE FROM recognizable_candidate_rejection;
          DELETE FROM visual_place_album;
          DELETE FROM visual_place_review;
          DELETE FROM visual_place_trip;
          DELETE FROM visual_place_disposition;
          UPDATE visual_discovery_state SET enabled = 0, revision = revision + 1, scope = NULL, checkpoint = NULL, proposal = NULL WHERE record_id = 1;
          DELETE FROM manual_journey;
          DELETE FROM journey_privacy_revision;
          DELETE FROM reconstruction_disposition;
          DELETE FROM reconstruction_link;
          DELETE FROM reconstruction_journey;
          DELETE FROM reconstruction_visit;
          DELETE FROM reconstruction_place;
          DELETE FROM reconstruction_run;
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
              (asset_id, media_type, captured_at_millis, captured_day, has_precise_offset, modified_at_millis, location_available, availability, latitude, longitude, reported_accuracy_meters, platform_duplicate_family_id, source_origin, support_eligible, duplicate_tuple_version, duplicate_tuple_fingerprint)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(asset_id) DO UPDATE SET
              media_type = excluded.media_type,
              captured_at_millis = excluded.captured_at_millis, captured_day = excluded.captured_day, has_precise_offset = excluded.has_precise_offset,
              modified_at_millis = excluded.modified_at_millis,
              location_available = excluded.location_available,
              availability = excluded.availability, latitude = excluded.latitude, longitude = excluded.longitude, reported_accuracy_meters = excluded.reported_accuracy_meters,
              platform_duplicate_family_id = excluded.platform_duplicate_family_id, source_origin = excluded.source_origin, support_eligible = excluded.support_eligible,
              duplicate_tuple_version = excluded.duplicate_tuple_version, duplicate_tuple_fingerprint = excluded.duplicate_tuple_fingerprint`,
            candidate.assetId,
            candidate.mediaType,
            candidate.capturedAtMillis, candidate.capturedDay, Number(candidate.hasPreciseOffset),
            candidate.modifiedAtMillis,
            candidate.locationAvailable === null ? null : Number(candidate.locationAvailable),
            candidate.availability, candidate.latitude ?? null, candidate.longitude ?? null, candidate.reportedAccuracyMeters ?? null,
            normalizedFamilyId(candidate.platformDuplicateFamilyId), candidate.sourceOrigin ?? null, candidate.supportEligible === null || candidate.supportEligible === undefined ? null : Number(candidate.supportEligible), DUPLICATE_TUPLE_VERSION, duplicateTuple(candidate),
          );
          // A later foreground import is also proof this stable identity is
          // present. Do not overwrite a live maintenance run marker.
          await db.runAsync('INSERT OR IGNORE INTO maintenance_source_presence (asset_id, last_seen_run) VALUES (?, ?)', candidate.assetId, 0);
          await db.runAsync(
            `INSERT INTO canonical_evidence
              (evidence_id, source_ref, media_type, captured_at_millis, captured_day, has_precise_offset, modified_at_millis, location_available, availability, latitude, longitude, reported_accuracy_meters, platform_duplicate_family_id, source_origin, support_eligible, duplicate_tuple_version, duplicate_tuple_fingerprint)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(source_ref) DO UPDATE SET
              media_type = excluded.media_type,
              captured_at_millis = excluded.captured_at_millis, captured_day = excluded.captured_day, has_precise_offset = excluded.has_precise_offset,
              modified_at_millis = excluded.modified_at_millis,
              location_available = excluded.location_available,
              availability = excluded.availability, latitude = excluded.latitude, longitude = excluded.longitude, reported_accuracy_meters = excluded.reported_accuracy_meters,
              platform_duplicate_family_id = excluded.platform_duplicate_family_id, source_origin = excluded.source_origin, support_eligible = excluded.support_eligible,
              duplicate_tuple_version = excluded.duplicate_tuple_version, duplicate_tuple_fingerprint = excluded.duplicate_tuple_fingerprint`,
            candidate.assetId,
            candidate.assetId,
            candidate.mediaType,
            candidate.capturedAtMillis, candidate.capturedDay, Number(candidate.hasPreciseOffset),
            candidate.modifiedAtMillis,
            candidate.locationAvailable === null ? null : Number(candidate.locationAvailable),
            candidate.availability, candidate.latitude ?? null, candidate.longitude ?? null, candidate.reportedAccuracyMeters ?? null,
            normalizedFamilyId(candidate.platformDuplicateFamilyId), candidate.sourceOrigin ?? null, candidate.supportEligible === null || candidate.supportEligible === undefined ? null : Number(candidate.supportEligible), DUPLICATE_TUPLE_VERSION, duplicateTuple(candidate),
          );
        }
        if (candidates.length) await db.runAsync('UPDATE private_history_record SET canonical_evidence_revision = canonical_evidence_revision + 1 WHERE record_id = 1');
        if (candidates.length) await db.runAsync("UPDATE reconciliation_state SET status = 'pending', message = 'Local journey updates are waiting to be reconciled.' WHERE record_id = 1 AND EXISTS (SELECT 1 FROM maintenance_change_queue)");
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
    async loadReconciliation() {
      const row = await (await open()).getFirstAsync<ReconciliationStateRow>(
        `SELECT state.status, state.last_checked_at_millis, state.last_updated_at_millis,
          state.new_journey_count, state.updated_journey_count, state.message,
          (SELECT COUNT(*) FROM maintenance_change_queue) AS queued_change_count,
          (SELECT COUNT(*) FROM reconciliation_unresolved_remap) AS unresolved_remap_count
         FROM reconciliation_state state WHERE state.record_id = 1`,
      );
      return row ? {
        status: row.status, pendingCount: row.queued_change_count + row.unresolved_remap_count,
        queuedChangeCount: row.queued_change_count, unresolvedRemapCount: row.unresolved_remap_count,
        lastCheckedAtMillis: row.last_checked_at_millis,
        lastUpdatedAtMillis: row.last_updated_at_millis, newJourneyCount: row.new_journey_count,
        updatedJourneyCount: row.updated_journey_count, message: row.message,
      } : { status: 'idle', pendingCount: 0, lastCheckedAtMillis: null, lastUpdatedAtMillis: null, newJourneyCount: 0, updatedJourneyCount: 0, message: null };
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
        let changedEvidence = false;
        for (const candidate of candidates) {
          const prior = await db.getFirstAsync<SourceRow>('SELECT modified_at_millis, availability, platform_duplicate_family_id, duplicate_tuple_fingerprint FROM import_source_index WHERE asset_id = ?', candidate.assetId);
          const canonical = await db.getFirstAsync<{ availability: SourceCandidate['availability'] }>('SELECT availability FROM canonical_evidence WHERE source_ref = ?', candidate.assetId);
          const kind = !prior ? 'added' : canonical?.availability !== 'available' && candidate.availability === 'available' ? 'available'
            : prior.modified_at_millis !== candidate.modifiedAtMillis || prior.availability !== candidate.availability
              || prior.platform_duplicate_family_id !== normalizedFamilyId(candidate.platformDuplicateFamilyId)
              || prior.duplicate_tuple_fingerprint !== duplicateTuple(candidate) ? 'changed' : null;
          await db.runAsync(
            `INSERT INTO import_source_index (asset_id, media_type, captured_at_millis, captured_day, has_precise_offset, modified_at_millis, location_available, availability, latitude, longitude, reported_accuracy_meters, platform_duplicate_family_id, source_origin, support_eligible, duplicate_tuple_version, duplicate_tuple_fingerprint)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(asset_id) DO UPDATE SET media_type=excluded.media_type,
             captured_at_millis=excluded.captured_at_millis, captured_day=excluded.captured_day, has_precise_offset=excluded.has_precise_offset, modified_at_millis=excluded.modified_at_millis,
             location_available=excluded.location_available, availability=excluded.availability, latitude=excluded.latitude, longitude=excluded.longitude, reported_accuracy_meters=excluded.reported_accuracy_meters,
             platform_duplicate_family_id=excluded.platform_duplicate_family_id, source_origin=excluded.source_origin, support_eligible=excluded.support_eligible, duplicate_tuple_version=excluded.duplicate_tuple_version, duplicate_tuple_fingerprint=excluded.duplicate_tuple_fingerprint
             WHERE modified_at_millis IS NOT excluded.modified_at_millis OR availability IS NOT excluded.availability OR
             media_type IS NOT excluded.media_type OR captured_at_millis IS NOT excluded.captured_at_millis OR captured_day IS NOT excluded.captured_day OR has_precise_offset IS NOT excluded.has_precise_offset OR location_available IS NOT excluded.location_available OR latitude IS NOT excluded.latitude OR longitude IS NOT excluded.longitude OR reported_accuracy_meters IS NOT excluded.reported_accuracy_meters OR platform_duplicate_family_id IS NOT excluded.platform_duplicate_family_id OR source_origin IS NOT excluded.source_origin OR support_eligible IS NOT excluded.support_eligible OR duplicate_tuple_fingerprint IS NOT excluded.duplicate_tuple_fingerprint`,
            candidate.assetId, candidate.mediaType, candidate.capturedAtMillis, candidate.capturedDay, Number(candidate.hasPreciseOffset), candidate.modifiedAtMillis,
            candidate.locationAvailable === null ? null : Number(candidate.locationAvailable), candidate.availability, candidate.latitude ?? null, candidate.longitude ?? null, candidate.reportedAccuracyMeters ?? null,
            normalizedFamilyId(candidate.platformDuplicateFamilyId), candidate.sourceOrigin ?? null, candidate.supportEligible === null || candidate.supportEligible === undefined ? null : Number(candidate.supportEligible), DUPLICATE_TUPLE_VERSION, duplicateTuple(candidate),
          );
          if (kind) await db.runAsync(
            `INSERT INTO canonical_evidence
              (evidence_id, source_ref, media_type, captured_at_millis, captured_day, has_precise_offset, modified_at_millis, location_available, availability, latitude, longitude, reported_accuracy_meters, platform_duplicate_family_id, source_origin, support_eligible, duplicate_tuple_version, duplicate_tuple_fingerprint)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(source_ref) DO UPDATE SET media_type=excluded.media_type,
              captured_at_millis=excluded.captured_at_millis, captured_day=excluded.captured_day, has_precise_offset=excluded.has_precise_offset, modified_at_millis=excluded.modified_at_millis,
              location_available=excluded.location_available, availability=excluded.availability, latitude=excluded.latitude, longitude=excluded.longitude, reported_accuracy_meters=excluded.reported_accuracy_meters,
              platform_duplicate_family_id=excluded.platform_duplicate_family_id, source_origin=excluded.source_origin, support_eligible=excluded.support_eligible, duplicate_tuple_version=excluded.duplicate_tuple_version, duplicate_tuple_fingerprint=excluded.duplicate_tuple_fingerprint
              WHERE modified_at_millis IS NOT excluded.modified_at_millis OR availability IS NOT excluded.availability OR
              media_type IS NOT excluded.media_type OR captured_at_millis IS NOT excluded.captured_at_millis OR captured_day IS NOT excluded.captured_day OR has_precise_offset IS NOT excluded.has_precise_offset OR location_available IS NOT excluded.location_available OR latitude IS NOT excluded.latitude OR longitude IS NOT excluded.longitude OR reported_accuracy_meters IS NOT excluded.reported_accuracy_meters OR platform_duplicate_family_id IS NOT excluded.platform_duplicate_family_id OR source_origin IS NOT excluded.source_origin OR support_eligible IS NOT excluded.support_eligible OR duplicate_tuple_fingerprint IS NOT excluded.duplicate_tuple_fingerprint`,
            candidate.assetId, candidate.assetId, candidate.mediaType, candidate.capturedAtMillis, candidate.capturedDay, Number(candidate.hasPreciseOffset),
            candidate.modifiedAtMillis, candidate.locationAvailable === null ? null : Number(candidate.locationAvailable), candidate.availability, candidate.latitude ?? null, candidate.longitude ?? null, candidate.reportedAccuracyMeters ?? null,
            normalizedFamilyId(candidate.platformDuplicateFamilyId), candidate.sourceOrigin ?? null, candidate.supportEligible === null || candidate.supportEligible === undefined ? null : Number(candidate.supportEligible), DUPLICATE_TUPLE_VERSION, duplicateTuple(candidate),
          );
          await db.runAsync('INSERT INTO maintenance_source_presence (asset_id, last_seen_run, missing_full_scans) VALUES (?, ?, 0) ON CONFLICT(asset_id) DO UPDATE SET last_seen_run=excluded.last_seen_run, missing_full_scans=0', candidate.assetId, checkpoint.runToken);
          if (kind) await db.runAsync('INSERT OR IGNORE INTO maintenance_change_queue (asset_id, change_kind, source_revision) VALUES (?, ?, ?)', candidate.assetId, kind, candidate.modifiedAtMillis ?? -1);
          changedEvidence ||= kind !== null;
        }
        if (changedEvidence) await db.runAsync('UPDATE private_history_record SET canonical_evidence_revision = canonical_evidence_revision + 1 WHERE record_id = 1');
        if (candidates.length) await db.runAsync("UPDATE reconciliation_state SET status = 'pending', message = 'Local journey updates are waiting to be reconciled.' WHERE record_id = 1 AND EXISTS (SELECT 1 FROM maintenance_change_queue)");
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
          // Retain the private evidence row and provenance, but make it
          // ineligible for the next deterministic graph. The deletion queue is
          // therefore reflected in canonical reconstruction input.
          await db.runAsync(`UPDATE canonical_evidence SET availability = 'unavailable' WHERE source_ref IN (
            SELECT asset_id FROM maintenance_source_presence WHERE missing_full_scans >= ?
          )`, 2);
          const deleted = (await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM maintenance_source_presence WHERE missing_full_scans >= ?', 2))?.count ?? 0;
          if (deleted > 0) await db.runAsync('UPDATE private_history_record SET canonical_evidence_revision = canonical_evidence_revision + 1 WHERE record_id = 1');
          await db.runAsync('DELETE FROM maintenance_source_presence WHERE missing_full_scans >= ?', 2);
          await db.runAsync("UPDATE reconciliation_state SET status = 'pending', message = 'Local journey updates are waiting to be reconciled.' WHERE record_id = 1 AND EXISTS (SELECT 1 FROM maintenance_change_queue)");
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
    async acquireMaintenanceLease(nowMillis, allowDisabled = false) {
      const db = await open();
      await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
      try {
        await assertImportActive(db);
        const state = await db.getFirstAsync<{ enabled: number }>('SELECT enabled FROM maintenance_state WHERE record_id = 1');
        const existingLease = await db.getFirstAsync<{ run_token: number; expires_at_millis: number }>('SELECT run_token, expires_at_millis FROM maintenance_lease WHERE record_id = 1');
        if ((!allowDisabled && state?.enabled !== 1) || (existingLease && existingLease.expires_at_millis > nowMillis)) {
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
