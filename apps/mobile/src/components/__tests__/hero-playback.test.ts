import { heroPlaybackPolicy, type HeroPlaybackInput } from '@/data/hero-playback';

const ready: HeroPlaybackInput = {
  motionPreference: 'full',
  intent: 'auto',
  appActive: true,
  pageVisible: true,
  mediaFailed: false,
  autoplayBlocked: false,
};

describe('Welcome playback policy', () => {
  it('waits for a known motion preference and stays still for reduced motion unless played deliberately', () => {
    expect(heroPlaybackPolicy({ ...ready, motionPreference: 'unknown' })).toBe(false);
    expect(heroPlaybackPolicy({ ...ready, motionPreference: 'unknown', intent: 'play' })).toBe(false);
    expect(heroPlaybackPolicy({ ...ready, motionPreference: 'reduced' })).toBe(false);
    expect(heroPlaybackPolicy({ ...ready, motionPreference: 'reduced', intent: 'play' })).toBe(true);
  });

  it('pauses for inactive or invisible pages and failed media, even after an owner play', () => {
    expect(heroPlaybackPolicy({ ...ready, intent: 'play', appActive: false })).toBe(false);
    expect(heroPlaybackPolicy({ ...ready, intent: 'play', pageVisible: false })).toBe(false);
    expect(heroPlaybackPolicy({ ...ready, intent: 'play', mediaFailed: true })).toBe(false);
  });

  it('honors owner pause and lets blocked autoplay retry only on explicit play', () => {
    expect(heroPlaybackPolicy({ ...ready, intent: 'pause' })).toBe(false);
    expect(heroPlaybackPolicy({ ...ready, autoplayBlocked: true })).toBe(false);
    expect(heroPlaybackPolicy({ ...ready, autoplayBlocked: true, intent: 'play' })).toBe(true);
  });
});
