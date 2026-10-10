export type PrivateRecordState = 'connected' | 'disconnected' | 'deleted';

export type PrivateRecordLifecycle = {
  state: PrivateRecordState;
};

/**
 * A revisioned owner correction. Target identifiers are stable local record
 * identities; they are never inferred from a successor or a source path.
 */
export type CorrectionOverlay = {
  overlayId: string;
  targetKind: 'evidence' | 'history';
  targetId: string;
  scope: 'inclusion' | 'label' | 'note';
  action: 'apply' | 'remove';
  ownerValue: string | null;
  createdAtMillis: number;
  identityLineageId: string | null;
  replacesOverlayId: string | null;
};

export type LifecycleSnapshot = PrivateRecordLifecycle & {
  message: string | null;
};

export interface HistoryRecordRepository {
  getPrivateRecordLifecycle(): Promise<PrivateRecordLifecycle>;
  connectPrivateRecord(): Promise<void>;
  disconnectPrivateRecord(): Promise<void>;
  deleteLocalHistory(): Promise<void>;
  saveCorrectionOverlay(overlay: CorrectionOverlay): Promise<void>;
}
