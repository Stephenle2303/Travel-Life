import type { ImportCheckpoint, ImportRepository, ImportScope } from './types';

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

const CURRENT_SCHEMA_VERSION = 1;

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

type SchemaRow = { version: number };

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
export function createNativeImportRepository(): ImportRepository {
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

  return {
    getCheckpoint: read,
    loadCoverage: read,
    async commitPage(checkpoint, candidates) {
      const db = await open();
      await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
      try {
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
  };
}
