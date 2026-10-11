import { RECONSTRUCTION_RULE_VERSION, type EvidenceDisposition, type JourneyMembership, type Place, type ReconstructionEvidence, type ReconstructionGraph, type Visit } from './types';

const R = 6_371_000;
const MAX_PLACE_METERS = 5_000;

function normalizedLongitude(value: number) { return ((value + 180) % 360 + 360) % 360 - 180; }
function eligible(evidence: ReconstructionEvidence) {
  return evidence.availability !== 'unavailable' && !evidence.excluded && !evidence.duplicateConflict
    && Number.isFinite(evidence.latitude) && Number.isFinite(evidence.longitude)
    && evidence.latitude! >= -90 && evidence.latitude! <= 90 && evidence.longitude! >= -180 && evidence.longitude! <= 180
    && (evidence.reportedAccuracyMeters === null || (evidence.reportedAccuracyMeters >= 0 && evidence.reportedAccuracyMeters <= MAX_PLACE_METERS));
}
function distance(a: ReconstructionEvidence, b: ReconstructionEvidence) {
  const lat1 = a.latitude! * Math.PI / 180; const lat2 = b.latitude! * Math.PI / 180;
  const deltaLat = lat2 - lat1; const deltaLon = normalizedLongitude(b.longitude! - a.longitude!) * Math.PI / 180;
  const h = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return Math.round((2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))) * 1000) / 1000;
}
function dayGap(a: ReconstructionEvidence, b: ReconstructionEvidence) {
  if (a.hasPreciseOffset && b.hasPreciseOffset && a.capturedAtMillis !== null && b.capturedAtMillis !== null) return Math.abs(a.capturedAtMillis - b.capturedAtMillis) / 86_400_000;
  if (!a.capturedDay || !b.capturedDay) return null;
  return Math.abs(Date.parse(`${a.capturedDay}T00:00:00Z`) - Date.parse(`${b.capturedDay}T00:00:00Z`)) / 86_400_000;
}

function calendarGap(a: ReconstructionEvidence, b: ReconstructionEvidence) {
  if (!a.capturedDay || !b.capturedDay) return null;
  return Math.abs(Date.parse(`${a.capturedDay}T00:00:00Z`) - Date.parse(`${b.capturedDay}T00:00:00Z`)) / 86_400_000;
}

function mergeAiCandidates(fromJourneyId: string, toJourneyId: string, prior: ReconstructionEvidence | undefined, next: ReconstructionEvidence | undefined) {
  if (!prior?.capturedDay || !next?.capturedDay) return undefined;
  const offset = (Date.parse(`${next.capturedDay}T00:00:00Z`) - Date.parse(`${prior.capturedDay}T00:00:00Z`)) / 86_400_000;
  if (!Number.isInteger(offset) || !Number.isFinite(offset) || Math.abs(offset) > 3650) return undefined;
  return [{ localId: fromJourneyId, relativeDayOffset: 0, evidenceCategory: 'geotagged' as const }, { localId: toJourneyId, relativeDayOffset: offset, evidenceCategory: 'geotagged' as const }];
}

