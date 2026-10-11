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

function civilDayMillis(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value ? parsed : null;
}

function calendarGap(a: ReconstructionEvidence, b: ReconstructionEvidence) {
  const first = civilDayMillis(a.capturedDay);
  const second = civilDayMillis(b.capturedDay);
  if (first === null || second === null) return null;
  return Math.abs(first - second) / 86_400_000;
}

function visitEvidence(visit: Visit, input: ReconstructionEvidence[]) {
  return visit.evidenceIds.map((id) => input.find((item) => item.id === id)).filter((item): item is ReconstructionEvidence => Boolean(item));
}

function compareVisitEvidence(a: ReconstructionEvidence, b: ReconstructionEvidence) {
  const dayOrder = civilDayMillis(a.capturedDay)! - civilDayMillis(b.capturedDay)!;
  if (dayOrder) return dayOrder;
  if (a.hasPreciseOffset && b.hasPreciseOffset && a.capturedAtMillis !== null && b.capturedAtMillis !== null) return a.capturedAtMillis - b.capturedAtMillis;
  return a.id.localeCompare(b.id);
}

function visitStartEvidence(visit: Visit, input: ReconstructionEvidence[]) {
  return visitEvidence(visit, input).sort(compareVisitEvidence)[0];
}

function visitEndEvidence(visit: Visit, input: ReconstructionEvidence[]) {
  return visitEvidence(visit, input).sort(compareVisitEvidence).at(-1);
}

function visitHasOwnerBoundary(visit: Visit, input: ReconstructionEvidence[]) {
  return visitEvidence(visit, input).some((item) => item.ownerBoundaryAfter);
}

function visitHasUsualAreaContext(visit: Visit, input: ReconstructionEvidence[]) {
  return visitEvidence(visit, input).some((item) => item.usualAreaContext);
}

