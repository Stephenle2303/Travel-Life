import type { ReconstructionEvidence, ReconstructionGraph } from './types';
import { RECONSTRUCTION_RULE_VERSION } from './types';
import { reconstructV1 } from './engine';

type Database = {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, ...parameters: (string | number | null)[]): Promise<unknown>;
  getAllAsync<T>(source: string, ...parameters: (string | number | null)[]): Promise<T[]>;
  getFirstAsync<T>(source: string, ...parameters: (string | number | null)[]): Promise<T | null>;
};

type EvidenceRow = { evidence_id: string; captured_at_millis: number | null; captured_day: string | null; has_precise_offset: number; availability: ReconstructionEvidence['availability']; latitude: number | null; longitude: number | null; reported_accuracy_meters: number | null };

/** A graph rebuild is one local transaction, so readers see the prior complete run or the next one. */
export function createNativeReconstructionRepository() {
  let database: Promise<Database> | null = null;
  async function open() {
    if (!database) database = (async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const sqlite = require('expo-sqlite') as { openDatabaseAsync(name: string): Promise<Database> };
      return sqlite.openDatabaseAsync('travel-life-import-v1.db');
    })().catch((error) => { database = null; throw error; });
    return database;
  }

  return {
    async rebuild(nowMillis = Date.now()): Promise<ReconstructionGraph> {
      const db = await open();
      await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
      try {
        const lifecycle = await db.getFirstAsync<{ state: string }>('SELECT state FROM private_record_lifecycle WHERE record_id = 1');
        if (lifecycle?.state !== 'connected') throw new Error('Private record is not connected.');
        const rows = await db.getAllAsync<EvidenceRow>('SELECT evidence_id, captured_at_millis, captured_day, has_precise_offset, availability, latitude, longitude, reported_accuracy_meters FROM canonical_evidence');
        const excluded = new Set((await db.getAllAsync<{ target_id: string }>(`SELECT current.target_id FROM correction_overlays current
          JOIN (SELECT target_id, MAX(revision) AS revision FROM correction_overlays WHERE target_kind = 'evidence' AND correction_scope = 'inclusion' GROUP BY target_id) latest
          ON latest.target_id = current.target_id AND latest.revision = current.revision
          WHERE current.target_kind = 'evidence' AND current.correction_scope = 'inclusion' AND current.owner_action = 'remove'`)).map((row) => row.target_id));
        const graph = reconstructV1(rows.map((row) => ({
          id: row.evidence_id, capturedAtMillis: row.captured_at_millis,
          capturedDay: row.captured_day,
          hasPreciseOffset: row.has_precise_offset === 1, latitude: row.latitude, longitude: row.longitude, reportedAccuracyMeters: row.reported_accuracy_meters,
          availability: row.availability, duplicateFamilyId: null, duplicateConflict: false, excluded: excluded.has(row.evidence_id),
        })));
        const evidenceRevision = (await db.getFirstAsync<{ canonical_evidence_revision: number | null }>('SELECT canonical_evidence_revision FROM private_history_record WHERE record_id = 1'))?.canonical_evidence_revision ?? 0;
        const correctionRevision = (await db.getFirstAsync<{ revision: number | null }>('SELECT MAX(revision) AS revision FROM correction_overlays'))?.revision ?? 0;
        const revision = Math.max(evidenceRevision, correctionRevision);
        await db.runAsync('INSERT INTO reconstruction_run (rule_version, evidence_revision, status, completed_at_millis) VALUES (?, ?, ?, ?)', RECONSTRUCTION_RULE_VERSION, revision, 'complete', nowMillis);
        const runId = (await db.getFirstAsync<{ run_id: number }>('SELECT MAX(run_id) AS run_id FROM reconstruction_run'))?.run_id;
        if (runId === undefined) throw new Error('Could not create reconstruction run.');
        await db.runAsync('DELETE FROM reconstruction_disposition'); await db.runAsync('DELETE FROM reconstruction_link'); await db.runAsync('DELETE FROM reconstruction_journey'); await db.runAsync('DELETE FROM reconstruction_visit'); await db.runAsync('DELETE FROM reconstruction_place');
        for (const place of graph.places) { await db.runAsync('INSERT INTO reconstruction_place (place_id, run_id, representative_evidence_id, uncertainty_json) VALUES (?, ?, ?, ?)', place.id, runId, place.representativeId, JSON.stringify(place.uncertainty)); for (const evidenceId of place.memberIds) await db.runAsync('INSERT INTO reconstruction_link (run_id, link_kind, parent_id, child_id) VALUES (?, ?, ?, ?)', runId, 'place-support', place.id, evidenceId); }
        for (const visit of graph.visits) { await db.runAsync('INSERT INTO reconstruction_visit (visit_id, run_id, place_id, ordering) VALUES (?, ?, ?, ?)', visit.id, runId, visit.placeId, visit.order); for (const evidenceId of visit.evidenceIds) await db.runAsync('INSERT INTO reconstruction_link (run_id, link_kind, parent_id, child_id) VALUES (?, ?, ?, ?)', runId, 'visit-support', visit.id, evidenceId); }
        for (const journey of graph.journeys) { await db.runAsync('INSERT INTO reconstruction_journey (journey_id, run_id, journey_state) VALUES (?, ?, ?)', journey.id, runId, journey.state); for (const visitId of journey.visitIds) await db.runAsync('INSERT INTO reconstruction_link (run_id, link_kind, parent_id, child_id) VALUES (?, ?, ?, ?)', runId, 'journey-visit', journey.id, visitId); }
        for (const membership of graph.memberships) await db.runAsync('INSERT INTO reconstruction_link (run_id, link_kind, parent_id, child_id) VALUES (?, ?, ?, ?)', runId, `membership:${membership.state}:${membership.reason}`, membership.journeyId, membership.evidenceId);
        for (const merge of graph.possibleMerges) await db.runAsync('INSERT INTO reconstruction_link (run_id, link_kind, parent_id, child_id) VALUES (?, ?, ?, ?)', runId, `possible-merge:${merge.reason}`, merge.fromJourneyId, merge.toJourneyId);
        for (const disposition of graph.dispositions) await db.runAsync('INSERT INTO reconstruction_disposition (run_id, evidence_id, disposition_state, reasons_json) VALUES (?, ?, ?, ?)', runId, disposition.evidenceId, disposition.state, JSON.stringify(disposition.reasons));
        await db.execAsync('COMMIT');
        return graph;
      } catch (error) { await db.execAsync('ROLLBACK'); throw error; }
    },
  };
}
