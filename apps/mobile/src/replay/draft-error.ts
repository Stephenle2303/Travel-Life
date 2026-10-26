export type ReplayDraftGuard = 'scope' | 'mapping' | 'memory' | 'group' | 'automatic' | 'receipt' | 'revision' | 'branch' | 'unknown';

/** An expected stale scope or revision conflict; never a native storage error. */
export class ReplayDraftStaleError extends Error {
  readonly code = 'REPLAY_DRAFT_STALE';

  constructor(message: 'Replay draft is stale.' | 'Replay draft conflict.' = 'Replay draft is stale.', readonly reason: 'scope' | 'revision' | 'branch' | 'unknown' = 'unknown', readonly guard: ReplayDraftGuard = 'unknown') {
    super(message);
    this.name = 'ReplayDraftStaleError';
  }
}
