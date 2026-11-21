import { applyStructuralBoundaries, metersBetween } from './canonical-core';
import { projectCanonicalHistory, type CanonicalProjectionInput } from './canonical-projection';
import { applyOwnerConfiguredHomeAreas, effectiveConfiguredHomeDistanceV11 } from './engine-v1-1';
import { qualifyGraphJourneyWithClues } from '../clues/consumption';
import type { ClueRecord } from '../clues/types';
import type { OwnerConfiguredHomeArea, ReconstructionGraph, TripDetectorEvidence } from './types';

export const candidateTripPolicy = Object.freeze({
  version: 'recognizable-travel-shadow-v1',
  routineMinimumDays: 3,
  routineMinimumSpan: 28,
  independentSessionMinutes: 90,
  nearbySeparationMeters: 2_000,
  farAwayMeters: 50_000,
  shortGapDays: 2,
  continuationGapDays: 10,
  homeReturnMinutes: 60,
  plausibleMaximumMetersPerHour: 1_400_000,
});
export const recoveryTripPolicy = Object.freeze({
  version: 'atlas-recovery-shadow-v1',
  samePlaceContinuityHours: 18,
  corridorContinuityHours: 36,
  corridorMaximumDetour: 1.35,
  corridorMinimumLegFraction: 0.15,
});

export type UsualPlaceAnswer = { placeId: string; startDay: string; endDay: string; usual: boolean };
export type CandidateTrip = {
  id: string; state: 'reliable' | 'possible'; visitIds: string[]; supportIds: string[];
  supportKeys: string[];
  reasons: ('corroborated-outing' | 'sparse-sessions' | 'uncertain-boundary' | 'owner-reviewed')[];
};
export type CandidateTripProjection = {
  policyVersion: typeof candidateTripPolicy.version | typeof recoveryTripPolicy.version;
  trips: CandidateTrip[];
  mergeSuggestions: { left: CandidateTrip; right: CandidateTrip }[];
  boundaries: Record<'joined-nearby' | 'joined-away' | 'home-return' | 'owner-boundary' | 'separated-gap' | 'uncertain-gap', number>;
};

type Observation = { item: TripDetectorEvidence; visitId: string; placeId: string; day: number };
type Block = { day: number; observations: Observation[]; uncertain: boolean; separator?: 'home-return' | 'owner-boundary' | 'uncertain-gap' | 'review-gap' };
const dayLength = 86_400_000;
const minute = 60_000;
const supportKey = (item: TripDetectorEvidence) => item.duplicateFamilyId === null ? `E:${item.id}` : `F:${item.duplicateFamilyId}`;

function civilDay(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time / dayLength : null;
}

// Kept in step with outcome-v1-2.ts's NON_CAPTURE_ORIGINS (C-13, decision
// 0021): messaging-sourced evidence is review-only, same as unknown.
function usable(item: TripDetectorEvidence) {
  return !item.excluded && !item.duplicateConflict && item.supportEligible !== false && !item.timeConflict
    && item.availability !== 'unavailable' && item.reliableLocation !== false && item.captureLike !== false
    && item.sourceOrigin !== 'screenshot' && item.sourceOrigin !== 'download' && item.sourceOrigin !== 'unknown' && item.sourceOrigin !== 'messaging'
    && item.origin !== 'screenshot' && item.origin !== 'download' && item.origin !== 'unknown'
    && item.latitude !== null && Number.isFinite(item.latitude) && Math.abs(item.latitude) <= 90
    && item.longitude !== null && Number.isFinite(item.longitude) && Math.abs(item.longitude) <= 180
    && (item.reportedAccuracyMeters === null || (Number.isFinite(item.reportedAccuracyMeters)
      && item.reportedAccuracyMeters >= 0 && item.reportedAccuracyMeters <= 1_000));
}

function precise(item: TripDetectorEvidence) {
  return item.hasPreciseOffset && Number.isFinite(item.capturedAtMillis) ? item.capturedAtMillis : null;
}

