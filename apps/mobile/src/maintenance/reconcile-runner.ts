import type { MaintenanceCheckpoint } from '@/import-record/types';
import type { ReconcileDependencies } from './types';

const PAGE_SIZE = 100;

/** Runs without React and only handles normalized metadata supplied by the adapter. */
export async function reconcilePermittedLibrary(deps: ReconcileDependencies): Promise<'complete' | 'paused' | 'restricted'> {
  let checkpoint: MaintenanceCheckpoint | null = null;
  let leaseToken: number | null = null;
  try {
    const lifecycle = await deps.repository.getPrivateRecordLifecycle();
    const permission = await deps.photoAccess.inspect();
    if (lifecycle.state !== 'connected' || (permission?.scope !== 'full' && permission?.scope !== 'limited')) return 'restricted';
    const state = await deps.repository.loadMaintenance();
    if (!state.enabled && !deps.allowDisabled) return 'restricted';
    leaseToken = await deps.repository.acquireMaintenanceLease(deps.now(), deps.allowDisabled);
    if (leaseToken === null) return 'paused';
    const saved = await deps.repository.getMaintenanceCheckpoint();
    checkpoint = saved?.status === 'paused' && saved.scope === permission.scope
      ? { ...saved, runToken: leaseToken, status: 'running' }
      : { scope: permission.scope, nextOffset: 0, runToken: leaseToken, status: 'running' };
    await deps.repository.reconcileMaintenancePage(checkpoint, []);
    while (true) {
      if (!(await deps.repository.renewMaintenanceLease(leaseToken, deps.now()))) return 'paused';
      if (deps.isExpired?.()) {
        await deps.repository.pauseMaintenance(checkpoint, 'Maintenance paused before the system task expired. It can resume later.');
        return 'paused';
      }
      if ((await deps.repository.getPrivateRecordLifecycle()).state !== 'connected') {
        await deps.repository.pauseMaintenance(checkpoint, 'Private record access changed. Maintenance is waiting for an owner action.');
        return 'restricted';
      }
      const current = await deps.photoAccess.inspect();
      if (current?.scope !== checkpoint.scope) {
        await deps.repository.pauseMaintenance(checkpoint, 'Photo access changed. Maintenance is waiting for a permitted scope.');
        return 'restricted';
      }
      const page = await deps.photoAccess.readMetadataPage(checkpoint.nextOffset, PAGE_SIZE);
      const after = await deps.photoAccess.inspect();
      if (after?.scope !== checkpoint.scope) {
        await deps.repository.pauseMaintenance(checkpoint, 'Photo access changed. A late metadata page was discarded.');
        return 'restricted';
      }
      // A disable/disconnect can happen while the page was being read. The
      // repository repeats enabled/lifecycle checks inside its transaction.
      if ((await deps.repository.getPrivateRecordLifecycle()).state !== 'connected' || (!deps.allowDisabled && !(await deps.repository.loadMaintenance()).enabled)) {
        return 'restricted';
      }
      checkpoint = { ...checkpoint, nextOffset: checkpoint.nextOffset + page.length, status: page.length < PAGE_SIZE ? 'complete' : 'running' };
      await deps.repository.reconcileMaintenancePage(checkpoint, page);
      if (checkpoint.status === 'complete') {
        await deps.repository.completeMaintenanceRun(checkpoint, deps.now());
        return 'complete';
      }
    }
  } catch {
    if (checkpoint && leaseToken !== null) await deps.repository.pauseMaintenance(checkpoint, 'Maintenance paused because the current device-visible library could not be read.');
    return 'paused';
  } finally {
    if (leaseToken !== null) await deps.repository.releaseMaintenanceLease(leaseToken);
  }
}
