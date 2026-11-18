import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createNamiCorroborator, matcherVersion } from '../apps/mobile/scripts/offline-nami-corroboration.cjs';
import { createRun } from '../apps/mobile/scripts/offline-landmark-input.cjs';
import { assembleVisualEpisode, benchmarkOutcome } from '../evals/landmarks/benchmark-nami-visual.cjs';

const grid = 16;
const dimensions = 384;
const detail = { x: 3, y: 4, width: 4, height: 4 };
const sentinel = 'SYNTHETIC_SECRET_TEXT_URL_SOURCE_ID';

function patches(axis) {
  const data = new Float32Array(grid * grid * dimensions);
  for (let cell = 0; cell < grid * grid; cell++) data[cell * dimensions + axis(cell)] = 1;
  return data;
}

function independentDetail() {
  return patches((cell) => {
    const x = cell % grid - 7;
    const y = Math.floor(cell / grid) - 8;
    if (x >= 0 && x < detail.width && y >= 0 && y < detail.height) {
      return (detail.y + y) * grid + detail.x + x;
    }
    return 290;
  });
}

function withNoise(data, similarity, backgroundAxis) {
  const noisy = data.slice();
  for (let cell = 0; cell < grid * grid; cell += 1) {
    const offset = cell * dimensions;
    const block = noisy.subarray(offset, offset + dimensions);
    if (backgroundAxis !== undefined && block[backgroundAxis] === 1) continue;
    for (let axis = 0; axis < dimensions; axis += 1) block[axis] *= similarity;
    block[300] = Math.sqrt(1 - similarity ** 2);
  }
  return noisy;
}

function reducedReproduction() {
  return patches((cell) => {
    const x = cell % grid - 4;
    const y = Math.floor(cell / grid) - 3;
    return x >= 0 && x < 8 && y >= 0 && y < 8 ? (y * 2 + 1) * grid + x * 2 + 1 : 291;
  });
}

function fixture() {
  const features = new Map();
  const put = (id, value) => features.set(id, [{ patches: value }]);
  put('nami-detail', patches((cell) => cell));
  put('other-detail', patches(() => 292));
  put('camera-view', independentDetail());
  put('photo-on-paper', reducedReproduction());
  put('generic-view', patches(() => 293));
  put('place-name-print', patches(() => 294));
  return { features, referenceTemplates: [{ id: 'nami-detail', region: detail, subject: 'island-landmark' }],
    competingTemplates: [{ id: 'other-detail', region: detail }], reproductionSources: ['nami-detail'],
    gates: { minimumSimilarity: 0.70, minimumMargin: 0.04, minimumReproductionSimilarity: 0.84 } };
}

test('only distinctive spatial detail supplies a Nami observation with or without text', () => {
  const matcher = createNamiCorroborator(fixture());
  assert.equal(matcher.version, matcherVersion);
  const result = matcher.match({ id: 'camera-view' });
  assert.equal(result.accepted, true);
  assert.equal(result.reason, 'VISUAL_CORROBORATED');
  assert.equal(result.subject, 'island-landmark');
  assert.deepEqual(matcher.match({ id: 'camera-view' }, { textNominates: true }), result);
  const print = matcher.match({ id: 'place-name-print' }, { textNominates: true });
  assert.equal(print.accepted, false);
  assert.equal(print.subject, null);
  assert.equal(print.reason, 'TEXT_UNCORROBORATED');
  assert.equal(matcher.match({ id: 'generic-view' }).reason, 'DETAIL_UNSUPPORTED');
});

test('competing detail of the same subject forces abstention even with a text nomination', () => {
  const options = fixture();
  options.features.set('other-detail', options.features.get('nami-detail'));
  const result = createNamiCorroborator(options).match({ id: 'camera-view' }, { textNominates: true });
  assert.equal(result.detailSimilarity, result.competingSimilarity);
  assert.equal(result.reason, 'COMPETING_DETAIL');
  assert.equal(result.accepted, false);
});

