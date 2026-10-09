import type { LibraryScope } from '@/photo-access/types';

export type SourceAvailability = 'available' | 'unavailable' | 'unknown';

/**
 * Deliberately normalized metadata. It never carries a filename, URI, EXIF
 * blob, coordinate, or the media itself.
 */
export type SourceCandidate = {
  assetId: string;
  mediaType: 'image' | 'video';
  capturedAtMillis: number | null;
  modifiedAtMillis: number | null;
  locationAvailable: boolean | null;
  availability: SourceAvailability;
};

export type ImportScope = Extract<LibraryScope, 'full' | 'limited'> | 'selected';

export type ImportCheckpoint = {
  scope: ImportScope;
  nextOffset: number;
  scanned: number;
  geotagged: number;
  unavailable: number;
  status: 'paused' | 'running' | 'complete';
};

export type ImportCoverage = {
  scope: ImportScope | null;
  accessible: number | null;
  scanned: number;
  geotagged: number;
  unavailable: number;
  status: 'idle' | 'running' | 'paused' | 'complete' | 'blocked';
  message: string | null;
};

export interface ImportRepository {
  getCheckpoint(scope: ImportScope): Promise<ImportCheckpoint | null>;
  commitPage(checkpoint: ImportCheckpoint, candidates: SourceCandidate[]): Promise<void>;
  loadCoverage(scope: ImportScope): Promise<ImportCheckpoint | null>;
}
