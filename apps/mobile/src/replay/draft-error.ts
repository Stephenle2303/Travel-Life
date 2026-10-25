/** An expected stale scope or revision conflict; never a native storage error. */
export class ReplayDraftStaleError extends Error {
  readonly code = 'REPLAY_DRAFT_STALE';

  constructor(message: 'Replay draft is stale.' | 'Replay draft conflict.' = 'Replay draft is stale.') {
    super(message);
    this.name = 'ReplayDraftStaleError';
  }
}