test('the strongest of several references and competitors controls the result', () => {
  const options = fixture();
  options.features.set('irrelevant-reference', [{ patches: patches(() => 295) }]);
  options.referenceTemplates.unshift({ id: 'irrelevant-reference', region: detail, subject: 'different-subject' });
  assert.equal(createNamiCorroborator(options).match({ id: 'camera-view' }).subject, 'island-landmark');
  options.features.set('stronger-competitor', options.features.get('nami-detail'));
  options.competingTemplates.push({ id: 'stronger-competitor', region: detail });
  assert.equal(createNamiCorroborator(options).match({ id: 'camera-view' }).reason, 'COMPETING_DETAIL');
});

test('fractional detail similarity obeys the configured threshold', () => {
  const options = fixture();
  options.features.set('camera-view', [{ patches: withNoise(independentDetail(), 0.6, 290) }]);
  assert.equal(createNamiCorroborator(options).match({ id: 'camera-view' }).reason, 'DETAIL_UNSUPPORTED');
  options.gates.minimumSimilarity = 0.55;
  assert.equal(createNamiCorroborator(options).match({ id: 'camera-view' }).accepted, true);
});

test('a small positive lead must meet the configured competing margin', () => {
  const options = fixture();
  options.features.set('other-detail', [{ patches: withNoise(options.features.get('nami-detail')[0].patches, 0.98) }]);
  assert.equal(createNamiCorroborator(options).match({ id: 'camera-view' }).reason, 'COMPETING_DETAIL');
  options.gates.minimumMargin = 0.01;
  assert.equal(createNamiCorroborator(options).match({ id: 'camera-view' }).accepted, true);
});

test('matcher construction captures the validated competitor list and regions', () => {
  const options = fixture();
  options.features.set('other-detail', options.features.get('nami-detail'));
  const matcher = createNamiCorroborator(options);
  options.competingTemplates[0].region.x = 9;
  options.competingTemplates.length = 0;
  options.reproductionSources.length = 0;
  assert.equal(matcher.match({ id: 'camera-view' }).reason, 'COMPETING_DETAIL');
});

test('retain validated competing descriptors and classify invalid options', () => {
  const options = fixture();
  options.features.set('other-detail', [{ patches: options.features.get('nami-detail')[0].patches.slice() }]);
  const matcher = createNamiCorroborator(options);
  options.features.get('other-detail')[0].patches[0] = NaN;
  assert.equal(matcher.match({ id: 'camera-view' }).reason, 'COMPETING_DETAIL');
  assert.throws(() => createNamiCorroborator(null), { reasonCode: 'INPUT_SCHEMA' });
  assert.throws(() => matcher.match({ id: 'camera-view' }, null), { reasonCode: 'INPUT_SCHEMA' });
});

test('the benchmark requires a fixture and destination and reports malformed invocation safely', () => {
  const entry = new URL('../evals/landmarks/benchmark-nami-visual.cjs', import.meta.url);
  const result = spawnSync(process.execPath, [fileURLToPath(entry), sentinel], { encoding: 'utf8' });
  assert.equal(result.status, 2);
  assert.equal(result.stdout, '');
  assert.ok(!result.stderr.includes(sentinel));
  assert.deepEqual(result.stderr.trim().split('\n').map((row) => {
    const { stage, reasonCode } = JSON.parse(row);
    return [stage, reasonCode];
  }), [['SOURCE_READ', 'START'], ['SOURCE_READ', 'INPUT_SCHEMA']]);
});

test('a known copy cannot attach as an otherwise matching scene between two captures', () => {
  const ewha = 'ewha-womans-university';
  const namsan = 'namsan-seoul-tower';
  const schedule = [
    ['ewha-first', 5, ewha], ['copy', 6, null], ['ewha-last', 7, ewha],
    ['tower-first', 240, namsan], ['tower-last', 242, namsan],
  ];
  const photos = schedule.map(([id, minutes]) => ({
    evidence_id: id, source_ref: id, family: id, captured_at_millis: 60_000 * minutes,
    captured_day: '2026-01-01', source_origin: 'capture-like',
  }));
  const matches = new Map(schedule.map(([id, , place]) => [id, {
    place, reason: id === 'copy' ? 'REPRODUCTION_MATCH' : 'VISUAL_CORROBORATED',
  }]));
  const vector = new Float32Array(dimensions);
  vector[0] = 1;
  const embedding = { global: vector, pooled: vector, regions: [vector] };
  const features = new Map(schedule.map(([id]) => [id, [embedding]]));
  const result = assembleVisualEpisode(photos, matches, features);
  assert.deepEqual(result.stops.map(({ placeId }) => placeId), [ewha, namsan]);
  assert.deepEqual(result.membership.map(({ id }) => id), ['ewha-first', 'ewha-last', 'tower-first', 'tower-last']);
  matches.set('copy', { place: null, reason: 'DETAIL_UNSUPPORTED' });
  const ungated = assembleVisualEpisode(photos, matches, features);
  assert.equal(ungated.membership.find(({ id }) => id === 'copy')?.basis, 'scene');
});

