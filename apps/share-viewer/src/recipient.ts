import { SHARE_CONTRACT, createShareDiagnostic, newCorrelation, opaque, validateSnapshot } from '../../../supabase/functions/_shared/share-protocol.ts';
import type { ShareSnapshot } from '../../../supabase/functions/_shared/share-protocol.ts';
export type Recipient = { snapshot: ShareSnapshot; expiresAt: string };
export const diagnostic = createShareDiagnostic(event => console.info('[Travel Life share diagnostic]', event));
export function takeCapability(location: Pick<Location, 'hash' | 'pathname' | 'search'>, history: Pick<History, 'replaceState'>): string | null {
  const value = location.hash.startsWith('#') ? location.hash.slice(1) : '';
  // Erase before any network request, third-party module, or resource fetch.
  history.replaceState(null, '', location.pathname);
  return !location.search && opaque(value, 43, 43) ? value : null;
}
export function createRecipientClient(endpoint: string, publishableKey: string, capability: string, fetcher = fetch) {
  const correlationId = newCorrelation();
  const event = (stage: string, reasonCode: string, durableOutcome: string) => diagnostic({ operation: 'SHARE_READ', stage, reasonCode, durableOutcome, retryable: reasonCode === 'UNAVAILABLE', correlationId });
  async function post(body: unknown, stage: string) {
    event(stage, 'START', 'unchanged');
    try {
      if (!/^https:\/\//.test(endpoint) && !/^http:\/\/127\.0\.0\.1:\d+\//.test(endpoint)) throw new Error();
      const response = await fetcher(endpoint, { method: 'POST', cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', headers: { apikey: publishableKey, 'content-type': 'application/json', 'x-share-capability': capability, 'x-travel-life-correlation': correlationId }, body: JSON.stringify(body) });
      if (!response.ok) { event(stage, 'UNAVAILABLE', 'failed'); return null; }
      return response;
    } catch { event(stage, 'UNAVAILABLE', 'failed'); return null; }
  }
  return {
    async snapshot(): Promise<Recipient | null> {
      const response = await post({ action: 'snapshot' }, 'SHARE_SNAPSHOT'); if (!response) return null;
      try {
        const value = await response.json(); const snapshot = validateSnapshot(value.snapshot);
        if (!snapshot || snapshot.schemaVersion !== SHARE_CONTRACT || typeof value.expiresAt !== 'string' || !Number.isFinite(Date.parse(value.expiresAt))) { event('SHARE_SNAPSHOT', 'INVALID_REQUEST', 'failed'); return null; }
        event('SHARE_SNAPSHOT', 'COMPLETE', 'complete'); return { snapshot, expiresAt: value.expiresAt };
      } catch { event('SHARE_SNAPSHOT', 'INVALID_REQUEST', 'failed'); return null; }
    },
    async media(version: string, mediaKey: string): Promise<Blob | null> {
      const response = await post({ action: 'media', version, mediaKey }, 'SHARE_MEDIA'); if (!response) return null;
      try { const blob = await response.blob(); if (!['image/jpeg', 'video/mp4'].includes(blob.type) || !blob.size || blob.size > 52_428_800) throw new Error(); event('SHARE_MEDIA', 'COMPLETE', 'complete'); return blob; }
      catch { event('SHARE_MEDIA', 'INVALID_REQUEST', 'failed'); return null; }
    },
  };
}
