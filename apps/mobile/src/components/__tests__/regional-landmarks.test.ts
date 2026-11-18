import { fixtureJson, fixtureSha256, regionalFixtureEmbedding, regionalFixturePack, regionalFixtureRelease } from '@/test/regional-landmark-fixture';
import { createVisualRecognition, VisualPlaceError } from '@/visual-place/recovery';
import { finishRegionalLandmarkSearch, parseRegionalLandmarkPack, regionalLandmarkDescriptor, regionalLandmarkVerifier, searchRegionalLandmarks } from '@/visual-place/regional-landmarks';
import { createRegionalPackLoader } from '@/visual-place/regional-pack-loader';
import { regionalPackPreviewConfig } from '@/visual-place/regional-pack-config';

const minute = 60_000;
const starter = () => parseRegionalLandmarkPack(regionalFixturePack('starter', [0, 1, 2, 3]), 'starter');
const sample = (id: string, timestamp: number, axis: number, family = id) => ({
  id, family, capturedAtMillis: timestamp * minute, embedding: regionalFixtureEmbedding(axis),
});

it('corroborates a route across families and sessions, then fills only unresolved photos with deep matches', () => {
  const samples = [sample('first', 0, 0), sample('deeper', 2, 1), sample('second', 150, 2), sample('unindexed', 155, 11)];
  const search = searchRegionalLandmarks(samples, starter());
  expect(search).toMatchObject({ route: 'KR', conflict: false });
  expect(Object.fromEntries(search.matches)).toEqual({ first: { placeId: 'ewha-womans-university', country: 'KR' },
    deeper: null, second: { placeId: 'namsan-seoul-tower', country: 'KR' }, unindexed: null });
  const kr = parseRegionalLandmarkPack(regionalFixturePack('kr', [0, 1], true), 'kr');
  const vn = parseRegionalLandmarkPack(regionalFixturePack('vn', [2, 3], true), 'vn');
  expect(finishRegionalLandmarkSearch(samples, search, vn)).toBe(search.matches);
  expect(finishRegionalLandmarkSearch(samples, search, null)).toBe(search.matches);
  expect(Object.fromEntries(finishRegionalLandmarkSearch(samples, search, kr))).toEqual({ ...Object.fromEntries(search.matches),
    deeper: { placeId: 'ewha-womans-university', country: 'KR' } });
  expect(search.matches.get('deeper')).toBeNull();
});

it('abstains on repeated families, same-session positives, a competing country, and wholly unindexed albums', () => {
  const first = sample('first', 0, 0);
  const second = sample('second', 150, 2);
  expect(searchRegionalLandmarks([first, { ...second, family: first.family }], starter()).route).toBeNull();
  expect(searchRegionalLandmarks([first, { ...second, capturedAtMillis: 5 * minute }], starter()).route).toBeNull();
  const missingPreview = { id: 'missing', family: 'missing', capturedAtMillis: 75 * minute };
  expect(searchRegionalLandmarks([first, missingPreview, second], starter()).route).toBeNull();
  expect(searchRegionalLandmarks([first, second, sample('hanoi', 160, 4)], starter())).toMatchObject({ route: null, conflict: true });
  expect(searchRegionalLandmarks([first, second, { ...sample('text', 160, 11), signagePlaceId: 'taipei-101' }], starter()))
    .toMatchObject({ route: null, conflict: true });
  expect(searchRegionalLandmarks([sample('meter', 0, 11), sample('screenshot', 150, 12)], starter())).toMatchObject({ route: null, conflict: false });
});

it('preserves the distinct-place ambiguity fence even if a reference has a competing score', () => {
  const artifact = regionalFixturePack('starter', [0, 1, 2, 3]);
  artifact.descriptors[2].views[0] = regionalFixtureEmbedding(0);
  const samples = [sample('first', 0, 0), sample('second', 150, 2), sample('third', 300, 2)];
  const result = searchRegionalLandmarks(samples, parseRegionalLandmarkPack(artifact, 'starter'));
  expect(result).toMatchObject({ route: null, conflict: true });
  expect(result.matches.get('first')).toBe('ambiguous');
  const verifier = { ...regionalFixturePack('kr', [0]), descriptorVersion: regionalLandmarkVerifier, verification: { margin: 0.03 } };
  verifier.descriptors.push({ id: 'competing-public-reference', placeId: 'ewha', views: [regionalFixtureEmbedding(0)], role: 'counterexample' } as typeof verifier.descriptors[number]);
  expect(searchRegionalLandmarks([samples[0]], parseRegionalLandmarkPack(verifier, 'kr')).matches.get('first')).toBeNull();
});