test('host capture evidence can add a visually unnamed stop member and withhold a location clue', () => {
  const ewha = 'ewha-womans-university';
  const namsan = 'namsan-seoul-tower';
  const nami = 'nami-island';
  const schedule = [
    ['ewha-first', 5, ewha], ['ewha-last', 7, ewha],
    ['ferry', 245, nami], ['unlocated-clue', 246, nami], ['unlocated-unmatched', 246, null], ['unnamed-capture', 247, null],
    ['tower-first', 480, namsan], ['tower-last', 482, namsan],
  ];
  const photos = schedule.map(([id, minutes]) => ({
    evidence_id: id, source_ref: id, family: id, captured_at_millis: 60_000 * minutes,
    captured_day: '2026-01-01', source_origin: 'capture-like',
  }));
  const matches = new Map(schedule.map(([id, , place]) => [id, { place, reason: 'DETAIL_UNSUPPORTED' }]));
  const vector = new Float32Array(dimensions);
  vector[0] = 1;
  const embedding = { global: vector, pooled: vector, regions: [vector] };
  const features = new Map(schedule.map(([id]) => [id, [embedding]]));
  const ownLocation = new Map([
    ['ferry', { placeId: nami, kind: 'original-camera-gps', captureEvidenceId: 'gps-ferry' }],
    ['unlocated-clue', null],
    ['unnamed-capture', { placeId: nami, kind: 'original-camera-gps', captureEvidenceId: 'gps-other' }],
  ]);
  const result = assembleVisualEpisode(photos, matches, features, ownLocation);
  assert.deepEqual(result.stops.map(({ placeId, supportIds }) => [placeId, supportIds]), [
    [ewha, ['ewha-first', 'ewha-last']], [nami, ['ferry', 'unnamed-capture']], [namsan, ['tower-first', 'tower-last']],
  ]);
  assert.deepEqual(result.membership.map(({ id }) => id),
    ['ewha-first', 'ewha-last', 'ferry', 'unnamed-capture', 'tower-first', 'tower-last']);
  const visualOnly = assembleVisualEpisode(photos, matches, features);
  assert.deepEqual(visualOnly.stops[1].supportIds, ['ferry', 'unlocated-clue']);
  const derivedRows = photos.map((photo) => photo.evidence_id === 'unnamed-capture'
    ? { ...photo, family: 'ferry' } : photo);
  const sameFamily = assembleVisualEpisode(derivedRows, matches, features, ownLocation);
  assert.deepEqual(sameFamily.stops.map(({ placeId }) => placeId), [ewha, namsan]);
  assert.deepEqual(sameFamily.membership.map(({ id }) => id), ['ewha-first', 'ewha-last', 'tower-first', 'tower-last']);
});

test('capture regression can fail the quality gate by itself', () => {
  assert.equal(benchmarkOutcome(true, true, false), 'GATE_NOT_MET');
  assert.equal(benchmarkOutcome(false, true, true), 'COVERAGE_INCOMPLETE');
  assert.equal(benchmarkOutcome(true, true, true), null);
});

test('a downscaled, displaced reproduction of a known source is rejected ahead of detail or text', () => {
  const options = fixture();
  // The 0.5x template aligns with the same sampled cells as the source reprint.
  options.referenceTemplates[0].region = { ...detail, x: 4 };
  const result = createNamiCorroborator(options).match({ id: 'photo-on-paper' }, { textNominates: true });
  assert.equal(result.detailSimilarity, 1);
  assert.equal(result.reproductionSimilarity, 1);
  assert.equal(result.reason, 'REPRODUCTION_MATCH');
  assert.equal(result.accepted, false);
});

