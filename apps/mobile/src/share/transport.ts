import type { AnonymousSessionProvider } from '@/ai/session';

export type SharePublishRequest = Readonly<{
  contractVersion: 'travel-life-share-v1';
  requestId: string;
  contentDigest: string;
  /** Sent only over the authenticated creation request; never persisted by this transport. */
  capability: string;
  expiresInDays: number;
}>;

export type ShareTransportResult =
  | Readonly<{ status: 'staged'; requestId: string; contentDigest: string }>
  | Readonly<{ status: 'activated'; requestId: string; contentDigest: string }>
  | Readonly<{ status: 'skipped'; reason: 'disabled' | 'session-required' | 'invalid-response' | 'unavailable' | 'cancelled' }>;

const exactKeys = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).length === keys.length && keys.every((key) => key in value);
const opaque = (value: unknown) => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const digest = (value: unknown) => typeof value === 'string' && /^[A-Za-z0-9_-]{1,256}$/.test(value);

function validAcknowledgement(value: unknown, request: SharePublishRequest): ShareTransportResult | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const response = value as Record<string, unknown>;
  if (!exactKeys(response, ['status', 'requestId', 'contentDigest']) || (response.status !== 'staged' && response.status !== 'activated') || !opaque(response.requestId) || !digest(response.contentDigest)) return null;
  if (response.requestId !== request.requestId || response.contentDigest !== request.contentDigest) return null;
  return { status: response.status, requestId: response.requestId, contentDigest: response.contentDigest };
}

export function createShareTransport(options: { endpoint: string | undefined; publishableKey: string | undefined; session: AnonymousSessionProvider; fetcher?: typeof fetch }) {
  const fetcher = options.fetcher ?? fetch;
  return {
    async publish(request: SharePublishRequest, signal?: AbortSignal): Promise<ShareTransportResult> {
      if (!options.endpoint || !options.publishableKey) return { status: 'skipped', reason: 'disabled' };
      let session;
      try { session = await options.session.getAnonymousSession(); } catch { return { status: 'skipped', reason: 'session-required' }; }
      if (!session || session.expiresAtMillis <= Date.now()) return { status: 'skipped', reason: 'session-required' };
      try {
        const response = await fetcher(options.endpoint, {
          method: 'POST', signal,
          headers: { authorization: `Bearer ${session.accessToken}`, apikey: options.publishableKey, 'content-type': 'application/json' },
          body: JSON.stringify(request),
        });
        const parsed = await response.json().catch(() => null);
        return validAcknowledgement(parsed, request) ?? { status: 'skipped', reason: 'invalid-response' };
      } catch (error) {
        return { status: 'skipped', reason: signal?.aborted || error instanceof DOMException && error.name === 'AbortError' ? 'cancelled' : 'unavailable' };
      }
    },
  };
}
