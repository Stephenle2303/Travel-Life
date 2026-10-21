import { MaintenanceController } from '@/maintenance';
import type { MaintenanceRepository } from '@/import-record/types';
import type { PhotoAccessAdapter } from '@/photo-access/types';

const access: PhotoAccessAdapter = { inspect: async () => ({ scope: 'full', canAskAgain: false }), request: async () => ({ scope: 'full', canAskAgain: false }), readPage: async () => 0, readMetadataPage: async () => [], readSelectedMetadata: async () => [], manageLimited: async () => {}, select: async () => ({ canceled: true }) };

describe('maintenance lifecycle controls', () => {
  it('exposes the queued maintenance boundary to a foreground owner action', async () => {
    let finishInspect!: (value: { scope: 'full'; canAskAgain: boolean }) => void;
    const waitingAccess: PhotoAccessAdapter = { ...access, inspect: () => new Promise((resolve) => { finishInspect = resolve; }) };
    const repository = {
      loadMaintenance: async () => ({ enabled: true, status: 'checked' as const, lastCheckedAtMillis: null, lastUpdatedAtMillis: null, message: null }),
      getMaintenanceCheckpoint: async () => null,
    } as unknown as MaintenanceRepository;
    const controller = new MaintenanceController(repository, waitingAccess, { isAvailable: async () => true, register: async () => {}, unregister: async () => {} }, () => {});
    const refresh = controller.refresh();
    let settled = false;
    const idle = controller.whenIdle().then(() => { settled = true; });

    await Promise.resolve();
    expect(settled).toBe(false);
    finishInspect({ scope: 'full', canAskAgain: false });
    await Promise.all([refresh, idle]);
    expect(settled).toBe(true);
  });

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
