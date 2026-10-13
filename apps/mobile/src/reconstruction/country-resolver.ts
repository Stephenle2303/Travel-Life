import dataset from './data/natural-earth-110m-admin-0-countries-5.1.1.json';

export const NATURAL_EARTH_ADMIN_0_DATASET_VERSION = '5.1.1';
const BOUNDARY_MARGIN_DEGREES = 0.05;

type Country = { code: string; name: string; rings: [number, number][][] };
type Coordinate = { latitude: number | null; longitude: number | null };
type Resolution = { status: 'resolved'; code: string } | { status: 'invalid' | 'border' | 'unresolved' };

const countries = dataset.countries as Country[];

function pointOnSegment(longitude: number, latitude: number, start: [number, number], end: [number, number]) {
  const deltaLongitude = end[0] - start[0];
  const deltaLatitude = end[1] - start[1];
  const lengthSquared = deltaLongitude ** 2 + deltaLatitude ** 2;
  if (lengthSquared === 0) return Math.hypot(longitude - start[0], latitude - start[1]) <= BOUNDARY_MARGIN_DEGREES;
  const ratio = Math.max(0, Math.min(1, ((longitude - start[0]) * deltaLongitude + (latitude - start[1]) * deltaLatitude) / lengthSquared));
  return Math.hypot(longitude - (start[0] + ratio * deltaLongitude), latitude - (start[1] + ratio * deltaLatitude)) <= BOUNDARY_MARGIN_DEGREES;
}

function pointInRing(longitude: number, latitude: number, ring: [number, number][]) {
  let inside = false;
  for (let current = 0, previous = ring.length - 1; current < ring.length; previous = current++) {
    const [currentLongitude, currentLatitude] = ring[current];
    const [previousLongitude, previousLatitude] = ring[previous];
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
    let inside = false;
    for (const ring of country.rings) {
      for (let index = 1; index < ring.length; index += 1) if (pointOnSegment(longitude, latitude, ring[index - 1], ring[index])) return { status: 'border' };
      if (pointInRing(longitude, latitude, ring)) inside = !inside;
    }
    if (inside) matches.push(country);
  }
  return matches.length === 1 ? { status: 'resolved', code: matches[0].code } : { status: 'unresolved' };
}
