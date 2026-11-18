import { visualCaptureSessionGap } from './discovery';
import { matchesLandmarkScore, scoreLandmarkEmbedding, type LandmarkEmbedding } from './landmark-embedding';
import { compatibleVisualPhotoClues, resolveRegionalLandmarkId, visualPlaceCountry } from './place-catalog';

export const regionalLandmarkModelSha256 = '3afdc8bc63b50558d6e5770f5b799bb82455c2311183a2de43803f343a29d917';
export const regionalLandmarkDescriptor = 'dinov2-small-int8-android-pilot';
export const regionalLandmarkVerifier = 'dinov2-small-int8-verifier-v1';
export const regionalLandmarkMaximumPackBytes = 8 * 1024 * 1024;

const maximumReferences = 96;
const maximumViews = 192;
const dimensions = 384;
const regionCount = 16;
const publicId = /^[a-z0-9][a-z0-9-]{0,79}$/;

type RegionalPlace = { readonly placeId: string; readonly country: string };
type Reference = RegionalPlace & { readonly kind?: string; readonly counterexample: boolean; readonly views: readonly LandmarkEmbedding[] };
export type RegionalLandmarkPack = {
  readonly id: string;
  readonly descriptorVersion: string;
  readonly countries: readonly string[];
  readonly margin: number | null;
  readonly references: readonly Reference[];
};
export type RegionalLandmarkHit = RegionalPlace | 'ambiguous' | null;
export type RegionalLandmarkSample = {
  id: string;
  family: string;
  capturedAtMillis: number;
  embedding?: LandmarkEmbedding;
  signagePlaceId?: string;
};
export type RegionalLandmarkSearch = {
  matches: ReadonlyMap<string, RegionalLandmarkHit>;
  route: string | null;
  conflict: boolean;
};

export class RegionalPackSchemaError extends Error {
  constructor() { super('Incompatible public landmark pack.'); }
}

function requireSchema(condition: unknown): asserts condition {
  if (!condition) throw new RegionalPackSchemaError();
}

function object(value: unknown): Record<string, unknown> {
  requireSchema(value && typeof value === 'object' && !Array.isArray(value));
  return value as Record<string, unknown>;
}

function parseVector(value: unknown): readonly number[] {
  requireSchema(Array.isArray(value) && value.length === dimensions);
  let squaredNorm = 0;
  for (const coordinate of value) {
    requireSchema(typeof coordinate === 'number' && Number.isFinite(coordinate) && Math.abs(coordinate) <= 1);
    squaredNorm += coordinate * coordinate;
  }
  requireSchema(Math.abs(squaredNorm - 1) < 0.01);
  return Object.freeze([...value]);
}

function parseEmbedding(value: unknown): LandmarkEmbedding {
  const { global, pooled, regions } = object(value);
  requireSchema(Array.isArray(regions) && regions.length === regionCount);
  const regional = regions.map(parseVector);
  Object.freeze(regional);
  return Object.freeze({ global: parseVector(global), pooled: parseVector(pooled), regions: regional });
}

/** Accepts the untrusted v1 artifact emitted by buildArtifacts after byte verification. */
export function parseRegionalLandmarkPack(value: unknown, packId: string): RegionalLandmarkPack {
  const artifact = object(value);
  const { descriptorVersion, descriptors, places, verification } = artifact;
  requireSchema((packId === 'starter' || /^[a-z]{2}$/.test(packId)) && artifact.packId === packId && artifact.version === 1);
  requireSchema(descriptorVersion === regionalLandmarkDescriptor || descriptorVersion === regionalLandmarkVerifier);
  const margin = descriptorVersion === regionalLandmarkVerifier ? object(verification).margin : null;
  requireSchema(descriptorVersion === regionalLandmarkVerifier
    ? typeof margin === 'number' && Number.isFinite(margin) && margin > 0 && margin < 1
    : verification === undefined);
  requireSchema(Array.isArray(places) && places.length > 0 && places.length <= maximumReferences);
  const placesById = new Map<string, RegionalPlace>();
  for (const rawPlace of places) {
    const { id, region } = object(rawPlace);
    requireSchema(typeof id === 'string' && !placesById.has(id) && typeof region === 'string' && /^[A-Z]{2}-[A-Z0-9]{1,3}$/.test(region));
    const place = resolveRegionalLandmarkId(id);
    requireSchema(place && region.slice(0, 2) === place.country && (packId === 'starter' || packId === place.country.toLowerCase()));
    placesById.set(id, Object.freeze({ country: place.country, placeId: place.id }));
  }
  requireSchema(Array.isArray(descriptors) && descriptors.length > 0 && descriptors.length <= maximumReferences);
  const ids = new Set<string>();
  const supported = new Set<string>();
  let viewCount = 0;
  const references = descriptors.map((descriptor): Reference => {
    const { id, placeId, kind, role, views } = object(descriptor);
    requireSchema(typeof id === 'string' && publicId.test(id) && !ids.has(id) && typeof placeId === 'string');
    const place = placesById.get(placeId);
    requireSchema(place && (kind === undefined || kind === 'campus-complex' || kind === 'pfeiffer-hall')
      && (role === undefined || (role === 'counterexample' && margin !== null))
      && Array.isArray(views) && views.length > 0 && views.length <= 3);
    ids.add(id);
    if (role !== 'counterexample') supported.add(placeId);
    viewCount += views.length;
    requireSchema(viewCount <= maximumViews);
    return Object.freeze({ ...place, kind, counterexample: role === 'counterexample', views: Object.freeze(views.map(parseEmbedding)) });
  });
  requireSchema(supported.size === placesById.size);
  const countries = [...new Set([...placesById.values()].map(({ country }) => country))].sort();
  return Object.freeze({ id: packId, descriptorVersion, countries: Object.freeze(countries), margin: margin as number | null, references: Object.freeze(references) });
}

