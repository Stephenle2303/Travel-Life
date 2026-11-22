import { reviewCardReasonSentence } from '@/clues/review-card-copy';

describe('reviewCardReasonSentence (CAP-3 owner review surface)', () => {
  it('returns the exact closed sentence for each known reason', () => {
    expect(reviewCardReasonSentence('would-lower-atlas-trip')).toBe('A new detail would change one of your confirmed trips.');
    expect(reviewCardReasonSentence('protected-confirmed-trip')).toBe('A new detail touches a trip you already confirmed a different way.');
  });

  it('falls back to a safe generic sentence rather than exposing a raw reason code', () => {
    const sentence = reviewCardReasonSentence('some-future-reason-code');
    expect(sentence).toBe('A new detail needs your review before it changes anything.');
    expect(sentence).not.toContain('some-future-reason-code');
  });
});
