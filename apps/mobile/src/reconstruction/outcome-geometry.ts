/**
 * Pure geometry/session primitives shared by every trip-detector outcome
 * rule version (outcome-v1-2.ts, outcome-v1-3.ts). Extracted so "away from
 * Home", "one independent photo unit" and "corroborated" cannot silently
 * drift between rule versions kept side by side for benchmarking/rollback
 * (decision 0021/0023) — only the outcome gates themselves differ between
 * `outcome-v1-*.ts` files; this module has no gate of its own.
 */
import type { OwnerConfiguredHomeArea, TripDetectorEvidence } from './types';

const EARTH_RADIUS_METERS = 6_371_000;
export const RELIABLE_ACCURACY_METERS = 1_000;
export const DEFAULT_HOME_RADIUS_METERS = 20_000;
const SESSION_GAP_MILLIS = 60 * 60_000;
const SESSION_SPAN_MILLIS = 4 * 60 * 60_000;
const SESSION_DISPLACEMENT_METERS = 1_000;
const PLACE_SEPARATION_METERS = 1_000;

// C-13 (decision 0021): camera and imported (Google Takeout) supply support; screenshots
// and downloads supply none; messaging and unknown are review-only, same as the others here.
// Exported so any other reader needing the same own-capture test (e.g. the
// Possible-trips card's informational located-photo count) uses this one
// definition rather than a second, driftable copy.
export const NON_CAPTURE_ORIGINS = new Set(['screenshot', 'download', 'unknown', 'messaging']);

export function haversineMeters(aLat: number, aLon: number, bLat: number, bLon: number) {
  const radians = Math.PI / 180;
  const latDelta = (bLat - aLat) * radians;
  const lonDelta = ((((bLon - aLon) + 540) % 360) - 180) * radians;
  const h = Math.sin(latDelta / 2) ** 2 + Math.cos(aLat * radians) * Math.cos(bLat * radians) * Math.sin(lonDelta / 2) ** 2;
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function validDay(day: string | null | undefined): day is string {
  if (!day || !/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(day)) return false;
  const parsed = new Date(`${day}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === day;
}

export function isHomeActiveOnDay(area: OwnerConfiguredHomeArea, day: string | null) {
  return validDay(day) && (!area.effectiveStartDay || day >= area.effectiveStartDay) && (!area.effectiveEndDay || day <= area.effectiveEndDay);
}

export function validLocation(item: { latitude: number | null; longitude: number | null }) {
  return item.latitude !== null && Number.isFinite(item.latitude) && Math.abs(item.latitude) <= 90
    && item.longitude !== null && Number.isFinite(item.longitude) && Math.abs(item.longitude) <= 180;
}

/** Every distinct original/civil day in `units` has at least one Home area
 * active on it. An owner with no Home at all never covers anything (H-4).
 * Units with no valid day at all are conservatively uncovered too: a day
 * that cannot be checked must never be treated as covered by omission
 * (`Array.prototype.every` on an empty set would otherwise vacuously say
 * yes with zero days actually verified). */
export function homeCoversAllDays(units: readonly Pick<TripDetectorEvidence, 'capturedDay'>[], homeAreas: readonly OwnerConfiguredHomeArea[]) {
  if (!homeAreas.length || !units.length) return false;
  const days = new Set(units.map((item) => item.capturedDay).filter(validDay));
  if (!days.size) return false;
  return [...days].every((day) => homeAreas.some((area) => isHomeActiveOnDay(area, day)));
}

/** v1.3's whole Home model (decision 0023): inside an active Home's own
 * radius (free per-Home, no separate "away" distance). A photo with no
 * valid location is never claimed to be inside Home by omission — it is
 * conservatively treated as (possibly) away, same as v1.2. */
export function isWithinActiveHomeRadius(item: TripDetectorEvidence, homeAreas: readonly OwnerConfiguredHomeArea[]) {
  if (!validLocation(item)) return false;
  return homeAreas.some((area) => isHomeActiveOnDay(area, item.capturedDay)
    && haversineMeters(item.latitude!, item.longitude!, area.latitude, area.longitude) <= (area.radiusMeters ?? DEFAULT_HOME_RADIUS_METERS));
}

/** V1.1 §1 sessions, simplified to one pass: unordered day/place buckets for
 * evidence without a trusted instant, elapsed-gap/displacement/span splitting
 * for evidence that has one. Returns a session id per evidence id. */
export function partitionSessions(units: readonly TripDetectorEvidence[]): ReadonlyMap<string, string> {
  const sessionById = new Map<string, string>();
  const dayOnly = units.filter((item) => !item.hasPreciseOffset || item.capturedAtMillis === null);
  for (const item of dayOnly) {
    const key = `day:${item.capturedDay ?? 'unknown'}:${item.supportPlaceId ?? item.id}`;
    sessionById.set(item.id, key);
  }
  const trusted = [...units.filter((item) => item.hasPreciseOffset && item.capturedAtMillis !== null)]
    .sort((a, b) => a.capturedAtMillis! - b.capturedAtMillis! || a.id.localeCompare(b.id));
  let session: TripDetectorEvidence[] = [];
  let sessionIndex = 0;
  for (const item of trusted) {
    const prior = session.at(-1);
    const first = session[0];
    const gap = prior ? item.capturedAtMillis! - prior.capturedAtMillis! : 0;
    const span = first ? item.capturedAtMillis! - first.capturedAtMillis! : 0;
    const displaced = prior && validLocation(prior) && validLocation(item)
      ? haversineMeters(prior.latitude!, prior.longitude!, item.latitude!, item.longitude!) > SESSION_DISPLACEMENT_METERS : false;
    if (prior && (gap > SESSION_GAP_MILLIS || span > SESSION_SPAN_MILLIS || displaced)) { sessionIndex += 1; session = []; }
    session.push(item);
    sessionById.set(item.id, `trusted:${sessionIndex}`);
  }
  return sessionById;
}

/** V1.1 §1's "two corroborated places" check needs >=1 km separation, finer
 * than reconstruction-v1's own 5 km place clustering (decision 0021 keeps
 * that clustering unchanged). Two points 3 km apart already share one
 * `supportPlaceId`, so this checks raw coordinates directly rather than
 * distinct place ids (found by the M10.1/M10.3 benchmark, 2026-11-19). */
export function hasTwoSeparatedPlaces(units: readonly TripDetectorEvidence[]) {
  const located = units.filter(validLocation);
  for (let left = 0; left < located.length; left += 1) for (let right = left + 1; right < located.length; right += 1) {
    if (haversineMeters(located[left].latitude!, located[left].longitude!, located[right].latitude!, located[right].longitude!) >= PLACE_SEPARATION_METERS) return true;
  }
  return false;
}

/** One independent capture unit per verified duplicate family; deterministic,
 * never claims which member was the original (same rule as V1.1, and the
 * same tie-break: ascending sort then last-write-wins, so the highest id in
 * a family is the representative in both versions — V1.1's own `photoUnits`
 * builds a `Map` from an ascending-sorted array the same way, so every rule
 * version picks the same family representative for the same evidence). */
export function photoUnitsOf(evidence: readonly TripDetectorEvidence[]) {
  const byUnit = new Map<string, TripDetectorEvidence>();
  for (const item of [...evidence].sort((a, b) => a.id.localeCompare(b.id))) {
    const key = item.duplicateFamilyId ? `family:${item.duplicateFamilyId}` : `unit:${item.id}`;
    byUnit.set(key, item);
  }
  return [...byUnit.values()];
}
