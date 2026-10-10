import type { SchedulerAdapter } from './types';

export const maintenanceTaskName = 'travel-life-library-maintenance-v1';

/** Expo calls are contained here so tests and web never need a native scheduler. */
export function createExpoScheduler(): SchedulerAdapter {
  return {
    async isAvailable() {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const backgroundTask = require('expo-background-task') as {
          getStatusAsync(): Promise<number>;
          BackgroundTaskStatus: { Available: number };
        };
        return (await backgroundTask.getStatusAsync()) === backgroundTask.BackgroundTaskStatus.Available;
      } catch { return false; }
    },
    async register() {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const backgroundTask = require('expo-background-task') as { registerTaskAsync(name: string, options?: { minimumInterval?: number }): Promise<void> };
      // Expo expects minutes, not milliseconds. This only sets a lower bound;
      // both platforms retain control over the actual execution time.
      await backgroundTask.registerTaskAsync(maintenanceTaskName, { minimumInterval: 15 });
    },
    async unregister() {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const backgroundTask = require('expo-background-task') as {
          getStatusAsync(): Promise<number>;
          unregisterTaskAsync(name: string): Promise<void>;
          BackgroundTaskStatus: { Available: number };
        };
        if ((await backgroundTask.getStatusAsync()) !== backgroundTask.BackgroundTaskStatus.Available) return;
        await backgroundTask.unregisterTaskAsync(maintenanceTaskName);
      } catch {
        // No task to remove is already the required end state.
      }
    },
  };
}
