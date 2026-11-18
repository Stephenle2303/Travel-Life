import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import input from '../apps/mobile/scripts/offline-landmark-input.cjs';
import model from '../apps/mobile/scripts/offline-landmark-model.cjs';
import benchmark from '../apps/mobile/scripts/offline-landmark-benchmark.cjs';
import runner from '../apps/mobile/scripts/benchmark-offline-landmarks.cjs';
import details from '../apps/mobile/scripts/offline-landmark-details.cjs';
import detailRunner from '../apps/mobile/scripts/benchmark-landmark-details.cjs';

const { sha256, createRun, auditSnapshot, mapPlaces, parseManifest } = input;
const modelHash = 'a'.repeat(64);
const sentinel = 'private-sentinel-token';
const json = (value) => Buffer.from(JSON.stringify(value));
const places = [
  { id: 'ewha', name: 'Ewha', region: 'KR', wikidataId: 'Q1', latitude: 37, longitude: 126, commonsCategory: 'Example A' },
  { id: 'hanoi-a', name: 'Hanoi A', region: 'VN', wikidataId: 'Q2', latitude: 21, longitude: 105, commonsCategory: 'Example B' },
].map((place) => ({ ...place, mappingEvidence: { url: `https://www.wikidata.org/wiki/${place.wikidataId}`, revision: '101' } }));

function photo(id, role = 'reference', placeId = 'ewha', extra = {}) {
  return {
    id, file: `${id}.jpg`, sha256: sha256(Buffer.from(id)), source: 'commons',
    url: `https://commons.wikimedia.org/wiki/File:${id}.jpg`, author: `author-${id}`, captureGroup: `capture-${id}`,
    license: 'CC-BY-4.0', revision: '2026-01-01', review: 'approved', role, placeId,
    ...(role === 'reference' ? { starter: true } : {}), ...extra,
  };
}

function fixture(photos = [photo('reference-a'), photo('query-a', 'query')]) {
  return { version: 1, id: 'public-fixture', dinoModelSha256: modelHash, saladModelSha256: modelHash,
    gates: { minimumStopGain: 1, maximumFalseMatchRate: 0, maximumPackBytes: 100_000,
      maximumScanMillis: 100_000, maximumPeakMemoryBytes: 100_000_000 },
    places, photos };
}

function workspace(t, manifest = json(fixture())) {
  const runRoot = fileURLToPath(new URL('../evals/runs/', import.meta.url));
  fs.mkdirSync(runRoot, { recursive: true });
  const root = fs.mkdtempSync(path.join(runRoot, 'landmark-test-'));
  t.after(() => fs.rmSync(root, { force: true, recursive: true }));
  const options = {
    manifest: path.join(root, 'snapshot.json'), manifestHash: sha256(manifest),
    directory: root, destination: path.join(root, 'output'),
  };
  fs.writeFileSync(options.manifest, manifest);
  return options;
}

function assertDiagnostic(events, stage, reasonCode, durableOutcome = 'unchanged', retryable = false) {
  assert.equal(new Set(events.map((event) => event.correlationId)).size, 1);
  const event = events.at(-1);
  assert.match(event.correlationId, /^[0-9a-f-]{36}$/);
  assert.deepEqual(event, { operation: 'LANDMARK_PUBLIC_EVAL', stage, reasonCode,
    durableOutcome, retryable, correlationId: event.correlationId });
  assert.equal(events.filter((item) => item.reasonCode === reasonCode).length, 1);
  assert.equal(JSON.stringify(events).includes(sentinel), false);
}

test('admission deduplicates reposts and holds pending, rejected and unverified rights out of reference artifacts', () => {
  const a = photo('a');
  const b = photo('b');
  const rows = [a, b, photo('c', 'reference', 'ewha', { url: a.url }), photo('d', 'reference', 'ewha', { license: 'unknown' }),
    photo('e', 'reference', 'ewha', { review: 'pending' }), photo('f', 'reference', 'hanoi-a', { review: 'rejected' }),
    photo('g', 'query'), photo('h', 'reference', 'hanoi-a', { restrictions: 'Artwork rights unresolved' })];
  const audit = auditSnapshot(parseManifest(json(fixture(rows))), mapPlaces(places));
  assert.deepEqual(audit.references.map(({ id }) => id), ['a', 'b']);
  assert.deepEqual(audit.coverage.map(({ status }) => status), ['adequate', 'absent']);
  assert.deepEqual(audit.exclusions.map(({ reason }) => reason),
    ['duplicate', 'unverified-rights', 'review-pending', 'review-rejected', 'unverified-rights']);
  const withdrawn = auditSnapshot(fixture(rows.map((row) => row.id === 'b' ? { ...row, review: 'rejected' } : row)), mapPlaces(places));
  assert.equal(withdrawn.coverage[0].status, 'insufficient');
  assert.deepEqual(withdrawn.references.map(({ id }) => id), ['a']);
});

