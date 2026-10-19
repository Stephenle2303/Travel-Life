import type { CorrectionOverlay, PrivateRecordLifecycle } from '@/history-record';
import { serializeNativeTransactions } from '@/database/native-transaction';

import {
  ImportLifecycleBlockedError, type ImportCheckpoint, type ImportRepository, type ImportScope,
  type MaintenanceCheckpoint, type MaintenanceRepository, type MaintenanceSnapshot, type ReconciliationSnapshot, type SourceCandidate,
} from './types';

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

const CURRENT_SCHEMA_VERSION = 33;
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
const migrationV33 = `
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
  CREATE INDEX IF NOT EXISTS manual_journey_dates ON manual_journey (date_start, date_end);
  UPDATE private_history_record SET schema_version = 33 WHERE record_id = 1;
`;

const MAINTENANCE_LEASE_MILLIS = 5 * 60 * 1000;

type SchemaRow = { version: number };
type LifecycleRow = { state: 'connected' | 'disconnected' };
type RevisionRow = { revision: number | null };
type MaintenanceStateRow = { enabled: number; status: MaintenanceSnapshot['status']; last_checked_at_millis: number | null; last_updated_at_millis: number | null; message: string | null };
type MaintenanceCheckpointRow = { scope: Extract<ImportScope, 'full' | 'limited'>; next_offset: number; run_token: number; status: MaintenanceCheckpoint['status'] };
type SourceRow = { modified_at_millis: number | null; availability: SourceCandidate['availability']; platform_duplicate_family_id?: string | null; duplicate_tuple_fingerprint?: string | null };
type ReconciliationStateRow = { status: ReconciliationSnapshot['status']; last_checked_at_millis: number | null; last_updated_at_millis: number | null; new_journey_count: number; updated_journey_count: number; message: string | null; pending_count: number };

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
export function createNativeImportRepository(): ImportRepository & MaintenanceRepository {
  let database: Promise<SqliteDatabase> | null = null;

  async function open() {
    if (!database) {
      database = (async () => {
        // Native-only dependency loading keeps an unsupported runtime closed.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const sqlite = require('expo-sqlite') as { openDatabaseAsync(name: string): Promise<SqliteDatabase> };
        const db = serializeNativeTransactions(await sqlite.openDatabaseAsync('travel-life-import-v1.db'));
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
        if (currentSchema?.version === CURRENT_SCHEMA_VERSION) return db;
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
    getCheckpoint: read,
    loadCoverage: read,
    async getPrivateRecordLifecycle() {
      return lifecycle(await open());
    },
    async loadConfiguredHomeAreas() {
      const db = await open();
      const rows = await db.getAllAsync<{ area_id: string; owner_label: string | null; origin: 'observed-area' | 'legacy'; latitude: number; longitude: number; effective_start_day: string | null; effective_end_day: string | null; radius_meters: number }>(
        'SELECT area_id, owner_label, origin, latitude, longitude, effective_start_day, effective_end_day, radius_meters FROM configured_home_area ORDER BY effective_start_day, area_id',
      );
      return rows.map((row) => ({ id: row.area_id, label: row.owner_label, origin: row.origin, latitude: row.latitude, longitude: row.longitude, effectiveStartDay: row.effective_start_day, effectiveEndDay: row.effective_end_day, radiusMeters: row.radius_meters }));
    },
    async saveConfiguredHomeArea(area) {
      const label = area.label?.trim() || null;
      if (!area.id || (area.label !== null && !label) || !Number.isFinite(area.latitude) || !Number.isFinite(area.longitude) || !Number.isFinite(area.radiusMeters)
        || area.latitude < -90 || area.latitude > 90 || area.longitude < -180 || area.longitude > 180 || area.radiusMeters <= 0 || area.radiusMeters > 50_000
        || (!validCivilDay(area.effectiveStartDay) && area.effectiveStartDay !== null) || (!validCivilDay(area.effectiveEndDay) && area.effectiveEndDay !== null)
        || (area.effectiveStartDay !== null && area.effectiveEndDay !== null && area.effectiveStartDay > area.effectiveEndDay)) throw new Error('Configured home area is invalid.');
      const db = await open();
      await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
      try {
        await assertImportActive(db);
        await db.runAsync('INSERT INTO configured_home_area (area_id, owner_label, origin, latitude, longitude, effective_start_day, effective_end_day, radius_meters) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(area_id) DO UPDATE SET owner_label=excluded.owner_label, origin=excluded.origin, latitude=excluded.latitude, longitude=excluded.longitude, effective_start_day=excluded.effective_start_day, effective_end_day=excluded.effective_end_day, radius_meters=excluded.radius_meters', area.id, label, area.origin, area.latitude, area.longitude, area.effectiveStartDay, area.effectiveEndDay, area.radiusMeters);
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
    async deleteConfiguredHomeArea(id) {
      if (!id) throw new Error('Configured home area requires an identifier.');
      const db = await open();
      await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
      try { await assertImportActive(db); await db.runAsync('DELETE FROM configured_home_area WHERE area_id = ?', id); await db.execAsync('COMMIT'); }
      catch (error) { await db.execAsync('ROLLBACK'); throw error; }
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
          DELETE FROM configured_home_area;
          DELETE FROM manual_journey;
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
          (SELECT COUNT(*) FROM maintenance_change_queue) + (SELECT COUNT(*) FROM reconciliation_unresolved_remap) AS pending_count
         FROM reconciliation_state state WHERE state.record_id = 1`,
      );
      return row ? {
        status: row.status, pendingCount: row.pending_count, lastCheckedAtMillis: row.last_checked_at_millis,
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
