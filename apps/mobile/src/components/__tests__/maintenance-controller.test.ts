import { MaintenanceController } from '@/maintenance';
import type { MaintenanceRepository } from '@/import-record/types';
import type { PhotoAccessAdapter } from '@/photo-access/types';

const access: PhotoAccessAdapter = { inspect: async () => ({ scope: 'full', canAskAgain: false }), request: async () => ({ scope: 'full', canAskAgain: false }), readPage: async () => 0, readMetadataPage: async () => [], readSelectedMetadata: async () => [], manageLimited: async () => {}, select: async () => ({ canceled: true }) };

describe('maintenance lifecycle controls', () => {
  it('keeps an existing preference but refuses selected-only enable and Check now', async () => {
    let enabled = false;
    const repository = {
      loadPreparationIntent: async () => ({ version: 1, id: 'synthetic-selected', scope: 'selected', selectedIds: ['synthetic-only'], missingIds: 0, phase: 'complete' }),
      loadMaintenance: async () => ({ enabled, status: 'disabled', lastCheckedAtMillis: null, lastUpdatedAtMillis: null, message: null }),
      getMaintenanceCheckpoint: async () => null, saveMaintenance: jest.fn(),
    } as unknown as MaintenanceRepository;
    const read = jest.fn(async () => []); const register = jest.fn();
    const controller = new MaintenanceController(repository, { ...access, readMetadataPage: read }, { isAvailable: async () => true, register, unregister: async () => {} }, () => {});
    await controller.refresh(); await controller.setEnabled(true); await controller.rescan();
    expect(controller.snapshot).toMatchObject({ enabled: false, status: 'restricted' });
    expect(repository.saveMaintenance).not.toHaveBeenCalled();
    enabled = true; await controller.refresh(); await controller.rescan();
    expect(controller.snapshot.enabled).toBe(true);
    expect(read).not.toHaveBeenCalled(); expect(register).not.toHaveBeenCalled();
  });
  it('retains explicit preference when scheduling is unavailable and classifies the exact boundary', async () => {
    const saved: unknown[] = [];
    const repository = {
      getPrivateRecordLifecycle: async () => ({ state: 'connected' }),
      loadCoverage: async () => ({ status: 'complete' }),
      saveMaintenance: async (value: unknown) => { saved.push(value); },
    } as unknown as MaintenanceRepository;
    const register = jest.fn();
    const log = jest.spyOn(console, 'info').mockImplementation(() => {});
    try {
      const controller = new MaintenanceController(repository, access, { isAvailable: async () => false, register, unregister: async () => {} }, () => {});
      await controller.setEnabled(true);
      expect(controller.snapshot).toMatchObject({ enabled: true, status: 'restricted' });
      expect(register).not.toHaveBeenCalled();
      expect(saved).toEqual(expect.arrayContaining([expect.objectContaining({ enabled: true })]));
      expect(log.mock.calls).toEqual(expect.arrayContaining([[expect.any(String), expect.objectContaining({ operation: 'ONBOARDING_UPDATES', stage: 'UPDATE_SCHEDULE', reasonCode: 'RESTRICTED', durableOutcome: 'restricted' })]]));
    } finally { log.mockRestore(); }
  });

  it('redacts scheduling errors and retains saved opt-in for foreground recovery', async () => {
    const repository = { getPrivateRecordLifecycle: async () => ({ state: 'connected' }), loadCoverage: async () => ({ status: 'complete' }), saveMaintenance: async () => {} } as unknown as MaintenanceRepository;
    const log = jest.spyOn(console, 'info').mockImplementation(() => {});
    try {
      const controller = new MaintenanceController(repository, access, { isAvailable: async () => true, register: async () => { throw new Error('synthetic-secret-location'); }, unregister: async () => {} }, () => {});
      await controller.setEnabled(true);
      expect(controller.snapshot).toMatchObject({ enabled: true, status: 'restricted' });
      expect(JSON.stringify(log.mock.calls)).not.toContain('synthetic-secret-location');
      expect(controller.snapshot.message).not.toContain('synthetic-secret-location');
    } finally { log.mockRestore(); }
  });
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

  it('serializes lifecycle shutdown while saving disabled worker authority before final unregister', async () => {
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
    expect(events).toEqual(['save', 'unregister', 'save', 'unregister']);
    expect(controller.snapshot.enabled).toBe(false);
  });
});
