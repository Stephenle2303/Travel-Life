import type { ReconstructionEvidence, ReconstructionGraph } from './types';
import { RECONSTRUCTION_RULE_VERSION } from './types';
import { reconstructV1 } from './engine';
import { NATURAL_EARTH_ADMIN_0_DATASET_VERSION, resolveCountry } from './country-resolver';
import type { DurableRevealRecord, JourneyDetail, RevealMapAnchor } from '@/reveal/types';

type Database = {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, ...parameters: (string | number | null)[]): Promise<unknown>;
  getAllAsync<T>(source: string, ...parameters: (string | number | null)[]): Promise<T[]>;
  getFirstAsync<T>(source: string, ...parameters: (string | number | null)[]): Promise<T | null>;
};

type EvidenceRow = { evidence_id: string; captured_at_millis: number | null; captured_day: string | null; has_precise_offset: number; availability: ReconstructionEvidence['availability']; latitude: number | null; longitude: number | null; reported_accuracy_meters: number | null };
const RECONCILIATION_LEASE_MILLIS = 5 * 60 * 1000;

function coarseMapAnchor(latitude: number | null, longitude: number | null): RevealMapAnchor | null {
  if (latitude === null || longitude === null || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  // About eleven kilometres at the equator: useful for an Atlas overview but
  // deliberately not a precise personal location.
  return { latitude: Math.round(latitude * 10) / 10, longitude: Math.round(longitude * 10) / 10 };
}

/** Keeps an internal reconstruction ID out of the UI while retaining a stable local key. */
function opaqueJourneyDisplayId(journeyId: string) {
  let first = 2166136261;
  let second = 5381;
  for (let index = 0; index < journeyId.length; index += 1) {
    const code = journeyId.charCodeAt(index);
    first = Math.imul(first ^ code, 16777619);
    second = Math.imul(second, 33) ^ code;
  }
  return `atlas-${(first >>> 0).toString(36)}-${(second >>> 0).toString(36)}`;
}

/** A graph rebuild is one local transaction, so readers see the prior complete run or the next one. */
export function createNativeReconstructionRepository() {
  let database: Promise<Database> | null = null;
  // Populated only by the redacted Atlas read. It keeps the raw journey id in
  // this local repository, so opening one selected card never scans all IDs.
  const displayedJourneys = new Map<string, { runId: number; journeyId: string }>();
  async function open() {
    if (!database) database = (async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const sqlite = require('expo-sqlite') as { openDatabaseAsync(name: string): Promise<Database> };
      return sqlite.openDatabaseAsync('travel-life-import-v1.db');
    })().catch((error) => { database = null; throw error; });
    return database;
  }

  async function acquireLease(nowMillis: number): Promise<number | null> {
    const db = await open();
    await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
    try {
      const lifecycle = await db.getFirstAsync<{ state: string }>('SELECT state FROM private_record_lifecycle WHERE record_id = 1');
      if (lifecycle?.state !== 'connected') throw new Error('Private record is not connected.');
      const existing = await db.getFirstAsync<{ expires_at_millis: number }>('SELECT expires_at_millis FROM reconciliation_lease WHERE record_id = 1');
      if (existing && existing.expires_at_millis > nowMillis) { await db.execAsync('COMMIT'); return null; }
      const sequence = await db.getFirstAsync<{ next_token: number }>('SELECT next_token FROM reconciliation_run_sequence WHERE record_id = 1');
      const token = sequence?.next_token ?? 1;
      await db.runAsync('INSERT INTO reconciliation_run_sequence (record_id, next_token) VALUES (?, ?) ON CONFLICT(record_id) DO UPDATE SET next_token=excluded.next_token', 1, token + 1);
      await db.runAsync('INSERT INTO reconciliation_lease (record_id, owner_token, expires_at_millis) VALUES (?, ?, ?) ON CONFLICT(record_id) DO UPDATE SET owner_token=excluded.owner_token, expires_at_millis=excluded.expires_at_millis', 1, token, nowMillis + RECONCILIATION_LEASE_MILLIS);
      await db.execAsync('COMMIT');
      return token;
    } catch (error) { await db.execAsync('ROLLBACK'); throw error; }
  }

  async function releaseLease(token: number) {
    await (await open()).runAsync('DELETE FROM reconciliation_lease WHERE record_id = 1 AND owner_token = ?', token);
  }

  async function saveOutcome(status: 'pending' | 'restricted' | 'error', message: string) {
    const db = await open();
    await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
    try {
      await db.runAsync('UPDATE reconciliation_state SET status = ?, message = ? WHERE record_id = 1', status, message);
      await db.runAsync('UPDATE reconciliation_checkpoint SET status = ?, message = ? WHERE record_id = 1', status, message);
      await db.execAsync('COMMIT');
    } catch (error) { await db.execAsync('ROLLBACK'); throw error; }
  }

  return {
    /** Resolves an opaque Atlas id only inside SQLite and returns owner-readable text. */
    async loadJourneyDetail(displayId: string): Promise<{ detail: JourneyDetail; previewSourceRefs: (string | null)[] }> {
      const db = await open();
      const lifecycle = await db.getFirstAsync<{ state: string }>('SELECT state FROM private_record_lifecycle WHERE record_id = 1');
      if (lifecycle?.state !== 'connected') throw new Error('Private record is not connected.');
      const selected = displayedJourneys.get(displayId);
      if (!selected) throw new Error('Journey is unavailable.');
      const visits = await db.getAllAsync<{ captured_day: string | null; has_precise_offset: number; ordering: 'chronological' | 'uncertain' }>(`WITH visit_summary AS (
        SELECT visit.visit_id, MIN(evidence.captured_day) AS captured_day, MAX(evidence.has_precise_offset) AS has_precise_offset, visit.ordering
        FROM reconstruction_link journey_visit
        JOIN reconstruction_visit visit ON visit.run_id = journey_visit.run_id AND visit.visit_id = journey_visit.child_id
        LEFT JOIN reconstruction_link support ON support.run_id = visit.run_id AND support.link_kind = 'visit-support' AND support.parent_id = visit.visit_id
        LEFT JOIN canonical_evidence evidence ON evidence.evidence_id = support.child_id
        WHERE journey_visit.run_id = ? AND journey_visit.link_kind = 'journey-visit' AND journey_visit.parent_id = ?
        GROUP BY visit.visit_id, visit.ordering
      ) SELECT captured_day, has_precise_offset, ordering FROM visit_summary
        ORDER BY captured_day IS NULL, captured_day, visit_id`, selected.runId, selected.journeyId);
      const memories = await db.getAllAsync<{ captured_day: string | null; availability: 'available' | 'unavailable' | 'unknown'; source_ref: string; association: string; disposition: string | null }>(`WITH journey_evidence AS (
          SELECT child_id AS evidence_id, link_kind AS association
          FROM reconstruction_link
          WHERE run_id = ?
            AND parent_id = ? AND link_kind LIKE 'membership:%'
          UNION
          SELECT support.child_id AS evidence_id, 'visit-support' AS association
          FROM reconstruction_link journey_visit
          JOIN reconstruction_link support ON support.run_id = journey_visit.run_id AND support.link_kind = 'visit-support' AND support.parent_id = journey_visit.child_id
          WHERE journey_visit.run_id = ?
            AND journey_visit.link_kind = 'journey-visit' AND journey_visit.parent_id = ?
        )
        SELECT evidence.captured_day, evidence.availability, evidence.source_ref, journey_evidence.association, disposition.disposition_state AS disposition
        FROM journey_evidence JOIN canonical_evidence evidence ON evidence.evidence_id = journey_evidence.evidence_id
        LEFT JOIN reconstruction_disposition disposition ON disposition.run_id = ? AND disposition.evidence_id = evidence.evidence_id
        GROUP BY evidence.evidence_id, journey_evidence.association
        ORDER BY evidence.captured_day IS NULL, evidence.captured_day, evidence.evidence_id LIMIT 4`, selected.runId, selected.journeyId, selected.runId, selected.journeyId, selected.runId);
      if (!visits.length && !memories.length) throw new Error('Journey is unavailable.');
      const days = visits.map((visit) => visit.captured_day).filter((day): day is string => !!day).sort();
      const span = !days.length ? 'Observed date unknown' : days[0] === days[days.length - 1] ? `Observed ${days[0]}` : `Observed ${days[0]} to ${days[days.length - 1]}`;
      const detailVisits = visits.map((visit) => ({ label: visit.captured_day ?? 'Date unknown', precision: visit.captured_day ? (visit.has_precise_offset ? 'Observed day and time' : 'Observed day') : 'Date precision unavailable', support: 'Source supports this visit; it does not prove owner presence.' }));
      const detailMemories = memories.map((memory, index) => ({ id: `memory-${index + 1}`, availability: memory.availability, association: memory.association.startsWith('membership:') ? `Associated with this journey as a memory (${memory.association.slice('membership:'.length).replaceAll(/[-:]/g, ' ')}); separate from destination support.` : memory.disposition ? `This source is ${memory.disposition}; it is reviewable without being visit support.` : 'Supports an observed visit; this is not proof of owner presence.' }));
      const uncertainty = [...new Set([...(visits.some((visit) => visit.ordering === 'uncertain') ? ['Visit ordering is uncertain.'] : []), ...(visits.some((visit) => !visit.captured_day || !visit.has_precise_offset) ? ['Date precision is limited for part of this journey.'] : []), ...memories.filter((memory) => memory.disposition === 'unresolved' || memory.disposition === 'unassigned').map((memory) => `A source remains ${memory.disposition} and is not treated as visit support.`), ...memories.filter((memory) => memory.association.startsWith('membership:') && memory.captured_day === null).map(() => 'A GPS-less or date-limited memory is associated with this journey without destination support.')])];
      return { detail: { id: displayId, title: 'Private journey', observedSpan: span, visits: detailVisits, memories: detailMemories, uncertainty }, previewSourceRefs: memories.map((memory) => memory.availability === 'available' ? memory.source_ref : null) };
    },
    /** Reads only coarse map anchors and journey state from the committed run.
     * Source/evidence IDs, dates, and raw coordinates stay inside this query. */
    async loadDurableReveal(): Promise<DurableRevealRecord> {
      const db = await open();
      const lifecycle = await db.getFirstAsync<{ state: string }>('SELECT state FROM private_record_lifecycle WHERE record_id = 1');
      if (lifecycle?.state !== 'connected') throw new Error('Private record is not connected.');
      const completed = await db.getFirstAsync<{ run_id: number }>('SELECT MAX(run_id) AS run_id FROM reconstruction_run WHERE status = \'complete\'');
      if (!completed?.run_id) return { journeys: [], statistics: null };
      const rows = await db.getAllAsync<{ journey_id: string; run_id: number; journey_state: 'inferred' | 'possible-merge'; latitude: number | null; longitude: number | null; display_ordinal: number; year: number | null; ordering: 'chronological' | 'uncertain'; first_year: number | null; last_year: number | null }>(`
        WITH journey_anchor AS (
          SELECT journey_link.parent_id AS journey_id, MIN(visit.visit_id) AS visit_id
          FROM reconstruction_link journey_link
          JOIN reconstruction_visit visit ON visit.run_id = journey_link.run_id AND visit.visit_id = journey_link.child_id
          WHERE journey_link.link_kind = 'journey-visit'
          GROUP BY journey_link.parent_id
        ), journey_metadata AS (
          SELECT journey.journey_id, journey.run_id, journey.journey_state, evidence.latitude, evidence.longitude,
            MIN(CASE WHEN canonical.captured_day GLOB '????-??-??' THEN CAST(SUBSTR(canonical.captured_day, 1, 4) AS INTEGER) END) AS first_year,
            MAX(CASE WHEN canonical.captured_day GLOB '????-??-??' THEN CAST(SUBSTR(canonical.captured_day, 1, 4) AS INTEGER) END) AS last_year,
            CASE WHEN SUM(CASE WHEN journey_visit_row.ordering = 'uncertain' THEN 1 ELSE 0 END) > 0 THEN 'uncertain' ELSE 'chronological' END AS ordering
          FROM reconstruction_journey journey
          LEFT JOIN journey_anchor anchor ON anchor.journey_id = journey.journey_id
          LEFT JOIN reconstruction_visit visit ON visit.run_id = journey.run_id AND visit.visit_id = anchor.visit_id
          LEFT JOIN reconstruction_place place ON place.run_id = journey.run_id AND place.place_id = visit.place_id
          LEFT JOIN canonical_evidence evidence ON evidence.evidence_id = place.representative_evidence_id
          LEFT JOIN reconstruction_link journey_visit ON journey_visit.run_id = journey.run_id AND journey_visit.link_kind = 'journey-visit' AND journey_visit.parent_id = journey.journey_id
          LEFT JOIN reconstruction_visit journey_visit_row ON journey_visit_row.run_id = journey_visit.run_id AND journey_visit_row.visit_id = journey_visit.child_id
          LEFT JOIN reconstruction_link visit_support ON visit_support.run_id = journey.run_id AND visit_support.link_kind = 'visit-support' AND visit_support.parent_id = journey_visit.child_id
          LEFT JOIN canonical_evidence canonical ON canonical.evidence_id = visit_support.child_id
          WHERE journey.run_id = ?
          GROUP BY journey.journey_id
        ), numbered_journeys AS (
          SELECT *,
            ROW_NUMBER() OVER (ORDER BY first_year IS NULL, first_year, journey_id) AS display_ordinal,
            COUNT(*) OVER (PARTITION BY first_year) AS first_year_count
          FROM journey_metadata
        ), journey_years AS (
          SELECT DISTINCT journey_visit.parent_id AS journey_id, CAST(SUBSTR(canonical.captured_day, 1, 4) AS INTEGER) AS year
          FROM numbered_journeys
          JOIN reconstruction_link journey_visit ON journey_visit.run_id = numbered_journeys.run_id AND journey_visit.parent_id = numbered_journeys.journey_id
          JOIN reconstruction_link visit_support ON visit_support.run_id = journey_visit.run_id AND visit_support.link_kind = 'visit-support' AND visit_support.parent_id = journey_visit.child_id
          JOIN canonical_evidence canonical ON canonical.evidence_id = visit_support.child_id
          WHERE journey_visit.link_kind = 'journey-visit' AND canonical.captured_day GLOB '????-??-??'
        )
        SELECT numbered_journeys.journey_id, numbered_journeys.run_id, numbered_journeys.journey_state, numbered_journeys.latitude, numbered_journeys.longitude,
          numbered_journeys.display_ordinal, journey_years.year,
          CASE WHEN numbered_journeys.first_year IS NULL OR numbered_journeys.first_year_count > 1 THEN 'uncertain' ELSE numbered_journeys.ordering END AS ordering,
          numbered_journeys.first_year, numbered_journeys.last_year
        FROM numbered_journeys LEFT JOIN journey_years ON journey_years.journey_id = numbered_journeys.journey_id
        ORDER BY numbered_journeys.display_ordinal, journey_years.year
      `, completed.run_id);
      const statistics = await db.getFirstAsync<{ journey_count: number; place_count: number; country_count: number }>(`
        SELECT
          (SELECT COUNT(*) FROM reconstruction_journey WHERE run_id = ?) AS journey_count,
          (SELECT COUNT(*) FROM reconstruction_place WHERE run_id = ?) AS place_count,
          (SELECT COUNT(DISTINCT country_code) FROM reconstruction_place WHERE run_id = ? AND country_code IS NOT NULL) AS country_count
      `, completed.run_id, completed.run_id, completed.run_id);
      const journeys = new Map<string, DurableRevealRecord['journeys'][number]>();
      displayedJourneys.clear();
      for (const row of rows) {
        const displayId = opaqueJourneyDisplayId(row.journey_id);
        displayedJourneys.set(displayId, { runId: row.run_id, journeyId: row.journey_id });
        const existing = journeys.get(displayId);
        if (existing) { if (row.year !== null) existing.years.push(row.year); continue; }
        const periodLabel = row.first_year === null ? 'Date unknown' : row.first_year === row.last_year ? String(row.first_year) : `${row.first_year}–${row.last_year}`;
        journeys.set(displayId, { displayId, state: row.journey_state, anchor: coarseMapAnchor(row.latitude, row.longitude), years: row.year === null ? [] : [row.year], periodLabel, ordering: row.ordering });
      }
      return { journeys: [...journeys.values()], statistics: statistics ? { journeyCount: statistics.journey_count, placeCount: statistics.place_count, supportedCountryCount: statistics.country_count, countryStatus: 'supported' } : null };
    },
    async rebuild(nowMillis = Date.now(), consumeQueuedChanges = false, canUseSource: () => Promise<boolean> = async () => true): Promise<ReconstructionGraph> {
      const db = await open();
      await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
      try {
        const lifecycle = await db.getFirstAsync<{ state: string }>('SELECT state FROM private_record_lifecycle WHERE record_id = 1');
        if (lifecycle?.state !== 'connected') throw new Error('Private record is not connected.');
        let queueSnapshot = 0;
        let snapshotRevision = 0;
        if (consumeQueuedChanges) {
          if (!await canUseSource()) throw new Error('Photo access is not permitted.');
          snapshotRevision = ((await db.getFirstAsync<{ snapshot_revision: number }>('SELECT snapshot_revision FROM reconciliation_checkpoint WHERE record_id = 1'))?.snapshot_revision ?? 0) + 1;
          await db.runAsync('INSERT INTO reconciliation_queue_snapshot (snapshot_revision, asset_id, change_kind, source_revision) SELECT ?, asset_id, change_kind, source_revision FROM maintenance_change_queue', snapshotRevision);
          queueSnapshot = (await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM reconciliation_queue_snapshot WHERE snapshot_revision = ?', snapshotRevision))?.count ?? 0;
          await db.runAsync('INSERT INTO reconciliation_checkpoint (record_id, snapshot_revision, status, started_at_millis, message) VALUES (?, ?, ?, ?, ?) ON CONFLICT(record_id) DO UPDATE SET snapshot_revision=excluded.snapshot_revision, status=excluded.status, started_at_millis=excluded.started_at_millis, message=excluded.message', 1, snapshotRevision, 'running', nowMillis, 'Reconciling local journey updates.');
          await db.runAsync("UPDATE reconciliation_state SET status = 'running', message = 'Reconciling local journey updates.' WHERE record_id = 1");
        }
        const previousJourneyIds = new Set((await db.getAllAsync<{ journey_id: string }>('SELECT journey_id FROM reconstruction_journey')).map((row) => row.journey_id));
        const rows = await db.getAllAsync<EvidenceRow>('SELECT evidence_id, captured_at_millis, captured_day, has_precise_offset, availability, latitude, longitude, reported_accuracy_meters FROM canonical_evidence');
        const excluded = new Set((await db.getAllAsync<{ target_id: string }>(`SELECT current.target_id FROM correction_overlays current
          JOIN (SELECT target_id, MAX(revision) AS revision FROM correction_overlays WHERE target_kind = 'evidence' AND correction_scope = 'inclusion' GROUP BY target_id) latest
          ON latest.target_id = current.target_id AND latest.revision = current.revision
          WHERE current.target_kind = 'evidence' AND current.correction_scope = 'inclusion' AND current.owner_action = 'remove'`)).map((row) => row.target_id));
        // History corrections and owner-entered/confirmed records are already
        // durable, but M2.1 has no projection mapper for their semantics yet.
        // Keep the prior complete graph and queue checkpoint pending rather
        // than silently rebuilding around an owner decision.
        if (consumeQueuedChanges) {
          const protectedHistory = await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) AS count FROM correction_overlays
            WHERE target_kind = 'history'`);
          if ((protectedHistory?.count ?? 0) > 0) throw new Error('History corrections need owner review before local reconciliation.');
        }
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
        for (const place of graph.places) {
          const representative = rows.find((row) => row.evidence_id === place.representativeId);
          const country = resolveCountry({ latitude: representative?.latitude ?? null, longitude: representative?.longitude ?? null });
          await db.runAsync('INSERT INTO reconstruction_place (place_id, run_id, representative_evidence_id, uncertainty_json, country_code, country_dataset_version) VALUES (?, ?, ?, ?, ?, ?)', place.id, runId, place.representativeId, JSON.stringify(place.uncertainty), country.status === 'resolved' ? country.code : null, country.status === 'resolved' ? NATURAL_EARTH_ADMIN_0_DATASET_VERSION : null);
          for (const evidenceId of place.memberIds) await db.runAsync('INSERT INTO reconstruction_link (run_id, link_kind, parent_id, child_id) VALUES (?, ?, ?, ?)', runId, 'place-support', place.id, evidenceId);
        }
        for (const visit of graph.visits) { await db.runAsync('INSERT INTO reconstruction_visit (visit_id, run_id, place_id, ordering) VALUES (?, ?, ?, ?)', visit.id, runId, visit.placeId, visit.order); for (const evidenceId of visit.evidenceIds) await db.runAsync('INSERT INTO reconstruction_link (run_id, link_kind, parent_id, child_id) VALUES (?, ?, ?, ?)', runId, 'visit-support', visit.id, evidenceId); }
        for (const journey of graph.journeys) { await db.runAsync('INSERT INTO reconstruction_journey (journey_id, run_id, journey_state) VALUES (?, ?, ?)', journey.id, runId, journey.state); for (const visitId of journey.visitIds) await db.runAsync('INSERT INTO reconstruction_link (run_id, link_kind, parent_id, child_id) VALUES (?, ?, ?, ?)', runId, 'journey-visit', journey.id, visitId); }
        for (const membership of graph.memberships) await db.runAsync('INSERT INTO reconstruction_link (run_id, link_kind, parent_id, child_id) VALUES (?, ?, ?, ?)', runId, `membership:${membership.state}:${membership.reason}`, membership.journeyId, membership.evidenceId);
        for (const merge of graph.possibleMerges) await db.runAsync('INSERT INTO reconstruction_link (run_id, link_kind, parent_id, child_id) VALUES (?, ?, ?, ?)', runId, `possible-merge:${merge.reason}`, merge.fromJourneyId, merge.toJourneyId);
        for (const disposition of graph.dispositions) await db.runAsync('INSERT INTO reconstruction_disposition (run_id, evidence_id, disposition_state, reasons_json) VALUES (?, ?, ?, ?)', runId, disposition.evidenceId, disposition.state, JSON.stringify(disposition.reasons));
        if (consumeQueuedChanges) {
          const derivedIds = new Set([...graph.places, ...graph.visits, ...graph.journeys].map((item) => item.id));
          const overlays = await db.getAllAsync<{ overlay_id: string; target_id: string; identity_lineage_id: string | null }>(`SELECT overlay.overlay_id, overlay.target_id, overlay.identity_lineage_id FROM correction_overlays overlay
            JOIN inferred_history history ON history.history_id = overlay.target_id
            WHERE overlay.target_kind = 'history' AND history.history_state = 'inferred'`);
          await db.runAsync('DELETE FROM reconciliation_unresolved_remap');
          for (const overlay of overlays) if (!derivedIds.has(overlay.target_id)) await db.runAsync(
            'INSERT INTO reconciliation_unresolved_remap (overlay_id, target_id, identity_lineage_id, reason) VALUES (?, ?, ?, ?)',
            overlay.overlay_id, overlay.target_id, overlay.identity_lineage_id, 'The inferred target changed and needs owner review.',
          );
          // Acknowledge only the immutable snapshot. A subsequent producer can
          // add a changed revision while this transaction is pending; it is not
          // covered by this deletion and remains durable for the next pass.
          await db.runAsync(`DELETE FROM maintenance_change_queue WHERE EXISTS (
            SELECT 1 FROM reconciliation_queue_snapshot snapshot
            WHERE snapshot.snapshot_revision = ? AND snapshot.asset_id = maintenance_change_queue.asset_id
              AND snapshot.change_kind = maintenance_change_queue.change_kind
              AND snapshot.source_revision = maintenance_change_queue.source_revision
          )`, snapshotRevision);
          await db.runAsync('DELETE FROM reconciliation_queue_snapshot WHERE snapshot_revision = ?', snapshotRevision);
          const lifecycleBeforeAck = await db.getFirstAsync<{ state: string }>('SELECT state FROM private_record_lifecycle WHERE record_id = 1');
          if (lifecycleBeforeAck?.state !== 'connected') throw new Error('Private record is not connected.');
          if (!await canUseSource()) throw new Error('Photo access is not permitted.');
          await db.runAsync('UPDATE reconciliation_checkpoint SET status = ?, message = ? WHERE record_id = 1', 'complete', 'Complete local checkpoint.',);
          const newJourneyCount = graph.journeys.filter((journey) => !previousJourneyIds.has(journey.id)).length;
          const updatedJourneyCount = graph.journeys.filter((journey) => previousJourneyIds.has(journey.id)).length;
          await db.runAsync(
            "UPDATE reconciliation_state SET status = 'complete', last_checked_at_millis = ?, last_updated_at_millis = ?, new_journey_count = ?, updated_journey_count = ?, message = ? WHERE record_id = 1",
            nowMillis, nowMillis, queueSnapshot ? newJourneyCount : 0, queueSnapshot ? updatedJourneyCount : 0,
            queueSnapshot ? 'Local inferred journey updates are ready for review. They remain private and unpublished.' : 'No local journey updates were waiting.',
          );
        }
        await db.execAsync('COMMIT');
        return graph;
      } catch (error) {
        await db.execAsync('ROLLBACK');
        throw error;
      }
    },
    async reconcileQueued(nowMillis = Date.now(), canUseSource: () => Promise<boolean> = async () => true) {
      const token = await acquireLease(nowMillis);
      if (token === null) throw new Error('Local reconciliation is already running; queued changes remain pending.');
      try {
        const queued = (await (await open()).getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM maintenance_change_queue'))?.count ?? 0;
        if (queued === 0) return { graph: { ruleVersion: RECONSTRUCTION_RULE_VERSION, places: [], visits: [], journeys: [], possibleMerges: [], dispositions: [], memberships: [] } as ReconstructionGraph, newJourneyCount: 0, updatedJourneyCount: 0 };
        const graph = await this.rebuild(nowMillis, true, canUseSource);
        const outcome = await (await open()).getFirstAsync<{ new_journey_count: number; updated_journey_count: number }>(
          'SELECT new_journey_count, updated_journey_count FROM reconciliation_state WHERE record_id = 1',
        );
        return { graph, newJourneyCount: outcome?.new_journey_count ?? 0, updatedJourneyCount: outcome?.updated_journey_count ?? 0 };
      } catch (error) {
        const restricted = error instanceof Error && (error.message.includes('not connected') || error.message.includes('not permitted'));
        const pending = error instanceof Error && error.message.includes('need owner review');
        await saveOutcome(restricted ? 'restricted' : pending ? 'pending' : 'error', restricted ? 'Local journey updates are waiting for connected private access.' : pending ? 'Owner history needs review before queued local changes can be reconciled.' : 'Local journey reconciliation did not finish. Queued changes remain pending.');
        throw error;
      } finally {
        await releaseLease(token);
      }
    },
  };
}
