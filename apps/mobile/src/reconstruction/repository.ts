import type { ReconstructionEvidence, ReconstructionGraph } from './types';
import { RECONSTRUCTION_RULE_VERSION } from './types';
import { reconstructV1, type JourneyGroupingConstraint } from './engine';
import { NATURAL_EARTH_ADMIN_0_DATASET_VERSION, resolveCountry } from './country-resolver';
import type { DurableRevealRecord, JourneyDetail, RevealMapAnchor } from '@/reveal/types';
import { serializeNativeTransactions } from '@/database/native-transaction';

type Database = {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, ...parameters: (string | number | null)[]): Promise<unknown>;
  getAllAsync<T>(source: string, ...parameters: (string | number | null)[]): Promise<T[]>;
  getFirstAsync<T>(source: string, ...parameters: (string | number | null)[]): Promise<T | null>;
};

type EvidenceRow = { evidence_id: string; captured_at_millis: number | null; captured_day: string | null; has_precise_offset: number; availability: ReconstructionEvidence['availability']; latitude: number | null; longitude: number | null; reported_accuracy_meters: number | null; platform_duplicate_family_id?: string | null; source_origin?: string | null; support_eligible?: number | null; duplicate_tuple_version?: number | null; duplicate_tuple_fingerprint?: string | null };
type JourneyCorrectionAction = 'confirm' | 'reject' | 'claim' | 'split' | 'merge' | 'remove-visit';
type JourneyCorrectionRevision = { revision_id: string; action: JourneyCorrectionAction; reviewed_support_json: string; reviewed_visits_json?: string; reviewed_family_snapshot_json?: string | null; structural_boundary_json?: string | null };
type MemoryCorrectionAction = 'assign' | 'move' | 'reject' | 'unassign';
type MemoryCorrectionRevision = { revision_id: string; action: MemoryCorrectionAction; source_evidence_id: string; reviewed_support_json: string; reviewed_family_snapshot_json?: string | null; created_at_millis: number };
type OwnerJourneyClaim = NonNullable<JourneyDetail['ownerClaim']>;
type StructuralSplit = { afterVisitId: string };
type StructuralMerge = { withJourneyId: string };
type VisitRemoval = { visitId: string };
const RECONCILIATION_LEASE_MILLIS = 5 * 60 * 1000;

class JourneyCorrectionRemapRequiredError extends Error {
  constructor(readonly revisionId: string) {
    super('Journey correction needs owner remap.');
  }
}

type FamilySnapshot = { memberIds: string[]; tupleVersion: number; tupleFingerprint: string };
type FamilyResolver = {
  keyForEvidence(evidenceId: string): string;
  resolveFamily(key: string, snapshots: Record<string, FamilySnapshot>): string | null;
  snapshotsFor(keys: string[]): Record<string, FamilySnapshot>;
  conflictForEvidence(evidenceId: string): boolean;
  supportEligible(evidenceId: string): boolean;
};

/** Builds the only accepted duplicate-family relationship from persisted
 * private metadata. Values are never inferred from media or owner-visible data. */
export function resolveVerifiedDuplicateFamilies(rows: EvidenceRow[]): FamilyResolver {
  const byId = new Map(rows.map((row) => [row.evidence_id, row]));
  const familyRows = new Map<string, EvidenceRow[]>();
  for (const row of rows) {
    const id = typeof row.platform_duplicate_family_id === 'string' ? row.platform_duplicate_family_id.trim() : '';
    if (id) familyRows.set(id, [...(familyRows.get(id) ?? []), row]);
  }
  const valid = new Map<string, FamilySnapshot & { representativeId: string }>();
  const conflicts = new Set<string>();
  for (const [id, members] of familyRows) {
    const fingerprints = new Set(members.map((member) => member.duplicate_tuple_fingerprint ?? ''));
    const versions = new Set(members.map((member) => member.duplicate_tuple_version ?? 0));
    if (fingerprints.size !== 1 || versions.size !== 1 || ![...fingerprints][0]) { for (const member of members) conflicts.add(member.evidence_id); continue; }
    const memberIds = members.map((member) => member.evidence_id).sort();
    valid.set(id, { memberIds, tupleVersion: [...versions][0], tupleFingerprint: [...fingerprints][0], representativeId: memberIds[0] });
  }
  return {
    keyForEvidence(evidenceId) {
      const row = byId.get(evidenceId);
      const familyId = typeof row?.platform_duplicate_family_id === 'string' ? row.platform_duplicate_family_id.trim() : '';
      return familyId && valid.has(familyId) ? `F:${familyId}` : `E:${evidenceId}`;
    },
    resolveFamily(key, snapshots) {
      const id = key.slice(2); const current = valid.get(id); const saved = snapshots[key];
      if (!current || !saved || current.tupleVersion !== saved.tupleVersion || current.tupleFingerprint !== saved.tupleFingerprint
        || saved.memberIds.some((memberId) => !current.memberIds.includes(memberId))) return null;
      return current.representativeId;
    },
    snapshotsFor(keys) {
      const snapshots: Record<string, FamilySnapshot> = {};
      for (const key of keys) {
        if (!key.startsWith('F:')) continue;
        const current = valid.get(key.slice(2));
        if (current) snapshots[key] = { memberIds: current.memberIds, tupleVersion: current.tupleVersion, tupleFingerprint: current.tupleFingerprint };
      }
      return snapshots;
    },
    conflictForEvidence: (evidenceId) => conflicts.has(evidenceId),
    supportEligible: (evidenceId) => byId.get(evidenceId)?.support_eligible !== 0,
  };
}

function correctionFamilySnapshots(value: string | null | undefined, revisionId: string): Record<string, FamilySnapshot> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    for (const [key, snapshot] of Object.entries(parsed)) {
      const candidate = snapshot as Partial<FamilySnapshot>;
      if (!key.startsWith('F:') || !Array.isArray(candidate.memberIds) || !candidate.memberIds.every((id) => typeof id === 'string')
        || candidate.memberIds.length === 0 || new Set(candidate.memberIds).size !== candidate.memberIds.length
        || !Number.isInteger(candidate.tupleVersion) || typeof candidate.tupleFingerprint !== 'string' || !candidate.tupleFingerprint) throw new Error();
    }
    return parsed as Record<string, FamilySnapshot>;
  } catch { throw new JourneyCorrectionRemapRequiredError(revisionId); }
}

function resolveReviewedSupportKey(key: string, revisionId: string, snapshots: Record<string, FamilySnapshot>, families?: FamilyResolver) {
  if (key.startsWith('E:')) {
    const evidenceId = key.slice(2);
    if (families && families.keyForEvidence(evidenceId) !== key) throw new JourneyCorrectionRemapRequiredError(revisionId);
    return evidenceId;
  }
  if (!key.startsWith('F:') || !families) throw new JourneyCorrectionRemapRequiredError(revisionId);
  const evidenceId = families.resolveFamily(key, snapshots);
  if (!evidenceId) throw new JourneyCorrectionRemapRequiredError(revisionId);
  return evidenceId;
}

/** A split can only use one complete reviewed visit as its left boundary.
 * This intentionally fails closed if a saved revision no longer describes the
 * current immutable review scope. */
export function structuralBoundaryEvidenceIds(corrections: JourneyCorrectionRevision[], families?: FamilyResolver) {
  const boundaryEvidenceIds = new Set<string>();
  for (const correction of corrections) {
    if (correction.action !== 'split') continue;
    let reviewedVisits: unknown;
    let boundary: unknown;
    try {
      reviewedVisits = JSON.parse(correction.reviewed_visits_json ?? '[]');
      boundary = JSON.parse(correction.structural_boundary_json ?? '[]');
    } catch { throw new JourneyCorrectionRemapRequiredError(correction.revision_id); }
    if (!Array.isArray(reviewedVisits) || !Array.isArray(boundary)
      || !boundary.length || !boundary.every((key): key is string => typeof key === 'string' && (key.startsWith('E:') || key.startsWith('F:')))
      || new Set(boundary).size !== boundary.length
      || !reviewedVisits.some((visit) => Array.isArray(visit) && visit.length === boundary.length
        && visit.every((key) => typeof key === 'string' && boundary.includes(key)))) {
      throw new JourneyCorrectionRemapRequiredError(correction.revision_id);
    }
    const snapshots = correctionFamilySnapshots(correction.reviewed_family_snapshot_json, correction.revision_id);
    for (const key of boundary) boundaryEvidenceIds.add(resolveReviewedSupportKey(key, correction.revision_id, snapshots, families));
  }
  return boundaryEvidenceIds;
}

export function applyStructuralBoundaries(evidence: ReconstructionEvidence[], corrections: JourneyCorrectionRevision[], families?: FamilyResolver) {
  const boundaryEvidenceIds = structuralBoundaryEvidenceIds(corrections, families);
  return evidence.map((item) => ({ ...item, ownerBoundaryAfter: boundaryEvidenceIds.has(item.id) }));
}

export function predecessorWideScopeRevisions(corrections: JourneyCorrectionRevision[]) {
  return corrections.filter((correction) => correction.action === 'confirm' || correction.action === 'claim').map((correction) => correction.revision_id);
}

/** Merge only the two saved, consecutive visit scopes. Generated journey IDs
 * are never durable input: both scopes must resolve exactly before the graph
 * can be changed. */
