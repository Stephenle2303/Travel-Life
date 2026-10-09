import assert from 'node:assert/strict';
import { test } from 'node:test';
import { heroPlaybackPolicy, type HeroPlaybackInput } from '../hero-playback.ts';

const ready: HeroPlaybackInput = {
  motionPreference: 'full', intent: 'auto', appActive: true,
  pageVisible: true, mediaFailed: false, autoplayBlocked: false,
};

test('a silent hero can autoplay only after motion preference resolves', () => {
  assert.equal(heroPlaybackPolicy(ready), true);
  assert.equal(heroPlaybackPolicy({ ...ready, motionPreference: 'unknown' }), false);
  assert.equal(heroPlaybackPolicy({ ...ready, motionPreference: 'unknown', intent: 'play' }), false);
});

test('reduced motion stays static until an explicit play', () => {
  assert.equal(heroPlaybackPolicy({ ...ready, motionPreference: 'reduced' }), false);
  assert.equal(heroPlaybackPolicy({ ...ready, motionPreference: 'reduced', intent: 'play' }), true);
});

test('an owner pause survives lifecycle and motion preference changes', () => {
  for (const motionPreference of ['full', 'reduced', 'unknown'] as const) {
    assert.equal(heroPlaybackPolicy({ ...ready, motionPreference, intent: 'pause' }), false);
  }
});

test('background, inactive and hidden pages stop even deliberate playback', () => {
  assert.equal(heroPlaybackPolicy({ ...ready, appActive: false, intent: 'play' }), false);
  assert.equal(heroPlaybackPolicy({ ...ready, pageVisible: false, intent: 'play' }), false);
});

test('failed media stays static while rejected autoplay permits a deliberate retry', () => {
  assert.equal(heroPlaybackPolicy({ ...ready, mediaFailed: true, intent: 'play' }), false);
  assert.equal(heroPlaybackPolicy({ ...ready, autoplayBlocked: true }), false);
  assert.equal(heroPlaybackPolicy({ ...ready, autoplayBlocked: true, intent: 'play' }), true);
});