test('admission rejects a cross-split photographer, repeated capture, and conflicting label on a duplicate', () => {
  const a = photo('a');
  for (const b of [
    photo('b', 'query', 'ewha', { author: a.author.toUpperCase() }),
    photo('b', 'query', 'ewha', { captureGroup: a.captureGroup }),
    photo('b', 'reference', 'hanoi-a', { sha256: a.sha256 }),
  ]) {
    assert.throws(() => auditSnapshot(fixture([a, b]), mapPlaces(places)), { message: 'INPUT_INTEGRITY' });
  }
  const alias = photo('b', 'reference', 'ewha', { sha256: a.sha256 });
  const query = photo('c', 'query', 'ewha', { url: alias.url });
  assert.throws(() => auditSnapshot(fixture([a, alias, query]), mapPlaces(places)), { message: 'INPUT_INTEGRITY' });
});

test('positives cannot stand in for a negative control', () => {
  const rows = [photo('reference'), photo('positive', 'query', 'ewha', { control: 'generic' })];
  assert.throws(() => parseManifest(json(fixture(rows))), { message: 'INPUT_SCHEMA' });
  assert.equal(auditSnapshot(fixture(rows), mapPlaces(places)).negatives.generic, 0);
});

test('counterexamples are admitted separately and cannot overlap queries', () => {
  const anti = photo('other-avenue', 'counterexample');
  const input = { ...fixture([photo('ref'), anti, photo('query', 'query')]), verification: { margin: 0.035 } };
  const audit = auditSnapshot(parseManifest(json(input)), mapPlaces(places));
  assert.deepEqual(audit.references.map(({ id }) => id), ['ref']);
  assert.deepEqual(audit.counterexamples.map(({ id }) => id), ['other-avenue']);
  assert.throws(() => auditSnapshot({ ...input, photos: [...input.photos,
    photo('leak', 'query', null, { control: 'absent-place', captureGroup: anti.captureGroup })] }, mapPlaces(places)),
  { message: 'INPUT_INTEGRITY' });
  assert.throws(() => auditSnapshot({ ...input, photos: [photo('ref')] }, mapPlaces(places)), { message: 'INPUT_INTEGRITY' });
});

test('competing references can suppress a candidate but cannot create a match', () => {
  const reference = photo('real-place');
  const anti = photo('other-avenue', 'counterexample');
  const query = photo('query', 'query');
  const features = new Map([[reference.id, [0.72]], [anti.id, [0.75]], [query.id, [0]]]);
  const matcher = model.dinoVerifiedMatcher({
    matchesLandmarkEmbedding: (_, score) => score >= 0.59,
    scoreLandmarkEmbedding: (_, score) => ({ global: score, pooled: score, regional: score }),
  }, features, [anti], { margin: 0.035 });
  assert.equal(matcher.match(query, [reference]), null);
  features.set(anti.id, [0.68]);
  assert.equal(matcher.match(query, [reference]), 'ewha');
  assert.equal(matcher.match(query, []), null);
  assert.equal(matcher.match(query, [{ ...reference, placeId: 'hanoi-a' }]), 'hanoi-a');
});

test('verifier packs retain their margin and only counterexamples for included places', () => {
  const refs = [photo('reference'), photo('reference-hanoi', 'reference', 'hanoi-a')];
  const anti = [photo('another-avenue', 'counterexample')];
  const vector = new Float32Array(384).fill(0.05);
  const embedding = { global: vector, pooled: vector, regions: Array(16).fill(vector) };
  const features = new Map([...refs, ...anti].map(({ id }) => [id, [embedding, embedding]]));
  const matcher = model.dinoVerifiedMatcher({}, features, anti, { margin: 0.035 });
  const packs = benchmark.buildArtifacts(matcher, fixture(), modelHash, refs, mapPlaces(places), []);
  benchmark.verifyArtifacts(packs);
  const kr = packs.find(({ manifest }) => manifest.packId === 'kr');
  const vn = packs.find(({ manifest }) => manifest.packId === 'vn');
  assert.equal(JSON.parse(kr.artifact).verification.margin, 0.035);
  assert.equal(kr.manifest.attributions.at(-1).role, 'counterexample');
  assert.equal(vn.manifest.attributions.some(({ role }) => role === 'counterexample'), false);
  assert.throws(() => benchmark.verifyArtifacts([{ ...kr, manifest: { ...kr.manifest, verification: { margin: 0.5 } } }]),
    { message: 'ARTIFACT_INTEGRITY' });
});

test('Seoul Institute rows split by edition and reject a same-edition holdout', () => {
  const si = (edition, accession, role) => photo(`si-${accession}`, role, 'ewha', {
    source: 'seoul-institute', edition, author: 'Seoul Metropolitan Government',
    url: `https://data.si.re.kr/photo/${accession}`,
  });
  const rows = [si(2020, '06u00109aa40000', 'reference'), si(1995, '01101709aa0000', 'query'), si(2010, '04x00508ac0000', 'query')];
  const audit = auditSnapshot(parseManifest(json(fixture(rows))), mapPlaces(places));
  assert.equal(audit.queries.length, 2);
  assert.throws(() => auditSnapshot(fixture([...rows, si(2020, '06u00102aa10000', 'query')]), mapPlaces(places)),
    { message: 'INPUT_INTEGRITY' });
  assert.equal(auditSnapshot(fixture([{ ...rows[0], edition: 1995 }]), mapPlaces(places)).references.length, 0);
});

