import { maintenanceTaskName } from './scheduler';

// This module is imported by the root layout. Native task registration remains
// at module scope; the handler creates no providers and mounts no UI.
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const taskManager = require('expo-task-manager') as { defineTask(name: string, handler: () => Promise<unknown>): void };
  taskManager.defineTask(maintenanceTaskName, async () => {
    // Loading native media/SQLite bridges happens only in an OS-invoked task,
    // never when the React tree or web test harness imports this module.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createNativeImportRepository } = require('@/import-record') as typeof import('@/import-record');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { nativePhotoAccess } = require('@/photo-access/native-adapter') as typeof import('@/photo-access/native-adapter');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { reconcilePermittedLibrary } = require('./reconcile-runner') as typeof import('./reconcile-runner');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const backgroundTask = require('expo-background-task') as { BackgroundTaskResult: { Success: number; Failed: number } };
    const result = await reconcilePermittedLibrary({ repository: createNativeImportRepository(), photoAccess: nativePhotoAccess, now: () => Date.now() });
    return result === 'complete' ? backgroundTask.BackgroundTaskResult.Success : backgroundTask.BackgroundTaskResult.Failed;
  });
} catch {
  // Native task APIs are intentionally unavailable in web and Jest.
}