it('retains an ambiguous deep result as withheld evidence without changing accepted starter hits', () => {
  const samples = [sample('first', 0, 0), sample('deeper', 2, 1), sample('second', 150, 2)];
  const search = searchRegionalLandmarks(samples, starter());
  const artifact = regionalFixturePack('kr', [0, 1], true);
  artifact.descriptors[1].views.push(regionalFixtureEmbedding(1));
  const deep = parseRegionalLandmarkPack(artifact, 'kr');
  const merged = finishRegionalLandmarkSearch(samples, search, deep);
  expect(merged.get('deeper')).toBe('ambiguous');
  expect(merged.get('first')).toEqual(search.matches.get('first'));
  expect(merged.get('second')).toEqual(search.matches.get('second'));
});

it.each(['country', 'place', 'pack', 'descriptor', 'shape', 'finite', 'count', 'duplicate'] as const)('rejects a malformed %s in a pack', (fault) => {
  const artifact = regionalFixturePack('kr', [0, 1]);
  if (fault === 'country') artifact.places = [{ ...artifact.places[0], region: 'VN-HN' }];
  if (fault === 'place') artifact.places = [{ ...artifact.places[0], id: 'unsupported' }];
  if (fault === 'pack') artifact.packId = 'vn';
  if (fault === 'descriptor') artifact.descriptorVersion = 'incompatible-model';
  if (fault === 'shape') artifact.descriptors[0].views[0] = { ...regionalFixtureEmbedding(0), regions: [] };
  if (fault === 'finite') artifact.descriptors[0].views[0].global[0] = Infinity;
  if (fault === 'count') artifact.descriptors = Array.from({ length: 97 }, (_, i) => ({ ...artifact.descriptors[0], id: `ref-${i}` }));
  if (fault === 'duplicate') artifact.descriptors.push(artifact.descriptors[0]);
  expect(() => parseRegionalLandmarkPack(artifact, 'kr')).toThrow('Incompatible public landmark pack.');
});

