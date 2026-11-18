import type { OwnerConfiguredHomeArea, ReconstructionEvidence, ReconstructionGraph, TripDetectorEvidence } from './types';
import type { JourneyGroupingConstraint } from './engine';
import { buildV11Episodes, effectiveConfiguredHomeDistanceV11, qualifyTripV11 } from './engine-v1-1';
import { resolveCountry } from './country-resolver';
export type JourneyCorrectionAction = 'confirm' | 'reject' | 'claim' | 'place' | 'split' | 'merge' | 'remove-visit';
export type EvidenceRow = { evidence_id: string; media_type?: 'image' | 'video'; captured_at_millis: number | null; captured_day: string | null; has_precise_offset: number; availability: ReconstructionEvidence['availability']; latitude: number | null; longitude: number | null; reported_accuracy_meters: number | null; platform_duplicate_family_id?: string | null; source_origin?: string | null; support_eligible?: number | null; duplicate_tuple_version?: number | null; duplicate_tuple_fingerprint?: string | null };
export type JourneyCorrectionRevision = { revision_id: string; action: JourneyCorrectionAction; source_run_id?: number; reviewed_support_json: string; reviewed_visits_json?: string; reviewed_family_snapshot_json?: string | null; structural_boundary_json?: string | null };

export function metersBetween(a: ReconstructionEvidence, b: ReconstructionEvidence) {
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
export function qualifyGraphJourneyV11(graph: ReconstructionGraph, journeyId: string, evidence: ReconstructionEvidence[], mediaByEvidence: Map<string, 'image' | 'video'>, homeAreas: OwnerConfiguredHomeArea[] = []) {
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
  const homeCountry = new Map(homeAreas.map((area) => [area.id, resolveCountry({ latitude: area.latitude, longitude: area.longitude })]));
  const detectorEvidence: TripDetectorEvidence[] = candidateEvidence.map((item) => {
    const visit = candidateVisits.find((candidateVisit) => candidateVisit.evidenceIds.includes(item.id));
    const configuredDistance = effectiveConfiguredHomeDistanceV11(item, homeAreas);
    const activeHomes = configuredDistance === null ? [] : homeAreas.filter((area) => effectiveConfiguredHomeDistanceV11(item, [area]) !== null);
    const country = activeHomes.length ? resolveCountry(item) : null;
    const foreignToEveryBase = country?.status === 'resolved' && activeHomes.every((area) => {
      const home = homeCountry.get(area.id);
      return home?.status === 'resolved' && home.code !== country.code;
    });
    const distance = configuredDistance ?? (baseEvidence ? metersBetween(item, baseEvidence) : null);
    return {
      ...item, mediaType: mediaByEvidence.get(item.id) ?? 'image', captureLike: true,
      reliableLocation: item.reportedAccuracyMeters === null || item.reportedAccuracyMeters <= 1_000,
      originalLocalDay: item.capturedDay, sessionId: item.capturedDay ?? null,
      supportPlaceId: visit?.placeId ?? null, origin: 'capture-like',
      effectiveBaseDistanceMeters: distance, foreignToEveryBase,
      rareDestination: configuredDistance === null && Boolean(base && candidateEvidence.length < base.memberIds.length / 2),
    };
  });
  return qualifyTripV11(journeyId, detectorEvidence, { baseContext: detectorEvidence.some((item) => item.effectiveBaseDistanceMeters !== null) });
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
/** A legacy group may follow only one successor containing all of its visits.
 * A split, removed support or overlapping target remains unresolved. */
export function uniqueJourneySuccessors(prior: ReconstructionGraph, next: ReconstructionGraph): Map<string, string> {
  const targetsByVisit = new Map<string, Set<string>>();
  for (const journey of next.journeys) for (const visitId of journey.visitIds) {
    const targets = targetsByVisit.get(visitId) ?? new Set<string>();
    targets.add(journey.id); targetsByVisit.set(visitId, targets);
  }
  const mappings = new Map<string, string>();
  for (const journey of prior.journeys) {
    if (!journey.visitIds.length) continue;
    const targets = targetsByVisit.get(journey.visitIds[0]);
    if (!targets) continue;
    const matches = [...targets].filter(target => journey.visitIds.every(visit => targetsByVisit.get(visit)?.has(target)));
    if (matches.length === 1) mappings.set(journey.id, matches[0]);
  }
  return mappings;
}

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

  const evidenceById = new Map<string, ReconstructionEvidence>();
  for (const item of evidence) if (!evidenceById.has(item.id)) evidenceById.set(item.id, item);
  const explicitHomes = configuredHomeAreas.length > 0;
  const learnedBaseEvidence = graph.places
    .map((place) => ({ place, days: new Set(place.memberIds.map((id) => evidenceById.get(id)?.capturedDay).filter((day): day is string => Boolean(day))).size }))
    .filter((candidate) => candidate.days >= 12)
    .map((candidate) => candidate.place.memberIds.map((id) => evidenceById.get(id))
      .filter((item): item is ReconstructionEvidence => item !== undefined)
      .find((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude)))
    .filter((item): item is ReconstructionEvidence => Boolean(item));
  const learnedBasePlaceIds = new Set(graph.places.filter((place) => learnedBaseEvidence.some((base) => place.memberIds.includes(base.id))).map((place) => place.id));
  const normalize = (item: ReconstructionEvidence): TripDetectorEvidence => {
    const visitId = visitByEvidence.get(item.id);
    const supportPlaceId = visitId ? placeByVisit.get(visitId) ?? null : null;
    const configuredDistance = effectiveConfiguredHomeDistanceV11(item, configuredHomeAreas);
    const learnedDistances = configuredDistance === null ? learnedBaseEvidence.map((base) => metersBetween(item, base)).filter((distance): distance is number => distance !== null) : [];
    const distance = configuredDistance ?? (learnedDistances.length ? Math.min(...learnedDistances) : null);
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
    usualAreaContext: item.usualAreaContext || (configuredDistance === null && Boolean(supportPlaceId && learnedBasePlaceIds.has(supportPlaceId))),
    effectiveBaseDistanceMeters: distance,
    foreignToEveryBase: distance === null ? null : distance >= 50_000,
  };
  };
  const candidates = buildV11Episodes(unreviewedEvidence.map(normalize), {
    baseContext: explicitHomes || learnedBaseEvidence.length > 0,
    ownerHomeAreas: configuredHomeAreas,
    homeObservations: evidence.filter((item) => !visitByEvidence.has(item.id)).map(normalize),
  });

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
  const journeySuccessors = uniqueJourneySuccessors(graph, { ...graph, journeys: replacementJourneys });
  return {
    ...graph,
    journeys: replacementJourneys.sort((left, right) => left.id.localeCompare(right.id)),
    memberships: graph.memberships.map((membership) => ({
      ...membership,
      journeyId: visitToJourney.get(visitByEvidence.get(membership.evidenceId) ?? '') ?? journeySuccessors.get(membership.journeyId) ?? membership.journeyId,
    })),
    possibleMerges: graph.possibleMerges.filter((merge) => protectedJourneyIds.has(merge.fromJourneyId) || protectedJourneyIds.has(merge.toJourneyId)),
  };
}