const detailRegion = { x: 2, y: 3, width: 2, height: 4 };
const independentControls = ['lookalike-tower', 'generic', 'screenshot', 'absent-place'];

function detailFixture() {
  const archive = photo('archive-a', 'reference', 'ewha', {
    source: 'seoul-tourism-archive', license: 'KOGL-Type-1', url: 'https://archive.visitseoul.net/en/contents/ARP007ra1',
  });
  const reference = photo('ref-a');
  const counterexample = photo('decoy', 'counterexample');
  return {
    ...fixture([reference, archive, counterexample, photo('target-a', 'query'), photo('target-b', 'query'),
      ...independentControls.map((control) => photo(control, 'query', null, { control })),
      photo('known-regression', 'query', null, { control: 'absent-place' })]),
    verification: { margin: 0.035 },
    detail: {
      targetPlaceId: 'ewha', minimumSimilarity: 0.7, minimumMargin: 0.04, regressionQueryIds: ['known-regression'],
      regions: Object.fromEntries([reference, archive, counterexample].map(({ id }) => [id, detailRegion])),
    },
  };
}

function patchFeatures(template, x = detailRegion.x, y = detailRegion.y, reverse = false) {
  const patches = new Float32Array(16 ** 2 * 384);
  for (let cell = 0; cell < 16 ** 2; cell++) patches[cell * 384] = 1;
  for (let row = 0; row < detailRegion.height; row++) {
    for (let column = 0; column < detailRegion.width; column++) {
      const patch = row * detailRegion.width + column;
      const offset = ((y + row) * 16 + x + column) * 384;
      patches[offset] = 0;
      patches[offset + template + (reverse ? 7 - patch : patch)] = 1;
    }
  }
  return patches;
}

test('patch detail search preserves layout while finding a displaced match without query coordinates', () => {
  const template = patchFeatures(1);
  assert.equal(details.bestLayoutSimilarity(patchFeatures(1, 11, 9), template, detailRegion), 1);
  assert.ok(details.bestLayoutSimilarity(patchFeatures(1, 11, 9, true), template, detailRegion) < 0.7);
  assert.equal(details.bestLayoutSimilarity(patchFeatures(10), template, detailRegion), 0);
});

test('detail fixture admits signed-off public source rows and keeps query regions, aliases and malformed boxes out', () => {
  const input = detailFixture();
  const parsed = parseManifest(json(input));
  const audit = auditSnapshot(parsed, mapPlaces(parsed.places));
  const plan = details.prepareDetailInputs(details.parseDetailFixture(parsed), audit);
  assert.equal(plan.ready, true);
  assert.equal(plan.coverage.targetReferenceSources, 2);
  assert.equal(plan.coverage.independentTargetCampaigns, 2);
  assert.equal(plan.coverage.independentNegativeControls['absent-place'], 1);
  assert.equal(plan.regression.length, 1);
  for (const [id, box] of [['target-a', detailRegion], ['ref-a', { ...detailRegion, width: 16 }]]) {
    assert.throws(() => details.parseDetailFixture({ ...parsed, detail: { ...parsed.detail,
      regions: { ...parsed.detail.regions, [id]: box } } }), { message: 'INPUT_SCHEMA' });
  }
  const impostor = { ...input.photos.find((row) => row.id === 'archive-a'), id: 'archive-b',
    url: 'https://archive.visitseoul.net/en/contents/ARP007RA1/', sha256: modelHash };
  const deduped = auditSnapshot({ ...input, photos: [...input.photos, impostor] }, mapPlaces(input.places));
  assert.equal(deduped.exclusions[0].reason, 'duplicate');
  const wrongLicense = input.photos.map((row) => row.id === 'archive-a' ? { ...row, license: 'CC-BY-4.0' } : row);
  const missing = auditSnapshot({ ...input, photos: wrongLicense }, mapPlaces(input.places));
  assert.throws(() => details.prepareDetailInputs(details.parseDetailFixture(parsed), missing), { message: 'INPUT_INTEGRITY' });
});

function detailAdapters() {
  return { model: {
    loadDino: () => ({}),
    decodeImages: () => new Map(),
    extractDino: async (_runtime, _api, _pixels, _signal, patchIds) =>
      new Map([...patchIds].map((id) => [id, [{ patches: patchFeatures(
        ['ref-a', 'archive-a', 'target-a', 'target-b'].includes(id) ? 1 : 10,
      ) }]])),
    dinoMatcher: () => ({ version: 'baseline', match: (row) => row.id === 'known-regression' ? 'nami' : null }),
    dinoVerifiedMatcher: () => ({ version: 'verifier', match: () => null }),
  } };
}

function detailWorkspace(t, data = detailFixture()) {
  const options = workspace(t, json(data));
  for (const row of data.photos) fs.writeFileSync(path.join(options.directory, row.file), row.id);
  return options;
}