function incompatibleMovement(left: Observation, right: Observation, leftTime: number, rightTime: number) {
  if (rightTime < leftTime) return true;
  if (left.placeId === right.placeId) return false;
  const meters = metersBetween(left.item, right.item) ?? 0;
  const allowance = (left.item.reportedAccuracyMeters ?? 0) + (right.item.reportedAccuracyMeters ?? 0);
  return meters - allowance > candidateTripPolicy.plausibleMaximumMetersPerHour * (rightTime - leftTime) / (60 * minute);
}

function append<K, V>(groups: Map<K, V[]>, key: K, value: V) {
  const existing = groups.get(key);
  if (existing) existing.push(value);
  else groups.set(key, [value]);
}

// Mark two adjacent edges only when a third independent, timed place
// corroborates progression. A plausible duration alone is insufficient.
function corroboratedTravelEdges(observations: Iterable<Observation[]>, hasHardBoundary: (left: Observation, right: Observation) => boolean) {
  const runs: { first: Observation; last: Observation }[] = [];
  for (const day of observations) for (const row of day) {
    const prior = runs.at(-1);
    if (prior?.last.placeId === row.placeId && !prior.last.item.ownerBoundaryAfter) prior.last = row;
    else runs.push({ first: row, last: row });
  }
  const edges = new Map<string, string>();
  for (let index = 1; index + 1 < runs.length; index++) {
    const { last: left } = runs[index - 1];
    const middle = runs[index];
    const { first: right } = runs[index + 1];
    const start = precise(left.item);
    const via = precise(middle.first.item);
    const viaEnd = precise(middle.last.item);
    const end = precise(right.item);
    if (start === null || via === null || viaEnd === null || end === null || start >= via || viaEnd >= end
      || end - start > recoveryTripPolicy.corridorContinuityHours * 60 * minute || left.placeId === right.placeId
      || hasHardBoundary(left, middle.first) || hasHardBoundary(middle.last, right)
      || incompatibleMovement(left, middle.first, start, via) || incompatibleMovement(middle.last, right, viaEnd, end)) continue;
    const direct = metersBetween(left.item, right.item) ?? 0;
    const firstLeg = metersBetween(left.item, middle.first.item) ?? 0;
    const lastLeg = metersBetween(middle.first.item, right.item) ?? 0;
    const minimumLeg = Math.max(candidateTripPolicy.nearbySeparationMeters, direct * recoveryTripPolicy.corridorMinimumLegFraction);
    if (Math.min(firstLeg, lastLeg) < minimumLeg || firstLeg + lastLeg > direct * recoveryTripPolicy.corridorMaximumDetour) continue;
    edges.set(left.item.id, middle.first.item.id);
    edges.set(middle.last.item.id, right.item.id);
  }
  return edges;
}

function homeRowsBetween(left: Observation, right: Observation, homeByDay: ReadonlyMap<number, TripDetectorEvidence[]>) {
  const leftTime = precise(left.item);
  const rightTime = precise(right.item);
  const rows: TripDetectorEvidence[] = [];
  for (let day = left.day; day <= right.day; day++) {
    for (const item of homeByDay.get(day) ?? []) {
      const time = precise(item);
      if (day === left.day && (leftTime === null || time === null || time <= leftTime)) continue;
      if (day === right.day && (rightTime === null || time === null || time >= rightTime)) continue;
      rows.push(item);
    }
  }
  return rows;
}

function corroboratedHomeReturn(rows: TripDetectorEvidence[]) {
  const byArea = new Map<string, TripDetectorEvidence[]>();
  for (const row of rows) {
    const ids = row.configuredHomeAreaIds ?? (row.configuredHomeAreaId ? [row.configuredHomeAreaId] : []);
    for (const id of ids) append(byArea, id, row);
  }
  for (const area of byArea.values()) {
    const unique = new Map<string, TripDetectorEvidence>();
    for (const row of [...area].sort((a, b) => a.id.localeCompare(b.id))) unique.set(supportKey(row), row);
    const timesByDay = new Map<number, number[]>();
    for (const row of unique.values()) {
      const day = civilDay(row.capturedDay);
      if (day === null) continue;
      const time = precise(row);
      if (time === null) {
        if (!timesByDay.has(day)) timesByDay.set(day, []);
      } else append(timesByDay, day, time);
    }
    for (const [day, times] of timesByDay) {
      if (timesByDay.has(day + 1)) return true;
      if (times.length < 2) continue;
      times.sort((a, b) => a - b);
      if (times.at(-1)! - times[0] >= candidateTripPolicy.homeReturnMinutes * minute) return true;
    }
  }
  return false;
}

