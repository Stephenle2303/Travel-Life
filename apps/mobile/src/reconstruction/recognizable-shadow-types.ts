import type { RevealMapAnchor } from '@/reveal/types';

export type RecognizableShadowCard = {
  id: string;
  title: string;
  observedPeriod: string;
  coverUri: string | null;
};

export type RecognizableShadowPossibleCard = RecognizableShadowCard & {
  reason: 'limited-photos' | 'uncertain-boundary';
};

type ShadowPairTrip = Pick<RecognizableShadowCard, 'title' | 'observedPeriod'>;
export type RecognizableShadowPair = {
  id: string;
  left: ShadowPairTrip;
  right: ShadowPairTrip;
  baselineGrouping: 'joined' | 'separate' | 'unmatched';
};

export type RecognizableShadowPreview = {
  policyVersion: string;
  comparison?: {
    baselineRuleVersion: string;
    baselineTripDetectorVersion: string;
    evidenceRows: number;
    elapsedMillis: number;
  };
  separatePairs?: RecognizableShadowPair[];
  reliable: RecognizableShadowCard[];
  possible: RecognizableShadowPossibleCard[];
};

export type RecognizableReveal = {
  token: object;
  featured: (RecognizableShadowCard & { canPlay: boolean }) | null;
  possible: (RecognizableShadowPossibleCard & { canReview: boolean; canReject: boolean })[];
  observed: RevealMapAnchor[];
};
export class RecognizableComparisonLimitError extends Error {
  constructor() { super('Reconstruction comparison exceeds its local size limit.'); }
}
