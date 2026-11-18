const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');

const megabyte = 1024 ** 2;
const identifier = /^[a-z0-9][a-z0-9-]{0,79}$/;
const digest = /^[a-f0-9]{64}$/;
const acceptedLicenses = new Set(['CC0-1.0', 'CC-BY-4.0', 'CC-BY-SA-4.0', 'CC-BY-3.0', 'CC-BY-SA-3.0',
  'CC-BY-2.0', 'CC-BY-SA-2.0', 'PDM-1.0']);
const seoulInstituteEditions = new Map([['01', 1995], ['04', 2010], ['06', 2020]]);
const negativeControls = ['lookalike-tower', 'generic', 'screenshot', 'absent-place'];
const requiredPlaces = ['ewha', 'namsan', 'nami'];
const dinoVerifierVersion = 'dinov2-small-int8-verifier-v1';

class LandmarkBuildError extends Error {
  constructor(reasonCode, retryable = false) {
    super(reasonCode);
    this.reasonCode = reasonCode;
    this.retryable = retryable;
  }
}

function requireCondition(condition, reasonCode = 'INPUT_SCHEMA') {
  if (!condition) throw new LandmarkBuildError(reasonCode);
}

function createRun(writeEvent, signal) {
  const correlationId = randomUUID();
  let failed = false;
  const emit = (stage, reasonCode, durableOutcome, retryable = false) => writeEvent({
    operation: 'LANDMARK_PUBLIC_EVAL', reasonCode, stage, retryable, durableOutcome, correlationId,
  });
  return {
    async stage(stage, execute) {
      emit(stage, 'START', 'unchanged');
      try {
        if (signal?.aborted) throw new LandmarkBuildError('CANCELLED');
        const result = await execute();
        emit(stage, 'COMPLETE', 'complete');
        return result;
      } catch (error) {
        const known = error instanceof LandmarkBuildError;
        const reasonCode = known ? error.reasonCode : 'UNKNOWN';
        const skipped = reasonCode === 'CANCELLED' || reasonCode === 'COVERAGE_INCOMPLETE';
        if (!failed) emit(stage, reasonCode, skipped ? 'skipped' : 'unchanged', known && error.retryable);
        failed = true;
        throw error;
      }
    },
    outcome(stage, reasonCode) {
      emit(stage, reasonCode, 'skipped');
    },
  };
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function readSnapshot(file, maxBytes = 2 * megabyte) {
  let handle;
  try {
    handle = fs.openSync(file, 'r');
    const info = fs.fstatSync(handle);
    requireCondition(info.isFile() && info.size > 0 && info.size <= maxBytes, 'INPUT_LIMIT');
    const bytes = Buffer.alloc(info.size);
    let count = 0;
    while (count < bytes.length) {
      const read = fs.readSync(handle, bytes, count, bytes.length - count, count);
      if (!read) break;
      count += read;
    }
    requireCondition(count === bytes.length && fs.fstatSync(handle).size === count, 'INPUT_INTEGRITY');
    return bytes;
  } catch (error) {
    if (error instanceof LandmarkBuildError) throw error;
    throw new LandmarkBuildError('INPUT_UNAVAILABLE', true);
  } finally {
    if (handle !== undefined) fs.closeSync(handle);
  }
}

function readPinned(file, expected, maxBytes) {
  const bytes = readSnapshot(file, maxBytes);
  requireCondition(sha256(bytes) === expected, 'INPUT_INTEGRITY');
  return bytes;
}

function parseJson(bytes) {
  try {
    return JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
  } catch {
    throw new LandmarkBuildError('INPUT_SCHEMA');
  }
}

function nonempty(value, maxLength = 500) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}

function validId(value) {
  return typeof value === 'string' && identifier.test(value);
}

function validDigest(value) {
  return typeof value === 'string' && digest.test(value);
}

