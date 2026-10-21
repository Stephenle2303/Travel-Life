import type { OwnerConfiguredHomeArea, ReconstructionEvidence, ReconstructionGraph, TripDetectorEvidence } from './types';
import { RECONSTRUCTION_RULE_VERSION } from './types';
import { reconstructV1, type JourneyGroupingConstraint } from './engine';
import { applyOwnerConfiguredHomeAreas, buildV11Episodes, qualifyTripV11 } from './engine-v1-1';
import { NATURAL_EARTH_ADMIN_0_DATASET_VERSION, countryDisplayName, resolveCountry } from './country-resolver';
import { destinationLabel, type DestinationSupport } from './destination-label';
import type { DurableRevealRecord, JourneyDetail, RevealMapAnchor } from '@/reveal/types';
import type { ManualJourneyInput } from '@/import-record/types';
import { ensureNativeImportSchema } from '@/import-record/repository';
import { serializeNativeTransactions } from '@/database/native-transaction';

type Database = {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, ...parameters: (string | number | null)[]): Promise<unknown>;
  getAllAsync<T>(source: string, ...parameters: (string | number | null)[]): Promise<T[]>;
  getFirstAsync<T>(source: string, ...parameters: (string | number | null)[]): Promise<T | null>;
};

type EvidenceRow = { evidence_id: string; media_type?: 'image' | 'video'; captured_at_millis: number | null; captured_day: string | null; has_precise_offset: number; availability: ReconstructionEvidence['availability']; latitude: number | null; longitude: number | null; reported_accuracy_meters: number | null; platform_duplicate_family_id?: string | null; source_origin?: string | null; support_eligible?: number | null; duplicate_tuple_version?: number | null; duplicate_tuple_fingerprint?: string | null };
export type JourneyCorrectionAction = 'confirm' | 'reject' | 'claim' | 'place' | 'split' | 'merge' | 'remove-visit';
type JourneyCorrectionRevision = { revision_id: string; action: JourneyCorrectionAction; source_run_id?: number; reviewed_support_json: string; reviewed_visits_json?: string; reviewed_family_snapshot_json?: string | null; structural_boundary_json?: string | null };
type MemoryCorrectionAction = 'assign' | 'move' | 'reject' | 'unassign';
type MemoryCorrectionRevision = { revision_id: string; action: MemoryCorrectionAction; source_evidence_id: string; reviewed_support_json: string; reviewed_family_snapshot_json?: string | null; created_at_millis: number };
type OwnerJourneyClaim = NonNullable<JourneyDetail['ownerClaim']>;
type OwnerJourneyPlace = NonNullable<JourneyDetail['ownerPlace']>;
type StructuralSplit = { afterVisitId: string };
type StructuralMerge = { withJourneyId: string };
type VisitRemoval = { visitId: string };
const RECONCILIATION_LEASE_MILLIS = 5 * 60 * 1000;
export type ReconciliationStage = 'LEASE_OPEN' | 'MAINTENANCE_LEASE_READ' | 'LEASE_WRITE' | 'QUEUE_READ' | 'REBUILD' | 'OUTCOME_READ' | 'OUTCOME_SAVE' | 'LEASE_RELEASE';

export type DurableRevealStage =
  | 'DURABLE_OPEN' | 'DURABLE_SCHEMA' | 'DURABLE_LIFECYCLE_READ' | 'DURABLE_RUN_READ'
  | 'DURABLE_MANUAL_READ' | 'DURABLE_JOURNEY_READ' | 'DURABLE_COUNTRY_READ'
  | 'DURABLE_OWNER_PLACE_READ' | 'DURABLE_STATISTICS_READ' | 'DURABLE_DIAGNOSTICS_READ'
  | 'DURABLE_DESTINATION_READ' | 'DURABLE_CORRECTION_READ' | 'DURABLE_FAMILY_READ'
  | 'DURABLE_SUPPORT_READ' | 'DURABLE_PROJECTION'
  | 'DURABLE_MANUAL_EMPTY_LAYOUT' | 'DURABLE_MANUAL_RETAINED_LAYOUT';

const manualSchemaFailureStages = {
  manual_id: 'DURABLE_MANUAL_ID_FIELD', command_key: 'DURABLE_MANUAL_COMMAND_FIELD',
  owner_label: 'DURABLE_MANUAL_LABEL_FIELD', owner_context: 'DURABLE_MANUAL_CONTEXT_FIELD',
  latitude: 'DURABLE_MANUAL_LATITUDE_FIELD', longitude: 'DURABLE_MANUAL_LONGITUDE_FIELD',
  date_kind: 'DURABLE_MANUAL_DATE_KIND_FIELD', date_start: 'DURABLE_MANUAL_START_FIELD', date_end: 'DURABLE_MANUAL_END_FIELD',
} as const;
export type DurableRevealDiagnosticStage = DurableRevealStage | typeof manualSchemaFailureStages[keyof typeof manualSchemaFailureStages] | 'DURABLE_MANUAL_TABLE';

/** Native detail stays in memory; only the fixed stage crosses diagnostics. */
export class DurableRevealStageError extends Error {
  constructor(readonly stage: DurableRevealStage, readonly originalError: unknown) {
    super('Local Atlas read did not finish.');
    this.name = 'DurableRevealStageError';
  }
}

export function durableRevealFailureStage(error: unknown): DurableRevealDiagnosticStage | null {
  if (!(error instanceof DurableRevealStageError)) return null;
  if (error.stage === 'DURABLE_MANUAL_READ' && error.originalError instanceof Error) {
    // Recognize only known schema signatures in memory. Neither the parsed
    // identifier nor the native message is returned or sent to diagnostics.
    const message = error.originalError.message.toLowerCase();
    if (/no such table:\s*manual_journey\b/.test(message)) return 'DURABLE_MANUAL_TABLE';
    const field = /no such column:\s*(?:manual_journey\.)?([a-z_]+)\b/.exec(message)?.[1];
    if (field && Object.prototype.hasOwnProperty.call(manualSchemaFailureStages, field)) {
      return manualSchemaFailureStages[field as keyof typeof manualSchemaFailureStages];
    }
  }
  return error.stage;
}

/** Carries an internal, fixed processing stage without exposing a native SQLite error to the UI log. */
export class ReconciliationStageError extends Error {
  constructor(readonly stage: ReconciliationStage, readonly originalError: unknown) {
    super(originalError instanceof Error ? originalError.message : 'Local reconciliation failed.');
    this.name = 'ReconciliationStageError';
  }
}

function reconciliationStageError(stage: ReconciliationStage, error: unknown) {
  return error instanceof ReconciliationStageError ? error : new ReconciliationStageError(stage, error);
}

// Keep each statement below SQLite's conservative 999-variable boundary.
const MAX_RECONSTRUCTION_INSERT_PARAMETERS = 800;
// Generated place IDs can contain every support ID. Bound bridge payloads as
// well as SQLite parameters so one dense place does not create a huge call.
const MAX_RECONSTRUCTION_INSERT_CHARACTERS = 256_000;

type SqlValue = string | number | null;

