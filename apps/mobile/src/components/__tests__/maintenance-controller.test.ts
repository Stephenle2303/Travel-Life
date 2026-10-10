import { MaintenanceController } from '@/maintenance';
import type { MaintenanceRepository } from '@/import-record/types';
import type { PhotoAccessAdapter } from '@/photo-access/types';

const access: PhotoAccessAdapter = { inspect: async () => ({ scope: 'full', canAskAgain: false }), request: async () => ({ scope: 'full', canAskAgain: false }), readPage: async () => 0, readMetadataPage: async () => [], readSelectedMetadata: async () => [], manageLimited: async () => {}, select: async () => ({ canceled: true }) };

describe('maintenance lifecycle controls', () => {
  it('serializes disable and unregisters a scheduled task before persisting disabled state', async () => {
    const events: string[] = [];
    const repository = {
      getPrivateRecordLifecycle: async () => ({ state: 'connected' }),
      loadMaintenance: async () => ({ enabled: true, status: 'pending', lastCheckedAtMillis: null, lastUpdatedAtMillis: null, message: null }),
      getMaintenanceCheckpoint: async () => null,
      saveMaintenance: async () => { events.push('save'); },
    } as unknown as MaintenanceRepository;
    const scheduler = { isAvailable: async () => true, register: async () => {}, unregister: async () => { events.push('unregister'); } };
    const controller = new MaintenanceController(repository, access, scheduler, () => {});
    await Promise.all([controller.stopForLifecycle(), controller.stopForLifecycle()]);
    expect(events).toEqual(['unregister', 'unregister', 'save', 'unregister', 'unregister', 'save']);
    expect(controller.snapshot.enabled).toBe(false);
  });
});
