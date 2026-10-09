import { getRootStackOptions } from '@/app/_layout';
import { getPressedMotionStyle, palette } from '@/components/ui';

describe('reduced-motion defaults', () => {
  it('uses no navigation animation when motion is reduced', () => {
    expect(getRootStackOptions(true)).toEqual({
      headerShown: false,
      animation: 'none',
      contentStyle: { backgroundColor: palette.rainforest },
    });
  });

  it('does not apply the pressed scale while reduced motion is active', () => {
    expect(getPressedMotionStyle(true, true)).toBe(false);
    expect(getPressedMotionStyle(true, false)).toEqual({ transform: [{ scale: 0.985 }] });
  });
});
