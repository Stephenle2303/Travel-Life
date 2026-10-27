import { createAnonymousSessionProvider } from '@/ai/session';
import type { JourneyEligibility } from '@/reveal/types';
import { createSharePublishController } from './publish-controller';
import { createShareTransport } from './transport';

/** One owner-only composition point; absent environment keeps publishing disabled. */
export function createShareService(getEligibility: (displayId: string, snapshotToken: number, expectedPrivacyRevision: number) => Promise<JourneyEligibility>) {
  const url = process.env.EXPO_PUBLIC_TRAVEL_LIFE_SUPABASE_URL;
  const publishableKey = process.env.EXPO_PUBLIC_TRAVEL_LIFE_SUPABASE_PUBLISHABLE_KEY;
  const endpoint = url ? `${url.replace(/\/$/, '')}/functions/v1/travel-life-share` : undefined;
  const session = createAnonymousSessionProvider({ url, publishableKey });
  const transport = createShareTransport({ endpoint, publishableKey, session });
  return createSharePublishController({ getEligibility, transport });
}
