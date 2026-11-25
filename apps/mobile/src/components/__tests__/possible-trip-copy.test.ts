import { hiddenOutingReasonSentence, possibleTripReasonSentence } from '@/reconstruction/possible-trip-copy';
import type { TripOutcomeReasonCode } from '@/reconstruction/types';

describe('possibleTripReasonSentence (CAP-3, detector-v1-2.md)', () => {
  it('returns the exact closed sentence for each of the 8 card reason codes', () => {
    expect(possibleTripReasonSentence('home-not-set', 0)).toBe("Your Home isn't set for this time.");
    expect(possibleTripReasonSentence('time-conflict', 0)).toBe("Photo dates and locations don't line up.");
    expect(possibleTripReasonSentence('no-location', 0)).toBe('These photos have no location data.');
    expect(possibleTripReasonSentence('weak-location', 0)).toBe('Photo locations are too imprecise to confirm.');
    expect(possibleTripReasonSentence('near-home', 0)).toBe("It's close to your Home, so it may be an everyday outing.");
    expect(possibleTripReasonSentence('frequent-place', 0)).toBe('You come here often, so it may be everyday life.');
    expect(possibleTripReasonSentence('single-moment', 0)).toBe('All photos are from one place and moment.');
  });

  it('interpolates the located count for few-photos, singular and plural', () => {
    expect(possibleTripReasonSentence('few-photos', 1)).toBe('Only 1 photo has a location.');
    expect(possibleTripReasonSentence('few-photos', 3)).toBe('Only 3 photos have a location.');
    expect(possibleTripReasonSentence('few-photos', 0)).toBe('Only 0 photos have a location.');
  });

  it('falls back to a safe generic sentence rather than crashing on a code outside the 8-code card table', () => {
    const sentence = possibleTripReasonSentence('owner-veto' as TripOutcomeReasonCode, 0);
    expect(typeof sentence).toBe('string');
    expect(sentence.length).toBeGreaterThan(0);
    expect(sentence.toLowerCase()).not.toContain("weren't");
    expect(sentence.toLowerCase()).not.toContain("wasn't");
  });
});

describe('hiddenOutingReasonSentence (M10.11, decision 0023)', () => {
  it('returns the exact closed sentence for the Hidden outings card\'s one reason', () => {
    expect(hiddenOutingReasonSentence('brief-outing')).toBe('A short outing with only a few photos.');
  });

  it('stays in sync with possibleTripReasonSentence rather than a drifting second copy', () => {
    expect(hiddenOutingReasonSentence('brief-outing')).toBe(possibleTripReasonSentence('brief-outing', 0));
  });
});
