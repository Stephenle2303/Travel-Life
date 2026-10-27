import { createSharePublishController } from '@/share/publish-controller';

const makeDraft = () => ({
  requestId: 'request-a', contentDigest: 'digest-a', capability: 'capability-a', expiresInDays: 30,
  selections: [{ displayId: 'journey-a', snapshotToken: 7, privacyRevision: 4 }],
});

describe('selected-share publish controller', () => {
  it('rechecks selected journey eligibility immediately before publishing', async () => {
    const transport = { publish: jest.fn() };
    const getEligibility = jest.fn().mockResolvedValue({ eligible: false, reason: 'stale', privacyRevision: 5 });
    const controller = createSharePublishController({ getEligibility, transport });

    await expect(controller.publish(makeDraft(), 'runtime-share-1')).resolves.toEqual({ status: 'skipped', reason: 'eligibility-changed' });
    expect(transport.publish).not.toHaveBeenCalled();
    expect(getEligibility).toHaveBeenCalledWith('journey-a', 7, 4);
  });

  it('sends only a rechecked frozen request to the transport', async () => {
    const transport = { publish: jest.fn().mockResolvedValue({ status: 'staged', requestId: 'request-a', contentDigest: 'digest-a' }) };
    const getEligibility = jest.fn().mockResolvedValue({ eligible: true, reason: 'eligible', privacyRevision: 4 });
    const controller = createSharePublishController({ getEligibility, transport });

    await expect(controller.publish(makeDraft(), 'runtime-share-2')).resolves.toEqual({ status: 'staged', requestId: 'request-a', contentDigest: 'digest-a' });
    expect(transport.publish).toHaveBeenCalledWith(expect.objectContaining({ contractVersion: 'travel-life-share-v1', requestId: 'request-a', contentDigest: 'digest-a' }));
  });
});