export function applyOwnerJourneyMerges(graph: ReconstructionGraph, corrections: JourneyCorrectionRevision[], families?: FamilyResolver) {
  let next = graph;
  for (const correction of corrections.filter((item) => item.action === 'merge')) {
    let relation: unknown;
    try { relation = JSON.parse(correction.structural_boundary_json ?? ''); } catch { throw new JourneyCorrectionRemapRequiredError(correction.revision_id); }
    if (!relation || typeof relation !== 'object' || !Array.isArray((relation as { left?: unknown }).left) || !Array.isArray((relation as { right?: unknown }).right)) throw new JourneyCorrectionRemapRequiredError(correction.revision_id);
    const resolveVisit = (keys: unknown[]) => {
      if (!keys.length || !keys.every((key): key is string => typeof key === 'string' && (key.startsWith('E:') || key.startsWith('F:'))) || new Set(keys).size !== keys.length) throw new JourneyCorrectionRemapRequiredError(correction.revision_id);
      const snapshots = correctionFamilySnapshots(correction.reviewed_family_snapshot_json, correction.revision_id);
      const ids = keys.map((key) => resolveReviewedSupportKey(key, correction.revision_id, snapshots, families));
      const candidates = next.visits.filter((visit) => ids.every((id) => visit.evidenceIds.includes(id)));
      if (candidates.length !== 1 || candidates[0].order !== 'ordered' || ids.some((id) => next.visits.some((visit) => visit.id !== candidates[0].id && visit.evidenceIds.includes(id)))) throw new JourneyCorrectionRemapRequiredError(correction.revision_id);
      return candidates[0];
    };
    const leftVisit = resolveVisit((relation as { left: unknown[] }).left);
    const rightVisit = resolveVisit((relation as { right: unknown[] }).right);
    if (leftVisit.id === rightVisit.id) throw new JourneyCorrectionRemapRequiredError(correction.revision_id);
    const leftIndex = next.journeys.findIndex((journey) => journey.visitIds.includes(leftVisit.id));
    const rightIndex = next.journeys.findIndex((journey) => journey.visitIds.includes(rightVisit.id));
    if (leftIndex < 0 || rightIndex !== leftIndex + 1) throw new JourneyCorrectionRemapRequiredError(correction.revision_id);
    const left = next.journeys[leftIndex]; const right = next.journeys[rightIndex];
    const journeys = next.journeys.map((journey, index) => index === leftIndex ? { ...left, visitIds: [...left.visitIds, ...right.visitIds] } : journey).filter((_, index) => index !== rightIndex);
    next = {
      ...next,
      journeys,
      memberships: next.memberships.map((membership) => membership.journeyId === right.id ? { ...membership, journeyId: left.id } : membership),
      possibleMerges: next.possibleMerges.filter((merge) => merge.fromJourneyId !== left.id && merge.fromJourneyId !== right.id && merge.toJourneyId !== left.id && merge.toJourneyId !== right.id),
    };
  }
  return next;
}

/** Apply only corrections whose complete canonical support set maps to exactly
 * one candidate journey. A changed or split support set fails closed before the
 * new graph can replace the owner's last complete projection. */
export function applyJourneyCorrections(graph: ReconstructionGraph, corrections: JourneyCorrectionRevision[], applyRejections = true, families?: FamilyResolver) {
  const visitById = new Map(graph.visits.map((visit) => [visit.id, visit]));
  const matches = new Map<string, string>();
  const reviewedVisitsByRevision = new Map<string, string[]>();
  for (const correction of corrections) {
    let parsed: unknown;
    try { parsed = JSON.parse(correction.reviewed_support_json); } catch { throw new JourneyCorrectionRemapRequiredError(correction.revision_id); }
    if (!Array.isArray(parsed) || !parsed.every((item): item is string => typeof item === 'string')) throw new JourneyCorrectionRemapRequiredError(correction.revision_id);
    const reviewed = parsed;
    if (!reviewed.length || new Set(reviewed).size !== reviewed.length
      || reviewed.some((key, index) => (!key.startsWith('E:') && !key.startsWith('F:')) || key.length <= 2 || (index > 0 && reviewed[index - 1].localeCompare(key) >= 0))) throw new JourneyCorrectionRemapRequiredError(correction.revision_id);
    const familySnapshots = correctionFamilySnapshots(correction.reviewed_family_snapshot_json, correction.revision_id);
    const evidenceForKey = (key: string) => resolveReviewedSupportKey(key, correction.revision_id, familySnapshots, families);
    let reviewedVisits: string[][];
    try { reviewedVisits = correction.reviewed_visits_json ? JSON.parse(correction.reviewed_visits_json) : [reviewed]; } catch { throw new JourneyCorrectionRemapRequiredError(correction.revision_id); }
    if (!Array.isArray(reviewedVisits)) throw new JourneyCorrectionRemapRequiredError(correction.revision_id);
    const reviewedVisitKeys = reviewedVisits.flat();
    if (!reviewedVisits.length
      || !reviewedVisits.every((group) => Array.isArray(group) && group.length
        && group.every((key) => typeof key === 'string' && reviewed.includes(key))
        && group.every((key, index) => index === 0 || group[index - 1].localeCompare(key) < 0))
      || reviewedVisitKeys.length !== reviewed.length
      || new Set(reviewedVisitKeys).size !== reviewed.length
      || reviewed.some((key) => !reviewedVisitKeys.includes(key))) throw new JourneyCorrectionRemapRequiredError(correction.revision_id);
    const supportByJourney = new Map(graph.journeys.map((journey) => [
      journey.id,
      new Set(journey.visitIds.flatMap((visitId) => visitById.get(visitId)?.evidenceIds ?? [])),
    ]));
    const uniqueSuccessors = new Set<string>();
    for (const key of reviewed) {
      const evidenceId = evidenceForKey(key);
      const successors = [...supportByJourney.entries()]
        .filter(([, support]) => support.has(evidenceId))
        .map(([journeyId]) => journeyId);
      if (successors.length !== 1) throw new JourneyCorrectionRemapRequiredError(correction.revision_id);
      uniqueSuccessors.add(successors[0]);
    }
    if (uniqueSuccessors.size !== 1) throw new JourneyCorrectionRemapRequiredError(correction.revision_id);
    const successorId = [...uniqueSuccessors][0];
    const candidate = graph.journeys.find((journey) => journey.id === successorId);
    if (!candidate) throw new JourneyCorrectionRemapRequiredError(correction.revision_id);
    const mappedVisits: string[] = [];
    for (const group of reviewedVisits) {
      const evidenceIds = group.map(evidenceForKey);
      const candidates = graph.visits.filter((visit) => evidenceIds.every((evidenceId) => visit.evidenceIds.includes(evidenceId)));
      if (candidates.length !== 1 || !candidate.visitIds.includes(candidates[0].id)) throw new JourneyCorrectionRemapRequiredError(correction.revision_id);
      // A reviewed support unit must occur in exactly one current visit.  A
      // duplicate within the same successor journey is still ambiguous; the
      // journey-level lookup above cannot detect that split on its own.
      if (evidenceIds.some((evidenceId) => graph.visits.some((visit) => visit.id !== candidates[0].id && visit.evidenceIds.includes(evidenceId)))) {
        throw new JourneyCorrectionRemapRequiredError(correction.revision_id);
      }
      mappedVisits.push(candidates[0].id);
    }
    if (new Set(mappedVisits).size !== mappedVisits.length) throw new JourneyCorrectionRemapRequiredError(correction.revision_id);
    matches.set(correction.revision_id, candidate.id);
    reviewedVisitsByRevision.set(correction.revision_id, mappedVisits);
  }
  if (!applyRejections) return { graph, matches };
  const removedVisits = new Set(corrections.filter((correction) => correction.action === 'reject' || correction.action === 'remove-visit').flatMap((correction) => reviewedVisitsByRevision.get(correction.revision_id) ?? []));
  const removedEvidence = new Set([...removedVisits].flatMap((visitId) => visitById.get(visitId)?.evidenceIds ?? []));
  // Rejection also supplies a pre-grouping negative constraint. Destination
  // removal only changes this journey projection; it retains source support.
  const journeys = graph.journeys.map((journey) => ({ ...journey, visitIds: journey.visitIds.filter((visitId) => !removedVisits.has(visitId)) })).filter((journey) => journey.visitIds.length > 0);
  const journeyIds = new Set(journeys.map((journey) => journey.id));
  return { graph: { ...graph, journeys, memberships: graph.memberships.filter((membership) => journeyIds.has(membership.journeyId) && !removedEvidence.has(membership.evidenceId)), possibleMerges: graph.possibleMerges.filter((merge) => journeyIds.has(merge.fromJourneyId) && journeyIds.has(merge.toJourneyId)) }, matches };
}

function rejectionGroupingConstraints(corrections: JourneyCorrectionRevision[], families?: FamilyResolver): JourneyGroupingConstraint[] {
  const constraints: JourneyGroupingConstraint[] = [];
  for (const correction of corrections) {
    if (correction.action !== 'reject') continue;
    const parsed = JSON.parse(correction.reviewed_visits_json ?? correction.reviewed_support_json) as string[][] | string[];
    const groups = (Array.isArray(parsed[0]) ? parsed : [parsed]) as string[][];
    const snapshots = correctionFamilySnapshots(correction.reviewed_family_snapshot_json, correction.revision_id);
    const support = groups.map((group) => group.map((key) => resolveReviewedSupportKey(key, correction.revision_id, snapshots, families)).sort());
    if (support.length === 1) constraints.push({ kind: 'forbid-automatic-journey-membership', support: support[0] });
    for (let left = 0; left < support.length; left += 1) for (let right = left + 1; right < support.length; right += 1) {
      constraints.push({ kind: 'cannot-co-member', leftSupport: support[left], rightSupport: support[right] });
    }
  }
  return constraints;
}

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

function isCalendarDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function validatedOwnerClaim(claim: OwnerJourneyClaim | undefined): OwnerJourneyClaim {
  if (!claim || !claim.title || claim.title !== claim.title.trim() || claim.title.length > 120) {
    throw new Error('Enter a private journey title before saving.');
  }
  if (claim.date.kind === 'exact') {
    if (!isCalendarDay(claim.date.day)) throw new Error('Enter an exact owner date as YYYY-MM-DD.');
    return claim;
  }
  if (!isCalendarDay(claim.date.startDay) || !isCalendarDay(claim.date.endDay) || claim.date.startDay > claim.date.endDay) {
    throw new Error('Enter an ordered approximate date interval as YYYY-MM-DD.');
  }
  return claim;
}

/** A graph rebuild is one local transaction, so readers see the prior complete run or the next one. */
export function createNativeReconstructionRepository() {
  let database: Promise<Database> | null = null;
  // Populated only by the redacted Atlas read. It keeps the raw journey id in
  // this local repository, so opening one selected card never scans all IDs.
  const displayedJourneys = new Map<string, { runId: number; journeyId: string }>();
  const displayedVisits = new Map<string, { visitId: string; capturedAtMillis: number | null; ordering: 'chronological' | 'uncertain' }>();
  const displayedMemories = new Map<string, { evidenceId: string; availability: 'available' | 'unavailable' | 'unknown' }>();
  const displayedPendingRemaps = new Map<string, { candidateId: string; revisionId: string; runId: number; kind: 'journey' | 'memory' }>();
  async function open() {
    if (!database) database = (async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const sqlite = require('expo-sqlite') as { openDatabaseAsync(name: string): Promise<Database> };
      const db = serializeNativeTransactions(await sqlite.openDatabaseAsync('travel-life-import-v1.db'));
      await db.execAsync('PRAGMA busy_timeout = 30000');
      return db;
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

  async function recordPendingCorrectionRemap(revisionId: string) {
    const db = await open();
    await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
    try {
      const lifecycle = await db.getFirstAsync<{ state: string }>('SELECT state FROM private_record_lifecycle WHERE record_id = 1');
      if (lifecycle?.state !== 'connected') throw new Error('Private record is not connected.');
      const revision = await db.getFirstAsync<{ source_run_id: number }>(
        "SELECT source_run_id FROM journey_correction_revision WHERE revision_id = ? AND state = 'effective'", revisionId,
      );
      if (!revision) {
        const memoryRevision = await db.getFirstAsync<{ source_run_id: number }>(
          "SELECT source_run_id FROM journey_memory_correction_revision WHERE revision_id = ? AND state = 'effective'", revisionId,
        );
        if (!memoryRevision) { await db.execAsync('COMMIT'); return; }
        const candidateId = `memory-candidate-${revisionId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        await db.runAsync(`INSERT INTO journey_memory_correction_candidate (candidate_id, revision_id, base_run_id, state, reason, created_at_millis)
          VALUES (?, ?, ?, 'pending_remap', ?, ?)`, candidateId, revisionId, memoryRevision.source_run_id, 'The selected memory or its reviewed target no longer maps uniquely to this rebuilt journey.', Date.now());
        await db.execAsync('COMMIT'); return;
      }
      const candidateId = `candidate-${revisionId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      await db.runAsync(
        `INSERT INTO journey_correction_candidate (candidate_id, revision_id, base_run_id, state, reason, created_at_millis)
         VALUES (?, ?, ?, 'pending_remap', ?, ?)`,
        candidateId, revisionId, revision.source_run_id, 'Reviewed support did not map uniquely to a successor.', Date.now(),
      );
      await db.execAsync('COMMIT');
    } catch (error) { await db.execAsync('ROLLBACK'); throw error; }
  }

  return {
    /** Resolves an opaque Atlas id only inside SQLite and returns owner-readable text. */
    async loadJourneyDetail(displayId: string): Promise<{ detail: JourneyDetail; previewSourceRefs: (string | null)[]; snapshotToken: number }> {
      const db = await open();
      const lifecycle = await db.getFirstAsync<{ state: string }>('SELECT state FROM private_record_lifecycle WHERE record_id = 1');
      if (lifecycle?.state !== 'connected') throw new Error('Private record is not connected.');
      const selected = displayedJourneys.get(displayId);
      if (!selected) throw new Error('Journey is unavailable.');
      const visits = await db.getAllAsync<{ visit_id: string; captured_day: string | null; captured_at_millis: number | null; has_precise_offset: number; ordering: 'chronological' | 'uncertain' }>(`WITH visit_summary AS (
        SELECT visit.visit_id, MIN(evidence.captured_day) AS captured_day, MIN(evidence.captured_at_millis) AS captured_at_millis, MIN(evidence.has_precise_offset) AS has_precise_offset, visit.ordering
        FROM reconstruction_link journey_visit
        JOIN reconstruction_visit visit ON visit.run_id = journey_visit.run_id AND visit.visit_id = journey_visit.child_id
        LEFT JOIN reconstruction_link support ON support.run_id = visit.run_id AND support.link_kind = 'visit-support' AND support.parent_id = visit.visit_id
        LEFT JOIN canonical_evidence evidence ON evidence.evidence_id = support.child_id
        WHERE journey_visit.run_id = ? AND journey_visit.link_kind = 'journey-visit' AND journey_visit.parent_id = ?
        GROUP BY visit.visit_id, visit.ordering
      ) SELECT visit_id, captured_day, captured_at_millis, has_precise_offset, ordering FROM visit_summary
        ORDER BY captured_day IS NULL, captured_day, visit_id`, selected.runId, selected.journeyId);
      const memories = await db.getAllAsync<{ evidence_id: string; captured_day: string | null; availability: 'available' | 'unavailable' | 'unknown'; source_ref: string; association: string; disposition: string | null }>(`WITH journey_evidence AS (
          SELECT child_id AS evidence_id, link_kind AS association
          FROM reconstruction_link
          WHERE run_id = ?
            AND parent_id = ? AND link_kind LIKE 'membership:%'
          UNION ALL
          SELECT support.child_id AS evidence_id, 'visit-support' AS association
          FROM reconstruction_link journey_visit
          JOIN reconstruction_link support ON support.run_id = journey_visit.run_id AND support.link_kind = 'visit-support' AND support.parent_id = journey_visit.child_id
          WHERE journey_visit.run_id = ?
            AND journey_visit.link_kind = 'journey-visit' AND journey_visit.parent_id = ?
        )
        SELECT evidence.evidence_id, evidence.captured_day, evidence.availability, evidence.source_ref, GROUP_CONCAT(journey_evidence.association) AS association, disposition.disposition_state AS disposition
        FROM journey_evidence JOIN canonical_evidence evidence ON evidence.evidence_id = journey_evidence.evidence_id
        LEFT JOIN reconstruction_disposition disposition ON disposition.run_id = ? AND disposition.evidence_id = evidence.evidence_id
        GROUP BY evidence.evidence_id
        ORDER BY evidence.captured_day IS NULL, evidence.captured_day, evidence.evidence_id LIMIT 4`, selected.runId, selected.journeyId, selected.runId, selected.journeyId, selected.runId);
      if (!visits.length && !memories.length) throw new Error('Journey is unavailable.');
      const days = visits.map((visit) => visit.captured_day).filter((day): day is string => !!day).sort();
      const mergeRows = (await db.getAllAsync<{ journey_id: string; captured_day: string | null }>(`SELECT journey.journey_id, MIN(evidence.captured_day) AS captured_day
        FROM reconstruction_journey journey JOIN reconstruction_link journey_visit ON journey_visit.run_id = journey.run_id AND journey_visit.link_kind = 'journey-visit' AND journey_visit.parent_id = journey.journey_id
        JOIN reconstruction_link visit_support ON visit_support.run_id = journey_visit.run_id AND visit_support.link_kind = 'visit-support' AND visit_support.parent_id = journey_visit.child_id
        JOIN canonical_evidence evidence ON evidence.evidence_id = visit_support.child_id
        WHERE journey.run_id = ? AND journey.journey_id <> ? GROUP BY journey.journey_id ORDER BY captured_day IS NULL, captured_day, journey.journey_id LIMIT 2`, selected.runId, selected.journeyId)) ?? [];
      const mergeCandidates = mergeRows.map((row, index) => {
        const id = opaqueJourneyDisplayId(row.journey_id);
        displayedJourneys.set(id, { runId: selected.runId, journeyId: row.journey_id });
        return { id, label: row.captured_day ? `Journey near ${row.captured_day}` : `Journey candidate ${index + 1}` };
      });
      const correction = await db.getFirstAsync<{ action: 'confirm' | 'reject'; application_state: 'effective' | 'pending_remap' }>(
        `SELECT revision.action, application.application_state
         FROM journey_correction_application application
         JOIN journey_correction_revision revision ON revision.revision_id = application.revision_id
          WHERE application.run_id = ? AND application.target_kind = 'journey' AND application.journey_id = ? AND revision.action IN ('confirm', 'reject') AND revision.state <> 'superseded'
         ORDER BY revision.created_at_millis DESC LIMIT 1`, selected.runId, selected.journeyId,
      );
      const pendingScopeReview = await db.getFirstAsync<{ scope_review_id: string }>(
        `SELECT scope_review_id FROM journey_correction_scope_review
         WHERE run_id = ? AND journey_id = ? AND state = 'pending_scope_review' LIMIT 1`, selected.runId, selected.journeyId,
      );
      const ownerClaimRow = await db.getFirstAsync<{ owner_title: string; owner_date_kind: 'exact' | 'approximate'; owner_date_start: string; owner_date_end: string | null }>(
        `SELECT revision.owner_title, revision.owner_date_kind, revision.owner_date_start, revision.owner_date_end
         FROM journey_correction_application application
         JOIN journey_correction_revision revision ON revision.revision_id = application.revision_id
         WHERE application.run_id = ? AND application.target_kind = 'journey' AND application.journey_id = ?
           AND revision.action = 'claim' AND revision.state = 'effective'
         ORDER BY revision.created_at_millis DESC LIMIT 1`, selected.runId, selected.journeyId,
      );
      const ownerClaim = ownerClaimRow?.owner_date_kind === 'exact' && ownerClaimRow.owner_date_start
        ? { title: ownerClaimRow.owner_title, date: { kind: 'exact' as const, day: ownerClaimRow.owner_date_start } }
        : ownerClaimRow?.owner_date_kind === 'approximate' && ownerClaimRow.owner_date_start && ownerClaimRow.owner_date_end
          ? { title: ownerClaimRow.owner_title, date: { kind: 'approximate' as const, startDay: ownerClaimRow.owner_date_start, endDay: ownerClaimRow.owner_date_end } }
          : undefined;
      const currentSupportRows = (await db.getAllAsync<{ evidence_id: string }>(`SELECT DISTINCT support.child_id AS evidence_id
        FROM reconstruction_link journey JOIN reconstruction_link support
          ON support.run_id = journey.run_id AND support.link_kind = 'visit-support' AND support.parent_id = journey.child_id
        WHERE journey.run_id = ? AND journey.link_kind = 'journey-visit' AND journey.parent_id = ?`, selected.runId, selected.journeyId)) ?? [];
      const familyRows = await db.getAllAsync<EvidenceRow>('SELECT evidence_id, captured_at_millis, captured_day, has_precise_offset, availability, latitude, longitude, reported_accuracy_meters, platform_duplicate_family_id, source_origin, support_eligible, duplicate_tuple_version, duplicate_tuple_fingerprint FROM canonical_evidence');
      const detailFamilies = resolveVerifiedDuplicateFamilies(familyRows ?? []);
      const currentSupport = new Set(currentSupportRows.map((row) => detailFamilies.keyForEvidence(row.evidence_id)));
      const pendingCandidates = (await db.getAllAsync<{ candidate_id: string; revision_id: string; reason: string; reviewed_support_json: string; reviewed_family_snapshot_json: string | null }>(
        `SELECT candidate.candidate_id, candidate.revision_id, candidate.reason, revision.reviewed_support_json, revision.reviewed_family_snapshot_json
         FROM journey_correction_candidate candidate
         JOIN journey_correction_revision revision ON revision.revision_id = candidate.revision_id
         WHERE candidate.state = 'pending_remap'
         ORDER BY candidate.created_at_millis DESC`,
      )) ?? [];
      const pendingRemap = pendingCandidates.find((candidate) => {
        try {
          const reviewed = JSON.parse(candidate.reviewed_support_json) as unknown;
          if (!Array.isArray(reviewed)) return false;
          const snapshots = correctionFamilySnapshots(candidate.reviewed_family_snapshot_json, candidate.revision_id);
          return reviewed.some((key) => typeof key === 'string' && currentSupport.has(key)
            && Boolean(resolveReviewedSupportKey(key, candidate.revision_id, snapshots, detailFamilies)));
        } catch { return false; }
      });
      const pendingMemoryCandidates = (await db.getAllAsync<{ candidate_id: string; revision_id: string; reason: string; source_evidence_id: string }>(`SELECT candidate.candidate_id, candidate.revision_id, candidate.reason, revision.source_evidence_id
        FROM journey_memory_correction_candidate candidate JOIN journey_memory_correction_revision revision ON revision.revision_id = candidate.revision_id
        WHERE candidate.state = 'pending_remap' ORDER BY candidate.created_at_millis DESC`)) ?? [];
      const pendingMemoryRemap = pendingMemoryCandidates.find((candidate) => memories.some((memory) => memory.evidence_id === candidate.source_evidence_id));
      if (pendingRemap) displayedPendingRemaps.set(displayId, { candidateId: pendingRemap.candidate_id, revisionId: pendingRemap.revision_id, runId: selected.runId, kind: 'journey' });
      else if (pendingMemoryRemap) displayedPendingRemaps.set(displayId, { candidateId: pendingMemoryRemap.candidate_id, revisionId: pendingMemoryRemap.revision_id, runId: selected.runId, kind: 'memory' });
      else displayedPendingRemaps.delete(displayId);
      const span = !days.length ? 'Observed date unknown' : days[0] === days[days.length - 1] ? `Observed ${days[0]}` : `Observed ${days[0]} to ${days[days.length - 1]}`;
      const detailVisits = visits.map((visit, index) => {
        const id = `visit-${index + 1}`;
        displayedVisits.set(`${displayId}:${id}`, { visitId: visit.visit_id, capturedAtMillis: visit.captured_at_millis, ordering: visit.ordering });
        return { id, label: visit.captured_day ?? 'Date unknown', precision: visit.captured_day ? (visit.has_precise_offset ? 'Observed day and time' : 'Observed day') : 'Date precision unavailable', support: 'Source supports this visit; it does not prove owner presence.' };
      });
      const detailMemories = memories.map((memory, index) => {
        const id = `memory-${index + 1}`;
        displayedMemories.set(`${displayId}:${id}`, { evidenceId: memory.evidence_id, availability: memory.availability });
        const primary = memory.association.includes('membership:owner:owner-primary');
        const hasVisitSupport = memory.association.includes('visit-support');
        const hasMembership = memory.association.includes('membership:');
        return { id, availability: memory.availability, membershipState: primary ? 'primary' as const : hasMembership ? 'suggested' as const : 'unassigned' as const, association: [hasVisitSupport ? 'Supports an observed visit; it does not prove owner presence.' : null, hasMembership ? `Associated with this journey as a memory (${memory.association.split(',').find((item) => item.startsWith('membership:'))?.slice('membership:'.length).replaceAll(/[-:]/g, ' ')}); separate from destination support.` : !hasVisitSupport ? 'Unassigned memory; it has no visit or place support.' : null, memory.disposition ? `This source is ${memory.disposition}; it is reviewable without being visit support.` : null].filter(Boolean).join(' ') };
      });
      const uncertainty = [...new Set([...(visits.some((visit) => visit.ordering === 'uncertain') ? ['Visit ordering is uncertain.'] : []), ...(visits.some((visit) => !visit.captured_day || !visit.has_precise_offset) ? ['Date precision is limited for part of this journey.'] : []), ...memories.filter((memory) => memory.disposition === 'unresolved' || memory.disposition === 'unassigned').map((memory) => `A source remains ${memory.disposition} and is not treated as visit support.`), ...memories.filter((memory) => memory.association.startsWith('membership:') && memory.captured_day === null).map(() => 'A GPS-less or date-limited memory is associated with this journey without destination support.')])];
      return { detail: { id: displayId, title: ownerClaim?.title ?? 'Private journey', observedSpan: span, visits: detailVisits, mergeCandidates, memories: detailMemories, uncertainty, ownerClaim, pendingRemap: pendingRemap ? { reason: pendingRemap.reason } : pendingMemoryRemap ? { reason: pendingMemoryRemap.reason } : undefined, correctionState: pendingScopeReview ? 'pending scope review' : pendingRemap || pendingMemoryRemap || correction?.application_state === 'pending_remap' ? 'pending remap' : correction?.action === 'confirm' ? 'confirmed' : correction?.action === 'reject' ? 'rejected' : 'inferred' },
        // Unknown is not unavailable. Resolve this bounded, selected set under
        // current permission so Android imports made before URI probing can
        // become visible; the adapter still fails closed if access is gone.
        previewSourceRefs: memories.map((memory) => memory.availability === 'unavailable' ? null : memory.source_ref), snapshotToken: selected.runId };
    },
    /** Reads one stable, local-only associated-media page after an explicit gallery action. */
    async loadJourneyMediaPage(displayId: string, expectedSnapshotToken: number, page: number) {
      const pageSize = 12;
      if (!Number.isInteger(page) || page < 0) throw new Error('Gallery page is unavailable.');
      const db = await open();
      const selected = displayedJourneys.get(displayId);
      const lifecycle = await db.getFirstAsync<{ state: string }>('SELECT state FROM private_record_lifecycle WHERE record_id = 1');
      const completed = await db.getFirstAsync<{ run_id: number }>("SELECT MAX(run_id) AS run_id FROM reconstruction_run WHERE status = 'complete'");
      if (!selected || selected.runId !== expectedSnapshotToken || lifecycle?.state !== 'connected' || completed?.run_id !== expectedSnapshotToken) throw new Error('Gallery changed. Return to the journey and try again.');
      const rows = (await db.getAllAsync<{ evidence_id: string; availability: 'available' | 'unavailable' | 'unknown'; source_ref: string; media_type: string; association: string }>(`WITH journey_evidence AS (
          SELECT child_id AS evidence_id, link_kind AS association FROM reconstruction_link
          WHERE run_id = ? AND parent_id = ? AND link_kind LIKE 'membership:%'
          UNION ALL
          SELECT support.child_id AS evidence_id, 'visit-support' AS association
          FROM reconstruction_link journey_visit JOIN reconstruction_link support
            ON support.run_id = journey_visit.run_id AND support.link_kind = 'visit-support' AND support.parent_id = journey_visit.child_id
          WHERE journey_visit.run_id = ? AND journey_visit.link_kind = 'journey-visit' AND journey_visit.parent_id = ?
        ) SELECT evidence.evidence_id, evidence.availability, evidence.source_ref, evidence.media_type,
          GROUP_CONCAT(journey_evidence.association) AS association
        FROM journey_evidence JOIN canonical_evidence evidence ON evidence.evidence_id = journey_evidence.evidence_id
        GROUP BY evidence.evidence_id
        ORDER BY evidence.captured_day IS NULL, evidence.captured_day, evidence.evidence_id
        LIMIT ? OFFSET ?`, selected.runId, selected.journeyId, selected.runId, selected.journeyId, pageSize + 1, page * pageSize)) ?? [];
      const visible = rows.slice(0, pageSize);
      return {
        items: visible.map((row, index) => ({ id: `media-${page * pageSize + index + 1}`, availability: row.availability, association: row.association, kind: row.media_type === 'video' ? 'video' as const : 'photo' as const })),
        previewSourceRefs: visible.map((row) => row.availability === 'unavailable' ? null : row.source_ref),
        hasMore: rows.length > pageSize,
      };
    },
    /** Returns only a small local page of photos that have no visit support. */
    async loadUncertainMemories(displayId: string, expectedSnapshotToken: number, query = '', page = 0) {
      const db = await open();
      const selected = displayedJourneys.get(displayId);
      if (!selected || selected.runId !== expectedSnapshotToken || !Number.isInteger(page) || page < 0 || query.length > 10 || !/^[0-9-]*$/.test(query)) throw new Error('Uncertain memory review is unavailable. Reload the journey before continuing.');
      const lifecycle = await db.getFirstAsync<{ state: string }>('SELECT state FROM private_record_lifecycle WHERE record_id = 1');
      const completed = await db.getFirstAsync<{ run_id: number }>("SELECT MAX(run_id) AS run_id FROM reconstruction_run WHERE status = 'complete'");
      if (lifecycle?.state !== 'connected' || completed?.run_id !== expectedSnapshotToken) throw new Error('Review is stale. Reload the journey before continuing.');
      const rows = (await db.getAllAsync<{ evidence_id: string; captured_day: string | null; availability: 'available' | 'unavailable' | 'unknown'; has_location: number; suggestion_count: number; selected_primary: number }>(`WITH memberships AS (
          SELECT child_id AS evidence_id, parent_id AS journey_id, link_kind
          FROM reconstruction_link WHERE run_id = ? AND link_kind LIKE 'membership:%'
        ) SELECT evidence.evidence_id, evidence.captured_day, evidence.availability,
          CASE WHEN evidence.latitude IS NULL OR evidence.longitude IS NULL THEN 0 ELSE 1 END AS has_location,
          COUNT(DISTINCT memberships.journey_id) AS suggestion_count,
          MAX(CASE WHEN memberships.journey_id = ? AND memberships.link_kind = 'membership:owner:owner-primary' THEN 1 ELSE 0 END) AS selected_primary
        FROM canonical_evidence evidence LEFT JOIN memberships ON memberships.evidence_id = evidence.evidence_id
        WHERE evidence.captured_day LIKE ?
          AND NOT EXISTS (SELECT 1 FROM reconstruction_link support WHERE support.run_id = ? AND support.link_kind = 'visit-support' AND support.child_id = evidence.evidence_id)
        GROUP BY evidence.evidence_id
        ORDER BY evidence.captured_day IS NULL, evidence.captured_day, evidence.evidence_id
        LIMIT 13 OFFSET ?`, selected.runId, selected.journeyId, `${query}%`, selected.runId, page * 12)) ?? [];
      const memories = rows.slice(0, 12).map((row, index) => {
        const id = `uncertain-memory-${page * 12 + index + 1}`;
        displayedMemories.set(`${displayId}:${id}`, { evidenceId: row.evidence_id, availability: row.availability });
        return {
          id, capturedDay: row.captured_day, availability: row.availability,
          locationState: row.has_location ? 'Location metadata available' : 'Location metadata unavailable',
          association: row.suggestion_count ? `Suggested by ${row.suggestion_count} ${row.suggestion_count === 1 ? 'journey' : 'journeys'}; separate from destination support.` : 'No journey suggestion; separate from destination support.',
          membershipState: row.selected_primary ? 'primary' as const : row.suggestion_count ? 'suggested' as const : 'unassigned' as const,
        };
      });
      return { memories, hasMore: rows.length > 12 };
    },
    /** An owner may abandon a withheld correction, but remaps are never accepted implicitly. */
    async discardJourneyCorrectionPending(displayId: string, expectedSnapshotToken: number, commandKey: string, nowMillis = Date.now()) {
      const db = await open();
      const selected = displayedJourneys.get(displayId);
      const pending = displayedPendingRemaps.get(displayId);
      if (!selected || !pending || pending.runId !== expectedSnapshotToken || selected.runId !== expectedSnapshotToken) throw new Error('Pending correction is unavailable. Reload the journey before saving.');
      if (!commandKey || commandKey.length > 200) throw new Error('A correction command key is required.');
      await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
      try {
        const lifecycle = await db.getFirstAsync<{ state: string }>('SELECT state FROM private_record_lifecycle WHERE record_id = 1');
        const completed = await db.getFirstAsync<{ run_id: number }>("SELECT MAX(run_id) AS run_id FROM reconstruction_run WHERE status = 'complete'");
        if (lifecycle?.state !== 'connected' || completed?.run_id !== expectedSnapshotToken) throw new Error('Review is stale. Reload the journey before saving.');
        const candidate = await db.getFirstAsync<{ revision_id: string }>(pending.kind === 'journey'
          ? "SELECT revision_id FROM journey_correction_candidate WHERE candidate_id = ? AND revision_id = ? AND state = 'pending_remap'"
          : "SELECT revision_id FROM journey_memory_correction_candidate WHERE candidate_id = ? AND revision_id = ? AND state = 'pending_remap'", pending.candidateId, pending.revisionId);
        if (!candidate) {
          await db.execAsync('COMMIT');
          return { graph: null };
        }
        await db.runAsync(pending.kind === 'journey' ? "UPDATE journey_correction_candidate SET state = 'superseded' WHERE candidate_id = ?" : "UPDATE journey_memory_correction_candidate SET state = 'superseded' WHERE candidate_id = ?", pending.candidateId);
        await db.runAsync(pending.kind === 'journey' ? "UPDATE journey_correction_revision SET state = 'superseded' WHERE revision_id = ? AND state = 'effective'" : "UPDATE journey_memory_correction_revision SET state = 'superseded' WHERE revision_id = ? AND state = 'effective'", pending.revisionId);
        const graph = await this.rebuild(nowMillis, false, async () => true, true);
        const beforeCommit = await db.getFirstAsync<{ state: string }>('SELECT state FROM private_record_lifecycle WHERE record_id = 1');
        if (beforeCommit?.state !== 'connected') throw new Error('Private record is unavailable.');
        await db.execAsync('COMMIT');
        displayedPendingRemaps.delete(displayId);
        return { graph };
      } catch (error) { await db.execAsync('ROLLBACK'); throw error; }
    },
    /** Persist a review snapshot against canonical evidence only. A family key
     * is emitted only after its complete persisted tuple has been verified. */
    async saveJourneyCorrection(displayId: string, action: JourneyCorrectionAction, expectedSnapshotToken: number, reviewedSnapshot: JourneyDetail, commandKey: string, payloadOrNowMillis?: OwnerJourneyClaim | StructuralSplit | StructuralMerge | VisitRemoval | number, suppliedNowMillis = Date.now()) {
      const db = await open();
      const selected = displayedJourneys.get(displayId);
      if (!selected) throw new Error('Journey is unavailable.');
      const structuralPredecessorJourneyIds = [selected.journeyId];
      const nowMillis = typeof payloadOrNowMillis === 'number' ? payloadOrNowMillis : suppliedNowMillis;
      const claim = action === 'claim' && typeof payloadOrNowMillis === 'object' ? payloadOrNowMillis as OwnerJourneyClaim : undefined;
      const split = action === 'split' && typeof payloadOrNowMillis === 'object' ? payloadOrNowMillis as StructuralSplit : undefined;
      const merge = action === 'merge' && typeof payloadOrNowMillis === 'object' ? payloadOrNowMillis as StructuralMerge : undefined;
      const removal = action === 'remove-visit' && typeof payloadOrNowMillis === 'object' ? payloadOrNowMillis as VisitRemoval : undefined;
      await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
      try {
        if (!commandKey || commandKey.length > 200) throw new Error('A correction command key is required.');
        const committed = await db.getFirstAsync<{ revision_id: string; action: JourneyCorrectionAction }>('SELECT revision_id, action FROM journey_correction_revision WHERE command_key = ?', commandKey);
        if (committed) {
          await db.execAsync('COMMIT');
          // A lost response retry must not create a second reconstruction run.
          // The first command already committed its graph with this revision.
          return { revisionId: committed.revision_id, state: committed.action === 'confirm' ? 'confirmed' as const : committed.action === 'reject' ? 'rejected' as const : committed.action === 'remove-visit' ? 'visit-removed' as const : committed.action === 'split' ? 'split' as const : 'claimed' as const, graph: null };
        }
        const lifecycle = await db.getFirstAsync<{ state: string }>('SELECT state FROM private_record_lifecycle WHERE record_id = 1');
        const completed = await db.getFirstAsync<{ run_id: number }>("SELECT MAX(run_id) AS run_id FROM reconstruction_run WHERE status = 'complete'");
        if (lifecycle?.state !== 'connected' || selected.runId !== expectedSnapshotToken || completed?.run_id !== expectedSnapshotToken || reviewedSnapshot.id !== displayId) throw new Error('Review is stale. Reload the journey before saving.');
        const ownerClaim = action === 'claim' ? validatedOwnerClaim(claim) : undefined;
        const splitBoundary = action === 'split' ? displayedVisits.get(`${displayId}:${split?.afterVisitId ?? ''}`) : undefined;
        const removedVisit = action === 'remove-visit' ? displayedVisits.get(`${displayId}:${removal?.visitId ?? ''}`) : undefined;
        if (action === 'remove-visit' && !removedVisit) throw new Error('Choose an observed destination from this private journey.');
        if (action === 'split') {
          const selectedIndex = reviewedSnapshot.visits.findIndex((visit) => visit.id === split?.afterVisitId);
          const next = selectedIndex >= 0 ? displayedVisits.get(`${displayId}:${reviewedSnapshot.visits[selectedIndex + 1]?.id ?? ''}`) : undefined;
          if (!splitBoundary || !next || splitBoundary.ordering !== 'chronological' || next.ordering !== 'chronological' || splitBoundary.capturedAtMillis === null || next.capturedAtMillis === null || splitBoundary.capturedAtMillis >= next.capturedAtMillis) {
            throw new Error('Choose a boundary between strictly ordered observed visits.');
          }
        }
        const support = await db.getAllAsync<{ evidence_id: string; visit_id: string }>(`SELECT DISTINCT support.child_id AS evidence_id, journey.child_id AS visit_id
          FROM reconstruction_link journey JOIN reconstruction_link support
            ON support.run_id = journey.run_id AND support.link_kind = 'visit-support' AND support.parent_id = journey.child_id
          WHERE journey.run_id = ? AND journey.link_kind = 'journey-visit' AND journey.parent_id = ? ORDER BY support.child_id`, selected.runId, selected.journeyId);
        if (!support.length) throw new Error('This journey has no stable evidence support to review.');
        const canonicalRows = await db.getAllAsync<EvidenceRow>('SELECT evidence_id, captured_at_millis, captured_day, has_precise_offset, availability, latitude, longitude, reported_accuracy_meters, platform_duplicate_family_id, source_origin, support_eligible, duplicate_tuple_version, duplicate_tuple_fingerprint FROM canonical_evidence');
        const families = resolveVerifiedDuplicateFamilies(canonicalRows ?? []);
        const reviewedRows = removedVisit ? support.filter((row) => row.visit_id === removedVisit.visitId) : support;
        if (!reviewedRows.length) throw new Error('Choose a destination with stable observed support.');
        const reviewedSupport = [...new Set(reviewedRows.map((row) => families.keyForEvidence(row.evidence_id)))].sort();
        const reviewedSupportJson = JSON.stringify(reviewedSupport);
        const reviewedVisitsJson = JSON.stringify([...new Map(reviewedRows.map((row) => [row.visit_id, [] as string[]])).entries()].map(([visitId]) => [...new Set(reviewedRows.filter((row) => row.visit_id === visitId).map((row) => families.keyForEvidence(row.evidence_id)))].sort()));
        const reviewedFamilySnapshotsJson = JSON.stringify(families.snapshotsFor(reviewedSupport));
        let structuralBoundaryJson = splitBoundary ? JSON.stringify([...new Set(support.filter((row) => row.visit_id === splitBoundary.visitId).map((row) => families.keyForEvidence(row.evidence_id)))].sort()) : null;
        if (action === 'split' && structuralBoundaryJson === '[]') throw new Error('Choose a boundary with stable observed support.');
        if (action === 'merge') {
          const peer = displayedJourneys.get(merge?.withJourneyId ?? '');
          if (!peer || peer.runId !== selected.runId || peer.journeyId === selected.journeyId) throw new Error('Choose an adjacent journey from this private Atlas view.');
          structuralPredecessorJourneyIds.push(peer.journeyId);
          const peerSupport = await db.getAllAsync<{ evidence_id: string; visit_id: string }>(`SELECT DISTINCT support.child_id AS evidence_id, journey.child_id AS visit_id
            FROM reconstruction_link journey JOIN reconstruction_link support
              ON support.run_id = journey.run_id AND support.link_kind = 'visit-support' AND support.parent_id = journey.child_id
            WHERE journey.run_id = ? AND journey.link_kind = 'journey-visit' AND journey.parent_id = ? ORDER BY support.child_id`, peer.runId, peer.journeyId);
          const selectedVisits = [...new Map(support.map((row) => [row.visit_id, support.filter((item) => item.visit_id === row.visit_id).map((item) => `E:${item.evidence_id}`).sort()])).values()];
          const peerVisits = [...new Map(peerSupport.map((row) => [row.visit_id, peerSupport.filter((item) => item.visit_id === row.visit_id).map((item) => `E:${item.evidence_id}`).sort()])).values()];
          const ordered = await db.getAllAsync<{ journey_id: string; start_at_millis: number | null; ordering: 'chronological' | 'uncertain' }>(`SELECT journey.journey_id, MIN(evidence.captured_at_millis) AS start_at_millis,
              CASE WHEN SUM(CASE WHEN visit.ordering = 'uncertain' THEN 1 ELSE 0 END) > 0 THEN 'uncertain' ELSE 'chronological' END AS ordering
            FROM reconstruction_journey journey JOIN reconstruction_link journey_visit ON journey_visit.run_id = journey.run_id AND journey_visit.link_kind = 'journey-visit' AND journey_visit.parent_id = journey.journey_id
            JOIN reconstruction_visit visit ON visit.run_id = journey_visit.run_id AND visit.visit_id = journey_visit.child_id
            JOIN reconstruction_link visit_support ON visit_support.run_id = visit.run_id AND visit_support.link_kind = 'visit-support' AND visit_support.parent_id = visit.visit_id
            JOIN canonical_evidence evidence ON evidence.evidence_id = visit_support.child_id WHERE journey.run_id = ?
            GROUP BY journey.journey_id ORDER BY start_at_millis, journey.journey_id`, selected.runId);
          const selectedIndex = ordered.findIndex((row) => row.journey_id === selected.journeyId);
          const peerIndex = ordered.findIndex((row) => row.journey_id === peer.journeyId);
          if (selectedVisits.length !== 1 || peerVisits.length !== 1 || selectedIndex < 0 || peerIndex < 0 || Math.abs(selectedIndex - peerIndex) !== 1 || ordered[selectedIndex].ordering !== 'chronological' || ordered[peerIndex].ordering !== 'chronological') throw new Error('Merge requires two adjacent strictly ordered single-visit journeys.');
          structuralBoundaryJson = JSON.stringify(selectedIndex < peerIndex ? { left: selectedVisits[0], right: peerVisits[0] } : { left: peerVisits[0], right: selectedVisits[0] });
        }
        const reviewedSnapshotJson = JSON.stringify({
          title: reviewedSnapshot.title,
          observedSpan: reviewedSnapshot.observedSpan,
          visits: reviewedSnapshot.visits.map(({ label, precision, support: visitSupport }) => ({ label, precision, support: visitSupport })),
          memories: reviewedSnapshot.memories.map(({ availability, association }) => ({ availability, association })),
          uncertainty: reviewedSnapshot.uncertainty,
        });
        const matchingRevisions = await db.getAllAsync<{ revision_id: string; created_at_millis: number }>(
          `SELECT DISTINCT revision.revision_id, revision.created_at_millis
           FROM journey_correction_revision revision
           LEFT JOIN journey_correction_application application ON application.revision_id = revision.revision_id
           WHERE revision.state <> 'superseded' AND revision.action = ?
             AND ((application.run_id = ? AND application.target_kind = 'journey' AND application.journey_id = ?) OR revision.reviewed_support_json = ?)
           ORDER BY revision.created_at_millis DESC`, action, selected.runId, selected.journeyId, reviewedSupportJson,
        );
        const prior = matchingRevisions[0];
        for (const revision of matchingRevisions) {
          await db.runAsync("UPDATE journey_correction_revision SET state = 'superseded' WHERE revision_id = ?", revision.revision_id);
          await db.runAsync("UPDATE journey_correction_candidate SET state = 'superseded' WHERE revision_id = ? AND state = 'pending_remap'", revision.revision_id);
        }
        const predecessorWide = action === 'split' || action === 'merge'
          ? await db.getAllAsync<JourneyCorrectionRevision>(`SELECT revision_id, action, reviewed_support_json, reviewed_visits_json
              FROM journey_correction_revision WHERE state = 'effective' AND action IN ('confirm', 'claim')
                AND journey_id IN (${structuralPredecessorJourneyIds.map(() => '?').join(', ')})`, ...structuralPredecessorJourneyIds)
          : [];
        const predecessorWideIds = predecessorWideScopeRevisions(predecessorWide);
        for (const predecessorRevisionId of predecessorWideIds) await db.runAsync("UPDATE journey_correction_revision SET state = 'superseded' WHERE revision_id = ?", predecessorRevisionId);
        if (action === 'confirm' || action === 'claim') {
          await db.runAsync("UPDATE journey_correction_scope_review SET state = 'resolved' WHERE run_id = ? AND journey_id = ? AND state = 'pending_scope_review'", selected.runId, selected.journeyId);
        }
        const revisionId = `journey-review-${nowMillis}-${Math.random().toString(36).slice(2)}`;
        await db.runAsync(`INSERT INTO journey_correction_revision (revision_id, action, source_run_id, journey_id, reviewed_support_json, state, created_at_millis, replaces_revision_id, reviewed_snapshot_json, reviewed_visits_json, reviewed_family_snapshot_json, command_key, owner_title, owner_date_kind, owner_date_start, owner_date_end, structural_boundary_json) VALUES (?, ?, ?, ?, ?, 'effective', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, revisionId, action, selected.runId, selected.journeyId, reviewedSupportJson, nowMillis, prior?.revision_id ?? null, reviewedSnapshotJson, reviewedVisitsJson, reviewedFamilySnapshotsJson, commandKey, ownerClaim?.title ?? null, ownerClaim?.date.kind ?? null, ownerClaim?.date.kind === 'exact' ? ownerClaim.date.day : ownerClaim?.date.startDay ?? null, ownerClaim?.date.kind === 'approximate' ? ownerClaim.date.endDay : null, structuralBoundaryJson);
        const graph = await this.rebuild(nowMillis, false, async () => true, true);
        if (predecessorWideIds.length) {
          const runId = (await db.getFirstAsync<{ run_id: number }>('SELECT MAX(run_id) AS run_id FROM reconstruction_run WHERE status = \'complete\''))?.run_id;
          if (!runId) throw new Error('Could not record structural scope review.');
          const reviewedEvidenceIds = new Set(reviewedSupport.map((key) => key.slice(2)));
          const successorJourneyIds = graph.journeys
            .filter((journey) => journey.visitIds.some((visitId) => graph.visits.find((visit) => visit.id === visitId)?.evidenceIds.some((evidenceId) => reviewedEvidenceIds.has(evidenceId))))
            .map((journey) => journey.id);
          if (!successorJourneyIds.length) throw new Error('Could not identify structural successors for scope review.');
          for (const predecessorRevisionId of predecessorWideIds) for (const successorJourneyId of successorJourneyIds) {
            await db.runAsync(`INSERT INTO journey_correction_scope_review (scope_review_id, structural_revision_id, predecessor_revision_id, run_id, journey_id, state, created_at_millis)
              VALUES (?, ?, ?, ?, ?, 'pending_scope_review', ?)`, `scope-${revisionId}-${predecessorRevisionId}-${successorJourneyId}`, revisionId, predecessorRevisionId, runId, successorJourneyId, nowMillis);
          }
        }
        const lifecycleBeforeCommit = await db.getFirstAsync<{ state: string }>('SELECT state FROM private_record_lifecycle WHERE record_id = 1');
        if (lifecycleBeforeCommit?.state !== 'connected') throw new Error('Private record is unavailable.');
        await db.execAsync('COMMIT');
        return { revisionId, state: action === 'confirm' ? 'confirmed' as const : action === 'reject' ? 'rejected' as const : action === 'remove-visit' ? 'visit-removed' as const : action === 'split' ? 'split' as const : 'claimed' as const, graph };
      } catch (error) { await db.execAsync('ROLLBACK'); throw error; }
    },
    async saveJourneyMemoryCorrection(displayId: string, memoryId: string, action: MemoryCorrectionAction, expectedSnapshotToken: number, commandKey: string, nowMillis = Date.now()) {
      const db = await open();
      const selected = displayedJourneys.get(displayId);
      const memory = displayedMemories.get(`${displayId}:${memoryId}`);
      if (!selected || !memory) throw new Error('Selected memory is unavailable.');
      if (!commandKey || commandKey.length > 200) throw new Error('A correction command key is required.');
      if ((action === 'assign' || action === 'move') && memory.availability !== 'available') throw new Error('Reconnect to identify this memory before assigning it.');
      await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
      try {
        const committed = await db.getFirstAsync<{ revision_id: string }>('SELECT revision_id FROM journey_memory_correction_revision WHERE command_key = ?', commandKey);
        if (committed) { await db.execAsync('COMMIT'); return { revisionId: committed.revision_id, graph: null }; }
        const lifecycle = await db.getFirstAsync<{ state: string }>('SELECT state FROM private_record_lifecycle WHERE record_id = 1');
        const completed = await db.getFirstAsync<{ run_id: number }>("SELECT MAX(run_id) AS run_id FROM reconstruction_run WHERE status = 'complete'");
        if (lifecycle?.state !== 'connected' || selected.runId !== expectedSnapshotToken || completed?.run_id !== expectedSnapshotToken) throw new Error('Review is stale. Reload the journey before saving.');
        const support = await db.getAllAsync<{ evidence_id: string }>(`SELECT DISTINCT support.child_id AS evidence_id FROM reconstruction_link journey JOIN reconstruction_link support ON support.run_id = journey.run_id AND support.link_kind = 'visit-support' AND support.parent_id = journey.child_id WHERE journey.run_id = ? AND journey.link_kind = 'journey-visit' AND journey.parent_id = ? ORDER BY support.child_id`, selected.runId, selected.journeyId);
        if (!support.length) throw new Error('This journey has no stable support for a memory correction.');
        const canonicalRows = await db.getAllAsync<EvidenceRow>('SELECT evidence_id, captured_at_millis, captured_day, has_precise_offset, availability, latitude, longitude, reported_accuracy_meters, platform_duplicate_family_id, source_origin, support_eligible, duplicate_tuple_version, duplicate_tuple_fingerprint FROM canonical_evidence');
        const families = resolveVerifiedDuplicateFamilies(canonicalRows ?? []);
        const reviewedSupport = [...new Set(support.map((row) => families.keyForEvidence(row.evidence_id)))].sort();
        const revisionId = `journey-memory-${nowMillis}-${Math.random().toString(36).slice(2)}`;
        await db.runAsync(`INSERT INTO journey_memory_correction_revision (revision_id, action, source_run_id, source_evidence_id, journey_id, reviewed_support_json, reviewed_family_snapshot_json, state, created_at_millis, replaces_revision_id, command_key) VALUES (?, ?, ?, ?, ?, ?, ?, 'effective', ?, NULL, ?)`, revisionId, action, selected.runId, memory.evidenceId, selected.journeyId, JSON.stringify(reviewedSupport), JSON.stringify(families.snapshotsFor(reviewedSupport)), nowMillis, commandKey);
        const graph = await this.rebuild(nowMillis, false, async () => true, true);
        const beforeCommit = await db.getFirstAsync<{ state: string }>('SELECT state FROM private_record_lifecycle WHERE record_id = 1');
        if (beforeCommit?.state !== 'connected') throw new Error('Private record is unavailable.');
        await db.execAsync('COMMIT');
        return { revisionId, graph };
      } catch (error) { await db.execAsync('ROLLBACK'); throw error; }
    },
    async markJourneyCorrectionPending(revisionId: string) { await recordPendingCorrectionRemap(revisionId); },
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
            ROW_NUMBER() OVER (ORDER BY first_year IS NULL, first_year DESC, journey_id DESC) AS display_ordinal,
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
      const statistics = await db.getFirstAsync<{ journey_count: number; place_count: number; country_count: number; resolved_count: number }>(`
        SELECT
          (SELECT COUNT(*) FROM reconstruction_journey WHERE run_id = ?) AS journey_count,
          (SELECT COUNT(*) FROM reconstruction_place WHERE run_id = ?) AS place_count,
          (SELECT COUNT(DISTINCT country_code) FROM reconstruction_place WHERE run_id = ? AND country_code IS NOT NULL AND country_dataset_version = ?) AS country_count,
          (SELECT COUNT(*) FROM reconstruction_place WHERE run_id = ? AND country_dataset_version = ?) AS resolved_count
      `, completed.run_id, completed.run_id, completed.run_id, NATURAL_EARTH_ADMIN_0_DATASET_VERSION, completed.run_id, NATURAL_EARTH_ADMIN_0_DATASET_VERSION);
      const diagnostics = await db.getFirstAsync<{
        assessed: number; supported: number; places: number; visits: number;
        missing_day: number; invalid_day: number; unavailable: number;
        duplicate_conflict: number; insufficient_location: number; excluded: number;
      }>(`
        SELECT
          COUNT(*) AS assessed,
          COALESCE(SUM(CASE WHEN disposition_state = 'supported' THEN 1 ELSE 0 END), 0) AS supported,
          (SELECT COUNT(*) FROM reconstruction_place WHERE run_id = ?) AS places,
          (SELECT COUNT(*) FROM reconstruction_visit WHERE run_id = ?) AS visits,
          COALESCE(SUM(CASE WHEN reasons_json = '["missing-capture-date"]' THEN 1 ELSE 0 END), 0) AS missing_day,
          COALESCE(SUM(CASE WHEN reasons_json = '["invalid-capture-day"]' THEN 1 ELSE 0 END), 0) AS invalid_day,
          COALESCE(SUM(CASE WHEN reasons_json = '["source-unavailable"]' THEN 1 ELSE 0 END), 0) AS unavailable,
          COALESCE(SUM(CASE WHEN reasons_json = '["duplicate-family-conflict"]' THEN 1 ELSE 0 END), 0) AS duplicate_conflict,
          COALESCE(SUM(CASE WHEN reasons_json = '["insufficient-location-support"]' THEN 1 ELSE 0 END), 0) AS insufficient_location,
          COALESCE(SUM(CASE WHEN reasons_json = '["owner-excluded"]' THEN 1 ELSE 0 END), 0) AS excluded
        FROM reconstruction_disposition WHERE run_id = ?
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
      return { journeys: [...journeys.values()], statistics: statistics ? { journeyCount: statistics.journey_count, placeCount: statistics.place_count, supportedCountryCount: statistics.country_count, countryStatus: statistics.resolved_count === statistics.place_count ? 'supported' : 'unavailable' } : null,
        diagnostics: diagnostics ? { assessed: diagnostics.assessed, supported: diagnostics.supported, places: diagnostics.places, visits: diagnostics.visits, missingDay: diagnostics.missing_day, invalidDay: diagnostics.invalid_day, unavailable: diagnostics.unavailable, duplicateConflict: diagnostics.duplicate_conflict, insufficientLocation: diagnostics.insufficient_location, excluded: diagnostics.excluded } : null };
    },
    async rebuild(nowMillis = Date.now(), consumeQueuedChanges = false, canUseSource: () => Promise<boolean> = async () => true, transactionAlreadyOpen = false): Promise<ReconstructionGraph> {
      const db = await open();
      if (!transactionAlreadyOpen) await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
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
        const rows = await db.getAllAsync<EvidenceRow>('SELECT evidence_id, captured_at_millis, captured_day, has_precise_offset, availability, latitude, longitude, reported_accuracy_meters, platform_duplicate_family_id, source_origin, support_eligible, duplicate_tuple_version, duplicate_tuple_fingerprint FROM canonical_evidence');
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
        const families = resolveVerifiedDuplicateFamilies(rows);
        const evidence = rows.map((row) => ({
          id: row.evidence_id, capturedAtMillis: row.captured_at_millis,
          capturedDay: row.captured_day,
          hasPreciseOffset: row.has_precise_offset === 1, latitude: row.latitude, longitude: row.longitude, reportedAccuracyMeters: row.reported_accuracy_meters,
          availability: row.availability, duplicateFamilyId: families.keyForEvidence(row.evidence_id).startsWith('F:') ? families.keyForEvidence(row.evidence_id).slice(2) : (row.platform_duplicate_family_id ?? null), duplicateConflict: families.conflictForEvidence(row.evidence_id), supportEligible: families.supportEligible(row.evidence_id), excluded: excluded.has(row.evidence_id),
        }));
        const corrections = await db.getAllAsync<JourneyCorrectionRevision>(`SELECT revision_id, action, reviewed_support_json, reviewed_visits_json, reviewed_family_snapshot_json, structural_boundary_json
          FROM journey_correction_revision WHERE state = 'effective'`);
        const memoryCorrections = await db.getAllAsync<MemoryCorrectionRevision>(`SELECT revision_id, action, source_evidence_id, reviewed_support_json, reviewed_family_snapshot_json, created_at_millis
          FROM journey_memory_correction_revision WHERE state = 'effective' ORDER BY created_at_millis, revision_id`);
        // Resolve correction lineage against the unconstrained graph first.
        // A split or ambiguous reviewed support set aborts this transaction
        // before a newly generated graph can bypass the owner decision.
        const evidenceWithStructuralBoundaries = applyStructuralBoundaries(evidence, corrections, families);
        const nonStructuralCorrections = corrections.filter((correction) => correction.action !== 'split' && correction.action !== 'merge');
        const baseline = applyJourneyCorrections(reconstructV1(evidenceWithStructuralBoundaries), nonStructuralCorrections, false, families);
        const confirmed = applyJourneyCorrections(
          reconstructV1(evidenceWithStructuralBoundaries, { journeyGroupingConstraints: rejectionGroupingConstraints(nonStructuralCorrections, families) }),
          nonStructuralCorrections.filter((correction) => correction.action === 'confirm' || correction.action === 'remove-visit'),
          false,
          families,
        );
        // A memory decision has two independent identities: the particular
        // canonical photo and the complete reviewed support of its target.
        // Reuse the exact support mapper for the target; the photo itself is
        // checked below against the current canonical snapshot.  No inferred
        // visit/place/country support is changed by this overlay.
        const memoryMatches = applyJourneyCorrections(confirmed.graph, memoryCorrections.map((correction) => ({
          revision_id: correction.revision_id,
          action: 'claim' as const,
          reviewed_support_json: correction.reviewed_support_json,
          reviewed_family_snapshot_json: correction.reviewed_family_snapshot_json,
        })), false, families).matches;
        for (const correction of memoryCorrections) {
          if (!rows.some((row) => row.evidence_id === correction.source_evidence_id)) {
            throw new JourneyCorrectionRemapRequiredError(correction.revision_id);
          }
          if (!memoryMatches.has(correction.revision_id)) throw new JourneyCorrectionRemapRequiredError(correction.revision_id);
        }
        for (const correction of memoryCorrections) await db.runAsync(
          "UPDATE journey_memory_correction_candidate SET state = 'resolved' WHERE revision_id = ? AND state = 'pending_remap'", correction.revision_id,
        );
        const ownerPrimary = new Map<string, string>();
        const rejectedTargets = new Set<string>();
        for (const correction of memoryCorrections) {
          const target = memoryMatches.get(correction.revision_id)!;
          const sourceUnit = families.keyForEvidence(correction.source_evidence_id);
          const sourceEvidenceId = sourceUnit.startsWith('F:')
            ? families.resolveFamily(sourceUnit, families.snapshotsFor([sourceUnit]))
            : correction.source_evidence_id;
          if (!sourceEvidenceId) throw new JourneyCorrectionRemapRequiredError(correction.revision_id);
          const key = `${sourceUnit}:${target}`;
          if (correction.action === 'assign' || correction.action === 'move') {
            // Setting one key replaces any earlier accepted primary for this
            // evidence. This atomic transfer is what prevents two primaries.
            ownerPrimary.set(sourceUnit, target);
            rejectedTargets.delete(key);
          } else if (correction.action === 'reject') {
            rejectedTargets.add(key);
            if (ownerPrimary.get(sourceUnit) === target) ownerPrimary.delete(sourceUnit);
          } else if (ownerPrimary.get(sourceUnit) === target) {
            ownerPrimary.delete(sourceUnit);
          }
        }
        const structurallyMerged = applyOwnerJourneyMerges(confirmed.graph, corrections, families);
        const graph = {
          ...structurallyMerged,
          memberships: [
            ...structurallyMerged.memberships.filter((membership) => {
              const supportUnit = families.keyForEvidence(membership.evidenceId);
              return !ownerPrimary.has(supportUnit) && !rejectedTargets.has(`${supportUnit}:${membership.journeyId}`);
            }),
            ...[...ownerPrimary.entries()].map(([supportUnit, journeyId]) => ({ evidenceId: resolveReviewedSupportKey(supportUnit, 'memory-primary', families.snapshotsFor([supportUnit]), families), journeyId, state: 'owner' as const, reason: 'owner-primary' as const })),
          ],
        };
        const matches = new Map([...baseline.matches, ...confirmed.matches]);
        const evidenceRevision = (await db.getFirstAsync<{ canonical_evidence_revision: number | null }>('SELECT canonical_evidence_revision FROM private_history_record WHERE record_id = 1'))?.canonical_evidence_revision ?? 0;
        const correctionRevision = (await db.getFirstAsync<{ revision: number | null }>('SELECT MAX(revision) AS revision FROM correction_overlays'))?.revision ?? 0;
        const revision = Math.max(evidenceRevision, correctionRevision);
        await db.runAsync('INSERT INTO reconstruction_run (rule_version, evidence_revision, status, completed_at_millis) VALUES (?, ?, ?, ?)', RECONSTRUCTION_RULE_VERSION, revision, 'complete', nowMillis);
        const runId = (await db.getFirstAsync<{ run_id: number }>('SELECT MAX(run_id) AS run_id FROM reconstruction_run'))?.run_id;
        if (runId === undefined) throw new Error('Could not create reconstruction run.');
        for (const correction of corrections) {
          const targetKind = correction.action === 'reject' || correction.action === 'split' || correction.action === 'merge' ? 'grouping-constraint' : 'journey';
          const journeyId = targetKind === 'journey' ? matches.get(correction.revision_id) : null;
          if (targetKind === 'journey' && !journeyId) throw new JourneyCorrectionRemapRequiredError(correction.revision_id);
          await db.runAsync(
            `INSERT INTO journey_correction_application (revision_id, run_id, target_kind, journey_id, application_state) VALUES (?, ?, ?, ?, 'effective')`,
            correction.revision_id, runId, targetKind, journeyId ?? null,
          );
        }
        for (const correction of memoryCorrections) {
          await db.runAsync(
            `INSERT INTO journey_memory_correction_application (revision_id, run_id, journey_id, application_state) VALUES (?, ?, ?, 'effective')`,
            correction.revision_id, runId, memoryMatches.get(correction.revision_id) ?? null,
          );
        }
        for (const correction of corrections) await db.runAsync(
          "UPDATE journey_correction_candidate SET state = 'resolved' WHERE revision_id = ? AND state = 'pending_remap'",
          correction.revision_id,
        );
        await db.runAsync('DELETE FROM reconstruction_disposition'); await db.runAsync('DELETE FROM reconstruction_link'); await db.runAsync('DELETE FROM reconstruction_journey'); await db.runAsync('DELETE FROM reconstruction_visit'); await db.runAsync('DELETE FROM reconstruction_place');
        for (const place of graph.places) {
          const representative = rows.find((row) => row.evidence_id === place.representativeId);
          const country = resolveCountry({ latitude: representative?.latitude ?? null, longitude: representative?.longitude ?? null });
          await db.runAsync('INSERT INTO reconstruction_place (place_id, run_id, representative_evidence_id, uncertainty_json, country_code, country_dataset_version) VALUES (?, ?, ?, ?, ?, ?)', place.id, runId, place.representativeId, JSON.stringify(place.uncertainty), country.status === 'resolved' ? country.code : null, NATURAL_EARTH_ADMIN_0_DATASET_VERSION);
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
        if (!transactionAlreadyOpen) await db.execAsync('COMMIT');
        return graph;
      } catch (error) {
        if (!transactionAlreadyOpen) await db.execAsync('ROLLBACK');
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
        const pending = error instanceof Error && (error.message.includes('need owner review') || error.message.includes('needs owner remap'));
        if (error instanceof JourneyCorrectionRemapRequiredError) await recordPendingCorrectionRemap(error.revisionId);
        await saveOutcome(restricted ? 'restricted' : pending ? 'pending' : 'error', restricted ? 'Local journey updates are waiting for connected private access.' : pending ? 'An owner correction needs review before queued local changes can be reconciled.' : 'Local journey reconciliation did not finish. Queued changes remain pending.');
        throw error;
      } finally {
        await releaseLease(token);
      }
    },
  };
}