export function projectCandidateTrips({ graph, evidence, homeAreas, protectedJourneyIds = new Set(), reliableReviewedJourneyIds = new Set(), usualPlaceAnswers = [], mode }: {
  graph: ReconstructionGraph; evidence: readonly TripDetectorEvidence[]; homeAreas: readonly OwnerConfiguredHomeArea[];
  protectedJourneyIds?: ReadonlySet<string>; reliableReviewedJourneyIds?: ReadonlySet<string>;
  usualPlaceAnswers?: readonly UsualPlaceAnswer[];
  mode?: 'recovery';
}): CandidateTripProjection {
  const recovery = mode === 'recovery';
  const result: CandidateTripProjection = { policyVersion: recovery ? recoveryTripPolicy.version : candidateTripPolicy.version, trips: [], mergeSuggestions: [],
    boundaries: { 'joined-nearby': 0, 'joined-away': 0, 'home-return': 0, 'owner-boundary': 0, 'separated-gap': 0, 'uncertain-gap': 0 } };
  const normalized = applyOwnerConfiguredHomeAreas([...evidence], [...homeAreas]);
  const ownerSupport = new Map(normalized.filter((item) => !item.excluded && !item.duplicateConflict)
    .map((item) => [item.id, item]));
  const items = new Map(normalized.filter(usable).map((item) => [item.id, item]));
  const visits = new Map(graph.visits.map((visit) => [visit.id, visit]));
  const protectedVisits = new Set<string>();
  const protectedDays = new Set<number>();
  for (const journey of graph.journeys) {
    if (!protectedJourneyIds.has(journey.id) && !reliableReviewedJourneyIds.has(journey.id)) continue;
    const supportIds = new Set<string>();
    for (const id of journey.visitIds) {
      protectedVisits.add(id);
      for (const itemId of visits.get(id)?.evidenceIds ?? []) {
        const item = ownerSupport.get(itemId);
        if (!item) continue;
        supportIds.add(itemId);
        const day = civilDay(item.capturedDay);
        if (day !== null) protectedDays.add(day);
      }
    }
    if (supportIds.size && reliableReviewedJourneyIds.has(journey.id)) result.trips.push({
      id: journey.id, state: 'reliable', visitIds: [...journey.visitIds].sort(), supportIds: [...supportIds].sort(),
      supportKeys: [...new Set([...supportIds].map((id) => supportKey(ownerSupport.get(id)!)))].sort(), reasons: ['owner-reviewed'],
    });
  }
  // Excluded visits may still exist in the graph as evidence. Only visits
  // admitted by the canonical correction and privacy projection can contribute.
  const admitted = new Set(graph.journeys.flatMap((journey) => journey.visitIds));
  const observations: Observation[] = [];
  const homeUnits = new Set([...items.values()].filter((item) => item.configuredHomeAreaId).map(supportKey));
  const homeByDay = new Map<number, TripDetectorEvidence[]>();
  const hardBoundaries = new Set(protectedDays);
  const uncertainDays = new Set<number>();
  for (const item of normalized) {
    if (item.excluded || !item.timeConflict) continue;
    const day = civilDay(item.capturedDay);
    if (day !== null) uncertainDays.add(day);
  }
  for (const item of items.values()) {
    const day = civilDay(item.capturedDay);
    if (day === null) continue;
    if (item.ownerBoundaryAfter) hardBoundaries.add(day);
    if (item.configuredHomeAreaId) append(homeByDay, day, item);
  }
  const seenUnits = new Set<string>();
  const uniqueVisits = [...graph.visits].sort((a, b) => a.id.localeCompare(b.id));
  for (const visit of uniqueVisits) {
    if (!admitted.has(visit.id) || protectedVisits.has(visit.id)) continue;
    for (const id of [...visit.evidenceIds].sort()) {
      const item = items.get(id);
      if (!item || homeUnits.has(supportKey(item))) continue;
      const day = civilDay(item.capturedDay);
      if (day === null) continue;
      const unit = supportKey(item);
      if (seenUnits.has(unit)) continue;
      seenUnits.add(unit);
      observations.push({ item, day, visitId: visit.id, placeId: visit.placeId });
    }
  }
  const byPlace = new Map<string, Observation[]>();
  const byDay = new Map<number, Observation[]>();
  observations.sort((a, b) => a.day - b.day || (precise(a.item) ?? 0) - (precise(b.item) ?? 0) || a.item.id.localeCompare(b.item.id));
  for (const row of observations) append(byPlace, row.placeId, row);
  const routineFrom = new Map<string, number>();
  for (const [place, rows] of byPlace) {
    const distinct = [...new Set(rows.map((row) => row.day))];
    // Recurrence needs separate visits. A single concentrated stay does not
    // become a routine simply because it spans several calendar weeks.
    const separated = distinct.filter((day, index) => index === 0 || day - distinct[index - 1] > candidateTripPolicy.shortGapDays);
    const learned = separated.find((day, index) => index + 1 >= candidateTripPolicy.routineMinimumDays && day - separated[0] >= candidateTripPolicy.routineMinimumSpan);
    if (learned !== undefined) routineFrom.set(place, learned);
  }
  const answers = new Map<string, UsualPlaceAnswer[]>();
  for (const answer of usualPlaceAnswers) append(answers, answer.placeId, answer);
  const routineReferences = [...byPlace.entries()].filter(([place]) => routineFrom.has(place) || answers.has(place)).map(([, rows]) => rows[0]);
  const isRoutine = (row: Observation) => {
    const day = row.item.capturedDay!;
    const answer = answers.get(row.placeId)?.find((entry) => entry.startDay <= day && day <= entry.endDay);
    if (answer) return answer.usual;
    const configured = effectiveConfiguredHomeDistanceV11(row.item, homeAreas);
    return (configured === null || configured < candidateTripPolicy.farAwayMeters)
      && (routineFrom.get(row.placeId) ?? Infinity) < row.day;
  };
  const nearbyReference = (row: Observation) => {
    const configured = effectiveConfiguredHomeDistanceV11(row.item, homeAreas);
    if (configured !== null) return configured;
    let distance = Infinity;
    for (const prior of routineReferences) {
      if (prior.day >= row.day || !isRoutine({ ...prior, item: { ...prior.item, capturedDay: row.item.capturedDay }, day: row.day })) continue;
      const meters = metersBetween(row.item, prior.item);
      if (meters !== null) distance = Math.min(distance, meters);
    }
    return Number.isFinite(distance) ? distance : null;
  };
  const awayDistance = new Map<string, number>();
  for (const observation of observations) {
    if (isRoutine(observation)) continue;
    const distance = nearbyReference(observation);
    if (distance === null || distance < candidateTripPolicy.nearbySeparationMeters) continue;
    awayDistance.set(observation.item.id, distance);
    append(byDay, observation.day, observation);
  }

  const episodeGroups: Block[][] = [];
  const reviewBoundaries: number[] = [];
  let previous: Block | undefined;
  const hasFarSupport = (block: Block) => block.observations.every((row) => awayDistance.get(row.item.id)! >= candidateTripPolicy.farAwayMeters);
  const travelEdges = recovery ? corroboratedTravelEdges(byDay.values(), (left, right) => {
    if (left.item.ownerBoundaryAfter || right.day - left.day > candidateTripPolicy.shortGapDays) return true;
    for (let day = left.day; day <= right.day; day++) {
      if (hardBoundaries.has(day) || uncertainDays.has(day)) return true;
    }
    return corroboratedHomeReturn(homeRowsBetween(left, right, homeByDay));
  }) : new Map<string, string>();
  const travelConnects = (left: Observation, right: Observation) => travelEdges.get(left.item.id) === right.item.id;
  const blocks: Block[] = [];
  for (const [day, rows] of byDay) {
    const ambiguousOwnerSplit = rows.some(({ item }) => item.ownerBoundaryAfter) && rows.some(({ item }) => precise(item) === null);
    let block: Block = { day, observations: [], uncertain: ambiguousOwnerSplit || uncertainDays.has(day) };
    blocks.push(block);
    for (const [index, row] of rows.entries()) {
      const left = rows[index - 1];
      const leftTime = left ? precise(left.item) : null;
      const rightTime = precise(row.item);
      let separator: Block['separator'];
      if (left?.item.ownerBoundaryAfter && leftTime !== null && rightTime !== null) separator = 'owner-boundary';
      else if (leftTime !== null && rightTime !== null) {
        const homeRows = (homeByDay.get(day) ?? []).filter((item) => {
          const time = precise(item);
          return time !== null && time > leftTime && time < rightTime;
        });
        if (corroboratedHomeReturn(homeRows)) separator = 'home-return';
        else if (incompatibleMovement(left!, row, leftTime, rightTime)) {
          separator = 'uncertain-gap';
          if (!recovery) block.uncertain = true;
        }
      }
      if (recovery && !separator && left && left.placeId !== row.placeId && !travelConnects(left, row)) {
        separator = leftTime !== null && rightTime !== null ? 'review-gap' : 'uncertain-gap';
      }
      if (separator) {
        block = { day, observations: [], uncertain: ambiguousOwnerSplit || uncertainDays.has(day) || (!recovery && separator === 'uncertain-gap'), separator };
        blocks.push(block);
      }
      block.observations.push(row);
    }
  }
  for (const block of blocks) {
    const { day } = block;
    if (!previous) episodeGroups.push([block]);
    else {
      const gap = day - previous.day;
      const intervening = Array.from({ length: Math.min(gap, candidateTripPolicy.continuationGapDays + 1) }, (_, i) => previous!.day + i);
      const hasBoundary = intervening.some((d) => hardBoundaries.has(d));
      const left = previous.observations.at(-1)!;
      const right = block.observations[0];
      const leftTime = precise(left.item);
      const rightTime = precise(right.item);
      const incompatible = leftTime !== null && rightTime !== null && incompatibleMovement(left, right, leftTime, rightTime);
      const homeRows = recovery && gap <= candidateTripPolicy.continuationGapDays
        ? homeRowsBetween(left, right, homeByDay) : intervening.slice(1).flatMap((d) => homeByDay.get(d) ?? []);
      const timeConflict = incompatible || (recovery && intervening.some((d) => uncertainDays.has(d)));
      const samePlaceContinues = left.placeId === right.placeId && leftTime !== null && rightTime !== null
        && rightTime > leftTime && rightTime - leftTime <= recoveryTripPolicy.samePlaceContinuityHours * 60 * minute;
      const hasContinuity = recovery && (samePlaceContinues || travelConnects(left, right));
      if (block.separator === 'review-gap') {
        result.boundaries['uncertain-gap']++;
        reviewBoundaries.push(episodeGroups.length - 1);
        episodeGroups.push([block]);
      } else if (block.separator) {
        result.boundaries[block.separator]++;
        episodeGroups.push([block]);
      } else if (hasBoundary || protectedDays.has(day)) {
        result.boundaries['owner-boundary']++;
        episodeGroups.push([block]);
      } else if (corroboratedHomeReturn(homeRows)) {
        result.boundaries['home-return']++;
        episodeGroups.push([block]);
      } else if (timeConflict && gap <= candidateTripPolicy.continuationGapDays) {
        result.boundaries['uncertain-gap']++;
        if (!recovery) previous.uncertain = block.uncertain = true;
        episodeGroups.push([block]);
      } else if (recovery && !hasContinuity && gap <= candidateTripPolicy.continuationGapDays) {
        result.boundaries['uncertain-gap']++;
        reviewBoundaries.push(episodeGroups.length - 1);
        episodeGroups.push([block]);
      } else if (gap <= candidateTripPolicy.shortGapDays) {
        result.boundaries['joined-nearby']++;
        episodeGroups.at(-1)!.push(block);
      } else if (!recovery && gap <= candidateTripPolicy.continuationGapDays && hasFarSupport(previous) && hasFarSupport(block)) {
        result.boundaries['joined-away']++;
        episodeGroups.at(-1)!.push(block);
      } else {
        const uncertain = gap <= candidateTripPolicy.continuationGapDays;
        result.boundaries[uncertain ? 'uncertain-gap' : 'separated-gap']++;
        if (uncertain) previous.uncertain = block.uncertain = true;
        episodeGroups.push([block]);
      }
    }
    previous = block;
  }

  const automaticTrips = episodeGroups.map((episode): CandidateTrip => {
    const rows = episode.flatMap((block) => block.observations);
    const places = new Set(rows.map((row) => row.placeId));
    const times = rows.flatMap((row) => { const time = precise(row.item); return time === null ? [] : [time]; }).sort((a, b) => a - b);
    const independent = episode.length > 1 || places.size > 1 || (times.length > 1 && times.at(-1)! - times[0] >= candidateTripPolicy.independentSessionMinutes * minute);
    const uncertain = episode.some((block) => block.uncertain);
    const supportIds = rows.map((row) => row.item.id).sort();
    const supportKeys = rows.map((row) => supportKey(row.item)).sort();
    return {
      id: `candidate:${JSON.stringify(supportKeys)}`,
      state: independent && !uncertain ? 'reliable' : 'possible',
      visitIds: [...new Set(rows.map((row) => row.visitId))].sort(),
      supportIds,
      supportKeys,
      reasons: uncertain ? ['uncertain-boundary'] : independent ? ['corroborated-outing'] : ['sparse-sessions'],
    };
  });
  result.trips.push(...automaticTrips);
  const eligibleBoundaries = new Set(reviewBoundaries.filter((index) => automaticTrips[index].state === 'reliable' && automaticTrips[index + 1].state === 'reliable'));
  for (const index of eligibleBoundaries) {
    if (eligibleBoundaries.has(index - 1) || eligibleBoundaries.has(index + 1)) continue;
    result.mergeSuggestions.push({ left: automaticTrips[index], right: automaticTrips[index + 1] });
  }
  result.trips.sort((a, b) => a.id.localeCompare(b.id));
  return result;
}

