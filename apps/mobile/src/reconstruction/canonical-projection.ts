import { reconstructV1 } from './engine';
import { applyOwnerConfiguredHomeAreas } from './engine-v1-1';
import { uniqueJourneySuccessors } from './canonical-core';
import type { ReconstructionGraph } from './types';
import { resolveVerifiedDuplicateFamilies, applyStructuralBoundaries, mapFinalCorrectionApplications, rejectionGroupingConstraints, dependsOnPrivacyExcludedSupport, applyJourneyCorrections, applyOwnerJourneyMerges, constructCanonicalV11Graph, resolveReviewedSupportKey, JourneyCorrectionRemapRequiredError, type EvidenceRow, type JourneyCorrectionRevision } from './canonical-core';

export type CanonicalHomeRow = { area_id:string;latitude:number;longitude:number;effective_start_day:string|null;effective_end_day:string|null;radius_meters:number };
export type CanonicalMemoryCorrection = { revision_id:string;action:'assign'|'move'|'reject'|'unassign';source_evidence_id:string;reviewed_support_json:string;reviewed_family_snapshot_json?:string|null;created_at_millis:number };
export type CanonicalProjectionInput = { rows:EvidenceRow[];excluded:Set<string>;privateFilter:{excluded:Set<string>};configuredHomeAreas:CanonicalHomeRow[];storedCorrections:JourneyCorrectionRevision[];storedMemoryCorrections:CanonicalMemoryCorrection[] };
export type CanonicalProjectionStage = 'REBUILD_PROCESSING'|'REBUILD_BASELINE_GRAPH'|'REBUILD_BASELINE_MAPPING'|'REBUILD_CONSTRAINED_GRAPH'|'REBUILD_CONFIRMED_MAPPING'|'REBUILD_MEMORY_OVERLAY'|'REBUILD_OWNER_MERGE'|'REBUILD_CONTINUITY'|'REBUILD_MEMBERSHIP'|'REBUILD_FINAL_MAPPING';

function retainProtectedJourneys(automatic: ReconstructionGraph, reviewed: ReconstructionGraph, protectedIds: ReadonlySet<string>): ReconstructionGraph {
  const journeys = reviewed.journeys.filter((journey) => protectedIds.has(journey.id));
  const visitIds = new Set(journeys.flatMap((journey) => journey.visitIds));
  const visits = reviewed.visits.filter((visit) => visitIds.has(visit.id));
  const placeIds = new Set(visits.map((visit) => visit.placeId));
  const places = reviewed.places.filter((place) => placeIds.has(place.id));
  const automaticPlaceIds = new Set(automatic.places.map((place) => place.id));
  return {
    ...automatic,
    journeys: [...automatic.journeys, ...journeys],
    visits: [...automatic.visits, ...visits],
    places: [...automatic.places, ...places.filter((place) => !automaticPlaceIds.has(place.id))],
    memberships: [...automatic.memberships, ...reviewed.memberships.filter((membership) => protectedIds.has(membership.journeyId))],
  };
}