export class JourneyCorrectionRemapRequiredError extends Error {
  constructor(readonly revisionId: string) {
    super('Journey correction needs owner remap.');
  }
}

export type FamilySnapshot = { memberIds: string[]; tupleVersion: number; tupleFingerprint: string };
export type FamilyResolver = {
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

export function correctionFamilySnapshots(value: string | null | undefined, revisionId: string): Record<string, FamilySnapshot> {
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

export function resolveReviewedSupportKey(key: string, revisionId: string, snapshots: Record<string, FamilySnapshot>, families?: FamilyResolver) {
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
export function applyOwnerJourneyMerges(graph: ReconstructionGraph, corrections: JourneyCorrectionRevision[], families?: FamilyResolver, protectedJourneyIds?: Set<string>) {
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
    protectedJourneyIds?.add(left.id);
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
  // Keep row indices rather than IDs: duplicate visit rows must still count as
  // separate candidates and retain the existing ambiguity guard.
  const visitsByEvidence = new Map<string, Set<number>>();
  if(corrections.length)graph.visits.forEach((visit,index)=>{
    for(const id of visit.evidenceIds){const indices=visitsByEvidence.get(id)??new Set<number>();indices.add(index);visitsByEvidence.set(id,indices);}
  });
  const matches = new Map<string, string>();
  const reviewedVisitsByRevision = new Map<string, string[]>();
  for (const correction of corrections) {
    let parsed: unknown;
    try { parsed = JSON.parse(correction.reviewed_support_json); } catch { throw new JourneyCorrectionRemapRequiredError(correction.revision_id); }
    if (!Array.isArray(parsed) || !parsed.every((item): item is string => typeof item === 'string')) throw new JourneyCorrectionRemapRequiredError(correction.revision_id);
    const reviewed = parsed;
    const reviewedSet = new Set(reviewed);
    if (!reviewed.length || new Set(reviewed).size !== reviewed.length
      || reviewed.some((key, index) => (!key.startsWith('E:') && !key.startsWith('F:')) || key.length <= 2 || (index > 0 && reviewed[index - 1].localeCompare(key) >= 0))) throw new JourneyCorrectionRemapRequiredError(correction.revision_id);
    const familySnapshots = correctionFamilySnapshots(correction.reviewed_family_snapshot_json, correction.revision_id);
    const evidenceForKey = (key: string) => resolveReviewedSupportKey(key, correction.revision_id, familySnapshots, families);
    let reviewedVisits: string[][];
    try { reviewedVisits = correction.reviewed_visits_json ? JSON.parse(correction.reviewed_visits_json) : [reviewed]; } catch { throw new JourneyCorrectionRemapRequiredError(correction.revision_id); }
    if (!Array.isArray(reviewedVisits)) throw new JourneyCorrectionRemapRequiredError(correction.revision_id);
    const reviewedVisitKeys = reviewedVisits.flat();
    const reviewedVisitSet = new Set(reviewedVisitKeys);
    if (!reviewedVisits.length
      || !reviewedVisits.every((group) => Array.isArray(group) && group.length
        && group.every((key) => typeof key === 'string' && reviewedSet.has(key))
        && group.every((key, index) => index === 0 || group[index - 1].localeCompare(key) < 0))
      || reviewedVisitKeys.length !== reviewed.length
      || reviewedVisitSet.size !== reviewed.length
      || reviewed.some((key) => !reviewedVisitSet.has(key))) throw new JourneyCorrectionRemapRequiredError(correction.revision_id);
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
      const candidateRows = [...(visitsByEvidence.get(evidenceIds[0])??[])].filter(index=>evidenceIds.every(id=>visitsByEvidence.get(id)?.has(index)));
      const candidates = candidateRows.map(index=>graph.visits[index]);
      if (candidates.length !== 1 || !candidate.visitIds.includes(candidates[0].id)) throw new JourneyCorrectionRemapRequiredError(correction.revision_id);
      // A reviewed support unit must occur in exactly one current visit.  A
      // duplicate within the same successor journey is still ambiguous; the
      // journey-level lookup above cannot detect that split on its own.
      if (evidenceIds.some((evidenceId) => [...(visitsByEvidence.get(evidenceId)??[])].some(index=>graph.visits[index].id!==candidates[0].id))) {
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

export function canAwaitJourneyCorrectionReview(correction: JourneyCorrectionRevision) {
  return correction.action === 'confirm' || correction.action === 'claim' || correction.action === 'place';
}

export function dependsOnPrivacyExcludedSupport(correction: Pick<JourneyCorrectionRevision, 'revision_id' | 'reviewed_support_json' | 'reviewed_family_snapshot_json'>, excluded: ReadonlySet<string>) {
  if (!excluded.size) return false;
  let reviewed: unknown;
  try { reviewed = JSON.parse(correction.reviewed_support_json); }
  catch { throw new JourneyCorrectionRemapRequiredError(correction.revision_id); }
  if (!Array.isArray(reviewed) || !reviewed.every((key): key is string => typeof key === 'string')) throw new JourneyCorrectionRemapRequiredError(correction.revision_id);
  const snapshots = correctionFamilySnapshots(correction.reviewed_family_snapshot_json, correction.revision_id);
  return reviewed.some((key) => key.startsWith('E:') ? excluded.has(key.slice(2))
    : key.startsWith('F:') && snapshots[key]?.memberIds.some((id) => excluded.has(id)));
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

export function rejectionGroupingConstraints(corrections: JourneyCorrectionRevision[], families?: FamilyResolver): JourneyGroupingConstraint[] {
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
