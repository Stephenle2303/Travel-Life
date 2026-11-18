import assert from 'node:assert/strict';
import test from 'node:test';
import { createRun } from '../apps/mobile/scripts/offline-landmark-input.cjs';
import { assessCaptureEvidence } from '../evals/landmarks/offline-capture-evidence.cjs';

const target = { id: 'nami-island', latitude: 37.791667, longitude: 127.525556 };
const anchor = 'namsan-seoul-tower';
const gpsKind = 'original-camera-gps';
const sentinel = 'SYNTHETIC_PRIVATE_TEXT_SOURCE_ID';

function photo(id, minute, family = id, origin = 'capture-like') {
  return { evidence_id: id, source_origin: origin, family, captured_at_millis: Date.UTC(2026, 0, 8, 0, minute) };
}

function capture({ evidence_id: assetId, family: captureFamily, captured_at_millis: observedAtMillis }, fields) {
  return { evidenceId: `gps-${assetId}`, assetId, captureFamily, observedAtMillis, kind: gpsKind,
    latitude: target.latitude, longitude: target.longitude, accuracyMeters: 15, ...fields };
}

function fixture(photos, places, captureRecords = []) {
  const matches = new Map(photos.map(({ evidence_id: id }, index) => [id, {
    place: places[index], reason: places[index] ? 'VISUAL_CORROBORATED' : 'DETAIL_UNSUPPORTED',
  }]));
  return { photos, matches, captureRecords, target, maximumDistanceMeters: 600, maximumAccuracyMeters: 75 };
}

test('a private visual clue requires independent GPS bound to its own original-like asset', () => {
  const first = photo('first-clue', 5);
  const second = photo('second-clue', 4);
  const located = photo('located-without-match', 6);
  const unlocated = photo('nearby-without-match', 7);
  const otherAnchor = photo('another-stop', 9);
  const options = fixture([first, second, located, unlocated, otherAnchor], [target.id, target.id, null, null, anchor],
    [capture(first), capture(located)]);

  const result = assessCaptureEvidence(options);

  assert.deepEqual(result.privateClues, [
    { id: second.evidence_id, placeId: target.id, status: 'pending' },
    { id: first.evidence_id, placeId: target.id, status: 'capture-eligible' },
  ]);
  assert.deepEqual(result.observations, new Map([
    [first.evidence_id, { placeId: target.id, kind: gpsKind, captureEvidenceId: 'gps-first-clue' }],
    [second.evidence_id, null],
    [located.evidence_id, { placeId: target.id, kind: gpsKind, captureEvidenceId: 'gps-located-without-match' }],
  ]));
});

test('known copies, ambiguous origin and distant or imprecise coordinates cannot supply location or album support', () => {
  const rows = [photo('detected-copy', 1), photo('unknown-origin', 2, 'unknown-origin', null),
    photo('downloaded', 3, 'downloaded', 'download'), photo('foreign', 4), photo('poor-accuracy', 5),
    photo('edge-uncertainty', 6), photo('foreign-no-match', 7), photo('screenshot', 8, 'screenshot', 'screenshot')];
  const places = [target.id, target.id, target.id, target.id, target.id, target.id, null, target.id];
  const options = fixture(rows, places, rows.map((row) => capture(row)));
  options.matches.get('detected-copy').reason = 'REPRODUCTION_MATCH';
  Object.assign(options.captureRecords[3], { latitude: 35.2 });
  Object.assign(options.captureRecords[4], { accuracyMeters: 76 });
  Object.assign(options.captureRecords[5], { latitude: target.latitude + 0.0051, accuracyMeters: 70 });
  Object.assign(options.captureRecords[6], { longitude: -127 });

  const result = assessCaptureEvidence(options);

  assert.deepEqual(result.observations, new Map(rows.map(({ evidence_id: id }) => [id, null])));
  assert.deepEqual(result.privateClues.map(({ id, status }) => [id, status]), rows
    .filter((_, index) => places[index] !== null).map(({ evidence_id: id }) => [id, 'pending']));
});

test('longitude wrap and deterministic same-time clue order preserve nearby original captures', () => {
  const rows = [photo('last-clue', 5), photo('first-clue', 5)];
  const options = fixture(rows, [target.id, target.id], rows.map((row) => capture(row, {
    latitude: 0, longitude: -179.999, accuracyMeters: 5,
  })));
  options.target = { ...target, latitude: 0, longitude: 179.999 };

  const { privateClues, observations } = assessCaptureEvidence(options);

  assert.deepEqual(privateClues.map(({ id }) => id), ['first-clue', 'last-clue']);
  assert.ok([...observations.values()].every((decision) => decision?.kind === gpsKind));
});