test('paired detail benchmark measures only independent queries, checks target gain and publishes a report alone', async (t) => {
  const options = detailWorkspace(t);
  const events = [];
  const report = await detailRunner.runDetailBenchmark(options, (event) => events.push(event), undefined, detailAdapters());
  const candidate = report.comparison.scores[details.matcherVersion];
  assert.equal(report.independentQueries, 6);
  assert.equal(candidate.correctTarget, 2);
  assert.equal(candidate.falseTarget, 0);
  assert.equal(candidate.abstained, 4);
  assert.equal(candidate.regression['known-regression'], null);
  assert.equal(report.comparison.scores.baseline.regression['known-regression'], 'nami');
  assert.equal(report.result.targetPilotGate, 'passed');
  assert.equal(new Set(events.map((event) => event.correlationId)).size, 1);
  assert.deepEqual(fs.readdirSync(options.destination), ['report.json']);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(options.destination, 'report.json'), 'utf8')), report);
});

test('target gate rejects an under-gain and an unrelated image accepted as the target', async () => {
  const input = detailFixture();
  const config = details.parseDetailFixture(parseManifest(json(input)));
  const audit = auditSnapshot(input, mapPlaces(input.places));
  const plan = details.prepareDetailInputs(config, audit);
  const { model: adapters } = detailAdapters();
  const features = await adapters.extractDino(null, null, null, null, plan.patchPhotoIds);
  const score = () => details.compareDetailMatchers(input, config, plan,
    adapters.dinoMatcher(), adapters.dinoVerifiedMatcher(), audit.references, features);
  input.gates.minimumStopGain = 3;
  const insufficientGain = await score();
  assert.equal(insufficientGain.correctTargetGain, 2);
  assert.equal(insufficientGain.qualityPassed, false);
  input.gates.minimumStopGain = 1;
  features.set('generic', [{ patches: patchFeatures(1) }]);
  const falseAccept = await score();
  assert.equal(falseAccept.correctTargetGain, 2);
  assert.equal(falseAccept.targetFalseMatchRate, 0.25);
  assert.equal(falseAccept.qualityPassed, false);
  features.set('generic', [{ patches: patchFeatures(10) }]);
  features.set('known-regression', [{ patches: patchFeatures(1) }]);
  const regression = await score();
  assert.equal(regression.targetFalseMatchRate, 0);
  assert.equal(regression.targetRegressionClear, false);
  assert.equal(regression.qualityPassed, false);
});

test('detail runner reports insufficient independent controls and host memory overflow', async (t) => {
  const incomplete = detailFixture();
  incomplete.photos = incomplete.photos.filter((row) => row.control !== 'absent-place' || row.id === 'known-regression');
  const incompleteEvents = [];
  const report = await detailRunner.runDetailBenchmark(detailWorkspace(t, incomplete),
    (event) => incompleteEvents.push(event), undefined, detailAdapters());
  assert.equal(report.comparison.qualityPassed, true);
  assert.equal(report.result.targetPilotGate, 'incomplete');
  assertDiagnostic(incompleteEvents, 'BENCHMARK_SCORE', 'COVERAGE_INCOMPLETE', 'skipped');

  const bounded = detailFixture();
  bounded.gates.maximumPeakMemoryBytes = 1;
  const boundedEvents = [];
  const result = await detailRunner.runDetailBenchmark(detailWorkspace(t, bounded),
    (event) => boundedEvents.push(event), undefined, detailAdapters());
  assert.equal(result.comparison.qualityPassed, true);
  assert.equal(result.result.hostResourceGate, false);
  assert.equal(result.result.targetPilotGate, 'failed');
  assertDiagnostic(boundedEvents, 'BENCHMARK_SCORE', 'GATE_NOT_MET', 'skipped');
});

test('patch matching abstains when the competing layout is nearly as similar', async () => {
  const input = detailFixture();
  const config = details.parseDetailFixture(parseManifest(json(input)));
  const audit = auditSnapshot(input, mapPlaces(input.places));
  const plan = details.prepareDetailInputs(config, audit);
  const { model: adapters } = detailAdapters();
  const features = await adapters.extractDino(null, null, null, null, plan.patchPhotoIds);
  const competitor = patchFeatures(1);
  for (let row = detailRegion.y; row < detailRegion.y + detailRegion.height; row++) {
    for (let col = detailRegion.x; col < detailRegion.x + detailRegion.width; col++) {
      const offset = (row * 16 + col) * 384;
      for (let axis = 1; axis < 9; axis++) competitor[offset + axis] *= 0.98;
      competitor[offset + 16] = Math.sqrt(1 - 0.98 ** 2);
    }
  }
  features.set(plan.counterexamples[0].id, [{ patches: competitor }]);
  const report = await details.compareDetailMatchers(input, config, plan,
    adapters.dinoMatcher(), adapters.dinoVerifiedMatcher(), audit.references, features);
  assert.equal(report.scores[details.matcherVersion].targetAbstained, 2);
});