function visitCanFollow(prior: Visit, next: Visit, input: ReconstructionEvidence[]) {
  const priorEvidence = visitEndEvidence(prior, input);
  const nextEvidence = visitStartEvidence(next, input);
  if (!priorEvidence || !nextEvidence || visitHasOwnerBoundary(prior, input)) return false;
  if (prior.placeId === next.placeId || visitHasUsualAreaContext(prior, input) || visitHasUsualAreaContext(next, input)) return false;
  const gap = dayGap(priorEvidence, nextEvidence);
  const limit = priorEvidence.hasPreciseOffset && nextEvidence.hasPreciseOffset ? 3 : 2;
  return gap !== null && gap <= limit;
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
  const supported = input.filter((item) => placeByEvidence.has(item.id) && civilDayMillis(item.capturedDay) !== null);
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
  // Civil-day evidence can form a bounded uncertain visit at the same place
  // across adjacent recorded days. The deterministic grouping is not a claim
  // about within-day ordering or an elapsed duration.
  const weakByPlace = new Map<string, ReconstructionEvidence[]>();
  for (const item of supported.filter((candidate) => !candidate.hasPreciseOffset || candidate.capturedAtMillis === null)) {
    const placeId = placeByEvidence.get(item.id)!;
    weakByPlace.set(placeId, [...(weakByPlace.get(placeId) ?? []), item]);
  }
  for (const [placeId, items] of [...weakByPlace.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const sorted = [...items].sort((a, b) => civilDayMillis(a.capturedDay)! - civilDayMillis(b.capturedDay)! || a.id.localeCompare(b.id));
    let uncertainVisit: ReconstructionEvidence[] = [];
    for (const item of sorted) {
      const prior = uncertainVisit.at(-1);
      const gap = prior ? calendarGap(prior, item) : 0;
      const span = uncertainVisit.length ? calendarGap(uncertainVisit[0], item) : 0;
      if (prior && (visitHasOwnerBoundary({ id: '', placeId, evidenceIds: uncertainVisit.map((entry) => entry.id), order: 'uncertain' }, input) || item.ownerBoundaryAfter || gap === null || gap > 1 || span === null || span > 30)) {
        const evidenceIds = uncertainVisit.map((entry) => entry.id).sort();
        visits.push({ id: `visit:${evidenceIds.join('|')}`, placeId, evidenceIds, order: 'uncertain' });
        uncertainVisit = [];
      }
      uncertainVisit.push(item);
    }
    if (uncertainVisit.length) {
      const evidenceIds = uncertainVisit.map((entry) => entry.id).sort();
      visits.push({ id: `visit:${evidenceIds.join('|')}`, placeId, evidenceIds, order: 'uncertain' });
    }
  }
  const orderedVisits = visits.filter((visit) => visit.order === 'ordered').sort((a, b) => {
    const firstA = visitStartEvidence(a, input)!; const firstB = visitStartEvidence(b, input)!;
    return (firstA.capturedAtMillis ?? Number.MAX_SAFE_INTEGER) - (firstB.capturedAtMillis ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id);
  });
  const journeys: ReconstructionGraph['journeys'] = []; const possibleMerges: ReconstructionGraph['possibleMerges'] = [];
  for (const visit of orderedVisits) {
    const prior = journeys.at(-1); const priorVisit = prior && visits.find((candidate) => candidate.id === prior.visitIds.at(-1));
    const priorEvidence = priorVisit && visitEndEvidence(priorVisit, input); const nextEvidence = visitStartEvidence(visit, input);
    const gap = priorEvidence && nextEvidence ? dayGap(priorEvidence, nextEvidence) : null;
    const journeyStartVisit = prior && visits.find((candidate) => candidate.id === prior.visitIds[0]);
    const journeyStart = journeyStartVisit && visitStartEvidence(journeyStartVisit, input);
    const journeySpan = journeyStart && nextEvidence ? calendarGap(journeyStart, nextEvidence) : null;
    const automaticLimit = priorEvidence?.hasPreciseOffset && nextEvidence?.hasPreciseOffset ? 3 : 2;
    const mergeLimit = priorEvidence?.hasPreciseOffset && nextEvidence?.hasPreciseOffset ? 10 : 10;
    const boundary = priorVisit ? visitHasOwnerBoundary(priorVisit, input) : false;
    const localContext = visitHasUsualAreaContext(visit, input) || (priorVisit ? visitHasUsualAreaContext(priorVisit, input) : false);
    if (prior && priorVisit && !boundary && !localContext && priorVisit.placeId !== visit.placeId && gap !== null && gap <= automaticLimit && journeySpan !== null && journeySpan <= 30) prior.visitIds.push(visit.id);
    else {
      const next = { id: `journey:${visit.id}`, visitIds: [visit.id], state: 'inferred' as const }; journeys.push(next);
      if (prior && !boundary && gap !== null && gap <= mergeLimit) {
        const aiCandidates = mergeAiCandidates(prior.id, next.id, priorEvidence, nextEvidence);
        possibleMerges.push({ fromJourneyId: prior.id, toJourneyId: next.id, reason: journeySpan !== null && journeySpan > 30 ? 'span-cap' : 'adjacent-gap', ...(aiCandidates ? { aiCandidates } : {}) });
      }
    }
  }
  // Civil-day evidence only has a conservative order between different days.
  // It may use the two-day v1 link window, while same-day alternatives remain
  // separate because their within-day order is unknown.
  const weakVisits = visits.filter((visit) => visit.order === 'uncertain').sort((a, b) => {
    const firstA = visitStartEvidence(a, input)!; const firstB = visitStartEvidence(b, input)!;
    return compareVisitEvidence(firstA, firstB) || a.id.localeCompare(b.id);
  });
  for (const visit of weakVisits) {
    const prior = journeys.at(-1);
    const priorVisit = prior && visits.find((candidate) => candidate.id === prior.visitIds.at(-1));
    const priorEvidence = priorVisit && visitEndEvidence(priorVisit, input);
    const nextEvidence = visitStartEvidence(visit, input);
    const sameCivilDay = priorEvidence?.capturedDay === nextEvidence?.capturedDay;
    const journeyStartVisit = prior && visits.find((candidate) => candidate.id === prior.visitIds[0]);
    const journeyStart = journeyStartVisit && visitStartEvidence(journeyStartVisit, input);
    const journeySpan = journeyStart && nextEvidence ? calendarGap(journeyStart, nextEvidence) : null;
    if (prior && priorVisit?.order === 'uncertain' && !sameCivilDay && visitCanFollow(priorVisit, visit, input) && journeySpan !== null && journeySpan <= 30) {
      prior.visitIds.push(visit.id);
    } else {
      const next = { id: `journey:${visit.id}`, visitIds: [visit.id], state: 'inferred' as const }; journeys.push(next);
      const gap = priorEvidence && nextEvidence ? dayGap(priorEvidence, nextEvidence) : null;
      if (prior && priorVisit?.order === 'uncertain' && !sameCivilDay && !visitHasOwnerBoundary(priorVisit, input) && !visitHasUsualAreaContext(priorVisit, input) && !visitHasUsualAreaContext(visit, input) && gap !== null && gap <= 10) {
        const aiCandidates = mergeAiCandidates(prior.id, next.id, priorEvidence, nextEvidence);
        possibleMerges.push({ fromJourneyId: prior.id, toJourneyId: next.id, reason: journeySpan !== null && journeySpan > 30 ? 'span-cap' : 'adjacent-gap', ...(aiCandidates ? { aiCandidates } : {}) });
      }
    }
  }
  const dispositions: EvidenceDisposition[] = input.map((e) => placeByEvidence.has(e.id) && civilDayMillis(e.capturedDay) !== null
    ? { evidenceId: e.id, state: 'supported', reasons: ['eligible-place-support'] }
    : { evidenceId: e.id, state: e.excluded ? 'unassigned' : 'unresolved', reasons: [e.excluded ? 'owner-excluded' : conflictedFamilies.has(e.duplicateFamilyId ?? e.id) ? 'duplicate-family-conflict' : e.availability === 'unavailable' ? 'source-unavailable' : !e.capturedDay ? 'missing-capture-date' : civilDayMillis(e.capturedDay) === null ? 'invalid-capture-day' : 'insufficient-location-support'] });
  const memberships: JourneyMembership[] = [];
  for (const journey of journeys) for (const visitId of journey.visitIds) for (const evidenceId of visits.find((visit) => visit.id === visitId)?.evidenceIds ?? []) memberships.push({ evidenceId, journeyId: journey.id, state: 'inferred', reason: 'visit-support' });
  for (const item of input.filter((candidate) => !placeByEvidence.has(candidate.id) && candidate.availability === 'available' && !candidate.excluded && !conflictedFamilies.has(candidate.duplicateFamilyId ?? candidate.id))) {
    const compatible = journeys.flatMap((journey) => {
      const supports = journey.visitIds.flatMap((visitId) => visits.find((visit) => visit.id === visitId)?.evidenceIds ?? []).map((id) => input.find((evidence) => evidence.id === id)!).filter(Boolean);
      const before = supports.filter((support) => support.hasPreciseOffset && support.capturedAtMillis! < item.capturedAtMillis!).at(-1);
      const after = supports.find((support) => support.hasPreciseOffset && support.capturedAtMillis! > item.capturedAtMillis!);
      return [{ journey, supports, before, after }];
    });
    const bracket = compatible.filter(({ before, after }) => item.hasPreciseOffset && item.capturedAtMillis !== null && before && after && item.capturedAtMillis - before.capturedAtMillis! <= 86_400_000 && after.capturedAtMillis! - item.capturedAtMillis <= 86_400_000);
    if (bracket.length === 1) memberships.push({ evidenceId: item.id, journeyId: bracket[0].journey.id, state: 'inferred', reason: 'ordered-24-hour-bracket' });
    else if (bracket.length === 0) {
      const suggested = compatible.filter(({ supports }) => {
        if (!item.capturedDay) return false;
        const itemDay = civilDayMillis(item.capturedDay);
        const datedSupports = supports.filter((support) => civilDayMillis(support.capturedDay) !== null);
        if (itemDay === null || !datedSupports.length) return false;
        const supportDays = datedSupports.map((support) => civilDayMillis(support.capturedDay)!);
        const spanContains = itemDay >= Math.min(...supportDays) - 86_400_000 && itemDay <= Math.max(...supportDays) + 86_400_000;
        const nearestIsClose = datedSupports.some((support) => Math.abs(civilDayMillis(support.capturedDay)! - itemDay) <= 3 * 86_400_000);
        return spanContains && nearestIsClose;
      });
      if (suggested.length === 1) memberships.push({ evidenceId: item.id, journeyId: suggested[0].journey.id, state: 'suggested', reason: 'unique-three-day-suggestion' });
    }
  }
  return { ruleVersion: RECONSTRUCTION_RULE_VERSION, places, visits, journeys, possibleMerges, dispositions: dispositions.sort((a, b) => a.evidenceId.localeCompare(b.evidenceId)), memberships: memberships.sort((a, b) => a.evidenceId.localeCompare(b.evidenceId) || a.journeyId.localeCompare(b.journeyId)) };
}
