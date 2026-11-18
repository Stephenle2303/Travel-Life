import { resolveDestination, usesHistoricalVietnamProvinces, type Destination } from './country-resolver';

export type DestinationSupport = {
  placeId: string; familyId: string; latitude: number | null; longitude: number | null;
  reportedAccuracyMeters?: number | null; capturedDay?: string | null;
};

/** Only committed visit-support belongs here; journey media membership is insufficient. */
export async function destinationLabel(support: DestinationSupport[], fullTitle = false,
  resolvedPoints = new Map<string, Destination | null>()): Promise<string> {
  const places = new Map<string, Map<string, Destination | null>>();
  let yieldAfter = Date.now() + 12;
  for (const item of support) {
    if (Date.now() >= yieldAfter) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      yieldAfter = Date.now() + 12;
    }
    const families = places.get(item.placeId) ?? new Map<string, Destination | null>();
    const { latitude, longitude, reportedAccuracyMeters } = item;
    const key = `${latitude}/${longitude}/${reportedAccuracyMeters ?? 0}/${usesHistoricalVietnamProvinces(item.capturedDay)}`;
    let resolved = resolvedPoints.get(key);
    if (resolved === undefined) {
      resolved = resolveDestination(item);
      if (resolvedPoints.size < 8192) resolvedPoints.set(key, resolved);
    }
    if (!families.has(item.familyId)) families.set(item.familyId, resolved);
    else if (JSON.stringify(families.get(item.familyId)) !== JSON.stringify(resolved)) families.set(item.familyId, null);
    places.set(item.placeId, families);
  }
  const destinations: Destination[] = [];
  for (const families of places.values()) {
    const known = [...families.values()].filter((value): value is Destination => value !== null);
    if (known.length < 2 || new Set(known.map((value) => value.code)).size !== 1) continue;
    const names = new Set(known.map((value) => value.region));
    const parents = new Set(known.map((value) => value.parentRegion ?? value.region));
    const region = names.size === 1 ? known[0].region : parents.size === 1 ? [...parents][0] : null;
    destinations.push({ ...known[0], region });
  }
  const countries = [...new Set(destinations.map((value) => value.country))].sort();
  if (!countries.length) return 'Private journey';
  if (countries.length > 2) return 'Multi-country trip';
  if (countries.length === 2) return countries.join(' & ');
  if (destinations[0].code === 'VNM') {
    const names = [...new Set(destinations.flatMap(({ region }) => region ? [region] : []))].sort();
    if (names.length) {
      if (names.length > 2 && !fullTitle) return `${names.slice(0, 2).join(' · ')} +${names.length - 2}`;
      return `${names.join(' · ')}, ${countries[0]}`;
    }
  }
  const names = new Set(destinations.map((value) => value.region));
  const region = names.size === 1 ? destinations[0].region : null;
  return region && region !== countries[0] ? `${region}, ${countries[0]}` : countries[0];
}
