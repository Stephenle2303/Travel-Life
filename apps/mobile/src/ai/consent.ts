import type { AiConsent } from './types';

/** Consent is revisioned so a prior opt-in cannot authorize a changed request. */
export function hasCurrentAiConsent(consent: AiConsent | null, requiredRevision: number) {
  return Boolean(consent?.granted && consent.revision === requiredRevision && requiredRevision >= 0);
}