test('patch extraction normalizes each first-view patch and omits the class token', async () => {
  const api = model.loadSource('visual-place/landmark-embedding.ts');
  const first = new Float32Array(257 * 384);
  first[8] = 10;
  for (let index = 1; index <= 256; index++) {
    first[index * 384 + 2] = 3;
    first[index * 384 + 3] = 4;
  }
  const other = new Float32Array(257 * 384).fill(1);
  let call = 0;
  const runtime = { Tensor: class {}, session: {
    run: () => ({ last_hidden_state: { data: call++ === 0 ? first : other, dims: [1, 257, 384] } }),
    release() {},
  } };
  const rgba = new Uint8Array(224 * 224 * 4);
  const result = await model.extractDino(runtime, api,
    new Map([['selected', [rgba, rgba]], ['unselected', [rgba]]]), undefined, new Set(['selected']));
  const [full, cropped] = result.get('selected');
  assert.equal(full.patches.length, 256 * 384);
  assert.ok(Math.abs(full.patches[2] - 0.6) < 1e-6);
  assert.ok(Math.abs(full.patches[255 * 384 + 3] - 0.8) < 1e-6);
  assert.equal(full.patches[8], 0);
  assert.equal(first[386], 3);
  assert.equal(cropped.patches, undefined);
  assert.equal(result.get('unselected')[0].patches, undefined);
});

test('detail CLI rejects invalid invocation with a closed diagnostic and exit 2', () => {
  const cli = fileURLToPath(new URL('../apps/mobile/scripts/benchmark-landmark-details.cjs', import.meta.url));
  const result = spawnSync(process.execPath, [cli, sentinel], { encoding: 'utf8' });
  assert.equal(result.status, 2);
  assert.equal(result.stderr, '');
  const events = result.stdout.trim().split('\n').map((line) => JSON.parse(line));
  assertDiagnostic(events, 'SOURCE_READ', 'INPUT_SCHEMA');
});

test('an invalid local patch is classified separately from scene summaries and preserves diagnostic redaction', async (t) => {
  const options = detailWorkspace(t);
  const events = [];
  const row = new Float32Array(257 * 384).fill(1);
  row.fill(0, 384, 768);
  const pixel = new Uint8Array(224 * 224 * 4);
  let released = false;
  await assert.rejects(detailRunner.runDetailBenchmark(options, (event) => events.push(event), undefined, { model: {
    decodeImages: () => new Map([['ref-a', [pixel]]]),
    loadDino: () => ({ Tensor: class {}, session: {
      run: () => ({ last_hidden_state: { data: row, dims: [1, 257, 384] } }),
      release() { released = true; throw new Error(sentinel); },
    } }),
  } }), { message: 'DESCRIPTOR_SCHEMA' });
  assert.equal(released, true);
  assertDiagnostic(events, 'DESCRIPTOR_GENERATE', 'DESCRIPTOR_SCHEMA');
  assert.equal(fs.existsSync(options.destination), false);
});

test('detail entry point keeps stage classifications for schema, publication and cancellation faults', async (t) => {
  const invalid = detailFixture();
  invalid.detail.regions['target-a'] = { x: sentinel };
  const invalidEvents = [];
  await assert.rejects(detailRunner.runDetailBenchmark(workspace(t, json(invalid)), (event) => invalidEvents.push(event)),
    { message: 'INPUT_SCHEMA' });
  assertDiagnostic(invalidEvents, 'SOURCE_PARSE', 'INPUT_SCHEMA');
  const options = detailWorkspace(t);
  const publicationEvents = [];
  await assert.rejects(detailRunner.runDetailBenchmark(options, (event) => publicationEvents.push(event), undefined, {
    ...detailAdapters(), publish: () => { throw new Error(sentinel); },
  }));
  assertDiagnostic(publicationEvents, 'ARTIFACT_WRITE', 'UNKNOWN');
  const controller = new AbortController();
  const cancelEvents = [];
  await assert.rejects(detailRunner.runDetailBenchmark(options, (event) => {
    cancelEvents.push(event);
    if (event.stage === 'BENCHMARK_SCORE' && event.reasonCode === 'START') controller.abort();
  }, controller.signal, detailAdapters()), { message: 'CANCELLED' });
  assertDiagnostic(cancelEvents, 'BENCHMARK_SCORE', 'CANCELLED', 'skipped');
  assert.equal(fs.existsSync(options.destination), false);
});

test('audit publishes deterministic coverage and a closed incomplete status', async (t) => {
  const options = workspace(t);
  const events = [];
  const first = await runner.runBenchmark({ ...options, auditOnly: true }, (event) => events.push(event));
  const second = await runner.runBenchmark({ ...options, auditOnly: true, destination: options.destination + '-rerun' }, () => {});
  assert.deepEqual(first, second);
  assert.equal(first.result.publicGate, 'incomplete');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(options.destination, 'report.json'), 'utf8')), first);
  assertDiagnostic(events, 'BENCHMARK_SCORE', 'COVERAGE_INCOMPLETE', 'skipped');
});

