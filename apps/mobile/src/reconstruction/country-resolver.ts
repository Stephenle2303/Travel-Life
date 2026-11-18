import dataset from './data/natural-earth-destinations-5.1.1.json';
import vietnamLocalities from './data/vietnam-localities-81297802.json';
import vietnamProvinces from './data/vietnam-provinces-cod-2020.json';

export const NATURAL_EARTH_ADMIN_0_DATASET_VERSION = dataset.version;
const GEOMETRY_MARGIN_METERS = 250;
type Area = { code: string; name: string; rings: string[]; bounds: number[][] };
type QueryPoint = { latitude: number; longitude: number; margin: number; latitudeMargin: number; scaleX: number; longitudeMargin: number; edgeLongitudeMargin: number };
type Coordinate = { latitude: number | null; longitude: number | null; reportedAccuracyMeters?: number | null; capturedDay?: string | null };
type Resolution = { status: 'resolved'; code: string } | { status: 'invalid' | 'border' | 'unresolved' };
export type Destination = { code: string; country: string; region: string | null; parentRegion?: string };
const countries = dataset.countries as Area[];
const regions = new Map<string, Area[]>();
const areaBounds = new WeakMap<Area, readonly [number, number, number, number]>();
// Vietnam uses the independently checked urban footprints instead of the
// bundled Admin-1 geometry that misclassified Sa Đéc.
regions.set('VNM', vietnamLocalities.places);
for (const region of dataset.regions as Area[]) {
  if (region.code === 'VNM') continue;
  const group = regions.get(region.code) ?? [];
  group.push(region);
  regions.set(region.code, group);
}
// Keep global geometry as compact strings. Decode candidate rings only and
// bound retained coordinate allocations, including very large country rings.
const decodedRings = new Map<string, Float64Array>();
let cachedPoints = 0;
function decodeRing(packed: string): Float64Array {
  const cached = decodedRings.get(packed);
  if (cached) return cached;
  const values = packed.split(',');
  const points = new Float64Array(values.length);
  let x = 0; let y = 0;
  for (let i = 0; i < values.length; i += 2) {
    x += parseInt(values[i], 36); y += parseInt(values[i + 1], 36);
    points[i] = x / 10000;
    points[i + 1] = y / 10000;
  }
  const count = points.length / 2;
  if (count <= 50000) {
    while (cachedPoints + count > 50000) {
      const oldest = decodedRings.keys().next().value!;
      cachedPoints -= decodedRings.get(oldest)!.length / 2;
      decodedRings.delete(oldest);
    }
    decodedRings.set(packed, points);
    cachedPoints += count;
  }
  return points;
}
function valid(point: Coordinate) {
  return point.latitude !== null && point.longitude !== null && Number.isFinite(point.latitude) && Number.isFinite(point.longitude)
    && Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180
    && (point.reportedAccuracyMeters == null || (Number.isFinite(point.reportedAccuracyMeters) && point.reportedAccuracyMeters >= 0 && point.reportedAccuracyMeters <= 1000));
}
function unwrap(x: number, around: number) {
  const delta = around - x;
  return delta < -180 || delta >= 180 ? x + Math.round(delta / 360) * 360 : x;
}
function queryPoint(point: Coordinate): QueryPoint {
  const latitude = point.latitude!;
  const longitude = point.longitude!;
  const margin = GEOMETRY_MARGIN_METERS + (point.reportedAccuracyMeters ?? 0);
  const latitudeMargin = margin / 110574;
  const scaleX = 111320 * Math.cos(latitude * Math.PI / 180);
  const longitudeMargin = Math.min(180, margin / Math.max(1, scaleX));
  return { latitude, longitude, margin, latitudeMargin, scaleX, longitudeMargin, edgeLongitudeMargin: margin / scaleX };
}
function contains(area: Area, { longitude: x, latitude: y, margin, latitudeMargin, scaleX, longitudeMargin, edgeLongitudeMargin }: QueryPoint): 'inside' | 'outside' | 'border' {
  let extent = areaBounds.get(area);
  if (!extent) {
    let west = 180; let south = 90; let east = -180; let north = -90;
    for (const [minX, minY, maxX, maxY] of area.bounds) {
      west = Math.min(west, minX); south = Math.min(south, minY);
      east = Math.max(east, maxX); north = Math.max(north, maxY);
    }
    extent = [west, south, east, north];
    areaBounds.set(area, extent);
  }
  const [west, south, east, north] = extent;
  if (y < south - latitudeMargin || y > north + latitudeMargin
    || (east - west < 180 && (x < west - longitudeMargin || x > east + longitudeMargin))) return 'outside';
  let inside = false;
  const directLongitude = west > -179 && east < 179;
  for (let r = 0; r < area.rings.length; r += 1) {
    const bounds = area.bounds[r];
    if (y < bounds[1] - latitudeMargin || y > bounds[3] + latitudeMargin || (bounds[2] - bounds[0] < 180 && (x < bounds[0] - longitudeMargin || x > bounds[2] + longitudeMargin))) continue;
    const ring = decodeRing(area.rings[r]);
    let ringInside = false;
    for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
      const ax = directLongitude ? ring[j] : unwrap(ring[j], x); const ay = ring[j + 1];
      const bx = directLongitude ? ring[i] : unwrap(ring[i], ax); const by = ring[i + 1];
      // Only nearby edges can change the border result. Ray crossing still
      // considers every edge in the candidate ring.
      if (y >= Math.min(ay, by) - latitudeMargin && y <= Math.max(ay, by) + latitudeMargin
        && x >= Math.min(ax, bx) - edgeLongitudeMargin && x <= Math.max(ax, bx) + edgeLongitudeMargin) {
        const dx = (bx - ax) * scaleX; const dy = (by - ay) * 110574;
        const length = dx * dx + dy * dy;
        const t = length ? Math.max(0, Math.min(1, ((x - ax) * scaleX * dx + (y - ay) * 110574 * dy) / length)) : 0;
        if (Math.hypot((x - ax) * scaleX - t * dx, (y - ay) * 110574 - t * dy) <= margin) return 'border';
      }
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
  return resolveCountryAt(queryPoint(point));
}

function resolveCountryAt(point: QueryPoint): Resolution {
  const matches = [];
  for (const country of countries) {
    const result = contains(country, point);
    if (result === 'border') return { status: 'border' };
    if (result === 'inside') matches.push(country);
  }
  return matches.length === 1 ? { status: 'resolved', code: matches[0].code } : { status: 'unresolved' };
}
function resolveRegion(areas: readonly Area[], point: QueryPoint) {
  const matches = new Set<string>();
  for (const region of areas) {
    const result = contains(region, point);
    if (result === 'border') return null;
    if (result === 'inside') matches.add(region.name);
  }
  return matches.size === 1 ? [...matches][0] : null;
}

export function resolveDestination(point: Coordinate): Destination | null {
  if (!valid(point)) return null;
  const query = queryPoint(point);
  const country = resolveCountryAt(query);
  if (country.status !== 'resolved') return null;
  const region = resolveRegion(regions.get(country.code) ?? [], query);
  const parent = country.code === 'VNM' && usesHistoricalVietnamProvinces(point.capturedDay)
    ? resolveRegion(vietnamProvinces.regions, query)
    : null;
  return {
    code: country.code, country: countryDisplayName(country.code)!, region: region ?? parent,
    ...(region && parent && region !== parent ? { parentRegion: parent } : {}),
  };
}

export function usesHistoricalVietnamProvinces(day: string | null | undefined): boolean {
  return Boolean(day && /^\d{4}-\d{2}-\d{2}$/.test(day)
    && day >= vietnamProvinces.validFrom && day <= vietnamProvinces.validThrough);
}
