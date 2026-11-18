import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPartialProposal } from '../evals/landmarks/benchmark-nami-visual.cjs';

const ewha = 'ewha-womans-university';
const nami = 'nami-island';
const tower = 'namsan-seoul-tower';

function fixture() {
  const schedule = [
    ['ewha-one', 5, ewha],
    ['unnamed-campus', 6, null],
    ['copy-between-anchors', 6, null, 'REPRODUCTION_MATCH'],
    ['unrelated-between-anchors', 6, null],
    ['screen-between-anchors', 6, null, 'DETAIL_UNSUPPORTED', 'screenshot'],
    ['ewha-two', 7, ewha],
    ['nami-ferry', 240, nami],
    ['nami-zipline', 244, nami],
    ['tower-one', 480, tower],
    ['tower-two', 485, tower],
  ];
  const photos = schedule.map(([id, minute, , , origin = 'capture-like']) => ({
    evidence_id: id, source_ref: id, family: id, captured_at_millis: minute * 60_000,
    captured_day: '2026-01-01', source_origin: origin,
  }));
  const matches = new Map(schedule.map(([id, , place, reason = 'DETAIL_UNSUPPORTED']) => [id, { place, reason }]));
  const sameScene = new Float32Array(384);
  sameScene[0] = 1;
  const otherScene = new Float32Array(384);
  otherScene[1] = 1;
  const features = new Map(schedule.map(([id]) => {
    const descriptor = id === 'unrelated-between-anchors' ? otherScene : sameScene;
    return [id, [{ global: descriptor, pooled: descriptor, regions: [descriptor] }]];
  }));
  const evidence = {
    observations: new Map([['nami-ferry', null], ['nami-zipline', null]]),
    clues: [
      { id: 'nami-ferry', placeId: nami, status: 'pending' },
      { id: 'nami-zipline', placeId: nami, status: 'pending' },
      { id: 'screen-between-anchors', placeId: 'excluded-screen-place', status: 'pending' },
      { id: 'copy-between-anchors', placeId: 'excluded-copy-place', status: 'pending' },
      { id: 'not-in-this-episode', placeId: 'excluded-other-episode-place', status: 'pending' },
    ],
  };
  return { photos, matches, features, evidence };
}

test('a Seoul proposal keeps Nami pending and admits only the independently supported unnamed scene', () => {
  const { photos, matches, features, evidence } = fixture();
  const { album, pendingClues } = buildPartialProposal(photos, matches, features, evidence);
  assert.equal(album.placeId, 'locality-seoul');
  assert.deepEqual(pendingClues, [nami]);
  assert.deepEqual(album.stops, [
    { placeId: ewha, supportIds: ['ewha-one', 'ewha-two'] },
    { placeId: tower, supportIds: ['tower-one', 'tower-two'] },
  ]);
  assert.deepEqual(album.coverIds, ['ewha-one', 'tower-one']);
  assert.deepEqual(album.membership.map(({ id }) => id), ['ewha-one', 'unnamed-campus', 'ewha-two', 'tower-one', 'tower-two']);
  assert.deepEqual(album.membership[1], { id: 'unnamed-campus', placeId: ewha, basis: 'scene' });
  assert.equal(Object.hasOwn(photos[1], 'latitude'), false);
  assert.equal(matches.get('unnamed-campus').place, null);
});

test('one-sided context does not admit the unnamed photo', () => {
  const { photos, matches, features, evidence } = fixture();
  photos.find(({ evidence_id }) => evidence_id === 'ewha-two').captured_at_millis = 10 * 60_000;
  const { album } = buildPartialProposal(photos, matches, features, evidence);
  assert.deepEqual(album.membership.map(({ id }) => id), ['ewha-one', 'ewha-two', 'tower-one', 'tower-two']);
});

test('a private place clue cannot publish a proposal without a qualified trip', () => {
  const { photos, matches, features, evidence } = fixture();
  const oneStop = photos.filter(({ evidence_id }) => !evidence_id.startsWith('tower'));
  assert.equal(buildPartialProposal(oneStop, matches, features, evidence), null);
});

test('missing decisions for pending visual matches cannot promote them', () => {
  const { photos, matches, features, evidence } = fixture();
  const { album, pendingClues } = buildPartialProposal(photos, matches, features, { ...evidence, observations: new Map() });
  assert.deepEqual(pendingClues, [nami]);
  assert.deepEqual(album.stops.map(({ placeId }) => placeId), [ewha, tower]);
  assert.ok(!album.membership.some(({ id }) => id.startsWith('nami-')));
});
