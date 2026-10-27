import { createFrozenShareDraft } from '@/share/draft';

describe('selected-share draft creation', () => {
  it('persists the opaque capability before returning a publishable frozen draft', async () => {
    const capabilityStore = { create: jest.fn().mockResolvedValue('capability-a'), read: jest.fn(), remove: jest.fn() };

    await expect(createFrozenShareDraft({
      requestId: 'request-a',
      contentDigest: 'digest-a',
      expiresInDays: 30,
      selections: [{ displayId: 'journey-a', snapshotToken: 7, privacyRevision: 4 }],
      capabilityStore,
    })).resolves.toEqual(expect.objectContaining({ requestId: 'request-a', capability: 'capability-a' }));
    expect(capabilityStore.create).toHaveBeenCalledWith('request-a');
  });
});