test('CLI pipeline preserves exact stages and redacts sentinels for source, mapping, review, model and artifact faults', async (t) => {
  const cases = [
    ['SOURCE_READ', 'INPUT_UNAVAILABLE', true, () => json(fixture()), (options) => ({ ...options, manifest: options.manifest + sentinel })],
    ['SOURCE_READ', 'INPUT_INTEGRITY', false, () => json(fixture()), (options) => ({ ...options, manifestHash: 'f'.repeat(64) })],
    ['SOURCE_PARSE', 'INPUT_SCHEMA', false, () => Buffer.from(sentinel)],
    ['PLACE_MAPPING', 'PLACE_MAPPING', false, () => json({ ...fixture(), places: [{ ...places[0], wikidataId: sentinel }] })],
    ['REFERENCE_ADMISSION', 'INPUT_INTEGRITY', false, () => json(fixture([
      photo('a'), photo('b', 'query', 'ewha', { author: 'author-a' }),
    ]))],
    ['IMAGE_DECODE', 'IMAGE_DECODE', false, () => json(fixture()), undefined, {
      decodeImages: (images, photos, size) => model.decodeImages(images, photos, size, () => { throw new Error(sentinel); }),
    }],
    ['MODEL_LOAD', 'MODEL_UNAVAILABLE', true, () => json(fixture()), undefined, { loadDino: () => { throw new input.LandmarkBuildError('MODEL_UNAVAILABLE', true); } }],
    ['DESCRIPTOR_GENERATE', 'MODEL_INFERENCE', true, () => json(fixture()), undefined, {
      loadDino: () => ({ Tensor: class {}, session: { run: () => { throw new Error(sentinel); }, release() {} } }),
    }],
    ['DESCRIPTOR_GENERATE', 'DESCRIPTOR_SCHEMA', false, () => json(fixture()), undefined, {
      loadDino: () => ({ Tensor: class {}, session: { run: () => ({ last_hidden_state: { data: new Float32Array(1), dims: [1] } }), release() {} } }),
    }],
    ['DESCRIPTOR_GENERATE', 'MODEL_CLEANUP', true, () => json(fixture()), undefined, {
      loadDino: () => ({ Tensor: class {}, session: {
        run: () => ({ last_hidden_state: { data: new Float32Array(257 * 384).fill(1), dims: [1, 257, 384] } }),
        release() { throw new Error(sentinel); },
      } }),
    }],
    ['BENCHMARK_SCORE', 'INPUT_SCHEMA', false, () => json({ ...fixture(), episodes: [{ id: sentinel }] })],
    ['ARTIFACT_WRITE', 'UNKNOWN', false, () => json(fixture()), (options) => ({ ...options, auditOnly: true }), undefined, {
      publishArtifacts: () => { throw new Error(sentinel); },
    }],
  ];
  for (const [stage, reason, retryable, makeManifest, alterOptions, modelFault, benchmarkFault] of cases) {
    await t.test(reason, async (caseTest) => {
      const options = workspace(caseTest, makeManifest());
      if (['IMAGE_DECODE', 'MODEL_LOAD', 'DESCRIPTOR_GENERATE'].includes(stage)) {
        for (const row of fixture().photos) fs.writeFileSync(path.join(options.directory, row.file), row.id);
      }
      const events = [];
      const overrides = stage === 'IMAGE_DECODE' || !modelFault ? modelFault : {
        decodeImages: () => new Map([['reference-a', [new Uint8Array(224 * 224 * 4)]]]),
        ...modelFault,
      };
      await assert.rejects(runner.runBenchmark(alterOptions?.(options) ?? options, (event) => events.push(event),
        undefined, { model: overrides, benchmark: benchmarkFault }));
      assertDiagnostic(events, stage, reason, 'unchanged', retryable);
      assert.equal(fs.existsSync(options.destination), false);
    });
  }
});

test('cancellation ends with a skipped correlated outcome and never publishes', async (t) => {
  const options = workspace(t);
  const controller = new AbortController();
  const events = [];
  await assert.rejects(runner.runBenchmark(options, (event) => {
    events.push(event);
    if (event.stage === 'PLACE_MAPPING' && event.reasonCode === 'START') controller.abort();
  }, controller.signal), { message: 'CANCELLED' });
  assertDiagnostic(events, 'PLACE_MAPPING', 'CANCELLED', 'skipped');
  assert.equal(fs.existsSync(options.destination), false);
});

test('descriptor identity and shape are validated before matching', (t) => {
  const { directory } = workspace(t);
  const file = path.join(directory, 'salad.json');
  const row = photo('a');
  const raw = { version: 'salad-v1.0.0', modelSha256: modelHash, manifestSha256: modelHash, descriptors: { [row.sha256]: Array(8448).fill(1) } };
  const bytes = json(raw);
  fs.writeFileSync(file, bytes);
  assert.equal(model.readSalad(file, sha256(bytes), modelHash, modelHash, [row]).get('a')[0].length, 8448);
  assert.throws(() => model.readSalad(file, sha256(bytes), sentinel, modelHash, [row]), { message: 'DESCRIPTOR_SCHEMA' });
  assert.throws(() => model.readSalad(file, sha256(bytes), modelHash, sentinel, [row]), { message: 'DESCRIPTOR_SCHEMA' });
  assert.throws(() => model.readSalad(file, sha256(bytes), modelHash, modelHash, [photo('missing')]), { message: 'DESCRIPTOR_SCHEMA' });
});

