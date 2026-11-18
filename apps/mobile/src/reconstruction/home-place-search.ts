export type HomeSearchPlace = {
  id: string;
  name: string;
  context: string;
  level: string;
  latitude: number;
  longitude: number;
};

type GazetteerRow = [id: string, name: string, context: string, level: string, latitude: number, longitude: number];
type IndexedPlace = { row: GazetteerRow; normalizedName: string; normalizedContext: string };

export class HomePlaceIndexError extends Error {
  constructor() { super('Local Home place index is incompatible.'); }
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function normalizeName(value: string) {
  return normalize(value).replace(/^(?:(?:phuong|ward|xa|commune|huyen|quan|district|tinh|province|thanh pho|city) )+/, '')
    .replace(/ (?:ward|commune|district|province|city)$/, '');
}

let index: IndexedPlace[] | undefined;
function homePlaceIndex() {
  if (index) return index;
  // Avoid loading the gazetteer during Atlas startup.
  const dataset = require('./data/home-gazetteer-geonames.json') as { version?: string; places?: GazetteerRow[] };
  if (typeof dataset?.version !== 'string' || !dataset.version.startsWith('geonames-home-')
    || !Array.isArray(dataset.places) || !dataset.places.length) {
    throw new HomePlaceIndexError();
  }
  const contexts = new Map<string, string>();
  index = dataset.places.map((row) => {
    if (!Array.isArray(row)) throw new HomePlaceIndexError();
    const [sourceId, name, context, level, latitude, longitude] = row;
    if (![sourceId, name, context, level].every((value) => typeof value === 'string' && value.length > 0)
      || !Number.isFinite(latitude) || !Number.isFinite(longitude)
      || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new HomePlaceIndexError();
    let normalizedContext = contexts.get(context);
    if (!normalizedContext) { normalizedContext = normalize(context); contexts.set(context, normalizedContext); }
    return { row, normalizedName: normalizeName(name), normalizedContext };
  });
  return index;
}

/** A search result provides a source point for an owner-reviewed radius. */
export function searchHomePlaces(query: string): HomeSearchPlace[] {
  const needle = normalizeName(query.slice(0, 120));
  if (needle.length < 2) return [];
  const terms = needle.split(' ');
  const ranked: { row: GazetteerRow; rank: number }[] = [];
  const compare = (left: typeof ranked[number], right: typeof ranked[number]) => left.rank - right.rank
    || left.row[1].localeCompare(right.row[1]) || left.row[2].localeCompare(right.row[2])
    || left.row[0].localeCompare(right.row[0]);
  for (const { row, normalizedName: name, normalizedContext } of homePlaceIndex()) {
    if (!terms.some((term) => name.includes(term))
      || !terms.every((term) => name.includes(term) || normalizedContext.includes(term))) continue;
    const rank = name === needle ? 0 : name.startsWith(needle) ? 1 : name.includes(needle) ? 2 : 3;
    const candidate = { row, rank };
    const insertion = ranked.findIndex((entry) => compare(candidate, entry) < 0);
    if (insertion >= 0) ranked.splice(insertion, 0, candidate);
    else if (ranked.length < 8) ranked.push(candidate);
    if (ranked.length > 8) ranked.pop();
  }
  return ranked.map(({ row: [sourceId, name, context, level, latitude, longitude] }) => ({
    id: `geonames:${sourceId}`, name, context, level, latitude, longitude,
  }));
}
