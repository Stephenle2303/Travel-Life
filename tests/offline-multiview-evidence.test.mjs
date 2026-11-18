import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyGeometry, assessMultiview } from '../evals/landmarks/offline-multiview-evidence.cjs';
import { createRun } from '../apps/mobile/scripts/offline-landmark-input.cjs';
import { assembleVisualEpisode } from '../evals/landmarks/benchmark-nami-visual.cjs';

const nonplanar = {
  correspondences: 100, epipolarInliers: 85, planarInliers: 30, planarCoveragePpm: 170_000,
  epipolarCoveragePpm: 300_000, depthInliers: 60, depthCoveragePpm: 120_000,
};
const planar = {
  ...nonplanar, epipolarInliers: 100, planarInliers: 95, depthInliers: 5, depthCoveragePpm: 30_000,
};

test('dominant planar agreement and genuine viewpoint geometry have different outcomes', () => {
  assert.equal(classifyGeometry(planar), 'planar-match');
  assert.equal(classifyGeometry(nonplanar), 'distinct-view');
  assert.equal(classifyGeometry({ ...nonplanar, depthCoveragePpm: 59_999 }), 'inconclusive');
  assert.equal(classifyGeometry({ ...nonplanar, correspondences: 160 }), 'inconclusive');
});

test('a visual clue does not become album or stop support on an inconclusive or planar match', () => {
  const target = 'nami-island';
  const photos = ['first', 'second'];
  const matches = new Map(photos.map((id) => [id, { place: target, reason: 'VISUAL_CORROBORATED' }]));
  for (const geometry of ['inconclusive', 'planar-match']) {
    const evidence = assessMultiview(photos, matches, target, geometry);
    assert.deepEqual(evidence.clues.map(({ status }) => status), ['pending', 'pending']);
    assert.deepEqual(evidence.observations, new Map(photos.map((id) => [id, null])));
  }
  const distinct = assessMultiview(photos, matches, target, 'distinct-view');
  assert.deepEqual(distinct.observations, new Map(photos.map((id) => [id, { placeId: target }])));
  matches.set('second', { place: target, reason: 'REPRODUCTION_MATCH' });
  const knownCopy = assessMultiview(photos, matches, target, 'distinct-view');
  assert.deepEqual(knownCopy.clues, [{ id: 'first', placeId: target, status: 'pending' }]);
  assert.deepEqual(knownCopy.observations, new Map(photos.map((id) => [id, null])));
});

test('invalid geometry is rejected with a closed score-stage diagnostic', async () => {
  const events = [];
  const run = createRun((event) => events.push(event));
  await assert.rejects(run.stage('BENCHMARK_SCORE',
    () => classifyGeometry({ ...nonplanar, epipolarCoveragePpm: 'private-location-sentinel' })));
  assert.deepEqual(events.map(({ stage, reasonCode }) => [stage, reasonCode]),
    [['BENCHMARK_SCORE', 'START'], ['BENCHMARK_SCORE', 'INPUT_SCHEMA']]);
  assert.equal(new Set(events.map(({ correlationId }) => correlationId)).size, 1);
  assert.equal(events.at(-1).durableOutcome, 'unchanged');
  assert.doesNotMatch(JSON.stringify(events), /private-location-sentinel/);
  assert.throws(() => assessMultiview(['first', 'second'], new Map(), 'nami-island', 'inconclusive'),
    { reasonCode: 'INPUT_INTEGRITY' });
});

test('the assembled album includes a qualified pair and drops an inconclusive pair', () => {
  const ewha = 'ewha-womans-university';
  const nami = 'nami-island';
  const tower = 'namsan-seoul-tower';
  const schedule = [
    ['ewha-one', 5, ewha], ['ewha-two', 10, ewha],
    ['nami-one', 240, nami], ['nami-two', 245, nami],
    ['tower-one', 480, tower], ['tower-two', 485, tower],
  ];
  const photos = schedule.map(([id, minute]) => ({
    evidence_id: id, source_ref: id, family: id, captured_at_millis: minute * 60_000,
    captured_day: '2026-01-01', source_origin: 'capture-like',
  }));
  const matches = new Map(schedule.map(([id, , place]) => [id, { place, reason: 'VISUAL_CORROBORATED' }]));
  const features = new Map(schedule.map(([id]) => [id, [undefined]]));
  const pair = ['nami-one', 'nami-two'];
  const promoted = assembleVisualEpisode(photos, matches, features, assessMultiview(pair, matches, nami, 'distinct-view').observations);
  const withheld = assembleVisualEpisode(photos, matches, features, assessMultiview(pair, matches, nami, 'inconclusive').observations);
  assert.deepEqual(promoted.stops.map(({ placeId }) => placeId), [ewha, nami, tower]);
  assert.deepEqual(promoted.membership.map(({ id }) => id), schedule.map(([id]) => id));
  assert.deepEqual(withheld.stops.map(({ placeId }) => placeId), [ewha, tower]);
  assert.deepEqual(withheld.membership.map(({ id }) => id), ['ewha-one', 'ewha-two', 'tower-one', 'tower-two']);
});