function reconstructionRowWriter(db: Database, tableAndColumns: string, width: number) {
  const rowsPerStatement = Math.floor(MAX_RECONSTRUCTION_INSERT_PARAMETERS / width);
  let batch: SqlValue[][] = [];
  let characters = 0;
  const flush = async () => {
    if (!batch.length) return;
    const slots = `(${Array(width).fill('?').join(', ')})`;
    await db.runAsync(`INSERT INTO ${tableAndColumns} VALUES ${batch.map(() => slots).join(', ')}`, ...batch.flat());
    batch = [];
    characters = 0;
  };
  return {
    async add(row: SqlValue[]) {
      if (row.length !== width) throw new Error('Invalid reconstruction insert row width.');
      const rowCharacters = row.reduce<number>((count, value) => count + String(value ?? '').length, 0);
      if (rowCharacters > MAX_RECONSTRUCTION_INSERT_CHARACTERS) throw new Error('Reconstruction insert row exceeds the local SQLite bridge limit.');
      if (batch.length >= rowsPerStatement || characters + rowCharacters > MAX_RECONSTRUCTION_INSERT_CHARACTERS) await flush();
      batch.push(row);
      characters += rowCharacters;
    },
    flush,
  };
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Converts retained local days into a deliberately coarse UI period. Exact days never cross the reveal boundary. */
export function monthRangeLabel(firstDay: string | null, lastDay: string | null, firstYear: number | null, lastYear: number | null) {
  const monthFor = (day: string | null) => day && /^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(day) ? { year: Number(day.slice(0, 4)), month: Number(day.slice(5, 7)) - 1 } : null;
  const first = monthFor(firstDay); const last = monthFor(lastDay);
  if (first && last) {
    const start = `${MONTH_NAMES[first.month]} ${first.year}`;
    return first.year === last.year && first.month === last.month ? start : `${start}–${MONTH_NAMES[last.month]} ${last.year}`;
  }
  return firstYear === null ? 'Date unknown' : firstYear === lastYear ? String(firstYear) : `${firstYear}–${lastYear}`;
}

function metersBetween(a: ReconstructionEvidence, b: ReconstructionEvidence) {
  if (!Number.isFinite(a.latitude) || !Number.isFinite(a.longitude) || !Number.isFinite(b.latitude) || !Number.isFinite(b.longitude)) return null;
  const radians = Math.PI / 180;
  const latDelta = (b.latitude! - a.latitude!) * radians;
  const longitudeDelta = ((((b.longitude! - a.longitude!) + 540) % 360) - 180) * radians;
  const h = Math.sin(latDelta / 2) ** 2 + Math.cos(a.latitude! * radians) * Math.cos(b.latitude! * radians) * Math.sin(longitudeDelta / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * A place label must reflect its supported evidence, not whichever member won
 * a deterministic representative tie-break. Border/invalid members abstain;
 * conflicting resolved countries abstain rather than inventing a location.
 */
export function resolvePlaceCountryCode(place: { memberIds: string[] }, evidenceById: ReadonlyMap<string, ReconstructionEvidence>): string | null {
  const codes = new Set(place.memberIds.map((id) => evidenceById.get(id)).filter((item): item is ReconstructionEvidence => Boolean(item)).map((item) => resolveCountry({ latitude: item.latitude, longitude: item.longitude, reportedAccuracyMeters: item.reportedAccuracyMeters })).flatMap((result) => result.status === 'resolved' ? [result.code] : []));
  return codes.size === 1 ? [...codes][0] : null;
}

/** Conservative adapter from the stable V1 graph to V1.1's pure gate. It
 * derives only a frequently observed, non-candidate place as a provisional
 * base; absence or weak context stays unconfirmed rather than guessed. */
export function qualifyGraphJourneyV11(graph: ReconstructionGraph, journeyId: string, evidence: ReconstructionEvidence[], mediaByEvidence: Map<string, 'image' | 'video'>) {
  const journey = graph.journeys.find((candidate) => candidate.id === journeyId);
  if (!journey) throw new Error('Unknown reconstructed journey.');
  const visitById = new Map(graph.visits.map((visit) => [visit.id, visit]));
  const evidenceById = new Map(evidence.map((item) => [item.id, item]));
  const candidateVisits = journey.visitIds.map((id) => visitById.get(id)).filter((visit): visit is NonNullable<typeof visit> => Boolean(visit));
  const candidateIds = new Set(candidateVisits.flatMap((visit) => visit.evidenceIds));
  const candidatePlaceIds = new Set(candidateVisits.map((visit) => visit.placeId));
  const baseCandidates = graph.places
    .filter((place) => !candidatePlaceIds.has(place.id))
    .map((place) => ({ place, days: new Set(place.memberIds.map((id) => evidenceById.get(id)?.capturedDay).filter((day): day is string => Boolean(day))).size }))
    .filter((item) => item.days >= 12)
    .sort((a, b) => b.days - a.days || a.place.id.localeCompare(b.place.id));
  const base = baseCandidates[0]?.place;
  const baseEvidence = base ? evidenceById.get(base.representativeId) : undefined;
  const candidateEvidence = [...candidateIds].map((id) => evidenceById.get(id)).filter((item): item is ReconstructionEvidence => Boolean(item));
  const detectorEvidence: TripDetectorEvidence[] = candidateEvidence.map((item) => {
    const visit = candidateVisits.find((candidateVisit) => candidateVisit.evidenceIds.includes(item.id));
    const distance = baseEvidence ? metersBetween(item, baseEvidence) : null;
    return {
      ...item, mediaType: mediaByEvidence.get(item.id) ?? 'image', captureLike: true,
      reliableLocation: item.reportedAccuracyMeters === null || item.reportedAccuracyMeters <= 1_000,
      originalLocalDay: item.capturedDay, sessionId: item.capturedDay ?? null,
      supportPlaceId: visit?.placeId ?? null, origin: 'capture-like',
      effectiveBaseDistanceMeters: distance, rareDestination: Boolean(base && candidateEvidence.length < base.memberIds.length / 2),
    };
  });
  return qualifyTripV11(journeyId, detectorEvidence, { baseContext: Boolean(base && baseEvidence) });
}

/**
 * Joins adjacent V1 fragments only when both are demonstrably away from one
 * frequently observed base.  A ten-day ceiling permits ordinary multi-day
 * city stays but does not bridge an unobserved long break. It deliberately does not use country/city as a
 * grouping key: a city change is normal inside a trip, but location alone is
 * not proof of a continuous journey. Corrections retain their stable graph and
 * are therefore never rewritten by this additive migration step.
 */
export function mergeContinuousAwayJourneysV11(graph: ReconstructionGraph, evidence: ReconstructionEvidence[], protectedJourneyIds: ReadonlySet<string> = new Set(), configuredHomeAreas: OwnerConfiguredHomeArea[] = []): ReconstructionGraph {
  const evidenceById = new Map(evidence.map((item) => [item.id, item]));
  const visitById = new Map(graph.visits.map((visit) => [visit.id, visit]));
  const learnedBases = graph.places.map((place) => ({ place, days: new Set(place.memberIds.map((id) => evidenceById.get(id)?.capturedDay).filter((day): day is string => Boolean(day))).size }))
    .filter((item) => item.days >= 12)
    // A place representative is a stable display/provenance choice, not a
    // guarantee that it has a coordinate.  Fall back to any coordinate-bearing
    // support in the same frequent place so GPS-less media cannot turn a known
    // home base into an invisible continuity boundary.
    .map((item) => item.place.memberIds
      .map((id) => evidenceById.get(id))
      .filter((candidate): candidate is ReconstructionEvidence => Boolean(candidate))
      .find((candidate) => Number.isFinite(candidate.latitude) && Number.isFinite(candidate.longitude)))
    .filter((item): item is ReconstructionEvidence => Boolean(item));
  const configuredBases = configuredHomeAreas.filter((area) => Number.isFinite(area.latitude) && Number.isFinite(area.longitude)
    && area.latitude >= -90 && area.latitude <= 90 && area.longitude >= -180 && area.longitude <= 180);
  // An owner-configured home is authoritative. Falling back to all-history
  // frequent places in that case can turn a photo-heavy holiday into a base
  // and prevent its city fragments from being joined.
  if (!configuredBases.length && !learnedBases.length) return graph;
  const activeConfiguredBases = (day: string | null) => configuredBases.filter((area) => day !== null
    && (!area.effectiveStartDay || day >= area.effectiveStartDay)
    && (!area.effectiveEndDay || day <= area.effectiveEndDay));
  const nearestBaseDistance = (item: ReconstructionEvidence) => {
    const applicable = configuredBases.length
      ? activeConfiguredBases(item.capturedDay).map((area) => ({ latitude: area.latitude, longitude: area.longitude } as ReconstructionEvidence))
      : learnedBases;
    const distances = applicable.map((base) => metersBetween(item, base)).filter((distance): distance is number => distance !== null);
    return distances.length ? Math.min(...distances) : null;
  };
  const span = (journey: ReconstructionGraph['journeys'][number]) => {
    const items = journey.visitIds.flatMap((id) => visitById.get(id)?.evidenceIds ?? []).map((id) => evidenceById.get(id)).filter((item): item is ReconstructionEvidence => Boolean(item));
    const ordered = items.filter((item) => item.capturedAtMillis !== null).sort((a, b) => a.capturedAtMillis! - b.capturedAtMillis!);
    const days = items.map((item) => item.capturedDay).filter((day): day is string => Boolean(day)).sort();
    // GPS-less associated media cannot manufacture an away boundary. A supported
    // away fragment needs at least one known far point; every known point must
    // remain far from all applicable frequent bases. This keeps a missing
    // coordinate from splitting a real multi-city holiday while retaining an
    // observed home return as a boundary.
    const knownDistances = items.map(nearestBaseDistance).filter((distance): distance is number => distance !== null);
    const far = knownDistances.length > 0 && knownDistances.every((distance) => distance >= 50_000);
    return { journey, start: ordered[0]?.capturedAtMillis ?? (days[0] ? Date.parse(`${days[0]}T00:00:00Z`) : null), end: ordered.at(-1)?.capturedAtMillis ?? (days.at(-1) ? Date.parse(`${days.at(-1)}T00:00:00Z`) : null), far };
  };
  const ordered = graph.journeys.map(span).sort((a, b) => (a.start ?? Number.MAX_SAFE_INTEGER) - (b.start ?? Number.MAX_SAFE_INTEGER) || a.journey.id.localeCompare(b.journey.id));
  const groups: ReconstructionGraph['journeys'] = [];
  for (const candidate of ordered) {
    const prior = groups.at(-1);
    const priorSpan = prior && span(prior);
    const gap = priorSpan && priorSpan.end !== null && candidate.start !== null ? candidate.start - priorSpan.end : Number.POSITIVE_INFINITY;
    // A correction pins its exact current support projection.  It must never
    // be absorbed by a heuristic continuity merge, but an unrelated historic
    // correction must not suppress automatic continuity everywhere else.
    if (prior && priorSpan?.far && candidate.far
      && !protectedJourneyIds.has(prior.id) && !protectedJourneyIds.has(candidate.journey.id)
      && gap >= 0 && gap <= 10 * 24 * 60 * 60 * 1000) prior.visitIds.push(...candidate.journey.visitIds);
    else groups.push({ ...candidate.journey, visitIds: [...candidate.journey.visitIds] });
  }
  const remap = new Map<string, string>();
  const journeys = groups.map((journey) => {
    const id = journey.visitIds.length === 1 ? journey.id : `journey:${journey.visitIds.join('|')}`;
    for (const original of ordered.filter((item) => journey.visitIds.includes(item.journey.visitIds[0])).map((item) => item.journey.id)) remap.set(original, id);
    return { ...journey, id };
  });
  if (!remap.size || journeys.length === graph.journeys.length) return graph;
  return { ...graph, journeys, memberships: graph.memberships.map((membership) => ({ ...membership, journeyId: remap.get(membership.journeyId) ?? membership.journeyId })), possibleMerges: graph.possibleMerges.filter((merge) => remap.get(merge.fromJourneyId) === undefined && remap.get(merge.toJourneyId) === undefined) };
}

/**
 * Makes the canonical V1.1 episode pass the authority for unreviewed journey
 * membership.  The legacy graph still supplies stable places, visits and all
 * correction anchors; it no longer decides which away fragments comprise a
 * persisted/displayed journey.  Reviewed journeys are deliberately kept as
 * immutable projections until the exact-support remapper has decided them.
 */
export function constructCanonicalV11Graph(
  graph: ReconstructionGraph,
  evidence: ReconstructionEvidence[],
  protectedJourneyIds: ReadonlySet<string> = new Set(),
  configuredHomeAreas: OwnerConfiguredHomeArea[] = [],
): ReconstructionGraph {
  const journeyByVisit = new Map<string, string>();
  for (const journey of graph.journeys) for (const visitId of journey.visitIds) journeyByVisit.set(visitId, journey.id);
  const placeByVisit = new Map(graph.visits.map((visit) => [visit.id, visit.placeId]));
  const visitByEvidence = new Map<string, string>();
  for (const visit of graph.visits) for (const evidenceId of visit.evidenceIds) visitByEvidence.set(evidenceId, visit.id);
  const unreviewedEvidence = evidence.filter((item) => {
    const visitId = visitByEvidence.get(item.id);
    return visitId !== undefined && !protectedJourneyIds.has(journeyByVisit.get(visitId) ?? '');
  });
  if (!unreviewedEvidence.length) return graph;

  const explicitHomes = configuredHomeAreas.length > 0;
  const learnedBaseEvidence = explicitHomes ? [] : graph.places
    .map((place) => ({ place, days: new Set(place.memberIds.map((id) => evidence.find((item) => item.id === id)?.capturedDay).filter((day): day is string => Boolean(day))).size }))
    .filter((candidate) => candidate.days >= 12)
    .map((candidate) => candidate.place.memberIds.map((id) => evidence.find((item) => item.id === id))
      .filter((item): item is ReconstructionEvidence => item !== undefined)
      .find((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude)))
    .filter((item): item is ReconstructionEvidence => Boolean(item));
  const validCapturedDay = (day: string | null) => Boolean(day && /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(day) && new Date(`${day}T00:00:00.000Z`).toISOString().slice(0, 10) === day);
  const configuredDistance = (item: ReconstructionEvidence) => validCapturedDay(item.capturedDay) ? configuredHomeAreas
    .filter((area) => Number.isFinite(area.radiusMeters ?? 50_000) && (area.radiusMeters ?? 50_000) > 0 && (area.radiusMeters ?? 50_000) <= 50_000)
    .filter((area) => !area.effectiveStartDay || item.capturedDay! >= area.effectiveStartDay)
    .filter((area) => !area.effectiveEndDay || item.capturedDay! <= area.effectiveEndDay)
    .map((area) => metersBetween(item, { ...item, latitude: area.latitude, longitude: area.longitude }))
    .filter((distance): distance is number => distance !== null) : [];
  const learnedBasePlaceIds = new Set(graph.places.filter((place) => learnedBaseEvidence.some((base) => place.memberIds.includes(base.id))).map((place) => place.id));
  const candidates = buildV11Episodes(unreviewedEvidence.map((item) => {
    const visitId = visitByEvidence.get(item.id);
    const supportPlaceId = visitId ? placeByVisit.get(visitId) ?? null : null;
    const distances = explicitHomes ? configuredDistance(item) : learnedBaseEvidence.map((base) => metersBetween(item, base)).filter((distance): distance is number => distance !== null);
    const distance = distances.length ? Math.min(...distances) : null;
    return {
    ...item,
    mediaType: 'image' as const,
    // Android's local library does not always expose a source classification;
    // retain that established capture-like fallback, but never overwrite an
    // explicit non-capture provenance persisted by import.
    captureLike: item.sourceOrigin !== 'download' && item.sourceOrigin !== 'screenshot' && item.sourceOrigin !== 'unknown',
    origin: item.sourceOrigin === 'download' || item.sourceOrigin === 'screenshot' || item.sourceOrigin === 'unknown' ? item.sourceOrigin : 'capture-like',
    originalLocalDay: item.capturedDay,
    // V1 visit ordering is not a session model.  A dated visit is the most
    // conservative bridge available until native session normalization exists.
    sessionId: item.capturedDay,
    supportPlaceId,
    usualAreaContext: item.usualAreaContext || (!explicitHomes && Boolean(supportPlaceId && learnedBasePlaceIds.has(supportPlaceId))),
    effectiveBaseDistanceMeters: distance,
    foreignToEveryBase: distance === null ? null : distance >= 50_000,
  };
  }), { baseContext: explicitHomes || learnedBaseEvidence.length > 0, ownerHomeAreas: configuredHomeAreas });

  const consumedVisits = new Set<string>();
  const replacementJourneys: ReconstructionGraph['journeys'] = [];
  const visitToJourney = new Map<string, string>();
  for (const candidate of candidates.trips) {
    const visitIds = [...new Set(candidate.supportIds.map((id) => visitByEvidence.get(id)).filter((id): id is string => Boolean(id)))];
    if (!visitIds.length) continue;
    // Only a stable representation order is used here; mixed time precision
    // was already kept in separate canonical episodes above.
    visitIds.sort((left, right) => left.localeCompare(right));
    if (visitIds.some((id) => consumedVisits.has(id))) continue;
    const id = `journey:v1-1:${visitIds.join('|')}`;
    replacementJourneys.push({ id, visitIds, state: 'inferred' });
    for (const visitId of visitIds) { consumedVisits.add(visitId); visitToJourney.set(visitId, id); }
  }
  // Preserve an invalid/unsupported legacy visit as a private draft rather
  // than deleting it.  Qualification subsequently fails it closed.
  for (const journey of graph.journeys) if (!protectedJourneyIds.has(journey.id)) {
    const remaining = journey.visitIds.filter((visitId) => !consumedVisits.has(visitId));
    if (remaining.length) {
      const id = `journey:v1-1:${remaining.slice().sort().join('|')}`;
      replacementJourneys.push({ ...journey, id, visitIds: remaining });
      for (const visitId of remaining) visitToJourney.set(visitId, id);
    }
  }
  for (const journey of graph.journeys) if (protectedJourneyIds.has(journey.id)) {
    replacementJourneys.push({ ...journey, visitIds: [...journey.visitIds] });
    for (const visitId of journey.visitIds) visitToJourney.set(visitId, journey.id);
  }
  return {
    ...graph,
    journeys: replacementJourneys.sort((left, right) => left.id.localeCompare(right.id)),
    memberships: graph.memberships.map((membership) => ({
      ...membership,
      journeyId: visitToJourney.get(visitByEvidence.get(membership.evidenceId) ?? '') ?? membership.journeyId,
    })),
    possibleMerges: graph.possibleMerges.filter((merge) => protectedJourneyIds.has(merge.fromJourneyId) || protectedJourneyIds.has(merge.toJourneyId)),
  };
}

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
  return corrections.filter((correction) => correction.action === 'confirm' || correction.action === 'claim' || correction.action === 'place').map((correction) => correction.revision_id);
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

/** The durable application target must be the ID in the graph that will be
 * committed and read by Atlas, not an intermediate pre-continuity graph. */
export function mapCorrectionsToCommittedJourneys(graph: ReconstructionGraph, corrections: JourneyCorrectionRevision[], families?: FamilyResolver) {
  return applyJourneyCorrections(graph, corrections, false, families).matches;
}

function canAwaitJourneyCorrectionReview(correction: JourneyCorrectionRevision) {
  return correction.action === 'confirm' || correction.action === 'claim' || correction.action === 'place';
}

/** Separates a reviewable ambiguity created only by the final committed graph
 * from earlier structural/support failures, which remain fail-closed. */
export function mapFinalCorrectionApplications(graph: ReconstructionGraph, corrections: JourneyCorrectionRevision[], families?: FamilyResolver) {
  const matches = new Map<string, string>();
  const pending: JourneyCorrectionRevision[] = [];
  for (const correction of corrections) {
    try {
      const match = mapCorrectionsToCommittedJourneys(graph, [correction], families).get(correction.revision_id);
      if (canAwaitJourneyCorrectionReview(correction) && !match) throw new JourneyCorrectionRemapRequiredError(correction.revision_id);
      if (match) matches.set(correction.revision_id, match);
    } catch (error) {
      if (!canAwaitJourneyCorrectionReview(correction) || !(error instanceof JourneyCorrectionRemapRequiredError)) throw error;
      pending.push(correction);
    }
  }
  return { matches, pending };
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
  if (!claim || (!claim.title && !claim.date)) throw new Error('Enter a private journey title or date before saving.');
  if (claim.title && (claim.title !== claim.title.trim() || claim.title.length > 120)) throw new Error('Enter a private journey title of 120 characters or fewer.');
  if (!claim.date) return claim;
  if (claim.date.kind === 'exact') {
    if (!isCalendarDay(claim.date.day)) throw new Error('Enter an exact owner date as YYYY-MM-DD.');
    return claim;
  }
  if (!isCalendarDay(claim.date.startDay) || !isCalendarDay(claim.date.endDay) || claim.date.startDay > claim.date.endDay) {
    throw new Error('Enter an ordered approximate date interval as YYYY-MM-DD.');
  }
  return claim;
}

function validatedOwnerPlace(place: OwnerJourneyPlace | undefined): OwnerJourneyPlace {
  if (!place || !place.id || place.id.length > 160 || !place.name || place.name !== place.name.trim() || place.name.length > 120 || !place.context || place.context !== place.context.trim() || place.context.length > 160) {
    throw new Error('Choose a local place result before saving.');
  }
  if (!Number.isFinite(place.anchor.latitude) || !Number.isFinite(place.anchor.longitude) || place.anchor.latitude < -90 || place.anchor.latitude > 90 || place.anchor.longitude < -180 || place.anchor.longitude > 180) {
    throw new Error('The selected place has an invalid local map anchor.');
  }
  return place;
}

type ManualRow = { manual_id: string; command_key: string; owner_label: string; owner_context: string; latitude: number; longitude: number; date_kind: 'exact' | 'approximate'; date_start: string; date_end: string };

function validateManualJourney(input: ManualJourneyInput) {
  if (!input.commandKey || input.commandKey.length > 160) throw new Error('A stable private save key is required.');
  if (!input.label || input.label !== input.label.trim() || input.label.length > 120) throw new Error('Enter a destination label of 120 characters or fewer.');
  if (!input.context || input.context !== input.context.trim() || input.context.length > 160) throw new Error('Enter a destination area of 160 characters or fewer.');
  if (!Number.isFinite(input.anchor.latitude) || !Number.isFinite(input.anchor.longitude) || input.anchor.latitude < -90 || input.anchor.latitude > 90 || input.anchor.longitude < -180 || input.anchor.longitude > 180) throw new Error('Choose a valid coarse map area.');
  if (input.date.kind === 'exact') {
    if (!isCalendarDay(input.date.day)) throw new Error('Enter an exact date as YYYY-MM-DD.');
  } else if (!isCalendarDay(input.date.startDay) || !isCalendarDay(input.date.endDay) || input.date.startDay > input.date.endDay) {
    throw new Error('Enter an ordered approximate date interval as YYYY-MM-DD.');
  }
}

function manualRange(input: ManualJourneyInput | ManualRow) {
  return 'date' in input ? (input.date.kind === 'exact' ? [input.date.day, input.date.day] as const : [input.date.startDay, input.date.endDay] as const) : [input.date_start, input.date_end] as const;
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
      const sqlite = require('expo-sqlite') as { openDatabaseAsync(name: string, options?: { useNewConnection?: boolean }): Promise<Database> };
      // Expo SQLite can retain a released cached native handle after Android
      // recreates the React runtime while the process survives. The import
      // repository owns its cached connection; reconstruction gets a fresh
      // handle and the existing transaction gate serializes their writers.
      const db = serializeNativeTransactions(await sqlite.openDatabaseAsync('travel-life-import-v1.db', { useNewConnection: true }));
      await db.execAsync('PRAGMA busy_timeout = 30000');
      return db;
    })().catch((error) => { database = null; throw error; });
    return database;
  }

  async function readDestinationLabels(db: Database, runId: number, journeyId: string | null = null) {
    const support = await db.getAllAsync<EvidenceRow & { journey_id: string; place_id: string }>(`
      SELECT DISTINCT journey.parent_id AS journey_id, visit.place_id,
        evidence.evidence_id, evidence.captured_at_millis, evidence.captured_day,
        evidence.has_precise_offset, evidence.availability, evidence.latitude, evidence.longitude,
        evidence.reported_accuracy_meters, evidence.platform_duplicate_family_id,
        evidence.source_origin, evidence.support_eligible, evidence.duplicate_tuple_version,
        evidence.duplicate_tuple_fingerprint
      FROM reconstruction_link journey
      JOIN reconstruction_visit visit ON visit.run_id = journey.run_id AND visit.visit_id = journey.child_id
      JOIN reconstruction_link support ON support.run_id = visit.run_id
        AND support.link_kind = 'visit-support' AND support.parent_id = visit.visit_id
      JOIN canonical_evidence evidence ON evidence.evidence_id = support.child_id
      WHERE journey.run_id = ? AND journey.link_kind = 'journey-visit'
        AND (? IS NULL OR journey.parent_id = ?)
    `, runId, journeyId, journeyId);
    const families = resolveVerifiedDuplicateFamilies(support);
    const grouped = new Map<string, DestinationSupport[]>();
    for (const row of support) {
      if (row.availability === 'unavailable' || !families.supportEligible(row.evidence_id) || families.conflictForEvidence(row.evidence_id)) continue;
      grouped.set(row.journey_id, [...(grouped.get(row.journey_id) ?? []), {
        placeId: row.place_id, familyId: families.keyForEvidence(row.evidence_id),
        latitude: row.latitude, longitude: row.longitude, reportedAccuracyMeters: row.reported_accuracy_meters,
      }]);
    }
    return new Map([...grouped].map(([id, items]) => [id, destinationLabel(items)]));
  }

  async function activeMaintenanceLease(db: Database, nowMillis: number) {
    const maintenance = await db.getFirstAsync<{ expires_at_millis: number }>('SELECT expires_at_millis FROM maintenance_lease WHERE record_id = 1');
    return maintenance !== null && maintenance.expires_at_millis > nowMillis;
  }

  async function acquireLease(nowMillis: number, setStage: (stage: ReconciliationStage) => void): Promise<number | null> {
    setStage('LEASE_OPEN');
    const db = await open();
    // An OS-invoked metadata pass uses this durable lease from another JS
    // runtime. Reading it first avoids racing its active writer for SQLite's
    // exclusive transaction lock; its owner will reconcile the queue itself.
    setStage('MAINTENANCE_LEASE_READ');
    if (await activeMaintenanceLease(db, nowMillis)) return null;
    setStage('LEASE_WRITE');
    try {
      await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
    } catch (error) {
      // A task can acquire its durable maintenance lease between the read
      // above and this write. Recheck once to classify that race without
      // retrying an unknown SQLite failure or adding another write.
      try {
        setStage('MAINTENANCE_LEASE_READ');
        if (await activeMaintenanceLease(db, nowMillis)) return null;
      } catch {
        // Preserve the original write-lock failure when the read cannot run.
      }
      setStage('LEASE_WRITE');
      throw error;
    }
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

  async function saveNoQueuedOutcome(nowMillis: number) {
    const db = await open();
    await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
    try {
      await db.runAsync("UPDATE reconciliation_state SET status = 'complete', last_checked_at_millis = ?, last_updated_at_millis = ?, new_journey_count = 0, updated_journey_count = 0, message = ? WHERE record_id = 1", nowMillis, nowMillis, 'No local journey updates were waiting.');
      await db.runAsync("UPDATE reconciliation_checkpoint SET status = 'complete', message = ? WHERE record_id = 1", 'No local journey updates were waiting.');
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
        const existing = await db.getFirstAsync<{ candidate_id: string }>(
          "SELECT candidate_id FROM journey_memory_correction_candidate WHERE revision_id = ? AND state = 'pending_remap' LIMIT 1", revisionId,
        );
        if (existing) { await db.execAsync('COMMIT'); return; }
        const candidateId = `memory-candidate-${revisionId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        await db.runAsync(`INSERT INTO journey_memory_correction_candidate (candidate_id, revision_id, base_run_id, state, reason, created_at_millis)
          VALUES (?, ?, ?, 'pending_remap', ?, ?)`, candidateId, revisionId, memoryRevision.source_run_id, 'The selected memory or its reviewed target no longer maps uniquely to this rebuilt journey.', Date.now());
        await db.execAsync('COMMIT'); return;
      }
      const existing = await db.getFirstAsync<{ candidate_id: string }>(
        "SELECT candidate_id FROM journey_correction_candidate WHERE revision_id = ? AND state = 'pending_remap' LIMIT 1", revisionId,
      );
      if (existing) { await db.execAsync('COMMIT'); return; }
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
    async findManualJourneyOverlaps(input: ManualJourneyInput) {
      validateManualJourney(input);
      const db = await open();
      await ensureNativeImportSchema(db);
      const [start, end] = manualRange(input);
      const lifecycle = await db.getFirstAsync<{ state: string }>('SELECT state FROM private_record_lifecycle WHERE record_id = 1');
      if (lifecycle?.state !== 'connected') throw new Error('Private record is not connected.');
      const manual = await db.getAllAsync<ManualRow>(`SELECT manual_id, command_key, owner_label, owner_context, latitude, longitude, date_kind, date_start, date_end
        FROM manual_journey WHERE date_start <= ? AND date_end >= ? ORDER BY date_start, manual_id`, end, start);
      const completed = await db.getFirstAsync<{ run_id: number }>("SELECT MAX(run_id) AS run_id FROM reconstruction_run WHERE status = 'complete'");
      const inferred = completed?.run_id ? await db.getAllAsync<{ journey_id: string; first_day: string; last_day: string }>(`
        SELECT journey_visit.parent_id AS journey_id, MIN(evidence.captured_day) AS first_day, MAX(evidence.captured_day) AS last_day
        FROM reconstruction_link journey_visit
        JOIN reconstruction_trip_qualification qualification ON qualification.run_id = journey_visit.run_id AND qualification.journey_id = journey_visit.parent_id
        JOIN reconstruction_link support ON support.run_id = journey_visit.run_id AND support.link_kind = 'visit-support' AND support.parent_id = journey_visit.child_id
        JOIN canonical_evidence evidence ON evidence.evidence_id = support.child_id
        WHERE journey_visit.run_id = ? AND journey_visit.link_kind = 'journey-visit'
          AND qualification.classification IN ('AUTO_CONFIRMED', 'USER_CONFIRMED')
        GROUP BY journey_visit.parent_id HAVING MIN(evidence.captured_day) <= ? AND MAX(evidence.captured_day) >= ?`, completed.run_id, end, start) : [];
      return [
        ...manual.map((row) => ({ id: `manual:${row.manual_id}`, label: `${row.owner_label} · owner-entered`, editable: false })),
        ...inferred.map((row) => ({ id: opaqueJourneyDisplayId(row.journey_id), label: row.first_day === row.last_day ? `Inferred journey near ${row.first_day}` : `Inferred journey ${row.first_day} to ${row.last_day}`, editable: true })),
      ];
    },
    async createManualJourney(input: ManualJourneyInput) {
      validateManualJourney(input);
      const db = await open();
      await ensureNativeImportSchema(db);
      const [start, end] = manualRange(input);
      await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
      try {
        const lifecycle = await db.getFirstAsync<{ state: string }>('SELECT state FROM private_record_lifecycle WHERE record_id = 1');
        if (lifecycle?.state !== 'connected') throw new Error('Private record is not connected.');
        const existing = await db.getFirstAsync<ManualRow>('SELECT manual_id, command_key, owner_label, owner_context, latitude, longitude, date_kind, date_start, date_end FROM manual_journey WHERE command_key = ?', input.commandKey);
        if (existing) { await db.execAsync('COMMIT'); return `manual:${existing.manual_id}`; }
        const overlapRows = await db.getAllAsync<{ manual_id: string }>('SELECT manual_id FROM manual_journey WHERE date_start <= ? AND date_end >= ?', end, start);
        const completed = await db.getFirstAsync<{ run_id: number }>("SELECT MAX(run_id) AS run_id FROM reconstruction_run WHERE status = 'complete'");
        const inferredRows = completed?.run_id ? await db.getAllAsync<{ journey_id: string }>(`
          SELECT journey_visit.parent_id AS journey_id
          FROM reconstruction_link journey_visit
          JOIN reconstruction_trip_qualification qualification ON qualification.run_id = journey_visit.run_id AND qualification.journey_id = journey_visit.parent_id
          JOIN reconstruction_link support ON support.run_id = journey_visit.run_id AND support.link_kind = 'visit-support' AND support.parent_id = journey_visit.child_id
          JOIN canonical_evidence evidence ON evidence.evidence_id = support.child_id
          WHERE journey_visit.run_id = ? AND journey_visit.link_kind = 'journey-visit'
            AND qualification.classification IN ('AUTO_CONFIRMED', 'USER_CONFIRMED')
          GROUP BY journey_visit.parent_id HAVING MIN(evidence.captured_day) <= ? AND MAX(evidence.captured_day) >= ?`, completed.run_id, end, start) : [];
        const overlapIds = [...overlapRows.map((row) => `manual:${row.manual_id}`), ...inferredRows.map((row) => opaqueJourneyDisplayId(row.journey_id))].sort();
        const reviewed = [...new Set(input.reviewedOverlapIds)].sort();
        if (overlapIds.join('|') !== reviewed.join('|')) throw new Error('The private record changed after overlap review. Review overlaps again before saving.');
        const id = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        const anchor = coarseMapAnchor(input.anchor.latitude, input.anchor.longitude)!;
        await db.runAsync(`INSERT INTO manual_journey (manual_id, command_key, owner_label, owner_context, latitude, longitude, date_kind, date_start, date_end, created_at_millis)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, id, input.commandKey, input.label, input.context, anchor.latitude, anchor.longitude, input.date.kind, start, end, Date.now());
        const readBack = await db.getFirstAsync<{ manual_id: string }>('SELECT manual_id FROM manual_journey WHERE manual_id = ?', id);
        if (!readBack) throw new Error('The owner-entered journey could not be read back.');
        await db.execAsync('COMMIT');
        return `manual:${id}`;
      } catch (error) { await db.execAsync('ROLLBACK'); throw error; }
    },
    async saveConfiguredHomeAreaFromJourney(displayId: string, areaId: string, visitId: string, ownerLabel: string, effectiveStartDay: string | null, effectiveEndDay: string | null) {
      const db = await open();
      const lifecycle = await db.getFirstAsync<{ state: string }>('SELECT state FROM private_record_lifecycle WHERE record_id = 1');
      const selected = displayedJourneys.get(displayId);
      if (lifecycle?.state !== 'connected' || !selected || !areaId || !visitId || !ownerLabel.trim()) throw new Error('Private place selection is unavailable.');
      const validHomeDay = (day: string | null) => day === null || (/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(day) && new Date(`${day}T00:00:00.000Z`).toISOString().slice(0, 10) === day);
      if (!validHomeDay(effectiveStartDay) || !validHomeDay(effectiveEndDay) || (effectiveStartDay && effectiveEndDay && effectiveStartDay > effectiveEndDay)) throw new Error('Home-area dates must be valid and ordered.');
      const place = await db.getFirstAsync<{ latitude: number; longitude: number }>(`SELECT evidence.latitude, evidence.longitude FROM reconstruction_link journey_visit JOIN reconstruction_visit visit ON visit.run_id = journey_visit.run_id AND visit.visit_id = journey_visit.child_id JOIN reconstruction_place reconstruction_place ON reconstruction_place.run_id = visit.run_id AND reconstruction_place.place_id = visit.place_id JOIN canonical_evidence evidence ON evidence.evidence_id = reconstruction_place.representative_evidence_id WHERE journey_visit.run_id = ? AND journey_visit.parent_id = ? AND journey_visit.child_id = ? AND journey_visit.link_kind = 'journey-visit' AND evidence.latitude IS NOT NULL AND evidence.longitude IS NOT NULL LIMIT 1`, selected.runId, selected.journeyId, visitId);
      if (!place) throw new Error('Choose an observed area in this journey.');
      await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
      try { await db.runAsync("INSERT INTO configured_home_area (area_id, owner_label, origin, latitude, longitude, effective_start_day, effective_end_day, radius_meters) VALUES (?, ?, 'observed-area', ?, ?, ?, ?, ?) ON CONFLICT(area_id) DO UPDATE SET owner_label=excluded.owner_label, origin=excluded.origin, latitude=excluded.latitude, longitude=excluded.longitude, effective_start_day=excluded.effective_start_day, effective_end_day=excluded.effective_end_day, radius_meters=excluded.radius_meters", areaId, ownerLabel.trim(), place.latitude, place.longitude, effectiveStartDay, effectiveEndDay, 20_000); await db.execAsync('COMMIT'); }
      catch (error) { await db.execAsync('ROLLBACK'); throw error; }
    },
    /** Resolves an opaque Atlas id only inside SQLite and returns owner-readable text. */
    async loadJourneyDetail(displayId: string): Promise<{ detail: JourneyDetail; previewSourceRefs: (string | null)[]; snapshotToken: number }> {
      const db = await open();
      if (displayId.startsWith('manual:')) await ensureNativeImportSchema(db);
      const lifecycle = await db.getFirstAsync<{ state: string }>('SELECT state FROM private_record_lifecycle WHERE record_id = 1');
      if (lifecycle?.state !== 'connected') throw new Error('Private record is not connected.');
      if (displayId.startsWith('manual:')) {
        const manualId = displayId.slice('manual:'.length);
        const manual = await db.getFirstAsync<ManualRow>('SELECT manual_id, command_key, owner_label, owner_context, latitude, longitude, date_kind, date_start, date_end FROM manual_journey WHERE manual_id = ?', manualId);
        if (!manual) throw new Error('Journey is unavailable.');
        const ownerClaim: OwnerJourneyClaim = manual.date_kind === 'exact'
          ? { title: manual.owner_label, date: { kind: 'exact', day: manual.date_start } }
          : { title: manual.owner_label, date: { kind: 'approximate', startDay: manual.date_start, endDay: manual.date_end } };
        return { detail: { id: displayId, title: manual.owner_label, observedSpan: 'Owner-entered date claim; no observed evidence is attached.', visits: [], memories: [], uncertainty: ['This is an owner-entered private assertion. It does not prove presence or create visit support.'], ownerClaim, ownerPlace: { id: `manual-place:${manual.manual_id}`, name: manual.owner_label, context: manual.owner_context, anchor: coarseMapAnchor(manual.latitude, manual.longitude)! }, ownerEntered: true }, previewSourceRefs: [], snapshotToken: 0 };
      }
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
      const ownerClaimRow = await db.getFirstAsync<{ owner_title: string | null; owner_date_kind: 'exact' | 'approximate' | null; owner_date_start: string | null; owner_date_end: string | null }>(
        `SELECT revision.owner_title, revision.owner_date_kind, revision.owner_date_start, revision.owner_date_end
         FROM journey_correction_application application
         JOIN journey_correction_revision revision ON revision.revision_id = application.revision_id
         WHERE application.run_id = ? AND application.target_kind = 'journey' AND application.journey_id = ?
           AND revision.action = 'claim' AND revision.state = 'effective'
         ORDER BY revision.created_at_millis DESC LIMIT 1`, selected.runId, selected.journeyId,
      );
      const ownerDate = ownerClaimRow?.owner_date_kind === 'exact' && ownerClaimRow.owner_date_start
        ? { kind: 'exact' as const, day: ownerClaimRow.owner_date_start }
        : ownerClaimRow?.owner_date_kind === 'approximate' && ownerClaimRow.owner_date_start && ownerClaimRow.owner_date_end
          ? { kind: 'approximate' as const, startDay: ownerClaimRow.owner_date_start, endDay: ownerClaimRow.owner_date_end }
          : undefined;
      const ownerClaim = ownerClaimRow && (ownerClaimRow.owner_title || ownerDate)
        ? { ...(ownerClaimRow.owner_title ? { title: ownerClaimRow.owner_title } : {}), ...(ownerDate ? { date: ownerDate } : {}) }
        : undefined;
      const ownerPlaceRow = await db.getFirstAsync<{ owner_place_id: string; owner_place_name: string; owner_place_context: string; owner_latitude: number; owner_longitude: number }>(
        `SELECT revision.owner_place_id, revision.owner_place_name, revision.owner_place_context, revision.owner_latitude, revision.owner_longitude
         FROM journey_correction_application application
         JOIN journey_correction_revision revision ON revision.revision_id = application.revision_id
         WHERE application.run_id = ? AND application.target_kind = 'journey' AND application.journey_id = ?
           AND revision.action = 'place' AND revision.state = 'effective'
         ORDER BY revision.created_at_millis DESC LIMIT 1`, selected.runId, selected.journeyId,
      );
      const ownerPlaceAnchor = ownerPlaceRow ? coarseMapAnchor(ownerPlaceRow.owner_latitude, ownerPlaceRow.owner_longitude) : null;
      const ownerPlace = ownerPlaceRow?.owner_place_id && ownerPlaceRow.owner_place_name && ownerPlaceRow.owner_place_context && ownerPlaceAnchor
        ? { id: ownerPlaceRow.owner_place_id, name: ownerPlaceRow.owner_place_name, context: ownerPlaceRow.owner_place_context, anchor: ownerPlaceAnchor }
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
      const destinationLabels = await readDestinationLabels(db, selected.runId, selected.journeyId);
      return { detail: { id: displayId, title: ownerClaim?.title ?? ownerPlace?.name ?? destinationLabels.get(selected.journeyId) ?? 'Private journey', observedSpan: span, visits: detailVisits, mergeCandidates, memories: detailMemories, uncertainty, ownerClaim, ownerPlace, pendingRemap: pendingRemap ? { reason: pendingRemap.reason } : pendingMemoryRemap ? { reason: pendingMemoryRemap.reason } : undefined, correctionState: pendingScopeReview ? 'pending scope review' : pendingRemap || pendingMemoryRemap || correction?.application_state === 'pending_remap' ? 'pending remap' : correction?.action === 'confirm' ? 'confirmed' : correction?.action === 'reject' ? 'rejected' : 'inferred' },
        // Unknown is not unavailable. Resolve this bounded, selected set under
        // current permission so Android imports made before URI probing can
        // become visible; the adapter still fails closed if access is gone.
        previewSourceRefs: memories.map((memory) => memory.availability === 'unavailable' ? null : memory.source_ref), snapshotToken: selected.runId };
    },
    /** Reads one stable, local-only associated-media page after an explicit gallery action. */
    async loadJourneyMediaPage(displayId: string, expectedSnapshotToken: number, page: number) {
      // A gallery opens as a photo grid. Keep fetches bounded while avoiding
      // the old list-like page-by-page experience.
      const pageSize = 60;
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
    async saveJourneyCorrection(displayId: string, action: JourneyCorrectionAction, expectedSnapshotToken: number, reviewedSnapshot: JourneyDetail, commandKey: string, payloadOrNowMillis?: OwnerJourneyClaim | OwnerJourneyPlace | StructuralSplit | StructuralMerge | VisitRemoval | number, suppliedNowMillis = Date.now()) {
      const db = await open();
      const selected = displayedJourneys.get(displayId);
      if (!selected) throw new Error('Journey is unavailable.');
      const structuralPredecessorJourneyIds = [selected.journeyId];
      const nowMillis = typeof payloadOrNowMillis === 'number' ? payloadOrNowMillis : suppliedNowMillis;
      const claim = action === 'claim' && typeof payloadOrNowMillis === 'object' ? payloadOrNowMillis as OwnerJourneyClaim : undefined;
      const place = action === 'place' && typeof payloadOrNowMillis === 'object' ? payloadOrNowMillis as OwnerJourneyPlace : undefined;
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
        const ownerPlace = action === 'place' ? validatedOwnerPlace(place) : undefined;
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
              FROM journey_correction_revision WHERE state = 'effective' AND action IN ('confirm', 'claim', 'place')
                AND journey_id IN (${structuralPredecessorJourneyIds.map(() => '?').join(', ')})`, ...structuralPredecessorJourneyIds)
          : [];
        const predecessorWideIds = predecessorWideScopeRevisions(predecessorWide);
        for (const predecessorRevisionId of predecessorWideIds) await db.runAsync("UPDATE journey_correction_revision SET state = 'superseded' WHERE revision_id = ?", predecessorRevisionId);
        if (action === 'confirm' || action === 'claim' || action === 'place') {
          await db.runAsync("UPDATE journey_correction_scope_review SET state = 'resolved' WHERE run_id = ? AND journey_id = ? AND state = 'pending_scope_review'", selected.runId, selected.journeyId);
        }
        const revisionId = `journey-review-${nowMillis}-${Math.random().toString(36).slice(2)}`;
        const correctionColumns = ['revision_id', 'action', 'source_run_id', 'journey_id', 'reviewed_support_json', 'state', 'created_at_millis', 'replaces_revision_id', 'reviewed_snapshot_json', 'reviewed_visits_json', 'reviewed_family_snapshot_json', 'command_key', 'owner_title', 'owner_date_kind', 'owner_date_start', 'owner_date_end', 'structural_boundary_json', 'owner_place_id', 'owner_place_name', 'owner_place_context', 'owner_latitude', 'owner_longitude'];
        const correctionValues = [revisionId, action, selected.runId, selected.journeyId, reviewedSupportJson, 'effective', nowMillis, prior?.revision_id ?? null, reviewedSnapshotJson, reviewedVisitsJson, reviewedFamilySnapshotsJson, commandKey, ownerClaim?.title ?? null, ownerClaim?.date?.kind ?? null, ownerClaim?.date?.kind === 'exact' ? ownerClaim.date.day : ownerClaim?.date?.kind === 'approximate' ? ownerClaim.date.startDay : null, ownerClaim?.date?.kind === 'approximate' ? ownerClaim.date.endDay : null, structuralBoundaryJson, ownerPlace?.id ?? null, ownerPlace?.name ?? null, ownerPlace?.context ?? null, ownerPlace?.anchor.latitude ?? null, ownerPlace?.anchor.longitude ?? null];
        await db.runAsync(`INSERT INTO journey_correction_revision (${correctionColumns.join(', ')}) VALUES (${correctionColumns.map(() => '?').join(', ')})`, ...correctionValues);
        // A place is an owner-controlled display override for the exact trip
        // currently on screen; it does not change its evidence, visits, or
        // grouping. Rebuilding here can rotate/split generated IDs before the
        // override is visible, incorrectly turning a valid save into a remap.
        // A later evidence-driven rebuild still remaps this immutable support
        // snapshot fail-closed, preserving the correction safety boundary.
        if (action === 'place') {
          await db.runAsync(
            `INSERT INTO journey_correction_application (revision_id, run_id, target_kind, journey_id, application_state) VALUES (?, ?, 'journey', ?, 'effective')`,
            revisionId, selected.runId, selected.journeyId,
          );
          const lifecycleBeforeCommit = await db.getFirstAsync<{ state: string }>('SELECT state FROM private_record_lifecycle WHERE record_id = 1');
          if (lifecycleBeforeCommit?.state !== 'connected') throw new Error('Private record is unavailable.');
          await db.execAsync('COMMIT');
          return { revisionId, state: 'claimed' as const, graph: null };
        }
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
      let stage: DurableRevealStage = 'DURABLE_OPEN';
      let db: Database | null = null;
      try {
        db = await open();
        // Atlas includes owner-entered journeys, so this is also a valid first
        // entry point on a device that has not opened the import repository.
        stage = 'DURABLE_SCHEMA';
        await ensureNativeImportSchema(db);
        stage = 'DURABLE_LIFECYCLE_READ';
        const lifecycle = await db.getFirstAsync<{ state: string }>('SELECT state FROM private_record_lifecycle WHERE record_id = 1');
        if (lifecycle?.state !== 'connected') throw new Error('Private record is not connected.');
        stage = 'DURABLE_RUN_READ';
        const completed = await db.getFirstAsync<{ run_id: number }>('SELECT MAX(run_id) AS run_id FROM reconstruction_run WHERE status = \'complete\'');
        if (!completed?.run_id) {
          stage = 'DURABLE_MANUAL_READ';
          const manualRows = await db.getAllAsync<ManualRow>('SELECT manual_id, command_key, owner_label, owner_context, latitude, longitude, date_kind, date_start, date_end FROM manual_journey ORDER BY date_start DESC, manual_id DESC');
          stage = 'DURABLE_PROJECTION';
          const manualJourneys = manualRows.filter((row) => typeof row.manual_id === 'string' && typeof row.owner_label === 'string' && typeof row.owner_context === 'string' && typeof row.date_start === 'string' && typeof row.date_end === 'string' && (row.date_kind === 'exact' || row.date_kind === 'approximate')).map((row) => ({ displayId: `manual:${row.manual_id}`, state: 'owner-entered' as const, anchor: coarseMapAnchor(row.latitude, row.longitude), years: [Number(row.date_start.slice(0, 4))], periodLabel: row.date_kind === 'exact' ? row.date_start : `${row.date_start} to ${row.date_end} (approximate)`, ordering: 'chronological' as const, label: `${row.owner_label} · ${row.owner_context}`, locationKind: 'owner-entered' as const }));
          return { journeys: manualJourneys, statistics: null };
        }
        stage = 'DURABLE_JOURNEY_READ';
        const rows = await db.getAllAsync<{ journey_id: string; run_id: number; journey_state: 'inferred' | 'possible-merge'; latitude: number | null; longitude: number | null; display_ordinal: number; year: number | null; ordering: 'chronological' | 'uncertain'; first_year: number | null; last_year: number | null; first_day: string | null; last_day: string | null }>(`
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
            MIN(CASE WHEN canonical.captured_day GLOB '????-??-??' THEN canonical.captured_day END) AS first_day,
            MAX(CASE WHEN canonical.captured_day GLOB '????-??-??' THEN canonical.captured_day END) AS last_day,
            CASE WHEN SUM(CASE WHEN journey_visit_row.ordering = 'uncertain' THEN 1 ELSE 0 END) > 0 THEN 'uncertain' ELSE 'chronological' END AS ordering
          FROM reconstruction_journey journey
          JOIN reconstruction_trip_qualification qualification ON qualification.run_id = journey.run_id AND qualification.journey_id = journey.journey_id
          LEFT JOIN journey_anchor anchor ON anchor.journey_id = journey.journey_id
          LEFT JOIN reconstruction_visit visit ON visit.run_id = journey.run_id AND visit.visit_id = anchor.visit_id
          LEFT JOIN reconstruction_place place ON place.run_id = journey.run_id AND place.place_id = visit.place_id
          LEFT JOIN canonical_evidence evidence ON evidence.evidence_id = place.representative_evidence_id
          LEFT JOIN reconstruction_link journey_visit ON journey_visit.run_id = journey.run_id AND journey_visit.link_kind = 'journey-visit' AND journey_visit.parent_id = journey.journey_id
          LEFT JOIN reconstruction_visit journey_visit_row ON journey_visit_row.run_id = journey_visit.run_id AND journey_visit_row.visit_id = journey_visit.child_id
          LEFT JOIN reconstruction_link visit_support ON visit_support.run_id = journey.run_id AND visit_support.link_kind = 'visit-support' AND visit_support.parent_id = journey_visit.child_id
          LEFT JOIN canonical_evidence canonical ON canonical.evidence_id = visit_support.child_id
          WHERE journey.run_id = ? AND qualification.classification IN ('AUTO_CONFIRMED', 'USER_CONFIRMED')
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
          numbered_journeys.first_year, numbered_journeys.last_year, numbered_journeys.first_day, numbered_journeys.last_day
        FROM numbered_journeys LEFT JOIN journey_years ON journey_years.journey_id = numbered_journeys.journey_id
        ORDER BY numbered_journeys.display_ordinal, journey_years.year
      `, completed.run_id);
        stage = 'DURABLE_MANUAL_READ';
        const manualRows = await db.getAllAsync<ManualRow>('SELECT manual_id, command_key, owner_label, owner_context, latitude, longitude, date_kind, date_start, date_end FROM manual_journey ORDER BY date_start DESC, manual_id DESC');
        stage = 'DURABLE_PROJECTION';
        const manualJourneys = manualRows.filter((row) => typeof row.manual_id === 'string' && typeof row.owner_label === 'string' && typeof row.owner_context === 'string' && typeof row.date_start === 'string' && typeof row.date_end === 'string' && (row.date_kind === 'exact' || row.date_kind === 'approximate')).map((row) => ({ displayId: `manual:${row.manual_id}`, state: 'owner-entered' as const, anchor: coarseMapAnchor(row.latitude, row.longitude), years: [Number(row.date_start.slice(0, 4))], periodLabel: row.date_kind === 'exact' ? row.date_start : `${row.date_start} to ${row.date_end} (approximate)`, ordering: 'chronological' as const, label: `${row.owner_label} · ${row.owner_context}`, locationKind: 'owner-entered' as const }));
        stage = 'DURABLE_COUNTRY_READ';
        const countryRows = await db.getAllAsync<{ journey_id: string; country_code: string }>(`
        SELECT DISTINCT journey_link.parent_id AS journey_id, place.country_code
        FROM reconstruction_link journey_link
        JOIN reconstruction_visit visit ON visit.run_id = journey_link.run_id AND visit.visit_id = journey_link.child_id
        JOIN reconstruction_place place ON place.run_id = visit.run_id AND place.place_id = visit.place_id
        JOIN reconstruction_trip_qualification qualification ON qualification.run_id = journey_link.run_id AND qualification.journey_id = journey_link.parent_id
        WHERE journey_link.run_id = ? AND journey_link.link_kind = 'journey-visit'
          AND qualification.classification IN ('AUTO_CONFIRMED', 'USER_CONFIRMED')
          AND place.country_dataset_version = ? AND place.country_code IS NOT NULL
      `, completed.run_id, NATURAL_EARTH_ADMIN_0_DATASET_VERSION);
        stage = 'DURABLE_OWNER_PLACE_READ';
        const ownerPlaceRows = await db.getAllAsync<{ journey_id: string; owner_place_name: string; owner_place_context: string; owner_latitude: number; owner_longitude: number }>(`
        SELECT application.journey_id, revision.owner_place_name, revision.owner_place_context, revision.owner_latitude, revision.owner_longitude
        FROM journey_correction_application application
        JOIN journey_correction_revision revision ON revision.revision_id = application.revision_id
        WHERE application.run_id = ? AND application.target_kind = 'journey'
          AND revision.action = 'place' AND revision.state = 'effective'
        ORDER BY revision.created_at_millis DESC`, completed.run_id);
        const ownerPlaceByJourney = new Map<string, { name: string; context: string; latitude: number; longitude: number }>();
        for (const row of ownerPlaceRows) {
          if (!ownerPlaceByJourney.has(row.journey_id) && row.owner_place_name && row.owner_place_context && Number.isFinite(row.owner_latitude) && Number.isFinite(row.owner_longitude)) {
            ownerPlaceByJourney.set(row.journey_id, { name: row.owner_place_name, context: row.owner_place_context, latitude: row.owner_latitude, longitude: row.owner_longitude });
          }
        }
        const labelsByJourney = new Map<string, string[]>();
        for (const row of countryRows) {
          const name = countryDisplayName(row.country_code);
          if (name) labelsByJourney.set(row.journey_id, [...new Set([...(labelsByJourney.get(row.journey_id) ?? []), name])].sort());
        }
        stage = 'DURABLE_STATISTICS_READ';
        const statistics = await db.getFirstAsync<{ journey_count: number; place_count: number; country_count: number; resolved_count: number }>(`
        WITH qualified_destinations AS (
          SELECT DISTINCT visit.place_id
          FROM reconstruction_link journey_visit
          JOIN reconstruction_trip_qualification qualification
            ON qualification.run_id = journey_visit.run_id AND qualification.journey_id = journey_visit.parent_id
          JOIN reconstruction_visit visit
            ON visit.run_id = journey_visit.run_id AND visit.visit_id = journey_visit.child_id
          WHERE journey_visit.run_id = ? AND journey_visit.link_kind = 'journey-visit'
            AND qualification.classification IN ('AUTO_CONFIRMED', 'USER_CONFIRMED')
        )
        SELECT
          (SELECT COUNT(*) FROM reconstruction_trip_qualification WHERE run_id = ? AND classification IN ('AUTO_CONFIRMED', 'USER_CONFIRMED')) AS journey_count,
          (SELECT COUNT(*) FROM qualified_destinations) AS place_count,
          (SELECT COUNT(DISTINCT place.country_code) FROM qualified_destinations destination JOIN reconstruction_place place ON place.run_id = ? AND place.place_id = destination.place_id WHERE place.country_code IS NOT NULL AND place.country_dataset_version = ?) AS country_count,
          (SELECT COUNT(*) FROM qualified_destinations destination JOIN reconstruction_place place ON place.run_id = ? AND place.place_id = destination.place_id WHERE place.country_dataset_version = ?) AS resolved_count
      `, completed.run_id, completed.run_id, completed.run_id, NATURAL_EARTH_ADMIN_0_DATASET_VERSION, completed.run_id, NATURAL_EARTH_ADMIN_0_DATASET_VERSION);
        stage = 'DURABLE_DIAGNOSTICS_READ';
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
        stage = 'DURABLE_DESTINATION_READ';
        const destinationLabels = await readDestinationLabels(db, completed.run_id);
        const pendingReviewJourneys = new Set<string>();
        stage = 'DURABLE_CORRECTION_READ';
        const pendingCandidates = (await db.getAllAsync<{ revision_id: string; reviewed_support_json: string; reviewed_family_snapshot_json: string | null }>(
          `SELECT candidate.revision_id, revision.reviewed_support_json, revision.reviewed_family_snapshot_json
         FROM journey_correction_candidate candidate
         JOIN journey_correction_revision revision ON revision.revision_id = candidate.revision_id
         WHERE candidate.state = 'pending_remap'`,
        )) ?? [];
        if (pendingCandidates.length) {
          stage = 'DURABLE_FAMILY_READ';
          const familyRows = await db.getAllAsync<EvidenceRow>('SELECT evidence_id, captured_at_millis, captured_day, has_precise_offset, availability, latitude, longitude, reported_accuracy_meters, platform_duplicate_family_id, source_origin, support_eligible, duplicate_tuple_version, duplicate_tuple_fingerprint FROM canonical_evidence');
          const families = resolveVerifiedDuplicateFamilies(familyRows ?? []);
          stage = 'DURABLE_SUPPORT_READ';
          const supportRows = await db.getAllAsync<{ journey_id: string; evidence_id: string }>(`
          SELECT DISTINCT journey.parent_id AS journey_id, support.child_id AS evidence_id
          FROM reconstruction_link journey
          JOIN reconstruction_link support ON support.run_id = journey.run_id
            AND support.link_kind = 'visit-support' AND support.parent_id = journey.child_id
          WHERE journey.run_id = ? AND journey.link_kind = 'journey-visit'`, completed.run_id);
          const journeysByEvidence = new Map<string, Set<string>>();
          for (const support of supportRows) {
            const ids = journeysByEvidence.get(support.evidence_id) ?? new Set<string>();
            ids.add(support.journey_id); journeysByEvidence.set(support.evidence_id, ids);
          }
          for (const candidate of pendingCandidates) {
            try {
              const reviewed = JSON.parse(candidate.reviewed_support_json) as unknown;
              if (!Array.isArray(reviewed) || !reviewed.every((key): key is string => typeof key === 'string')) continue;
              const snapshots = correctionFamilySnapshots(candidate.reviewed_family_snapshot_json, candidate.revision_id);
              for (const key of reviewed) for (const journeyId of journeysByEvidence.get(resolveReviewedSupportKey(key, candidate.revision_id, snapshots, families)) ?? []) pendingReviewJourneys.add(journeyId);
            } catch {
              // A malformed candidate remains protected but cannot be attached to
              // a current journey without a verified support mapping.
            }
          }
        }
        stage = 'DURABLE_PROJECTION';
        displayedJourneys.clear();
        for (const row of rows) {
          const displayId = opaqueJourneyDisplayId(row.journey_id);
          displayedJourneys.set(displayId, { runId: row.run_id, journeyId: row.journey_id });
          const existing = journeys.get(displayId);
          if (existing) { if (row.year !== null) existing.years.push(row.year); continue; }
          const names = labelsByJourney.get(row.journey_id) ?? [];
          const supportedLabel = destinationLabels.get(row.journey_id);
          const ownerPlace = ownerPlaceByJourney.get(row.journey_id);
          const label = ownerPlace ? `${ownerPlace.name}, ${ownerPlace.context}` : supportedLabel && supportedLabel !== 'Private journey' ? supportedLabel : names.length === 1 ? names[0] : names.length === 2 ? `${names[0]} & ${names[1]}` : names.length > 2 ? 'Multi-country trip' : 'Private journey';
          journeys.set(displayId, { displayId, state: row.journey_state, anchor: ownerPlace ? coarseMapAnchor(ownerPlace.latitude, ownerPlace.longitude) : coarseMapAnchor(row.latitude, row.longitude), years: row.year === null ? [] : [row.year], periodLabel: monthRangeLabel(row.first_day, row.last_day, row.first_year, row.last_year), ordering: row.ordering, label, locationKind: ownerPlace ? 'owner-confirmed' : 'inferred', needsReview: pendingReviewJourneys.has(row.journey_id) });
        }
        return { journeys: [...journeys.values(), ...manualJourneys], statistics: statistics ? { journeyCount: statistics.journey_count, placeCount: statistics.place_count, supportedCountryCount: statistics.country_count, countryStatus: statistics.resolved_count === statistics.place_count ? 'supported' : 'unavailable' } : null,
          diagnostics: diagnostics ? { assessed: diagnostics.assessed, supported: diagnostics.supported, places: diagnostics.places, visits: diagnostics.visits, missingDay: diagnostics.missing_day, invalidDay: diagnostics.invalid_day, unavailable: diagnostics.unavailable, duplicateConflict: diagnostics.duplicate_conflict, insufficientLocation: diagnostics.insufficient_location, excluded: diagnostics.excluded } : null };
      } catch (error) {
        if (db && stage === 'DURABLE_MANUAL_READ' && error instanceof Error && error.message.toLowerCase().includes('no such column')) {
          try {
            // Only row presence is inspected. No owner-entered value leaves
            // SQLite, and this diagnostic path never repairs or writes data.
            const manualCount = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM manual_journey');
            if (manualCount?.count === 0) stage = 'DURABLE_MANUAL_EMPTY_LAYOUT';
            else if (manualCount && manualCount.count > 0) stage = 'DURABLE_MANUAL_RETAINED_LAYOUT';
          } catch {
            // A failed optional probe must not mask the original read error.
          }
        }
        throw new DurableRevealStageError(stage, error);
      }
    },
    async rebuild(nowMillis = Date.now(), consumeQueuedChanges = false, canUseSource: () => Promise<boolean> = async () => true, transactionAlreadyOpen = false): Promise<ReconstructionGraph> {
      const db = await open();
      // Catch-up can arrive before a durable-reveal read has had a chance to
      // gate a retained device through the additive import schema. Do that
      // once before this direct writer begins; never attempt a migration
      // inside a caller-owned correction transaction.
      if (!transactionAlreadyOpen) await ensureNativeImportSchema(db);
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
        const rows = await db.getAllAsync<EvidenceRow>('SELECT evidence_id, media_type, captured_at_millis, captured_day, has_precise_offset, availability, latitude, longitude, reported_accuracy_meters, platform_duplicate_family_id, source_origin, support_eligible, duplicate_tuple_version, duplicate_tuple_fingerprint FROM canonical_evidence');
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
        const configuredHomeAreas = await db.getAllAsync<{ area_id: string; latitude: number; longitude: number; effective_start_day: string | null; effective_end_day: string | null; radius_meters: number }>(
          'SELECT area_id, latitude, longitude, effective_start_day, effective_end_day, radius_meters FROM configured_home_area ORDER BY area_id',
        );
        const evidence = applyOwnerConfiguredHomeAreas(rows.map((row) => ({
          id: row.evidence_id, capturedAtMillis: row.captured_at_millis,
          capturedDay: row.captured_day,
          hasPreciseOffset: row.has_precise_offset === 1, latitude: row.latitude, longitude: row.longitude, reportedAccuracyMeters: row.reported_accuracy_meters,
          availability: row.availability, duplicateFamilyId: families.keyForEvidence(row.evidence_id).startsWith('F:') ? families.keyForEvidence(row.evidence_id).slice(2) : (row.platform_duplicate_family_id ?? null), duplicateConflict: families.conflictForEvidence(row.evidence_id), supportEligible: families.supportEligible(row.evidence_id), sourceOrigin: row.source_origin, excluded: excluded.has(row.evidence_id),
        })), configuredHomeAreas.map((area) => ({ id: area.area_id, latitude: area.latitude, longitude: area.longitude, effectiveStartDay: area.effective_start_day, effectiveEndDay: area.effective_end_day, radiusMeters: area.radius_meters })));
        const corrections = await db.getAllAsync<JourneyCorrectionRevision>(`SELECT revision_id, action, source_run_id, reviewed_support_json, reviewed_visits_json, reviewed_family_snapshot_json, structural_boundary_json
          FROM journey_correction_revision WHERE state = 'effective'`);
        const memoryCorrections = await db.getAllAsync<MemoryCorrectionRevision>(`SELECT revision_id, action, source_evidence_id, reviewed_support_json, reviewed_family_snapshot_json, created_at_millis
          FROM journey_memory_correction_revision WHERE state = 'effective' ORDER BY created_at_millis, revision_id`);
        // Resolve correction lineage against the unconstrained graph first.
        // A split or ambiguous reviewed support set aborts this transaction
        // before a newly generated graph can bypass the owner decision.
        const evidenceWithStructuralBoundaries = applyStructuralBoundaries(evidence, corrections, families);
        const nonStructuralCorrections = corrections.filter((correction) => correction.action !== 'split' && correction.action !== 'merge');
        const baselineGraph = reconstructV1(evidenceWithStructuralBoundaries);
        // Journey-scoped corrections can be ambiguous before the final
        // continuity graph exists. Preserve them as review candidates rather
        // than letting an intermediate mapper prevent the Atlas from being
        // rebuilt. Grouping and structural corrections still fail closed.
        const baseline = mapFinalCorrectionApplications(baselineGraph, nonStructuralCorrections, families);
        const confirmedGraph = reconstructV1(evidenceWithStructuralBoundaries, { journeyGroupingConstraints: rejectionGroupingConstraints(nonStructuralCorrections, families) });
        const confirmed = mapFinalCorrectionApplications(
          confirmedGraph,
          nonStructuralCorrections.filter((correction) => correction.action === 'confirm' || correction.action === 'remove-visit'),
          families,
        );
        // A memory decision has two independent identities: the particular
        // canonical photo and the complete reviewed support of its target.
        // Reuse the exact support mapper for the target; the photo itself is
        // checked below against the current canonical snapshot.  No inferred
        // visit/place/country support is changed by this overlay.
        const memoryMatches = applyJourneyCorrections(confirmedGraph, memoryCorrections.map((correction) => ({
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
        const structurallyMerged = applyOwnerJourneyMerges(confirmedGraph, corrections, families);
        // Do not remap an owner-reviewed graph implicitly.  Exact correction
        // matches pin only their own journeys; unrelated corrections must not
        // freeze a later, unreviewed continuous away episode.
        const protectedJourneyIds = new Set([
          ...baseline.matches.values(),
          ...confirmed.matches.values(),
          ...memoryMatches.values(),
        ]);
        const continuityGraph = constructCanonicalV11Graph(structurallyMerged, evidence, protectedJourneyIds, configuredHomeAreas.map((area) => ({
          id: area.area_id,
          latitude: area.latitude,
          longitude: area.longitude,
          effectiveStartDay: area.effective_start_day,
          effectiveEndDay: area.effective_end_day,
          radiusMeters: area.radius_meters,
        })));
        const graph = {
          ...continuityGraph,
          memberships: [
            ...continuityGraph.memberships.filter((membership) => {
              const supportUnit = families.keyForEvidence(membership.evidenceId);
              return !ownerPrimary.has(supportUnit) && !rejectedTargets.has(`${supportUnit}:${membership.journeyId}`);
            }),
            ...[...ownerPrimary.entries()].map(([supportUnit, journeyId]) => ({ evidenceId: resolveReviewedSupportKey(supportUnit, 'memory-primary', families.snapshotsFor([supportUnit]), families), journeyId, state: 'owner' as const, reason: 'owner-primary' as const })),
          ],
        };
        // `baseline` and `confirmed` intentionally run before the continuity
        // pass so those corrections protect their reviewed support. The final
        // Atlas projection can then merge otherwise-unreviewed episodes and
        // generate a different journey ID. Store correction applications
        // against that final graph, not the pre-continuity ID, or a saved
        // owner place will have no visible journey to override.
        const { matches: finalMatches, pending: finalPendingRemaps } = mapFinalCorrectionApplications(graph, corrections, families);
        const pendingFinalRemaps = [...new Map([...baseline.pending, ...confirmed.pending, ...finalPendingRemaps].map((correction) => [correction.revision_id, correction])).values()];
        const evidenceRevision = (await db.getFirstAsync<{ canonical_evidence_revision: number | null }>('SELECT canonical_evidence_revision FROM private_history_record WHERE record_id = 1'))?.canonical_evidence_revision ?? 0;
        const correctionRevision = (await db.getFirstAsync<{ revision: number | null }>('SELECT MAX(revision) AS revision FROM correction_overlays'))?.revision ?? 0;
        const revision = Math.max(evidenceRevision, correctionRevision);
        await db.runAsync('INSERT INTO reconstruction_run (rule_version, evidence_revision, status, completed_at_millis) VALUES (?, ?, ?, ?)', RECONSTRUCTION_RULE_VERSION, revision, 'complete', nowMillis);
        const runId = (await db.getFirstAsync<{ run_id: number }>('SELECT MAX(run_id) AS run_id FROM reconstruction_run'))?.run_id;
        if (runId === undefined) throw new Error('Could not create reconstruction run.');
        for (const correction of corrections) {
          const targetKind = correction.action === 'reject' || correction.action === 'split' || correction.action === 'merge' ? 'grouping-constraint' : 'journey';
          const journeyId = targetKind === 'journey' ? finalMatches.get(correction.revision_id) : null;
          if (targetKind === 'journey' && !journeyId) continue;
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
        for (const correction of pendingFinalRemaps) {
          const existing = await db.getFirstAsync<{ candidate_id: string }>(
            "SELECT candidate_id FROM journey_correction_candidate WHERE revision_id = ? AND state = 'pending_remap' LIMIT 1",
            correction.revision_id,
          );
          if (!existing) await db.runAsync(
            `INSERT INTO journey_correction_candidate (candidate_id, revision_id, base_run_id, state, reason, created_at_millis)
             VALUES (?, ?, ?, 'pending_remap', ?, ?)`,
            `candidate-${correction.revision_id}-${nowMillis}-${Math.random().toString(36).slice(2)}`,
            correction.revision_id, correction.source_run_id ?? runId,
            'Reviewed support now spans more than one rebuilt journey.', nowMillis,
          );
        }
        for (const correction of corrections.filter((candidate) => finalMatches.has(candidate.revision_id))) await db.runAsync(
          "UPDATE journey_correction_candidate SET state = 'resolved' WHERE revision_id = ? AND state = 'pending_remap'",
          correction.revision_id,
        );
        await db.runAsync('DELETE FROM reconstruction_trip_qualification'); await db.runAsync('DELETE FROM reconstruction_disposition'); await db.runAsync('DELETE FROM reconstruction_link'); await db.runAsync('DELETE FROM reconstruction_journey'); await db.runAsync('DELETE FROM reconstruction_visit'); await db.runAsync('DELETE FROM reconstruction_place');
        const evidenceById = new Map(evidence.map((item) => [item.id, item]));
        const links = reconstructionRowWriter(db, 'reconstruction_link (run_id, link_kind, parent_id, child_id)', 4);
        for (const place of graph.places) {
          const countryCode = resolvePlaceCountryCode(place, evidenceById);
          await db.runAsync('INSERT INTO reconstruction_place (place_id, run_id, representative_evidence_id, uncertainty_json, country_code, country_dataset_version) VALUES (?, ?, ?, ?, ?, ?)', place.id, runId, place.representativeId, JSON.stringify(place.uncertainty), countryCode, NATURAL_EARTH_ADMIN_0_DATASET_VERSION);
          for (const evidenceId of place.memberIds) await links.add([runId, 'place-support', place.id, evidenceId]);
        }
        for (const visit of graph.visits) { await db.runAsync('INSERT INTO reconstruction_visit (visit_id, run_id, place_id, ordering) VALUES (?, ?, ?, ?)', visit.id, runId, visit.placeId, visit.order); for (const evidenceId of visit.evidenceIds) await links.add([runId, 'visit-support', visit.id, evidenceId]); }
        const confirmedJourneyIds = new Set(corrections.filter((correction) => correction.action === 'confirm').map((correction) => finalMatches.get(correction.revision_id)).filter((id): id is string => Boolean(id)));
        const mediaByEvidence = new Map(rows.map((row) => [row.evidence_id, row.media_type ?? 'image'] as const));
        for (const journey of graph.journeys) {
          await db.runAsync('INSERT INTO reconstruction_journey (journey_id, run_id, journey_state) VALUES (?, ?, ?)', journey.id, runId, journey.state);
          const ownerConfirmed = confirmedJourneyIds.has(journey.id);
          const qualification = ownerConfirmed
            ? { classification: 'USER_CONFIRMED' as const, score: 0, path: null, reasons: ['owner-confirmed'] }
            : qualifyGraphJourneyV11(graph, journey.id, evidence, mediaByEvidence);
          await db.runAsync(
            'INSERT INTO reconstruction_trip_qualification (run_id, journey_id, classification, score, qualification_path, reasons_json) VALUES (?, ?, ?, ?, ?, ?)',
            runId, journey.id, qualification.classification, qualification.score, qualification.path,
            JSON.stringify(qualification.reasons),
          );
          for (const visitId of journey.visitIds) await links.add([runId, 'journey-visit', journey.id, visitId]);
        }
        for (const membership of graph.memberships) await links.add([runId, `membership:${membership.state}:${membership.reason}`, membership.journeyId, membership.evidenceId]);
        for (const merge of graph.possibleMerges) await links.add([runId, `possible-merge:${merge.reason}`, merge.fromJourneyId, merge.toJourneyId]);
        await links.flush();
        const dispositions = reconstructionRowWriter(db, 'reconstruction_disposition (run_id, evidence_id, disposition_state, reasons_json)', 4);
        for (const disposition of graph.dispositions) await dispositions.add([runId, disposition.evidenceId, disposition.state, JSON.stringify(disposition.reasons)]);
        await dispositions.flush();
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
      let token: number | null = null;
      let primaryFailure: unknown = null;
      let stage: ReconciliationStage = 'LEASE_OPEN';
      try {
        // This path reads versioned maintenance/reconciliation lease tables
        // before it delegates to rebuild. Gate it here, rather than relying
        // on the later rebuild gate after a retained local record has already
        // failed a lease read.
        await ensureNativeImportSchema(await open());
        token = await acquireLease(nowMillis, (next) => { stage = next; });
        if (token === null) throw new Error('Local reconciliation is already running; queued changes remain pending.');
        stage = 'QUEUE_READ';
        const queued = (await (await open()).getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM maintenance_change_queue'))?.count ?? 0;
        if (queued === 0) {
          await saveNoQueuedOutcome(nowMillis);
          return { graph: { ruleVersion: RECONSTRUCTION_RULE_VERSION, places: [], visits: [], journeys: [], possibleMerges: [], dispositions: [], memberships: [] } as ReconstructionGraph, newJourneyCount: 0, updatedJourneyCount: 0 };
        }
        stage = 'REBUILD';
        const graph = await this.rebuild(nowMillis, true, canUseSource);
        stage = 'OUTCOME_READ';
        const outcome = await (await open()).getFirstAsync<{ new_journey_count: number; updated_journey_count: number }>(
          'SELECT new_journey_count, updated_journey_count FROM reconciliation_state WHERE record_id = 1',
        );
        return { graph, newJourneyCount: outcome?.new_journey_count ?? 0, updatedJourneyCount: outcome?.updated_journey_count ?? 0 };
      } catch (error) {
        // A fresh reconciliation or maintenance lease is expected contention,
        // not a failed run. Preserve the prior result without writing outcome state.
        if (error instanceof Error && error.message.includes('already running')) throw error;
        primaryFailure = reconciliationStageError(stage, error);
        const sourceError = error instanceof ReconciliationStageError ? error.originalError : error;
        const restricted = sourceError instanceof Error && (sourceError.message.includes('not connected') || sourceError.message.includes('not permitted'));
        const pending = sourceError instanceof Error && (sourceError.message.includes('need owner review') || sourceError.message.includes('needs owner remap'));
        try {
          stage = 'OUTCOME_SAVE';
          if (sourceError instanceof JourneyCorrectionRemapRequiredError) await recordPendingCorrectionRemap(sourceError.revisionId);
          await saveOutcome(restricted ? 'restricted' : pending ? 'pending' : 'error', restricted ? 'Local journey updates are waiting for connected private access.' : pending ? 'An owner correction needs review before queued local changes can be reconciled.' : 'Local journey reconciliation did not finish. Queued changes remain pending.');
        } catch {
          // The original reconstruction failure is more useful than a best-effort status-write failure.
        }
        throw primaryFailure;
      } finally {
        if (token !== null) {
          try {
            await releaseLease(token);
          } catch (error) {
            if (primaryFailure === null) throw reconciliationStageError('LEASE_RELEASE', error);
          }
        }
      }
    },
  };
}
