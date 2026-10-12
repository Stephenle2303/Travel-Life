import type { ImportScope, MaintenanceCheckpoint, MaintenanceRepository, MaintenanceSnapshot } from '@/import-record/types';
import type { PhotoAccessAdapter } from '@/photo-access/types';

export type ReconcileDependencies = {
  repository: MaintenanceRepository;
  photoAccess: Pick<PhotoAccessAdapter, 'inspect' | 'readMetadataPage'>;
  now: () => number;
  isExpired?: () => boolean;
  allowDisabled?: boolean;
};

export type SchedulerAdapter = {
  isAvailable(): Promise<boolean>;
  register(): Promise<void>;
  unregister(): Promise<void>;
};

export type MaintenanceView = MaintenanceSnapshot & { checkpoint: MaintenanceCheckpoint | null };
export type MaintenanceScope = Extract<ImportScope, 'full' | 'limited'>;
