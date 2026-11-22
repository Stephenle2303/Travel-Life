import { personalRuleSentence } from '@/clues/personal-rule-copy';

describe('personalRuleSentence (CAP-7 personal learning)', () => {
  it('returns the exact closed sentence for the built rule kind', () => {
    expect(personalRuleSentence('pair-preference')).toBe("You said two trips weren't the same trip. Travel Life won't suggest merging them again.");
  });

  it('falls back to a safe generic sentence rather than exposing a raw rule kind', () => {
    const sentence = personalRuleSentence('some-future-rule-kind');
    expect(sentence).toBe('Travel Life learned a preference from a decision you made.');
    expect(sentence).not.toContain('some-future-rule-kind');
  });
});
