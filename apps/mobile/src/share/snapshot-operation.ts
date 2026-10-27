/**
 * Local recovery state for exactly one owner-authorized publication attempt.
 * The capability is deliberately opaque: callers store it in their protected
 * capability store and never place it in diagnostics, UI state, or requests
 * after the initial creation call.
 */
export type SharePublishOperation = Readonly<{
  requestId: string;
  contentDigest: string;
  capability: string;
}>;

export type SharePublishServerState = 'staged' | 'activated' | 'revoked' | 'removed';

export type SharePublishReconciliation =
  | Readonly<{ kind: 'resume' }>
  | Readonly<{ kind: 'restart-required' }>
  | Readonly<{ kind: 'reconcile-removal' }>
  | Readonly<{ kind: 'published-revoke-separately' }>
  | Readonly<{ kind: 'terminal' }>;

export function bindSharePublishOperation(input: SharePublishOperation): SharePublishOperation {
  return Object.freeze({ ...input });
}

/**
 * A retry may resume only the same immutable preview. A remote delete fence
 * wins before activation. Once a receipt says activated, cancelling cannot
 * erase a potentially delivered link; the owner must issue an explicit revoke.
 */
export function reconcileSharePublishOperation(
  operation: SharePublishOperation,
  remote: Readonly<{
    requestId: string;
    contentDigest: string;
    serverState: SharePublishServerState;
    deleteFence: boolean;
  }>,
): SharePublishReconciliation {
  if (operation.requestId !== remote.requestId || operation.contentDigest !== remote.contentDigest) {
    return { kind: 'restart-required' };
  }
  if (remote.deleteFence && remote.serverState === 'staged') return { kind: 'reconcile-removal' };
  if (remote.serverState === 'staged') return { kind: 'resume' };
  if (remote.serverState === 'activated') return { kind: 'published-revoke-separately' };
  return { kind: 'terminal' };
}