test('paired runner publishes both model variants on the same inputs', async (t) => {
  const options = workspace(t);
  const photos = fixture().photos;
  for (const row of photos) fs.writeFileSync(path.join(options.directory, row.file), row.id);
  const salad = path.join(options.directory, 'salad.json');
  const saladBytes = json({ version: 'salad-v1.0.0', modelSha256: modelHash, manifestSha256: options.manifestHash,
    descriptors: Object.fromEntries(photos.map((row) => [row.sha256, Array(8448).fill(1)])) });
  fs.writeFileSync(salad, saladBytes);
  const row = new Float32Array(257 * 384).fill(1);
  const pixel = new Uint8Array(224 * 224 * 4);
  const report = await runner.runBenchmark({ ...options, salad, saladHash: sha256(saladBytes) }, () => {}, undefined, {
    model: {
      decodeImages: () => new Map([['reference-a', [pixel, pixel]], ['query-a', [pixel]]]),
      loadDino: () => ({ Tensor: class {}, session: {
        run: () => ({ last_hidden_state: { data: row, dims: [1, 257, 384] } }),
        release() {},
      } }),
    },
  });
  assert.deepEqual(Object.keys(report.scores), ['dinov2-small-int8-android-pilot', 'salad-v1.0.0-cosine-v1']);
  for (const score of Object.values(report.scores)) {
    assert.equal(score.deep.count, 1);
    assert.equal(score.deep.correct, 1);
  }
  assert.equal(report.packManifests.length, 4);
});

test('packs are deterministic and publication refuses corruption, interruption and replacement', async (t) => {
  const { destination, directory } = workspace(t);
  const fixtureInput = fixture();
  const placeMap = mapPlaces(places);
  const audit = auditSnapshot(fixtureInput, placeMap);
  const features = new Map([['reference-a', [new Float32Array(8448).fill(0.5)]]]);
  const matcher = model.saladMatcher(features);
  const pack = () => benchmark.buildArtifacts(matcher, fixtureInput, modelHash, audit.references, placeMap, audit.coverage);
  assert.deepEqual(pack(), pack());
  const packs = pack();
  benchmark.verifyArtifacts(packs);
  features.set('reference-a', [new Float32Array([0.5])]);
  assert.throws(() => benchmark.verifyArtifacts(pack()), { message: 'ARTIFACT_INTEGRITY' });
  const corrupted = [{ ...packs[0], artifact: Buffer.from(sentinel) }];
  const events = [];
  const run = createRun((event) => events.push(event));
  await assert.rejects(run.stage('ARTIFACT_VERIFY', () => benchmark.verifyArtifacts(corrupted)));
  assertDiagnostic(events, 'ARTIFACT_VERIFY', 'ARTIFACT_INTEGRITY');
  const interrupted = { ...fs, renameSync() { throw new Error(sentinel); } };
  const publishEvents = [];
  const publish = createRun((event) => publishEvents.push(event));
  await assert.rejects(publish.stage('ARTIFACT_WRITE', () => benchmark.publishArtifacts(destination, packs, { ok: true }, interrupted)));
  assertDiagnostic(publishEvents, 'ARTIFACT_WRITE', 'ARTIFACT_WRITE', 'unchanged', true);
  assert.equal(fs.existsSync(destination), false);
  assert.equal(fs.readdirSync(directory).some((filename) => filename.startsWith('.landmark-eval-')), false);
  benchmark.publishArtifacts(destination, packs, { ok: true });
  assert.throws(() => benchmark.publishArtifacts(destination, packs, { ok: false }), { message: 'OUTPUT_EXISTS' });
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(destination, 'report.json'), 'utf8')), { ok: true });
});

test('paired comparison scores ambiguity, checks two independent routing clues and gives both samplers equal work', () => {
  const fixtureInput = fixture();
  const placeMap = mapPlaces(places);
  const start = Date.UTC(2025, 0, 1, 7);
  const query = [
    photo('ewha-1', 'query'), photo('ewha-2', 'query'), photo('ewha-3', 'query'),
    photo('hanoi-1', 'query', 'hanoi-a'), photo('hanoi-2', 'query', 'hanoi-a'), photo('generic', 'query', null, { control: 'generic' }),
  ];
  const episode = { id: 'synthetic-routing', country: 'KR', expectedStops: ['ewha', 'hanoi-a'], rows: query.map((row, index) => ({
    ...row, session: index === 0 ? 'a' : 'b', capturedAtMillis: start + index * 60_000 + (index >= 3 ? 8 * 3_600_000 : 0),
  })) };
  const references = [photo('reference-a'), photo('reference-b', 'reference', 'hanoi-a', { starter: false })];
  const features = new Map([...references, ...query].map((row) => [row.id, [
    Float32Array.from(row.placeId === 'ewha' ? [1, 0, 0] : row.placeId === 'hanoi-a' ? [0, 1, 0] : [0, 0, 1]),
  ]]));
  const matcher = model.saladMatcher(features);
  const discovery = model.loadSource('visual-place/discovery.ts');
  const scores = benchmark.compareMatchers(fixtureInput, { references, queries: query }, [episode], placeMap, discovery, [matcher]);
  const result = scores[matcher.version];
  assert.equal(result.deep.correct, 5);
  assert.equal(result.deep.falseMatches, 0);
  assert.equal(result.starter.correct, 3);
  assert.ok(result.fixed.episodes[0].attempts > 0);
  assert.equal(result.fixed.episodes[0].attempts, result.progressive.episodes[0].attempts);
  assert.equal(result.routedEpisodes.correctRoutes, 1);
  assert.ok(result.routedEpisodes.episodes[0].routeAttempt >= 2);
  features.set('reference-b', [new Float32Array([1, 0, 0])]);
  assert.equal(matcher.match(query[0], references), null);
});