it('only configures the regional loader when all development settings are explicit and loopback', () => {
  const flags = { EXPO_PUBLIC_TRAVEL_LIFE_VISUAL_PLACE_PREVIEW: 'true', EXPO_PUBLIC_TRAVEL_LIFE_VISUAL_REGIONAL_PREVIEW: 'true',
    EXPO_PUBLIC_TRAVEL_LIFE_VISUAL_REGIONAL_ORIGIN: 'http://127.0.0.1:8198', EXPO_PUBLIC_TRAVEL_LIFE_VISUAL_REGIONAL_MANIFEST_SHA256: 'f'.repeat(64) };
  const before = Object.keys(flags).map((key) => [key, process.env[key]] as const);
  Object.assign(process.env, flags);
  try {
    expect(regionalPackPreviewConfig()).toEqual({ origin: 'http://127.0.0.1:8198', manifestSha256: 'f'.repeat(64) });
    for (const origin of ['https://example.test', 'http://127.0.0.1:90000', 'http://127.0.0.1:8198/a', 'http://127.0.0.1:8198?x=y']) {
      process.env.EXPO_PUBLIC_TRAVEL_LIFE_VISUAL_REGIONAL_ORIGIN = origin;
      expect(regionalPackPreviewConfig()).toBeNull();
    }
  } finally {
    for (const [key, value] of before) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

it.each([
  ['offline', 'PACK_LOAD', 'MEDIA_UNAVAILABLE', true],
  ['timeout', 'PACK_LOAD', 'HISTORY_READ_TIMEOUT', true],
  ['truncated', 'PACK_VALIDATE', 'MEDIA_VERIFY', true],
  ['corrupt', 'PACK_VALIDATE', 'MEDIA_VERIFY', true],
  ['incompatible', 'PACK_VALIDATE', 'MEDIA_SCHEMA', false],
  ['digest-timeout', 'PACK_VALIDATE', 'HISTORY_READ_TIMEOUT', true],
  ['digest-error', 'PACK_VALIDATE', 'UNKNOWN', true],
] as const)('preserves starter hits, bounds requests and classifies %s without disclosing data', async (fault, stage, reasonCode, retryable) => {
  const { files, manifest, manifestName, manifestSha256 } = regionalFixtureRelease();
  const publicRegionalFile = `${regionalLandmarkDescriptor}-vn.json`;
  const sentinel = 'synthetic-private-sentinel';
  let pin = manifestSha256;
  if (fault === 'incompatible') {
    const bytes = fixtureJson({ ...regionalFixturePack('vn', [2, 3], true), descriptorVersion: sentinel });
    files.set(publicRegionalFile, bytes);
    Object.assign(manifest.packs.find(({ packId }) => packId === 'vn')!, { size: bytes.length, sha256: fixtureSha256(bytes) });
    const nextManifest = fixtureJson(manifest);
    pin = fixtureSha256(nextManifest);
    files.set(manifestName, nextManifest);
  }
  let rejectedSignal: AbortSignal | undefined;
  const download = jest.fn(async (name: string, _limit: number, signal: AbortSignal) => {
    const bytes = files.get(name)!;
    if (name !== publicRegionalFile) return bytes;
    if (fault === 'offline') { rejectedSignal = signal; throw new VisualPlaceError('MEDIA_UNAVAILABLE'); }
    if (fault === 'timeout') return new Promise<Uint8Array>(() => {});
    if (fault === 'truncated') return bytes.slice(0, -1);
    if (fault === 'corrupt') { const damaged = bytes.slice(); damaged[0] = 65; return damaged; }
    return bytes;
  });
  const digest = jest.fn(async (bytes: Uint8Array) => {
    if (fault === 'digest-error' && bytes === files.get(publicRegionalFile)) throw new Error(sentinel);
    if (fault === 'digest-timeout' && bytes === files.get(publicRegionalFile)) return new Promise<string>(() => {});
    return fixtureSha256(bytes);
  });
  const correlationId = 'runtime-synthetic-action';
  const signal = new AbortController().signal;
  const allow = async () => true;
  const log = jest.spyOn(console, 'info').mockImplementation(() => {});
  try {
    const packs = await createRegionalPackLoader(pin, { download, digest }, 30)({ correlationId, signal, verify: async () => {} });
    expect(packs).not.toBeNull();
    const samples = [sample('first', 0, 4), sample('second', 150, 6)];
    const photos = samples.map(({ id }) => ({ id, uri: `file:///${sentinel}/${id}` }));
    const recognize = createVisualRecognition(null, undefined, async (uri) => ({ place: null,
      embedding: samples.find(({ id }) => uri.endsWith(id))!.embedding }));
    const result = await recognize({ photos, token: {}, observedPeriod: sentinel }, { approvedOnDeviceAnalysis: true, selectedIds: photos.map(({ id }) => id) },
      allow, signal, { correlationId, regional: { packs: packs!, samples } });
    expect(result.status === 'recognized' && result.observations.map(({ placeId }) => placeId)).toEqual(['turtle-tower', 'khue-van-cac']);
    expect(result.status === 'recognized' && result.retryRegionalPack).toBe(retryable ? true : undefined);
    expect(download.mock.calls.map(([name]) => name)).toEqual([manifestName, `${regionalLandmarkDescriptor}-starter.json`, publicRegionalFile]);
    if (fault === 'offline') expect(rejectedSignal?.aborted).toBe(true);
    const events = log.mock.calls.map(([, event]) => event);
    expect(new Set(events.map((event) => event.correlationId))).toEqual(new Set([correlationId]));
    expect(events.filter((event) => !['START', 'COMPLETE'].includes(event.reasonCode))).toEqual([expect.objectContaining({
      operation: 'VISUAL_PLACE_REVIEW', stage, reasonCode, durableOutcome: 'unchanged', retryable,
    })]);
    expect(JSON.stringify(events)).not.toMatch(new RegExp(`${sentinel}|turtle-tower|khue-van-cac|${publicRegionalFile}`));
  } finally { log.mockRestore(); }
});

it.each(['withdrawn', 'cancelled'] as const)('discards a regional load when authority is %s', async (fault) => {
  const { files, manifestSha256 } = regionalFixtureRelease();
  const controller = new AbortController();
  let allowed = true;
  const download = jest.fn(async (name: string) => {
    if (name.endsWith('-vn.json')) {
      if (fault === 'cancelled') controller.abort();
      else allowed = false;
    }
    return files.get(name)!;
  });
  const signal = controller.signal;
  const correlationId = 'runtime-private-test';
  const log = jest.spyOn(console, 'info').mockImplementation(() => {});
  try {
    const packs = await createRegionalPackLoader(manifestSha256, { download, digest: async (bytes) => fixtureSha256(bytes) })({
      signal, correlationId, verify: async () => {},
    });
    const samples = [sample('first', 0, 4), sample('second', 150, 6)];
    const photos = samples.map(({ id }) => ({ id, uri: `file:///${id}` }));
    const recognize = createVisualRecognition(null, undefined, async (uri) => ({ place: null,
      embedding: samples.find(({ id }) => uri.endsWith(id))!.embedding }));
    await expect(recognize({ photos, token: {}, observedPeriod: '' }, { approvedOnDeviceAnalysis: true, selectedIds: photos.map(({ id }) => id) },
      async () => allowed, signal, { correlationId, regional: { packs: packs!, samples } })).resolves.toEqual({
      status: fault === 'cancelled' ? 'cancelled' : 'stale',
    });
    const events = log.mock.calls.map(([, event]) => event);
    expect(events.filter((event) => !['START', 'COMPLETE'].includes(event.reasonCode))).toEqual([expect.objectContaining({
      stage: 'PACK_LOAD', reasonCode: fault === 'cancelled' ? 'SKIPPED' : 'HISTORY_STALE', durableOutcome: 'skipped', correlationId,
    })]);
  } finally { log.mockRestore(); }
});