function parseManifest(bytes) {
  const input = parseJson(bytes);
  requireCondition(input?.version === 1 && validId(input.id) && validDigest(input.dinoModelSha256));
  requireCondition(input.saladModelSha256 === null || validDigest(input.saladModelSha256));
  const gates = input.gates;
  requireCondition(gates && Number.isInteger(gates.minimumStopGain) && gates.minimumStopGain > 0
    && Number.isFinite(gates.maximumFalseMatchRate) && gates.maximumFalseMatchRate >= 0 && gates.maximumFalseMatchRate < 1
    && ['maximumPackBytes', 'maximumScanMillis', 'maximumPeakMemoryBytes'].every((key) =>
      Number.isSafeInteger(gates[key]) && gates[key] > 0));
  requireCondition(Array.isArray(input.places) && input.places.length > 0 && input.places.length <= 200);
  requireCondition(Array.isArray(input.photos) && input.photos.length > 0 && input.photos.length <= 500);
  requireCondition(input.episodes === undefined || (Array.isArray(input.episodes) && input.episodes.length <= 32));
  requireCondition(input.samplerBudget === undefined || (Number.isInteger(input.samplerBudget)
    && input.samplerBudget >= 1 && input.samplerBudget <= 96));
  const verification = input.verification;
  requireCondition(verification === undefined || (verification && Number.isFinite(verification.margin)
    && verification.margin > 0 && verification.margin < 1));
  for (const photo of input.photos) {
    requireCondition(photo && validId(photo.id) && ['reference', 'query', 'counterexample'].includes(photo.role)
      && (validId(photo.placeId) || (photo.role === 'query' && photo.placeId === null))
      && (photo.role !== 'counterexample' || Boolean(verification))
      && ['approved', 'pending', 'rejected'].includes(photo.review));
    if (photo.review !== 'approved') continue;
    requireCondition(nonempty(photo.file, 105) && /^[a-z0-9][\w.-]{0,99}\.jpe?g$/i.test(photo.file) && validDigest(photo.sha256)
      && ['commons', 'gldv2', 'flickr', 'synthetic', 'seoul-institute', 'seoul-tourism-archive'].includes(photo.source)
      && nonempty(photo.author)
      && nonempty(photo.captureGroup, 120) && nonempty(photo.revision)
      && (photo.restrictions == null || nonempty(photo.restrictions))
      && (photo.rotateClockwise === undefined || typeof photo.rotateClockwise === 'boolean'));
    if (photo.role === 'reference') requireCondition(typeof photo.starter === 'boolean'
      && (photo.kind === undefined || ['campus-complex', 'pfeiffer-hall'].includes(photo.kind)));
    requireCondition(photo.placeId === null ? negativeControls.includes(photo.control) : photo.control == null);
  }
  requireCondition(new Set(input.photos.map(({ id }) => id)).size === input.photos.length);
  return input;
}

function publicUrl(value, hosts) {
  if (!nonempty(value, 2000)) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && hosts.includes(url.hostname) ? url : null;
  } catch {
    return null;
  }
}

function mapPlaces(places) {
  const placesById = new Map();
  const entities = new Set();
  for (const place of places) {
    const mapping = place?.mappingEvidence;
    const url = publicUrl(mapping?.url, ['www.wikidata.org']);
    requireCondition(place && validId(place.id) && nonempty(place.name)
      && /^[A-Z]{2}(?:-[A-Z0-9]{1,8})?$/.test(place.region) && /^Q[1-9][0-9]*$/.test(place.wikidataId)
      && Number.isFinite(place.latitude) && Math.abs(place.latitude) <= 90
      && Number.isFinite(place.longitude) && Math.abs(place.longitude) <= 180
      && nonempty(place.commonsCategory) && nonempty(mapping?.revision)
      && url?.pathname.split('/').at(-1) === place.wikidataId
      && !placesById.has(place.id) && !entities.has(place.wikidataId), 'PLACE_MAPPING');
    entities.add(place.wikidataId);
    const { id, name, region, wikidataId, latitude, longitude, commonsCategory } = place;
    placesById.set(id, { id, name, region, wikidataId, latitude, longitude, commonsCategory,
      mappingEvidence: { url: mapping.url, revision: mapping.revision } });
  }
  return placesById;
}

function sourceIdentity(photo) {
  if (photo.source === 'synthetic') {
    return photo.role === 'query' && photo.control === 'screenshot' && photo.url === null && photo.license === 'CC0-1.0'
      ? `synthetic:${photo.sha256}` : null;
  }
  if (photo.source === 'seoul-institute') {
    const url = publicUrl(photo.url, ['data.si.re.kr']);
    const id = url?.pathname.match(/^\/photo\/([a-z0-9]{14,15})$/i)?.[1];
    // Archive editions are separate capture campaigns. The archive names
    // the publisher, so require the matching accession prefix for the split.
    const edition = seoulInstituteEditions.get(id?.slice(0, 2));
    return edition && photo.edition === edition && photo.license === 'CC-BY-4.0'
      ? `seoul-institute:${id.toLowerCase()}` : null;
  }
  if (photo.source === 'seoul-tourism-archive') {
    const url = publicUrl(photo.url, ['archive.visitseoul.net']);
    const id = url?.pathname.match(/^\/en\/contents\/(ARP[a-z0-9]{6})\/?$/i)?.[1];
    return id && photo.license === 'KOGL-Type-1' ? `seoul-tourism-archive:${id.toLowerCase()}` : null;
  }
  const hosts = photo.source === 'commons' ? ['commons.wikimedia.org']
    : photo.source === 'flickr' ? ['www.flickr.com', 'flickr.com'] : ['commons.wikimedia.org', 'www.flickr.com', 'flickr.com'];
  const url = publicUrl(photo.url, hosts);
  if (!url) return null;
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname).replaceAll(' ', '_');
  } catch {
    return null;
  }
  if (url.hostname === 'commons.wikimedia.org' && /^\/wiki\/File:.+/.test(pathname)) {
    return `commons:${pathname.toLowerCase()}`;
  }
  const flickr = pathname.match(/^\/photos\/[^/]+\/(\d+)\/?$/);
  return flickr ? `flickr:${flickr[1]}` : null;
}

