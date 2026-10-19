import { resolveDestination, type Destination } from './country-resolver';

export type DestinationSupport = {
  placeId: string; familyId: string; latitude: number | null; longitude: number | null;
  reportedAccuracyMeters?: number | null;
};

/** Only committed visit-support belongs here; journey media membership is insufficient. */
export function destinationLabel(support: DestinationSupport[]): string {
  const places = new Map<string, Map<string, Destination | null>>();
  for (const item of support) {
    const families = places.get(item.placeId) ?? new Map<string, Destination | null>();
    const resolved = resolveDestination(item);
    if (!families.has(item.familyId)) families.set(item.familyId, resolved);
    else if (JSON.stringify(families.get(item.familyId)) !== JSON.stringify(resolved)) families.set(item.familyId, null);
    places.set(item.placeId, families);
  }
  const destinations: Destination[] = [];
  for (const families of places.values()) {
    const known = [...families.values()].filter((value): value is Destination => value !== null);
    if (known.length < 2 || new Set(known.map((value) => value.code)).size !== 1) continue;
    const names = new Set(known.map((value) => value.region));
    destinations.push({ ...known[0], region: names.size === 1 ? known[0].region : null });
  }
  const countries = [...new Set(destinations.map((value) => value.country))].sort();
  if (!countries.length) return 'Private journey';
  if (countries.length > 2) return 'Multi-country trip';
  if (countries.length === 2) return countries.join(' & ');
  const names = new Set(destinations.map((value) => value.region));
  const region = names.size === 1 ? destinations[0].region : null;
  return region && region !== countries[0] ? `${region}, ${countries[0]}` : countries[0];
}
