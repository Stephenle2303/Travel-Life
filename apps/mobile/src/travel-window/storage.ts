import { runOwnedTransaction, serializeNativeTransactions } from '@/database/native-transaction';
import { classifyAppDiagnosticError, createDiagnosticCorrelationId, recordAppDiagnostic, type AppDiagnosticEvent } from '@/diagnostics/app-diagnostics';
import { ensureNativeImportSchema } from '@/import-record/repository';
import type { CaptureRecord, ProvenanceClass } from './types';

/**
 * Production storage for GPS-less trip discovery (decision 0019/0020).
 * Deliberately independent of the GPS reconstruction engine: never reads or
 * writes `canonical_evidence` or any `reconstruction_*` table. Shares only
 * the underlying SQLite file (`travel-life-import-v1.db`) and the project's
 * existing transaction-serialization guard, like every other repository
 * here — no new locking logic.
 */

type Database = {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, ...parameters: (string | number | null)[]): Promise<unknown>;
  getAllAsync<T>(source: string, ...parameters: (string | number | null)[]): Promise<T[]>;
  getFirstAsync<T>(source: string, ...parameters: (string | number | null)[]): Promise<T | null>;
};

export type ScanCursor = { backfillCursorMillis: number | null; backfillComplete: boolean; newestCursorMillis: number | null };
export type ScanState = { captures: CaptureRecord[]; cursor: ScanCursor };
export type Disposition = 'confirmed' | 'dismissed';
/** A gazetteer match (reconstruction/owner-place-search.ts's OwnerPlace), never a raw coordinate the owner didn't choose. */
export type ConfirmedPlace = { name: string; context: string; latitude: number; longitude: number };
export type ConfirmedDateRange = { startDay: string; endDay: string };

export type TravelWindowStorage = {
  readScanState(): Promise<ScanState>;
  writeScanBatch(records: readonly CaptureRecord[], cursor: Partial<ScanCursor>): Promise<void>;
  readDispositions(): Promise<ReadonlyMap<string, Disposition>>;
  /**
   * Also creates a real `manual_journey` + `travel_window_album` so the
   * confirmed trip is visible in the Atlas and goes through the same
   * journey-detail/Replay-eligibility gates as any other journey (decision
   * 0019/0020's own acceptance line). Only `memberIds` (trusted camera/
   * imported provenance) become album photos; `reviewIds` stay excluded —
   * membership.ts's own distinction ("never assumed to be the owner's").
   * A member photo with no matching `canonical_evidence` row yet (the main
   * import hasn't reached it) is silently skipped, not retried here.
   */
  confirmWindow(command: string, manualId: string, memberIds: readonly string[], reviewIds: readonly string[], place: ConfirmedPlace, dateRange: ConfirmedDateRange): Promise<void>;
  dismissWindow(command: string): Promise<void>;
};

type CaptureRow = { asset_id: string; captured_at_millis: number; utc_offset_minutes: number | null; provenance: string; located: number };
type CursorRow = { backfill_cursor_millis: number | null; backfill_complete: number; newest_cursor_millis: number | null };
type DispositionRow = { command: string; decision: Disposition };

const knownProvenance: ReadonlySet<string> = new Set<ProvenanceClass>(['camera', 'imported', 'messaging', 'screenshot', 'download', 'unknown']);
function toProvenance(value: string): ProvenanceClass {
  return knownProvenance.has(value) ? (value as ProvenanceClass) : 'unknown';
}

function diagnostic(stage: 'TRAVEL_WINDOW_CACHE_READ' | 'TRAVEL_WINDOW_CACHE_WRITE' | 'TRAVEL_WINDOW_REVIEW', reasonCode: AppDiagnosticEvent['reasonCode'], outcome: AppDiagnosticEvent['durableOutcome'], retryable: boolean, correlationId: string): AppDiagnosticEvent {
  return { operation: 'TRAVEL_WINDOW_SCAN', stage, reasonCode, retryable, durableOutcome: outcome, correlationId };
}

/** Runs a storage step, converting any failure into the one closed diagnostic for that stage. */
async function guarded<T>(stage: 'TRAVEL_WINDOW_CACHE_READ' | 'TRAVEL_WINDOW_CACHE_WRITE' | 'TRAVEL_WINDOW_REVIEW', body: () => Promise<T>): Promise<T> {
  const correlationId = createDiagnosticCorrelationId();
  try {
    const result = await body();
    recordAppDiagnostic(diagnostic(stage, 'COMPLETE', 'complete', false, correlationId));
    return result;
  } catch (error) {
    const reasonCode = classifyAppDiagnosticError(error);
    const retryable = reasonCode === 'DATABASE_BUSY' || reasonCode === 'TRANSACTION';
    recordAppDiagnostic(diagnostic(stage, reasonCode, 'failed', retryable, correlationId));
    throw error;
  }
}

