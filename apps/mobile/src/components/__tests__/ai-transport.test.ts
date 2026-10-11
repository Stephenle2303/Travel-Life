import { buildMinimizedAiRequest, createAiTransport, hasCurrentAiConsent, validateAiProposals } from '@/ai';

const minimized = buildMinimizedAiRequest({ consentRevision: 4, evidenceRevision: 8, correctionRevision: 3, alternatives: [{ localAlternativeId: 'private-alternative', kind: 'journey-group', candidates: [{ localId: 'private-evidence-id', relativeDayOffset: 0, evidenceCategory: 'geotagged' }, { localId: 'private-other-id', relativeDayOffset: 2, evidenceCategory: 'gps-less' }] }] });
if (!minimized) throw new Error('fixture setup failed');

const input = { request: minimized.request, expectedConsentRevision: 4, currentEvidenceRevision: 8, currentCorrectionRevision: 3, consentGranted: true };
const session = { getAnonymousSession: async () => ({ accessToken: 'anonymous-token', expiresAtMillis: Date.now() + 60_000 }) };

describe('optional AI transport boundary', () => {
  it('keeps opaque references on device and requires a current consent revision', () => {
    expect(JSON.stringify(minimized.request)).not.toContain('private-evidence-id');
    expect(JSON.stringify(minimized.request)).not.toContain('private-alternative');
    expect(hasCurrentAiConsent({ revision: 4, granted: true }, 4)).toBe(true);
    expect(hasCurrentAiConsent({ revision: 3, granted: true }, 4)).toBe(false);
  });

  it('skips before the network for missing consent or stale local bindings', async () => {
    const fetcher = jest.fn();
    const transport = createAiTransport({ endpoint: 'https://proxy.example', publishableKey: 'sb_publishable_test', session, fetcher });
    await expect(transport.request({ ...input, consentGranted: false })).resolves.toMatchObject({ status: 'skipped', reason: 'consent-required' });
    await expect(transport.request({ ...input, currentEvidenceRevision: 9 })).resolves.toMatchObject({ status: 'skipped', reason: 'stale' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects a proposal that references an unknown opaque candidate', async () => {
    const transport = createAiTransport({ endpoint: 'https://proxy.example', publishableKey: 'sb_publishable_test', session, fetcher: async () => new Response(JSON.stringify({ status: 'proposal', contractVersion: 'travel-life-ai-v1', usage: { inputTokens: 10, outputTokens: 4 }, proposals: [{ alternativeId: 'a_0', selectedCandidateIds: ['c_unknown'], confidence: 'low', rationaleCode: 'ambiguous-grouping' }] })) });
    await expect(transport.request(input)).resolves.toMatchObject({ status: 'skipped', reason: 'invalid-response' });
  });

  it('returns typed local-safe skipped states for disabled session and unavailable network', async () => {
    await expect(createAiTransport({ endpoint: undefined, publishableKey: 'sb_publishable_test', session }).request(input)).resolves.toMatchObject({ status: 'skipped', reason: 'disabled' });
    await expect(createAiTransport({ endpoint: 'https://proxy.example', publishableKey: 'sb_publishable_test', session: { getAnonymousSession: async () => null } }).request(input)).resolves.toMatchObject({ status: 'skipped', reason: 'session-required' });
    await expect(createAiTransport({ endpoint: 'https://proxy.example', publishableKey: 'sb_publishable_test', session, fetcher: async () => { throw new Error('offline'); } }).request(input)).resolves.toMatchObject({ status: 'skipped', reason: 'unavailable' });
  });

  it('does not pass unknown skipped reasons or unbounded usage through from the proxy', async () => {
    const unknownReason = createAiTransport({ endpoint: 'https://proxy.example', publishableKey: 'sb_publishable_test', session, fetcher: async () => new Response(JSON.stringify({ status: 'skipped', reason: 'unexpected', usage: { inputTokens: null, outputTokens: null } })) });
    const unsafeUsage = createAiTransport({ endpoint: 'https://proxy.example', publishableKey: 'sb_publishable_test', session, fetcher: async () => new Response(JSON.stringify({ status: 'skipped', reason: 'limited', usage: { inputTokens: -1, outputTokens: 100000 } })) });
    await expect(unknownReason.request(input)).resolves.toMatchObject({ status: 'skipped', reason: 'invalid-response' });
    await expect(unsafeUsage.request(input)).resolves.toMatchObject({ status: 'skipped', reason: 'invalid-response' });
  });

  it('sends only the minimized request with the anonymous bearer and publishable key', async () => {
    const fetcher = jest.fn(async () => new Response(JSON.stringify({ status: 'proposal', contractVersion: 'travel-life-ai-v1', usage: { inputTokens: 12, outputTokens: 4 }, proposals: [{ alternativeId: 'a_0', selectedCandidateIds: ['c_0'], confidence: 'low', rationaleCode: 'ambiguous-grouping' }] })));
    const transport = createAiTransport({ endpoint: 'https://proxy.example', publishableKey: 'sb_publishable_test', session, fetcher });
    await expect(transport.request(input)).resolves.toMatchObject({ status: 'proposal', proposals: [{ alternativeId: 'a_0', selectedCandidateIds: ['c_0'] }] });
    expect(fetcher).toHaveBeenCalledWith('https://proxy.example', expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ authorization: 'Bearer anonymous-token', apikey: 'sb_publishable_test', 'content-type': 'application/json' }), body: JSON.stringify(minimized.request) }));
  });

  it('accepts only bounded proposals supplied by the current request', () => {
    expect(validateAiProposals([{ alternativeId: 'a_0', selectedCandidateIds: ['c_0'], confidence: 'low', rationaleCode: 'ambiguous-grouping' }], minimized.request)).toBe(true);
    expect(validateAiProposals([{ alternativeId: 'a_0', selectedCandidateIds: ['c_0'], confidence: 'medium', rationaleCode: 'no-proposal' }], minimized.request)).toBe(false);
    expect(validateAiProposals([null as unknown as never], minimized.request)).toBe(false);
  });
});
