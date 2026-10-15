import dataset from './data/natural-earth-110m-admin-0-countries-5.1.1.json';

export const NATURAL_EARTH_ADMIN_0_DATASET_VERSION = '5.1.1';
const BOUNDARY_MARGIN_METERS = 5_000;

type Country = { code: string; name: string; rings: [number, number][][] };
type Coordinate = { latitude: number | null; longitude: number | null };
type Resolution = { status: 'resolved'; code: string } | { status: 'invalid' | 'border' | 'unresolved' };

const countries = (dataset.countries as Country[]).map((country) => ({ ...country, bounds: country.rings.reduce((bounds, ring) => ring.reduce((next, [longitude, latitude]) => ({ minLongitude: Math.min(next.minLongitude, longitude), maxLongitude: Math.max(next.maxLongitude, longitude), minLatitude: Math.min(next.minLatitude, latitude), maxLatitude: Math.max(next.maxLatitude, latitude) }), bounds), { minLongitude: Infinity, maxLongitude: -Infinity, minLatitude: Infinity, maxLatitude: -Infinity }) }));

function unwrap(longitude: number, around: number) { return longitude + Math.round((around - longitude) / 360) * 360; }
function pointOnSegment(longitude: number, latitude: number, start: [number, number], end: [number, number]) {
  const startLongitude = unwrap(start[0], longitude); const endLongitude = unwrap(end[0], startLongitude);
  const deltaLongitude = endLongitude - startLongitude;
  const deltaLatitude = end[1] - start[1];
  const lengthSquared = deltaLongitude ** 2 + deltaLatitude ** 2;
  const ratio = Math.max(0, Math.min(1, ((longitude - startLongitude) * deltaLongitude + (latitude - start[1]) * deltaLatitude) / lengthSquared));
  const meters = Math.hypot((longitude - (startLongitude + ratio * deltaLongitude)) * 111_320 * Math.cos(latitude * Math.PI / 180), (latitude - (start[1] + ratio * deltaLatitude)) * 110_574);
  return meters <= BOUNDARY_MARGIN_METERS;
}

function pointInRing(longitude: number, latitude: number, ring: [number, number][]) {
  let inside = false;
  for (let current = 0, previous = ring.length - 1; current < ring.length; previous = current++) {
    const [currentLongitude, currentLatitude] = [unwrap(ring[current][0], longitude), ring[current][1]];
    const [previousLongitude, previousLatitude] = [unwrap(ring[previous][0], currentLongitude), ring[previous][1]];
    if ((currentLatitude > latitude) !== (previousLatitude > latitude)
      && longitude < (previousLongitude - currentLongitude) * (latitude - currentLatitude) / (previousLatitude - currentLatitude) + currentLongitude) inside = !inside;
  }
  return inside;
}

/**
 * Device-only Natural Earth lookup. The country name remains in the bundled
 * geometry for attribution; callers receive a code only and never send a point
 * to a map, geocoder, or network service.
 */
export function resolveCountry(coordinate: Coordinate): Resolution {
  const { latitude, longitude } = coordinate;
  if (latitude === null || longitude === null || !Number.isFinite(latitude) || !Number.isFinite(longitude)
    || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return { status: 'invalid' };
  const matches: Country[] = [];
  for (const country of countries) {
    if (latitude < country.bounds.minLatitude - 1 || latitude > country.bounds.maxLatitude + 1 || longitude < country.bounds.minLongitude - 1 || longitude > country.bounds.maxLongitude + 1) continue;
    let inside = false;
    for (const ring of country.rings) {
      for (let index = 1; index < ring.length; index += 1) if (pointOnSegment(longitude, latitude, ring[index - 1], ring[index])) return { status: 'border' };
      if (pointInRing(longitude, latitude, ring)) inside = !inside;
    }
    if (inside) matches.push(country);
  }
  return matches.length === 1 ? { status: 'resolved', code: matches[0].code } : { status: 'unresolved' };
}
