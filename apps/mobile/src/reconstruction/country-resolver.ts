import dataset from './data/natural-earth-destinations-5.1.1.json';

export const NATURAL_EARTH_ADMIN_0_DATASET_VERSION = dataset.version;
const GEOMETRY_MARGIN_METERS = 250;
type Area = { code: string; name: string; rings: string[]; bounds: number[][] };
type Coordinate = { latitude: number | null; longitude: number | null; reportedAccuracyMeters?: number | null };
type Resolution = { status: 'resolved'; code: string } | { status: 'invalid' | 'border' | 'unresolved' };
export type Destination = { code: string; country: string; region: string | null };
const countries = dataset.countries as Area[];
const regions = new Map<string, Area[]>();
for (const region of dataset.regions as Area[]) {
  const group = regions.get(region.code) ?? [];
  group.push(region);
  regions.set(region.code, group);
}
// Keep global geometry as compact strings. Decode candidate rings only and
// bound retained coordinate allocations, including very large country rings.
const decodedRings = new Map<string, number[][]>();
let cachedPoints = 0;
function decodeRing(packed: string): number[][] {
  const cached = decodedRings.get(packed);
  if (cached) return cached;
  const values = packed.split(',');
  const points: number[][] = [];
  let x = 0; let y = 0;
  for (let i = 0; i < values.length; i += 2) {
    x += parseInt(values[i], 36); y += parseInt(values[i + 1], 36);
    points.push([x / 10000, y / 10000]);
  }
  if (points.length <= 50000) {
    while (cachedPoints + points.length > 50000) {
      const oldest = decodedRings.keys().next().value!;
      cachedPoints -= decodedRings.get(oldest)!.length;
      decodedRings.delete(oldest);
    }
    decodedRings.set(packed, points);
    cachedPoints += points.length;
  }
  return points;
}
function valid(point: Coordinate) {
  return point.latitude !== null && point.longitude !== null && Number.isFinite(point.latitude) && Number.isFinite(point.longitude)
    && Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180
    && (point.reportedAccuracyMeters == null || (Number.isFinite(point.reportedAccuracyMeters) && point.reportedAccuracyMeters >= 0 && point.reportedAccuracyMeters <= 1000));
}
function unwrap(x: number, around: number) { return x + Math.round((around - x) / 360) * 360; }
function contains(area: Area, x: number, y: number, margin: number): 'inside' | 'outside' | 'border' {
  // These depend only on the query point, not on a ring or polygon edge.
  const latitudeMargin = margin / 110574;
  const scaleX = 111320 * Math.cos(y * Math.PI / 180);
  const longitudeMargin = Math.min(180, margin / Math.max(1, scaleX));
  let inside = false;
  for (let r = 0; r < area.rings.length; r += 1) {
    const bounds = area.bounds[r];
    if (y < bounds[1] - latitudeMargin || y > bounds[3] + latitudeMargin || (bounds[2] - bounds[0] < 180 && (x < bounds[0] - longitudeMargin || x > bounds[2] + longitudeMargin))) continue;
    const ring = decodeRing(area.rings[r]);
    let ringInside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const ax = unwrap(ring[j][0], x); const ay = ring[j][1];
      const bx = unwrap(ring[i][0], ax); const by = ring[i][1];
      const dx = (bx - ax) * scaleX; const dy = (by - ay) * 110574;
      const length = dx * dx + dy * dy;
      const t = length ? Math.max(0, Math.min(1, ((x - ax) * scaleX * dx + (y - ay) * 110574 * dy) / length)) : 0;
      if (Math.hypot((x - ax) * scaleX - t * dx, (y - ay) * 110574 - t * dy) <= margin) return 'border';
      if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) ringInside = !ringInside;
    }
    if (ringInside) inside = !inside;
  }
  return inside ? 'inside' : 'outside';
}
export function countryDisplayName(code: string): string | null {
  return countries.find((country) => country.code === code)?.name ?? null;
}
/** Public geometry stays bundled; coordinates are never sent to a service. */
export function resolveCountry(point: Coordinate): Resolution {
  if (!valid(point)) return { status: 'invalid' };
  const matches = [];
  for (const country of countries) {
    const result = contains(country, point.longitude!, point.latitude!, GEOMETRY_MARGIN_METERS + (point.reportedAccuracyMeters ?? 0));
    if (result === 'border') return { status: 'border' };
    if (result === 'inside') matches.push(country);
  }
  return matches.length === 1 ? { status: 'resolved', code: matches[0].code } : { status: 'unresolved' };
}
export function resolveDestination(point: Coordinate): Destination | null {
  const country = resolveCountry(point);
  if (country.status !== 'resolved') return null;
  const matches = [];
  for (const region of regions.get(country.code) ?? []) {
    const result = contains(region, point.longitude!, point.latitude!, GEOMETRY_MARGIN_METERS + (point.reportedAccuracyMeters ?? 0));
    if (result === 'border') return { code: country.code, country: countryDisplayName(country.code)!, region: null };
    if (result === 'inside') matches.push(region.name);
  }
  return { code: country.code, country: countryDisplayName(country.code)!, region: matches.length === 1 ? matches[0] : null };
}
