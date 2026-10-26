import { maintenanceTaskName } from './scheduler';
import { classifyAppDiagnosticError, createDiagnosticCorrelationId, recordAppDiagnostic } from '@/diagnostics/app-diagnostics';
import { ReconciliationStageError } from '@/reconstruction/repository';

// This module is imported by the root layout. Native task registration remains
// at module scope; the handler creates no providers and mounts no UI.
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const taskManager = require('expo-task-manager') as { defineTask(name: string, handler: () => Promise<unknown>): void };
  taskManager.defineTask(maintenanceTaskName, async () => {
    const correlationId = createDiagnosticCorrelationId();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const backgroundTask = require('expo-background-task') as { BackgroundTaskResult: { Success: number; Failed: number } };
    try {
    // Loading native media/SQLite bridges happens only in an OS-invoked task,
    // never when the React tree or web test harness imports this module.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createNativeImportRepository } = require('@/import-record') as typeof import('@/import-record');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { nativePhotoAccess } = require('@/photo-access/native-adapter') as typeof import('@/photo-access/native-adapter');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { reconcilePermittedLibrary } = require('./reconcile-runner') as typeof import('./reconcile-runner');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createNativeReconstructionRepository } = require('@/reconstruction') as typeof import('@/reconstruction');
    const result = await reconcilePermittedLibrary({ repository: createNativeImportRepository(), photoAccess: nativePhotoAccess, now: () => Date.now() });
    if (result === 'complete') {
      try {
        await createNativeReconstructionRepository().reconcileQueued(Date.now(), async () => {
          const access = await nativePhotoAccess.inspect();
          return access?.scope === 'full' || access?.scope === 'limited';
        });
      }
      catch (error) {
        recordAppDiagnostic({ operation: 'MAINTENANCE_RECONCILIATION', reasonCode: classifyAppDiagnosticError(error), stage: error instanceof ReconciliationStageError ? error.stage : null, retryable: true, durableOutcome: 'failed', correlationId });
        return backgroundTask.BackgroundTaskResult.Failed;
      }
    }
    if (result !== 'complete') recordAppDiagnostic({ operation: 'MAINTENANCE_RECONCILIATION', reasonCode: result === 'paused' ? 'PAUSED' : 'RESTRICTED', stage: null, retryable: result === 'paused', durableOutcome: result === 'paused' ? 'paused' : 'restricted', correlationId });
    return result === 'complete' ? backgroundTask.BackgroundTaskResult.Success : backgroundTask.BackgroundTaskResult.Failed;
    } catch (error) {
      // An OS worker must never leak a native bridge/SQLite error through
      // TaskManager. The fixed local diagnostic is sufficient for recovery.
      recordAppDiagnostic({ operation: 'MAINTENANCE_RECONCILIATION', reasonCode: classifyAppDiagnosticError(error), stage: error instanceof ReconciliationStageError ? error.stage : null, retryable: true, durableOutcome: 'failed', correlationId });
      return backgroundTask.BackgroundTaskResult.Failed;
    }
  });
} catch {
  // Native task APIs are intentionally unavailable in web and Jest.
}