export function projectCandidateFromCanonical(baseline: Awaited<ReturnType<typeof projectCanonicalHistory>>,
  media: Map<string, 'image' | 'video'>, usualPlaceAnswers: readonly UsualPlaceAnswer[] = [], mode?: 'recovery',
  clues: readonly ClueRecord[] = [], correctedKeys: ReadonlySet<string> = new Set()) {
  const protectedJourneyIds = new Set([...baseline.finalMatches.values(), ...baseline.memoryMatches.values()]);
  const reliableReviewedJourneyIds = new Set<string>();
  const currentJourneyIds = new Set(baseline.graph.journeys.map((journey) => journey.id));
  for (const correction of baseline.corrections) {
    const id = baseline.finalMatches.get(correction.revision_id);
    if (!id || !currentJourneyIds.has(id)) continue;
    // v1.2 (decision 0021): agree with the Atlas surface on "reliable",
    // not the retired v1.1 score/learned-base path (found by the M10.3
    // code review, 2026-11-19 — the two disagreed on the same journey).
    // Clue-aware (CAP-2/M11.1, found by the 2026-11-20 code review): with
    // zero clues this is byte-identical to the old qualifyGraphJourneyV12
    // call, so the deferred preview caller (mode undefined, no clues passed)
    // is unaffected.
    if (correction.action === 'confirm'
      || qualifyGraphJourneyWithClues(baseline.graph, id, baseline.evidence, media, baseline.homeAreas, clues, correctedKeys).classification === 'AUTO_CONFIRMED') {
      reliableReviewedJourneyIds.add(id);
    }
  }
  const evidence = applyStructuralBoundaries(baseline.evidence, baseline.corrections, baseline.families);
  return projectCandidateTrips({ graph: baseline.graph, evidence, homeAreas: baseline.homeAreas,
    protectedJourneyIds, reliableReviewedJourneyIds, usualPlaceAnswers, mode });
}

/** Explicit shadow entry point. It neither changes the active projection nor
 * publishes candidate classifications to native or account storage. */
export async function projectCanonicalCandidateHistory(input: CanonicalProjectionInput, usualPlaceAnswers: readonly UsualPlaceAnswer[] = [], checkpoint?: () => Promise<void>, mode?: 'recovery') {
  const baseline = await projectCanonicalHistory(input, undefined, checkpoint);
  await checkpoint?.();
  const media = new Map(input.rows.map((row) => [row.evidence_id, row.media_type ?? 'image']));
  const candidate = projectCandidateFromCanonical(baseline, media, usualPlaceAnswers, mode);
  return { baseline, candidate };
}