export function createTravelWindowStorage(options?: { databaseName?: string }): TravelWindowStorage {
  const databaseName = options?.databaseName ?? 'travel-life-import-v1.db';
  let database: Promise<Database> | null = null;

  async function open(): Promise<Database> {
    if (!database) {
      database = (async () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const sqlite = require('expo-sqlite') as { openDatabaseAsync(name: string, options?: { useNewConnection?: boolean }): Promise<Database> };
        const db = serializeNativeTransactions(await sqlite.openDatabaseAsync(databaseName, { useNewConnection: true }));
        // Matches every other independently opened connection to this file
        // (reconstruction/repository.ts, import-record/repository.ts): without
        // it, a writer that loses the race to another connection's lock fails
        // immediately as DATABASE_BUSY instead of waiting its turn.
        await db.execAsync('PRAGMA busy_timeout = 30000');
        await ensureNativeImportSchema(db);
        return db;
      })();
    }
    return database;
  }

  return {
    async readScanState() {
      return guarded('TRAVEL_WINDOW_CACHE_READ', async () => {
        const db = await open();
        const [rows, cursorRow] = await Promise.all([
          db.getAllAsync<CaptureRow>('SELECT asset_id, captured_at_millis, utc_offset_minutes, provenance, located FROM travel_window_capture'),
          db.getFirstAsync<CursorRow>('SELECT backfill_cursor_millis, backfill_complete, newest_cursor_millis FROM travel_window_state WHERE record_id = 1'),
        ]);
        const captures: CaptureRecord[] = rows.map((row) => ({
          id: row.asset_id, capturedAtMillis: row.captured_at_millis, utcOffsetMinutes: row.utc_offset_minutes,
          provenance: toProvenance(row.provenance), located: row.located === 1,
        }));
        const cursor: ScanCursor = {
          backfillCursorMillis: cursorRow?.backfill_cursor_millis ?? null,
          backfillComplete: cursorRow?.backfill_complete === 1,
          newestCursorMillis: cursorRow?.newest_cursor_millis ?? null,
        };
        return { captures, cursor };
      });
    },

    async writeScanBatch(records, cursor) {
      return guarded('TRAVEL_WINDOW_CACHE_WRITE', async () => {
        const db = await open();
        await runOwnedTransaction(db, { kind: 'background' }, async (tx) => {
          for (const record of records) {
            await tx.runAsync(
              'INSERT INTO travel_window_capture (asset_id, captured_at_millis, utc_offset_minutes, provenance, located) VALUES (?, ?, ?, ?, ?)'
                + ' ON CONFLICT (asset_id) DO UPDATE SET captured_at_millis = excluded.captured_at_millis, utc_offset_minutes = excluded.utc_offset_minutes, provenance = excluded.provenance, located = excluded.located',
              record.id, record.capturedAtMillis, record.utcOffsetMinutes, record.provenance, record.located ? 1 : 0,
            );
          }
          const sets: string[] = [];
          const params: (string | number | null)[] = [];
          if ('backfillCursorMillis' in cursor) { sets.push('backfill_cursor_millis = ?'); params.push(cursor.backfillCursorMillis ?? null); }
          if ('backfillComplete' in cursor) { sets.push('backfill_complete = ?'); params.push(cursor.backfillComplete ? 1 : 0); }
          if ('newestCursorMillis' in cursor) { sets.push('newest_cursor_millis = ?'); params.push(cursor.newestCursorMillis ?? null); }
          if (sets.length) await tx.runAsync(`UPDATE travel_window_state SET ${sets.join(', ')} WHERE record_id = 1`, ...params);
        });
      });
    },

    async readDispositions() {
      return guarded('TRAVEL_WINDOW_CACHE_READ', async () => {
        const db = await open();
        const rows = await db.getAllAsync<DispositionRow>('SELECT command, decision FROM travel_window_disposition');
        return new Map(rows.map((row) => [row.command, row.decision]));
      });
    },

    async confirmWindow(command, manualId, memberIds, reviewIds, place, dateRange) {
      return guarded('TRAVEL_WINDOW_REVIEW', async () => {
        const db = await open();
        await runOwnedTransaction(db, { kind: 'foreground' }, async (tx) => {
          await tx.runAsync(
            'INSERT INTO travel_window_trip (manual_id, command, member_ids, review_ids, owner_place_name) VALUES (?, ?, ?, ?, ?)',
            manualId, command, JSON.stringify(memberIds), JSON.stringify(reviewIds), place.name,
          );
          await tx.runAsync('INSERT INTO travel_window_disposition (command, decision, manual_id) VALUES (?, ?, ?)', command, 'confirmed', manualId);
          const dateKind = dateRange.startDay === dateRange.endDay ? 'exact' : 'approximate';
          await tx.runAsync(
            'INSERT INTO manual_journey (manual_id, command_key, owner_label, owner_context, latitude, longitude, date_kind, date_start, date_end, created_at_millis) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            manualId, command, place.name, place.context, place.latitude, place.longitude, dateKind, dateRange.startDay, dateRange.endDay, Date.now(),
          );
          // Only trusted camera/imported captures become album photos; the
          // owner reviews nothing here, so an unresolved member is skipped,
          // never guessed from a different evidence row. Chunked: a window
          // has "deliberately no size cap" (membership.ts) and can exceed
          // SQLite's bound-parameter limit.
          const bySourceRef = new Map<string, string>();
          const CHUNK = 400;
          for (let start = 0; start < memberIds.length; start += CHUNK) {
            const chunk = memberIds.slice(start, start + CHUNK);
            const matches = await tx.getAllAsync<{ evidence_id: string; source_ref: string }>(
              `SELECT evidence_id, source_ref FROM canonical_evidence WHERE source_ref IN (${chunk.map(() => '?').join(',')})`
                + " AND media_type = 'image' AND latitude IS NULL AND longitude IS NULL",
              ...chunk,
            );
            for (const row of matches) bySourceRef.set(row.source_ref, row.evidence_id);
          }
          let slot = 0;
          for (const memberId of memberIds) {
            const evidenceId = bySourceRef.get(memberId);
            if (!evidenceId) continue;
            slot += 1;
            await tx.runAsync('INSERT INTO travel_window_album (manual_id, slot, evidence_id, source_ref) VALUES (?, ?, ?, ?)', manualId, slot, evidenceId, memberId);
          }
        });
      });
    },

    async dismissWindow(command) {
      return guarded('TRAVEL_WINDOW_REVIEW', async () => {
        const db = await open();
        await db.runAsync('INSERT INTO travel_window_disposition (command, decision, manual_id) VALUES (?, ?, ?)', command, 'dismissed', null);
      });
    },
  };
}
