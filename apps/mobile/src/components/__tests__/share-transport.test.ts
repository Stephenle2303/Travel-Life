import { createShareTransport } from '@/share/transport';

const session = { getAnonymousSession: jest.fn() };

describe('share transport', () => {
  beforeEach(() => jest.resetAllMocks());

  it('does not make a network request without a current owner session', async () => {
    session.getAnonymousSession.mockResolvedValue(null);
    const fetcher = jest.fn();
    const transport = createShareTransport({ endpoint: 'https://example.test/share', publishableKey: 'key', session, fetcher });

    await expect(transport.publish({ contractVersion: 'travel-life-share-v1', requestId: 'request-a', contentDigest: 'digest-a', capability: 'capability-a', expiresInDays: 30 })).resolves.toEqual({ status: 'skipped', reason: 'session-required' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('accepts only a closed publication acknowledgement', async () => {
    session.getAnonymousSession.mockResolvedValue({ accessToken: 'session-a', expiresAtMillis: Date.now() + 10_000 });
    const fetcher = jest.fn().mockResolvedValue({ json: async () => ({ status: 'staged', requestId: 'request-a', contentDigest: 'digest-a' }) });
    const transport = createShareTransport({ endpoint: 'https://example.test/share', publishableKey: 'key', session, fetcher });

    await expect(transport.publish({ contractVersion: 'travel-life-share-v1', requestId: 'request-a', contentDigest: 'digest-a', capability: 'capability-a', expiresInDays: 30 })).resolves.toEqual({ status: 'staged', requestId: 'request-a', contentDigest: 'digest-a' });
  });

  it('fails closed when a response changes the immutable content binding', async () => {
    session.getAnonymousSession.mockResolvedValue({ accessToken: 'session-a', expiresAtMillis: Date.now() + 10_000 });
    const fetcher = jest.fn().mockResolvedValue({ json: async () => ({ status: 'staged', requestId: 'request-a', contentDigest: 'other-digest' }) });
    const transport = createShareTransport({ endpoint: 'https://example.test/share', publishableKey: 'key', session, fetcher });

    await expect(transport.publish({ contractVersion: 'travel-life-share-v1', requestId: 'request-a', contentDigest: 'digest-a', capability: 'capability-a', expiresInDays: 30 })).resolves.toEqual({ status: 'skipped', reason: 'invalid-response' });
  });
});