function searchPack(pack: RegionalLandmarkPack, query: LandmarkEmbedding) {
  const matched = new Map<string, Reference>();
  const positiveScores = new Map<string, number>();
  const counterScores = new Map<string, number>();
  for (const reference of pack.references) {
    for (const view of reference.views) {
      const score = scoreLandmarkEmbedding(query, view);
      if (!reference.counterexample && matchesLandmarkScore(score, reference.kind)) matched.set(reference.placeId, reference);
      if (pack.margin === null) continue;
      const scores = reference.counterexample ? counterScores : positiveScores;
      const mean = (score.global + score.pooled + score.regional) / 3;
      scores.set(reference.placeId, Math.max(mean, scores.get(reference.placeId) ?? -Infinity));
    }
  }
  if (matched.size > 1) return { hit: 'ambiguous' as const, countries: [...new Set([...matched.values()].map(({ country }) => country))] };
  const winner = matched.values().next().value;
  if (!winner || (pack.margin !== null && counterScores.has(winner.placeId)
    && positiveScores.get(winner.placeId)! - counterScores.get(winner.placeId)! < pack.margin)) return { hit: null, countries: [] };
  const { placeId, country } = winner;
  return { hit: { placeId, country }, countries: [country] };
}

/** Only independent, accepted image matches can route. A competing country can veto. */
export function searchRegionalLandmarks(samples: readonly RegionalLandmarkSample[], starter: RegionalLandmarkPack): RegionalLandmarkSearch {
  const ordered = [...samples].sort((left, right) => left.capturedAtMillis - right.capturedAtMillis || left.id.localeCompare(right.id));
  const matches = new Map<string, RegionalLandmarkHit>();
  const countries = new Set<string>();
  const clues: { country: string; family: string; session: number }[] = [];
  let session = 0;
  let previous = -Infinity;
  for (const sample of ordered) {
    if (sample.capturedAtMillis - previous >= visualCaptureSessionGap) session += 1;
    previous = sample.capturedAtMillis;
    const signageCountry = sample.signagePlaceId && visualPlaceCountry(sample.signagePlaceId);
    if (signageCountry) countries.add(signageCountry);
    const result = sample.embedding && searchPack(starter, sample.embedding);
    const hit = result ? result.hit : null;
    matches.set(sample.id, hit);
    result && result.countries.forEach((country) => countries.add(country));
    if (hit && hit !== 'ambiguous' && (!sample.signagePlaceId || compatibleVisualPhotoClues(sample.signagePlaceId, hit.placeId))) {
      clues.push({ country: hit.country, family: sample.family, session });
    }
  }
  const conflict = countries.size > 1;
  const independent = !conflict && clues.some((left, index) => clues.slice(index + 1).some((right) =>
    left.family !== right.family && left.session !== right.session));
  return { matches, route: independent ? clues[0].country : null, conflict };
}

/** Retain starter observations and fill unresolved samples with only in-region deep hits. */
export function finishRegionalLandmarkSearch(samples: readonly RegionalLandmarkSample[], search: RegionalLandmarkSearch,
  deep: RegionalLandmarkPack | null,
): ReadonlyMap<string, RegionalLandmarkHit> {
  if (!deep || !search.route || deep.id !== search.route.toLowerCase() || deep.countries.length !== 1
    || deep.countries[0] !== search.route) return search.matches;
  const matches = new Map(search.matches);
  for (const sample of samples) {
    if (!sample.embedding || matches.get(sample.id)) continue;
    const { hit } = searchPack(deep, sample.embedding);
    if (hit && (hit === 'ambiguous' || hit.country === search.route)) matches.set(sample.id, hit);
  }
  return matches;
}
