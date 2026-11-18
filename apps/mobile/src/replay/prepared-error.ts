export type ReplayPreparedArtifactReason = 'REPLAY_SCOPE_INVALID' | 'REPLAY_MAPPING_INVALID' | 'REPLAY_RECEIPT_CONFLICT';
export type ReplayPreparedArtifactStage = 'REPLAY_OUTPUT_LIFECYCLE' | 'REPLAY_OUTPUT_MAPPING' | 'REPLAY_OUTPUT_RUN' | 'REPLAY_OUTPUT_PRIVACY' | 'REPLAY_OUTPUT_CAS';

/** A known cache-persistence guard; never carries native details or owner data. */
export class ReplayPreparedArtifactError extends Error {
  constructor(readonly diagnosticReason: ReplayPreparedArtifactReason, readonly diagnosticStage: ReplayPreparedArtifactStage) {
    super('Replay artifact is stale.');
    this.name = 'ReplayPreparedArtifactError';
  }
}
