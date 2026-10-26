import type { SourceCandidate } from '@/import-record/types';

export type LibraryScope = 'unasked' | 'full' | 'limited' | 'denied' | 'revoked' | 'unavailable';

export type CountStatus = 'none' | 'counting' | 'complete' | 'incomplete';

export type PhotoAccessSnapshot = {
  scope: LibraryScope;
  countStatus: CountStatus;
  count: number;
  selectedCount: number | null;
  selectedMissingIds: number;
  canAskAgain: boolean;
  message: string | null;
};

export type PermissionSnapshot = {
  scope: 'full' | 'limited' | 'denied' | 'unasked';
  canAskAgain: boolean;
};

export type SelectionResult = { canceled: true } | {
  canceled: false;
  count: number;
  missingAssetIds: number;
  stableAssetIds: string[];
};
/** Ephemeral private display data. Source identifiers never leave the adapter. */
export type OwnerPreview = { uri: string | null; availability: 'available' | 'unavailable'; kind: 'photo' | 'video' };

export interface PhotoAccessAdapter {
  inspect(): Promise<PermissionSnapshot | null>;
  request(): Promise<PermissionSnapshot | null>;
  readPage(offset: number, limit: number): Promise<number>;
  readMetadataPage(offset: number, limit: number): Promise<SourceCandidate[]>;
  readSelectedMetadata(assetIds: string[]): Promise<SourceCandidate[]>;
  manageLimited(): Promise<void>;
  select(): Promise<SelectionResult>;
  resolveOwnerPreviews?(assetIds: (string | null)[], limit: number, onResolved?: (preview: OwnerPreview, index: number) => void): Promise<OwnerPreview[]>;
}