/** The same canonical projection is called by native persistence and account workers. */
export async function projectCanonicalHistory({rows,excluded,privateFilter,configuredHomeAreas,storedCorrections,storedMemoryCorrections}:CanonicalProjectionInput,profile:{next(stage:CanonicalProjectionStage):void}={next:()=>{}},afterMemoryMapping?:(corrections:CanonicalMemoryCorrection[])=>Promise<void>) {
  const families = resolveVerifiedDuplicateFamilies(rows);
  const homeAreas = configuredHomeAreas.map((area) => ({ id: area.area_id, latitude: area.latitude, longitude: area.longitude, effectiveStartDay: area.effective_start_day, effectiveEndDay: area.effective_end_day, radiusMeters: area.radius_meters }));
  const evidence = applyOwnerConfiguredHomeAreas(rows.map((row) => ({
    id: row.evidence_id, capturedAtMillis: row.captured_at_millis,
    capturedDay: row.captured_day,
    hasPreciseOffset: row.has_precise_offset === 1, latitude: row.latitude, longitude: row.longitude, reportedAccuracyMeters: row.reported_accuracy_meters,
    availability: row.availability, duplicateFamilyId: families.keyForEvidence(row.evidence_id).startsWith('F:') ? families.keyForEvidence(row.evidence_id).slice(2) : (row.platform_duplicate_family_id ?? null), duplicateConflict: families.conflictForEvidence(row.evidence_id), supportEligible: families.supportEligible(row.evidence_id), sourceOrigin: row.source_origin, excluded: excluded.has(row.evidence_id),
  })), homeAreas);
  const homeUnits = new Set(evidence.filter((item) => item.configuredHomeAreaId).map((item) => families.keyForEvidence(item.id)));
  const corrections = storedCorrections.filter((correction) =>
    !['split', 'merge', 'remove-visit', 'reject'].includes(correction.action)
    || !dependsOnPrivacyExcludedSupport(correction, privateFilter.excluded));
  // Privacy temporarily overrides activation, never the immutable owner
  // revision. Restore makes this same correction eligible on the next
  // rebuild. Unrelated remap/structural guards remain authoritative.
  const memoryCorrections = storedMemoryCorrections.filter((correction) => {
    if (privateFilter.excluded.has(correction.source_evidence_id)) return false;
    return !dependsOnPrivacyExcludedSupport(correction, privateFilter.excluded);
  });
  // Resolve correction lineage against the unconstrained graph first.
  // A split or ambiguous reviewed support set aborts this transaction
  // before a newly generated graph can bypass the owner decision.
  profile.next('REBUILD_PROCESSING');
  const evidenceWithStructuralBoundaries = applyStructuralBoundaries(evidence, corrections, families);
  const nonStructuralCorrections = corrections.filter((correction) => correction.action !== 'split' && correction.action !== 'merge');
  profile.next('REBUILD_BASELINE_GRAPH');
  const baselineGraph = reconstructV1(evidenceWithStructuralBoundaries);
  // Journey-scoped corrections can be ambiguous before the final
  // continuity graph exists. Preserve them as review candidates rather
  // than letting an intermediate mapper prevent the Atlas from being
  // rebuilt. Grouping and structural corrections still fail closed.
  profile.next('REBUILD_BASELINE_MAPPING');
  const baseline = mapFinalCorrectionApplications(baselineGraph, nonStructuralCorrections, families);
  profile.next('REBUILD_CONSTRAINED_GRAPH');
  const groupingConstraints = rejectionGroupingConstraints(nonStructuralCorrections, families);
  // Baseline mapping is read-only. Empty constraints would repeat the
  // same deterministic graph; rejection constraints still need a pass.
  const confirmedGraph = groupingConstraints.length
    ? reconstructV1(evidenceWithStructuralBoundaries, { journeyGroupingConstraints: groupingConstraints })
    : baselineGraph;
  profile.next('REBUILD_CONFIRMED_MAPPING');
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
  profile.next('REBUILD_MEMORY_OVERLAY');
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
  await afterMemoryMapping?.(memoryCorrections);
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
  profile.next('REBUILD_OWNER_MERGE');
  // Do not remap an owner-reviewed graph implicitly.  Exact correction
  // matches pin only their own journeys; unrelated corrections must not
  // freeze a later, unreviewed continuous away episode.
  profile.next('REBUILD_CONTINUITY');
  const protectedJourneyIds = new Set([
    ...baseline.matches.values(),
    ...confirmed.matches.values(),
    ...memoryMatches.values(),
  ]);
  const structurallyMerged = applyOwnerJourneyMerges(confirmedGraph, corrections, families, protectedJourneyIds);
  let travelGraph = structurallyMerged;
  if (homeUnits.size) {
    const protectedVisits = new Set(structurallyMerged.journeys.filter((journey) => protectedJourneyIds.has(journey.id)).flatMap((journey) => journey.visitIds));
    const protectedUnits = new Set(structurallyMerged.visits.filter((visit) => protectedVisits.has(visit.id)).flatMap((visit) => visit.evidenceIds.map(families.keyForEvidence)));
    // The complete graph above is used only for reviewed identities. Remove
    // whole Home families before building automatic visits and memberships.
    const travelEvidence = evidenceWithStructuralBoundaries.filter((item) => {
      const key = families.keyForEvidence(item.id);
      return !homeUnits.has(key) && !protectedUnits.has(key);
    });
    travelGraph = retainProtectedJourneys(reconstructV1(travelEvidence, { journeyGroupingConstraints: groupingConstraints }), structurallyMerged, protectedJourneyIds);
  }
  const continuityGraph = constructCanonicalV11Graph(travelGraph, evidenceWithStructuralBoundaries, protectedJourneyIds, homeAreas);
  profile.next('REBUILD_MEMBERSHIP');
  const graph = {
    ...continuityGraph,
    memberships: [
      ...continuityGraph.memberships.filter((membership) => {
        const supportUnit = families.keyForEvidence(membership.evidenceId);
        return !excluded.has(membership.evidenceId) && (!homeUnits.has(supportUnit) || protectedJourneyIds.has(membership.journeyId))
          && !ownerPrimary.has(supportUnit) && !rejectedTargets.has(`${supportUnit}:${membership.journeyId}`);
      }),
      ...[...ownerPrimary.entries()].filter(([supportUnit]) => !excluded.has(resolveReviewedSupportKey(supportUnit, 'memory-primary', families.snapshotsFor([supportUnit]), families))).map(([supportUnit, journeyId]) => ({ evidenceId: resolveReviewedSupportKey(supportUnit, 'memory-primary', families.snapshotsFor([supportUnit]), families), journeyId, state: 'owner' as const, reason: 'owner-primary' as const })),
    ],
  };
  // `baseline` and `confirmed` intentionally run before the continuity
  // pass so those corrections protect their reviewed support. The final
  // Atlas projection can then merge otherwise-unreviewed episodes and
  // generate a different journey ID. Store correction applications
  // against that final graph, not the pre-continuity ID, or a saved
  // owner place will have no visible journey to override.
  profile.next('REBUILD_FINAL_MAPPING');
  const { matches: finalMatches, pending: finalPendingRemaps } = mapFinalCorrectionApplications(graph, corrections, families);
  const pendingFinalRemaps = [...new Map([...baseline.pending, ...confirmed.pending, ...finalPendingRemaps].map((correction) => [correction.revision_id, correction])).values()]
    .filter(correction=>!finalMatches.has(correction.revision_id));
  const legacyJourneyMappings = uniqueJourneySuccessors(baselineGraph, graph);
  return {graph,evidence,homeAreas,families,corrections,memoryCorrections,memoryMatches,finalMatches,pendingFinalRemaps,legacyJourneyMappings};
}