/** Pure deterministic baseline. It intentionally produces uncertainty instead of travel claims. */
export function reconstructV1(input: ReconstructionEvidence[]): ReconstructionGraph {
  const family = new Map<string, ReconstructionEvidence[]>();
  for (const item of input) { const key = item.duplicateFamilyId ?? item.id; family.set(key, [...(family.get(key) ?? []), item]); }
  // A contradictory duplicate family is not allowed to select one convenient
  // member. Every copy remains reviewable but supplies no automatic support.
  const conflictedFamilies = new Set([...family.entries()].filter(([, items]) => items.some((item) => item.duplicateConflict)).map(([id]) => id));
  const units = [...family.entries()].filter(([id]) => !conflictedFamilies.has(id)).map(([, items]) => items.sort((a, b) => a.id.localeCompare(b.id))[0])
    .filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude))
    .sort((a, b) => (a.latitude! - b.latitude!) || (normalizedLongitude(a.longitude!) - normalizedLongitude(b.longitude!)) || a.id.localeCompare(b.id));
  const clusters: ReconstructionEvidence[][] = [];
  for (const unit of units.filter(eligible)) {
    const choices = clusters.map((cluster, index) => ({ index, max: Math.max(...cluster.map((member) => distance(unit, member))), first: cluster.map((member) => member.id).sort()[0] }))
      .filter((choice) => choice.max <= MAX_PLACE_METERS).sort((a, b) => a.max - b.max || a.first.localeCompare(b.first));
    if (choices.length) clusters[choices[0].index].push(unit); else clusters.push([unit]);
  }
  const places: Place[] = clusters.map((members) => {
    const representativeId = [...members].sort((a, b) => Math.max(...members.map((m) => distance(a, m))) - Math.max(...members.map((m) => distance(b, m))) || a.id.localeCompare(b.id))[0].id;
    const memberIds = members.map((m) => m.id).sort();
    return { id: `place:${memberIds.join('|')}`, memberIds, representativeId, uncertainty: members.some((m) => m.reportedAccuracyMeters === null) ? ['reported-accuracy-unknown'] : [] };
  });
  const placeByEvidence = new Map(places.flatMap((place) => place.memberIds.map((id) => [id, place.id] as const)));
  const visits: Visit[] = [];
  const supported = input.filter((item) => placeByEvidence.has(item.id) && item.capturedDay);
  // Only actual instants with offsets establish an automatic sequence. Weak
  // timestamps remain their own uncertain visits instead of using an asset ID
  // as a false chronological fact.
  const orderedEvidence = supported.filter((item) => item.hasPreciseOffset && item.capturedAtMillis !== null)
    .sort((a, b) => a.capturedAtMillis! - b.capturedAtMillis! || a.id.localeCompare(b.id));
  let current: ReconstructionEvidence[] = [];
  for (const item of orderedEvidence) {
    const prior = current.at(-1);
    const samePlace = prior && placeByEvidence.get(prior.id) === placeByEvidence.get(item.id);
    const gap = prior ? dayGap(prior, item) : 0;
    const span = current.length ? calendarGap(current[0], item) : 0;
    if (prior && (prior.ownerBoundaryAfter || !samePlace || gap === null || gap > 2 || span === null || span > 30)) {
      visits.push({ id: `visit:${current.map((e) => e.id).join('|')}`, placeId: placeByEvidence.get(prior.id)!, evidenceIds: current.map((e) => e.id), order: 'ordered' }); current = [];
    }
    current.push(item);
  }
  if (current.length) visits.push({ id: `visit:${current.map((e) => e.id).join('|')}`, placeId: placeByEvidence.get(current[0].id)!, evidenceIds: current.map((e) => e.id), order: 'ordered' });
  // Civil-date-only evidence can form a bounded uncertain visit only when it
  // shares both place and civil day. It never establishes an elapsed-time
  // journey sequence.
  const weakGroups = new Map<string, ReconstructionEvidence[]>();
  for (const item of supported.filter((candidate) => !candidate.hasPreciseOffset || candidate.capturedAtMillis === null)) {
    const key = `${placeByEvidence.get(item.id)}:${item.capturedDay}`;
    weakGroups.set(key, [...(weakGroups.get(key) ?? []), item]);
  }
  for (const items of [...weakGroups.values()].sort((a, b) => a[0].id.localeCompare(b[0].id))) {
    const evidenceIds = items.map((item) => item.id).sort();
    visits.push({ id: `visit:${evidenceIds.join('|')}`, placeId: placeByEvidence.get(items[0].id)!, evidenceIds, order: 'uncertain' });
  }
  const orderedVisits = visits.filter((visit) => visit.order === 'ordered').sort((a, b) => {
    const firstA = input.find((e) => e.id === a.evidenceIds[0])!; const firstB = input.find((e) => e.id === b.evidenceIds[0])!;
    return (firstA.capturedAtMillis ?? Number.MAX_SAFE_INTEGER) - (firstB.capturedAtMillis ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id);
  });
  const journeys: ReconstructionGraph['journeys'] = []; const possibleMerges: ReconstructionGraph['possibleMerges'] = [];
  for (const visit of orderedVisits) {
    const prior = journeys.at(-1); const priorVisit = prior && visits.find((candidate) => candidate.id === prior.visitIds.at(-1));
    const priorEvidence = priorVisit && input.find((e) => e.id === priorVisit.evidenceIds.at(-1)); const nextEvidence = input.find((e) => e.id === visit.evidenceIds[0]);
    const gap = priorEvidence && nextEvidence ? dayGap(priorEvidence, nextEvidence) : null;
    const journeyStart = prior && input.find((e) => e.id === visits.find((candidate) => candidate.id === prior.visitIds[0])?.evidenceIds[0]);
    const journeySpan = journeyStart && nextEvidence ? calendarGap(journeyStart, nextEvidence) : null;
    const automaticLimit = priorEvidence?.hasPreciseOffset && nextEvidence?.hasPreciseOffset ? 3 : 2;
    const mergeLimit = priorEvidence?.hasPreciseOffset && nextEvidence?.hasPreciseOffset ? 10 : 10;
    const boundary = priorEvidence?.ownerBoundaryAfter === true;
    const localContext = visit.evidenceIds.some((id) => input.find((item) => item.id === id)?.usualAreaContext) || priorVisit?.evidenceIds.some((id) => input.find((item) => item.id === id)?.usualAreaContext);
    if (prior && priorVisit && !boundary && !localContext && priorVisit.placeId !== visit.placeId && gap !== null && gap <= automaticLimit && journeySpan !== null && journeySpan <= 30) prior.visitIds.push(visit.id);
    else {
      const next = { id: `journey:${visit.id}`, visitIds: [visit.id], state: 'inferred' as const }; journeys.push(next);
      if (prior && !boundary && gap !== null && gap <= mergeLimit) {
        const aiCandidates = mergeAiCandidates(prior.id, next.id, priorEvidence, nextEvidence);
        possibleMerges.push({ fromJourneyId: prior.id, toJourneyId: next.id, reason: journeySpan !== null && journeySpan > 30 ? 'span-cap' : 'adjacent-gap', ...(aiCandidates ? { aiCandidates } : {}) });
      }
    }
  }
  const dispositions: EvidenceDisposition[] = input.map((e) => placeByEvidence.has(e.id) ? { evidenceId: e.id, state: 'supported', reasons: ['eligible-place-support'] } : { evidenceId: e.id, state: e.excluded ? 'unassigned' : 'unresolved', reasons: [e.excluded ? 'owner-excluded' : conflictedFamilies.has(e.duplicateFamilyId ?? e.id) ? 'duplicate-family-conflict' : e.availability === 'unavailable' ? 'source-unavailable' : 'insufficient-location-support'] });
  const memberships: JourneyMembership[] = [];
  for (const journey of journeys) for (const visitId of journey.visitIds) for (const evidenceId of visits.find((visit) => visit.id === visitId)?.evidenceIds ?? []) memberships.push({ evidenceId, journeyId: journey.id, state: 'inferred', reason: 'visit-support' });
  for (const item of input.filter((candidate) => !placeByEvidence.has(candidate.id) && candidate.availability === 'available' && !candidate.excluded && candidate.hasPreciseOffset && candidate.capturedAtMillis !== null)) {
    const compatible = journeys.flatMap((journey) => {
      const supports = journey.visitIds.flatMap((visitId) => visits.find((visit) => visit.id === visitId)?.evidenceIds ?? []).map((id) => input.find((evidence) => evidence.id === id)!).filter(Boolean);
      const before = supports.filter((support) => support.hasPreciseOffset && support.capturedAtMillis! < item.capturedAtMillis!).at(-1);
      const after = supports.find((support) => support.hasPreciseOffset && support.capturedAtMillis! > item.capturedAtMillis!);
      return [{ journey, supports, before, after }];
    });
    const bracket = compatible.filter(({ before, after }) => item.hasPreciseOffset && before && after && item.capturedAtMillis! - before.capturedAtMillis! <= 86_400_000 && after.capturedAtMillis! - item.capturedAtMillis! <= 86_400_000);
    if (bracket.length === 1) memberships.push({ evidenceId: item.id, journeyId: bracket[0].journey.id, state: 'inferred', reason: 'ordered-24-hour-bracket' });
    else if (bracket.length === 0) {
      const suggested = compatible.filter(({ supports }) => supports.some((support) => support.hasPreciseOffset && support.capturedAtMillis !== null && Math.abs(support.capturedAtMillis - item.capturedAtMillis!) <= 3 * 86_400_000));
      if (suggested.length === 1) memberships.push({ evidenceId: item.id, journeyId: suggested[0].journey.id, state: 'suggested', reason: 'unique-three-day-suggestion' });
    }
  }
  return { ruleVersion: RECONSTRUCTION_RULE_VERSION, places, visits, journeys, possibleMerges, dispositions: dispositions.sort((a, b) => a.evidenceId.localeCompare(b.evidenceId)), memberships: memberships.sort((a, b) => a.evidenceId.localeCompare(b.evidenceId) || a.journeyId.localeCompare(b.journeyId)) };
}
