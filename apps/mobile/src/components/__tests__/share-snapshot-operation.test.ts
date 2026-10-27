import {
  bindSharePublishOperation,
  reconcileSharePublishOperation,
} from '@/share/snapshot-operation';

describe('selected share publication operation', () => {
  it('binds one durable request to one immutable preview digest', () => {
    const operation = bindSharePublishOperation({
      requestId: 'request-a',
      contentDigest: 'digest-a',
      capability: 'capability-a',
    });

    expect(reconcileSharePublishOperation(operation, {
      requestId: 'request-a',
      contentDigest: 'digest-a',
      serverState: 'staged',
      deleteFence: false,
    })).toEqual({ kind: 'resume' });

    expect(reconcileSharePublishOperation(operation, {
      requestId: 'request-a',
      contentDigest: 'digest-b',
      serverState: 'staged',
      deleteFence: false,
    })).toEqual({ kind: 'restart-required' });
  });

  it('does not activate a staged snapshot once delete-all has fenced its owner', () => {
    const operation = bindSharePublishOperation({
      requestId: 'request-a',
      contentDigest: 'digest-a',
      capability: 'capability-a',
    });

    expect(reconcileSharePublishOperation(operation, {
      requestId: 'request-a',
      contentDigest: 'digest-a',
      serverState: 'staged',
      deleteFence: true,
    })).toEqual({ kind: 'reconcile-removal' });
  });

  it('keeps an already activated link until the owner explicitly revokes it', () => {
    const operation = bindSharePublishOperation({
      requestId: 'request-a',
      contentDigest: 'digest-a',
      capability: 'capability-a',
    });

    expect(reconcileSharePublishOperation(operation, {
      requestId: 'request-a',
      contentDigest: 'digest-a',
      serverState: 'activated',
      deleteFence: false,
    })).toEqual({ kind: 'published-revoke-separately' });
  });
});
