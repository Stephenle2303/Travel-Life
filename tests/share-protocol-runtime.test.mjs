import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSnapshot, parseRange, createShareDiagnostic } from '../supabase/functions/_shared/share-protocol.ts';

const fixture = () => ({ schemaVersion: 'travel-life-share-v1', version: 'version_one', kind: 'lifetime-highlight', title: 'A selected memory', destinations: [{ key: 'destination_one', name: 'Synthetic coast', country: 'Fiction', centroid: null, date: { value: '2024-03', precision: 'month' }, status: 'inferred' }], chapters: [{ destinationKey: 'destination_one', mediaKeys: [] }], media: [], summary: { destinationCount: 1, mediaCount: 0 } });
test('v1 rejects private keys, precision inflation, dangling and duplicate references', () => {
  assert.ok(validateSnapshot(fixture()));
  for (const change of [s => { s.sourceId = 'SECRET'; }, s => { s.destinations[0].date.precision = 'day'; }, s => { s.chapters[0].destinationKey = 'other'; }, s => { s.destinations.push(s.destinations[0]); }, s => { s.title = '<script>SECRET</script>'; }, s => { s.media.push({ key: 'media' }); }]) {
    const value = fixture(); change(value); assert.equal(validateSnapshot(value), null);
  }
});
test('ranges are bounded, singular and independent of owner clock', () => {
  assert.deepEqual(parseRange('bytes=0-9', 20), { start: 0, end: 9 });
  assert.deepEqual(parseRange('bytes=-5', 20), { start: 15, end: 19 });
  for (const range of ['bytes=20-', 'bytes=3-2', 'bytes=0-1,4-5', 'bytes=0-9999999999999999']) assert.equal(parseRange(range, 20), null);
});
test('closed diagnostic boundary discards nested raw content and replaces hostile correlations', () => {
  const events = []; const log = createShareDiagnostic(value => events.push(value));
  log({ operation: 'SHARE_READ', stage: 'SHARE_MEDIA', reasonCode: 'UNAVAILABLE', durableOutcome: 'failed', retryable: true, correlationId: 'local_12345678', raw: { token: 'PRIVATE_SENTINEL' } });
  log({ operation: 'SHARE_READ', stage: 'SHARE_SNAPSHOT', reasonCode: 'PRIVATE_SENTINEL', durableOutcome: 'failed', correlationId: 'https://PRIVATE_SENTINEL' });
  assert.equal(events.length, 1); assert.equal(events[0].correlationId, 'local_12345678');
  assert.equal(JSON.stringify(events).includes('PRIVATE_SENTINEL'), false);
});