test('a fractional match to the second known source triggers the configured copy veto', () => {
  const options = fixture();
  options.referenceTemplates[0].region = { ...detail, x: 4 };
  options.reproductionSources.unshift('other-detail');
  options.features.set('photo-on-paper', [{ patches: withNoise(reducedReproduction(), 0.90, 291) }]);
  const match = () => createNamiCorroborator(options).match({ id: 'photo-on-paper' });
  assert.equal(match().reason, 'REPRODUCTION_MATCH');
  options.gates.minimumReproductionSimilarity = 0.95;
  assert.equal(match().accepted, true);
});

test('invalid matcher inputs and cancellation preserve the exact correlated scoring boundary and redact content', async (t) => {
  const cases = [
    ['invalid gate', 'INPUT_SCHEMA', (options) => { options.gates.minimumSimilarity = sentinel; }],
    ['invalid reference crop', 'INPUT_SCHEMA', (options) => { options.referenceTemplates[0].region = { x: sentinel }; }],
    ['missing reference', 'INPUT_INTEGRITY', (options) => { options.referenceTemplates = []; }],
    ['missing competing detail', 'INPUT_INTEGRITY', (options) => { options.competingTemplates = []; }],
    ['missing reproduction sources', 'INPUT_INTEGRITY', (options) => { options.reproductionSources = []; }],
    ['sparse reproduction sources', 'INPUT_SCHEMA', (options) => { options.reproductionSources = Array(1); }],
    ['overlapping positive and negative template', 'INPUT_INTEGRITY', (options) => {
      options.competingTemplates[0].id = 'nami-detail';
    }],
    ['query is a reference', 'INPUT_INTEGRITY', null, 'nami-detail'],
    ['invalid descriptor collection', 'DESCRIPTOR_SCHEMA', (options) => { options.features = sentinel; }],
    ['missing query descriptor', 'DESCRIPTOR_SCHEMA', (options) => { options.features.delete('camera-view'); }],
    ['wrong patch size', 'DESCRIPTOR_SCHEMA', (options) => {
      options.features.set('camera-view', [{ patches: new Float32Array(1) }]);
    }],
    ['invalid patch value', 'DESCRIPTOR_SCHEMA', (options) => { options.features.get('camera-view')[0].patches[0] = NaN; }],
    ['unknown fault', 'UNKNOWN', (options) => { options.features.get = () => { throw new Error(sentinel); }; }],
    ['cancelled scoring', 'CANCELLED', null, 'camera-view'],
  ];
  for (const [name, expected, modify, queryId = 'camera-view'] of cases) {
    await t.test(name, async () => {
      const options = fixture();
      modify?.(options);
      const events = [];
      const controller = new AbortController();
      const run = createRun((event) => events.push(event), controller.signal);
      await run.stage('REFERENCE_ADMISSION', async () => {});
      await assert.rejects(run.stage('BENCHMARK_SCORE', () => {
        const matcher = createNamiCorroborator({ ...options, signal: controller.signal });
        if (expected === 'CANCELLED') controller.abort();
        matcher.match({ id: queryId });
      }));
      assert.deepEqual(events.map(({ stage, reasonCode }) => [stage, reasonCode]), [
        ['REFERENCE_ADMISSION', 'START'], ['REFERENCE_ADMISSION', 'COMPLETE'],
        ['BENCHMARK_SCORE', 'START'], ['BENCHMARK_SCORE', expected],
      ]);
      assert.equal(new Set(events.map(({ correlationId }) => correlationId)).size, 1);
      assert.match(events[0].correlationId, /^[a-f0-9-]{36}$/);
      assert.deepEqual(events.at(-1), { operation: 'LANDMARK_PUBLIC_EVAL', reasonCode: expected, stage: 'BENCHMARK_SCORE',
        retryable: false, durableOutcome: expected === 'CANCELLED' ? 'skipped' : 'unchanged', correlationId: events[0].correlationId });
      assert.ok(!JSON.stringify(events).includes(sentinel));
    });
  }
});