function auditSnapshot(input, placesById) {
  const admitted = [];
  const exclusions = [];
  const seen = new Map();
  const splitByPerson = new Map();
  const rows = [...input.photos].sort((left, right) => left.id.localeCompare(right.id, 'en'));
  for (const photo of rows) {
    if (photo.review !== 'approved') {
      exclusions.push({ id: photo.id, placeId: photo.placeId, reason: photo.review === 'pending' ? 'review-pending' : 'review-rejected' });
      continue;
    }
    requireCondition(placesById.has(photo.placeId) || (photo.placeId === null && photo.role === 'query'), 'PLACE_MAPPING');
    const original = sourceIdentity(photo);
    const acceptedLicense = acceptedLicenses.has(photo.license)
      || (photo.source === 'seoul-tourism-archive' && photo.license === 'KOGL-Type-1');
    if (!original || !acceptedLicense || photo.restrictions != null) {
      exclusions.push({ id: photo.id, placeId: photo.placeId, reason: original ? 'unverified-rights' : 'unverified-source' });
      continue;
    }
    const author = photo.author.normalize('NFKC').trim().toLowerCase();
    const splitKey = photo.source === 'seoul-institute' ? `seoul-institute:${photo.edition}` : author;
    const keys = [`sha:${photo.sha256}`, `source:${original}`, `capture:${photo.captureGroup}`];
    const duplicates = keys.map((key) => seen.get(key)).filter(Boolean);
    requireCondition(!splitByPerson.has(splitKey) || splitByPerson.get(splitKey) === photo.role, 'INPUT_INTEGRITY');
    splitByPerson.set(splitKey, photo.role);
    if (duplicates.length) {
      requireCondition(duplicates.every((previous) => previous.role === photo.role
        && previous.placeId === photo.placeId && previous.control === photo.control), 'INPUT_INTEGRITY');
      for (const key of keys) seen.set(key, photo);
      exclusions.push({ id: photo.id, placeId: photo.placeId, reason: 'duplicate' });
      continue;
    }
    for (const key of keys) seen.set(key, photo);
    admitted.push(photo);
  }
  const references = admitted.filter((photo) => photo.role === 'reference');
  const queries = admitted.filter((photo) => photo.role === 'query');
  const counterexamples = admitted.filter((photo) => photo.role === 'counterexample');
  requireCondition(!input.verification || (counterexamples.length > 0
    && counterexamples.every((row) => references.some((reference) => reference.placeId === row.placeId))), 'INPUT_INTEGRITY');
  const coverage = [...placesById.values()].map((place) => {
    const rows = references.filter((photo) => photo.placeId === place.id);
    const positiveQueries = queries.filter((photo) => photo.placeId === place.id).length;
    const independentReferenceAuthors = new Set(rows.map((row) => row.author.normalize('NFKC').trim().toLowerCase())).size;
    const status = rows.length === 0 ? 'absent' : independentReferenceAuthors >= 2 && positiveQueries > 0 ? 'adequate' : 'insufficient';
    return { placeId: place.id, region: place.region, starter: rows.filter((photo) => photo.starter).length,
      deep: rows.length, independentReferenceAuthors, positiveQueries, status,
      excluded: exclusions.filter((photo) => photo.placeId === place.id).length };
  });
  const starterRegions = new Set(coverage.filter((row) => row.starter > 0).map((row) => row.region.split('-')[0]));
  const negatives = Object.fromEntries(negativeControls.map((tag) => [tag,
    queries.filter((query) => query.placeId === null && query.control === tag).length]));
  const countries = new Set(coverage.map((row) => row.region.split('-')[0]));
  const independentRegion = [...countries].some((country) => country !== 'KR'
    && coverage.filter((row) => row.status === 'adequate' && row.region.startsWith(country)).length >= 2);
  const complete = requiredPlaces.every((id) => coverage.some((row) => row.placeId === id && row.status === 'adequate'))
    && independentRegion && starterRegions.has('KR') && starterRegions.size >= 2 && Object.values(negatives).every(Boolean);
  return { references, queries, counterexamples, coverage, exclusions, negatives, complete };
}

function readPublicImages(directory, photos) {
  let root;
  try {
    root = fs.realpathSync(directory);
  } catch {
    throw new LandmarkBuildError('INPUT_UNAVAILABLE', true);
  }
  const images = new Map();
  let totalBytes = 0;
  for (const photo of photos) {
    const file = path.join(root, photo.file);
    let actual;
    try {
      actual = fs.realpathSync(file);
    } catch {
      throw new LandmarkBuildError('INPUT_UNAVAILABLE', true);
    }
    requireCondition(path.dirname(actual) === root && path.basename(actual) === photo.file, 'INPUT_INTEGRITY');
    const bytes = readPinned(file, photo.sha256, Math.min(10 * megabyte, 128 * megabyte - totalBytes));
    totalBytes += bytes.length;
    images.set(photo.id, bytes);
  }
  return images;
}

module.exports = { LandmarkBuildError, requireCondition, createRun, sha256, readSnapshot, readPinned, dinoVerifierVersion,
  parseJson, parseManifest, mapPlaces, auditSnapshot, readPublicImages, megabyte, negativeControls, requiredPlaces };