test('conflicting visual proposals remain pending even with an eligible location record', () => {
  const competing = photo('competing', 5);
  const options = fixture([competing], [null], [capture(competing)]);
  options.matches.get('competing').conflictingCandidate = target.id;
  const { privateClues, observations } = assessCaptureEvidence(options);
  assert.deepEqual(privateClues, [{ id: 'competing', placeId: target.id, status: 'pending' }]);
  assert.deepEqual(observations, new Map([['competing', null]]));
});

test('malformed configuration and capture rows fail with the fixed schema category', () => {
  const row = photo('capture', 5);
  const options = fixture([row], [target.id], [capture(row)]);
  for (const patch of [
    { photos: [, row] }, { matches: null }, { target: { ...target, latitude: 91 } },
    { maximumDistanceMeters: 0 }, { maximumAccuracyMeters: Infinity }, { captureRecords: [, capture(row)] },
    { captureRecords: [capture(row, { kind: 'fixture-observer-note' })] },
    { captureRecords: [capture(row, { longitude: '127.5' })] },
    { captureRecords: [capture(row, { longitude: -181 })] },
    { captureRecords: [capture(row, { accuracyMeters: 0 })] },
    { captureRecords: [capture(row, { observedAtMillis: 123.5 })] },
  ]) {
    assert.throws(() => assessCaptureEvidence({ ...options, ...patch }), { reasonCode: 'INPUT_SCHEMA' });
  }
});

test('every capture ID, family and observed time must bind to exactly one supplied asset', () => {
  const row = photo('capture', 5);
  const another = photo('another', 10);
  const options = fixture([row, another], [target.id, target.id]);
  for (const patch of [
    { photos: [row, row] }, { matches: new Map() },
    { captureRecords: [capture(row, { assetId: 'absent' })] },
    { captureRecords: [capture(row, { captureFamily: 'another' })] },
    { captureRecords: [capture(row, { observedAtMillis: another.captured_at_millis })] },
    { captureRecords: [capture(row), capture(row, { evidenceId: 'second-binding' })] },
    { captureRecords: [capture(row), capture(another, { evidenceId: 'gps-capture' })] },
  ]) {
    assert.throws(() => assessCaptureEvidence({ ...options, ...patch }), { reasonCode: 'INPUT_INTEGRITY' });
  }
});

test('score-stage fault events remain closed, correlated and leave subsequent publication untouched', async () => {
  const row = photo('capture', 5);
  const options = fixture([row], [target.id], [capture(row)]);
  for (const [expected, fault] of [
    ['INPUT_SCHEMA', () => assessCaptureEvidence({ ...options, captureRecords: [capture(row, { longitude: sentinel })] })],
    ['INPUT_INTEGRITY', () => assessCaptureEvidence({ ...options, captureRecords: [capture(row, { assetId: 'missing-fixture-id' })] })],
    ['UNKNOWN', () => { throw new Error(sentinel); }],
    ['CANCELLED', () => {}],
  ]) {
    const events = [];
    const abort = new AbortController();
    const run = createRun((event) => events.push(event), abort.signal);
    const fixtureRow = await run.stage('SOURCE_READ', () => row);
    assert.equal(fixtureRow, row);
    if (expected === 'CANCELLED') abort.abort(sentinel);
    let publicationAttempted = false;
    await assert.rejects(async () => {
      await run.stage('BENCHMARK_SCORE', fault);
      await run.stage('ARTIFACT_WRITE', () => { publicationAttempted = true; });
    });
    assert.equal(publicationAttempted, false);
    assert.equal(new Set(events.map(({ correlationId }) => correlationId)).size, 1);
    const keys = ['correlationId', 'durableOutcome', 'operation', 'reasonCode', 'retryable', 'stage'];
    events.forEach((event) => assert.deepEqual(Object.keys(event).sort(), keys));
    assert.deepEqual(events.map(({ reasonCode }) => reasonCode), ['START', 'COMPLETE', 'START', expected]);
    const terminal = events.at(-1);
    assert.equal(terminal.operation, 'LANDMARK_PUBLIC_EVAL');
    assert.equal(terminal.stage, 'BENCHMARK_SCORE');
    assert.equal(terminal.durableOutcome, expected === 'CANCELLED' ? 'skipped' : 'unchanged');
    assert.equal(terminal.retryable, false);
    assert.doesNotMatch(JSON.stringify(events), /SYNTHETIC_PRIVATE_TEXT_SOURCE_ID|missing-fixture-id|gps-capture/);
  }
});
