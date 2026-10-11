export type MotionPreference = 'unknown' | 'reduced' | 'full';
export type PlaybackIntent = 'auto' | 'play' | 'pause';

export interface HeroPlaybackInput {
  motionPreference: MotionPreference;
  intent: PlaybackIntent;
  appActive: boolean;
  pageVisible: boolean;
  mediaFailed: boolean;
  autoplayBlocked: boolean;
}

export function heroPlaybackPolicy(input: HeroPlaybackInput): boolean {
  if (input.motionPreference === 'unknown' || !input.appActive || !input.pageVisible || input.mediaFailed) return false;
  if (input.intent === 'pause') return false;
  if (input.intent === 'play') return true;
  return input.motionPreference === 'full' && !input.autoplayBlocked;
}
