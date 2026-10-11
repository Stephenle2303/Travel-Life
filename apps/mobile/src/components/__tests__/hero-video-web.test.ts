import { requestWebPlayback } from '@/components/hero-video.web';

describe('browser Welcome video playback', () => {
  it('keeps autoplay rejection in the local fallback path', async () => {
    const blocked = jest.fn();
    const video = { play: jest.fn(() => Promise.reject(new Error('autoplay denied'))) };

    requestWebPlayback(video, blocked);
    await Promise.resolve();

    expect(blocked).toHaveBeenCalledTimes(1);
  });

  it('also handles a synchronous playback failure', () => {
    const blocked = jest.fn();
    const video = { play: jest.fn(() => { throw new Error('unsupported'); }) };

    requestWebPlayback(video, blocked);

    expect(blocked).toHaveBeenCalledTimes(1);
  });
});