test('full gate requires every Korean target and nonzero equal work in both matchers and samplers', () => {
  const episodes = [{ id: 'korea', country: 'KR', expectedStops: ['ewha', 'namsan', 'nami'] },
    { id: 'vietnam', country: 'VN', expectedStops: ['hanoi-a', 'hanoi-b'] },
    { id: 'unknown', country: null, expectedStops: [] }];
  const work = { episodes: episodes.map(({ id }) => ({ episodeId: id, attempts: 5, commonBudget: 5 })),
    correctStops: 2, falseStops: 0, falseMatchRate: 0 };
  const baseline = { fixed: work, progressive: work, routedEpisodes: { ...work, correctStops: 4 } };
  const candidate = { fixed: { ...work, correctStops: 3 }, progressive: work,
    starter: { falseMatchRate: 0 }, deep: { falseMatchRate: 0 }, starterEpisodes: work,
    routedEpisodes: { ...work, regionRoutingAccuracy: 1, falseRoutes: 0, correctStops: 5, expectedStops: 5 } };
  const packs = ['starter', 'kr'].map((packId) => ({ manifest: { descriptorVersion: 'salad-v1', size: 100, packId } }));
  const assess = (inputEpisodes, variants = { baseline, candidate }) =>
    benchmark.assessGate(fixture(), { complete: true }, inputEpisodes, variants, packs).publicGate;
  assert.equal(assess(episodes), 'passed');
  assert.equal(assess(episodes, { baseline, candidate: { ...candidate, starter: { falseMatchRate: 0.1 } } }), 'failed');
  assert.equal(assess(episodes, { baseline, candidate: { ...candidate,
    routedEpisodes: { ...candidate.routedEpisodes, correctStops: 4 } } }), 'failed');
  assert.equal(assess(episodes, { baseline, candidate: { ...candidate,
    routedEpisodes: { ...candidate.routedEpisodes, falseRoutes: 1 } } }), 'failed');
  assert.equal(assess([{ ...episodes[0], expectedStops: ['ewha', 'nami'] }, episodes[1]]), 'incomplete');
  assert.equal(assess(episodes, { baseline, candidate: { ...candidate,
    progressive: { episodes: [{ episodeId: 'korea', attempts: 4, commonBudget: 5 }, work.episodes[1]] },
  } }), 'incomplete');
});

test('progressive sampling gives unresolved sessions a second attempt before spending work on resolved sessions', () => {
  const rows = [
    { id: 'match-a', session: 'a' }, { id: 'extra-a', session: 'a' },
    { id: 'miss-b', session: 'b' }, { id: 'match-b', session: 'b' },
  ];
  const attempted = [];
  assert.equal(benchmark.progressiveSample(rows, 3, ({ id }) => {
    attempted.push(id);
    return id.startsWith('match');
  }), 3);
  assert.deepEqual(attempted, ['match-a', 'miss-b', 'match-b']);
});

test('wrong images cannot earn stop credit and a false route on an unknown episode is counted', () => {
  const queries = ['one', 'two', 'three', 'four'].map((id) => photo(id, 'query', null, { control: 'absent-place' }));
  const discovery = {
    initialVisualDiscovery: () => ({}),
    advanceVisualDiscovery: (_, candidates) => ({ candidate: { representatives: candidates } }),
  };
  const sourceEpisode = { id: 'unknown', expectedStops: [],
    photos: queries.map(({ id }, index) => ({ photoId: id, session: index < 2 ? 'first' : 'second', capturedAtMillis: index })) };
  const placeMap = mapPlaces(places);
  const references = [photo('reference')];
  const matcher = { version: 'sample', match: () => 'ewha' };
  const score = (photos) => {
    const episodes = benchmark.prepareEpisodes([{ ...sourceEpisode, photos }], queries, placeMap);
    return benchmark.compareMatchers(fixture(), { queries, references }, episodes, placeMap, discovery, [matcher]).sample.routedEpisodes;
  };
  const result = score(sourceEpisode.photos);
  assert.equal(result.correctStops, 0);
  assert.equal(result.falseMatchRate, 1);
  assert.equal(result.falseRoutes, 1);
  assert.equal(result.episodes[0].routeAttempt, 3);
  assert.equal(score(sourceEpisode.photos.map((row) => ({ ...row, session: 'first' }))).falseRoutes, 0);
});
