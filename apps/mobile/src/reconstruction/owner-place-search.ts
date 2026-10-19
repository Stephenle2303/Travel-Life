import dataset from './data/natural-earth-destinations-5.1.1.json';

/** A local, owner-selected display anchor. It is never new trip evidence. */
export type OwnerPlace = {
  id: string;
  name: string;
  context: string;
  latitude: number;
  longitude: number;
  aliases?: string[];
};

type Area = { code: string; name: string; bounds: number[][] };

const countries = new Map((dataset.countries as Area[]).map((country) => [country.code, country.name]));
const specialPlaces: readonly OwnerPlace[] = [{
  id: 'wikidata:Q146695', name: 'Phú Quốc', context: 'Kiên Giang, Vietnam',
  latitude: 10.233333, longitude: 103.95, aliases: ['Phu Quoc', 'Phu Quoc Island'],
}];

function normalise(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim();
}

function anchor(bounds: number[][]) {
  const [minLongitude, minLatitude, maxLongitude, maxLatitude] = bounds.reduce(([minX, minY, maxX, maxY], [left, bottom, right, top]) => [
    Math.min(minX, left), Math.min(minY, bottom), Math.max(maxX, right), Math.max(maxY, top),
  ], [Infinity, Infinity, -Infinity, -Infinity]);
  return { latitude: (minLatitude + maxLatitude) / 2, longitude: (minLongitude + maxLongitude) / 2 };
}

const regionalPlaces: readonly OwnerPlace[] = (dataset.regions as Area[]).flatMap((region) => {
  const context = countries.get(region.code);
  if (!context || !region.name || !region.bounds.length) return [];
  return [{ id: `natural-earth-admin1:${region.code}:${normalise(region.name)}`, name: region.name, context, ...anchor(region.bounds) }];
});

function score(place: OwnerPlace, query: string) {
  const values = [place.name, place.context, ...(place.aliases ?? [])].map(normalise);
  if (values.some((value) => value === query)) return 0;
  if (values.some((value) => value.startsWith(query))) return 1;
  return 2;
}

/** Searches the bundled worldwide Admin-1 gazetteer plus reviewed special places.
 * The query, selected place, source media, and journey coordinates never leave the device. */
export function searchOwnerPlaces(query: string, limit = 8): OwnerPlace[] {
  const needle = normalise(query);
  if (!needle) return [];
  return [...specialPlaces, ...regionalPlaces]
    .filter((place) => [place.name, place.context, ...(place.aliases ?? [])].some((value) => normalise(value).includes(needle)))
    .sort((left, right) => score(left, needle) - score(right, needle) || left.name.localeCompare(right.name) || left.context.localeCompare(right.context))
    .slice(0, limit);
}
