/** Opaque local coordination metadata, never a diagnostic identifier. */
export type ReplayMutation = Readonly<{ operationId: string; sessionId: string; editVersion: number }>;
export type ReplayMutationReceipt = Readonly<{ operation_id: string; session_id: string; edit_version: number; kind: 'stage' | 'commit' | 'restore'; payload_digest: string; snapshot_token: number; privacy_revision: number; resulting_revision: number }>;
export type ReplayReconciliation = { kind: 'acknowledged'; revision: number } | { kind: 'outcome-unknown' | 'not-started' | 'conflict' | 'scope-invalid' };
let sequence = 0;
export function createReplayOperationId() { sequence += 1; return `replay-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${sequence.toString(36)}`; }
