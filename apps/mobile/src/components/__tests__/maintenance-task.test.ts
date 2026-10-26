import { ReconciliationStageError } from '@/reconstruction/repository';

const mockDefineTask = jest.fn();
const mockReconcile = jest.fn();
const mockReconcileQueued = jest.fn();

jest.mock('expo-task-manager', () => ({ defineTask: mockDefineTask }));
jest.mock('expo-background-task', () => ({ BackgroundTaskResult: { Success: 1, Failed: 2 } }));
jest.mock('@/import-record', () => ({ createNativeImportRepository: jest.fn(() => ({})) }));
jest.mock('@/photo-access/native-adapter', () => ({ nativePhotoAccess: {} }));
jest.mock('@/maintenance/reconcile-runner', () => ({ reconcilePermittedLibrary: (...args: unknown[]) => mockReconcile(...args) }));
jest.mock('@/reconstruction', () => ({ createNativeReconstructionRepository: jest.fn(() => ({ reconcileQueued: (...args: unknown[]) => mockReconcileQueued(...args) })) }));

describe('maintenance task entry point', () => {
  it('registers at module scope and maps completed versus paused work to Expo results', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/maintenance/task');
    expect(mockDefineTask).toHaveBeenCalledWith('travel-life-library-maintenance-v1', expect.any(Function));
    const handler = mockDefineTask.mock.calls[0][1] as () => Promise<number>;
    mockReconcile.mockResolvedValueOnce('complete');
    mockReconcileQueued.mockResolvedValueOnce({});
    await expect(handler()).resolves.toBe(1);
    expect(mockReconcileQueued).toHaveBeenCalledTimes(1);
    mockReconcile.mockResolvedValueOnce('paused');
    await expect(handler()).resolves.toBe(2);
    expect(mockReconcileQueued).toHaveBeenCalledTimes(1);
  });

  it('emits one fixed maintenance outcome when the background reconciliation is paused', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/maintenance/task');
    const handler = mockDefineTask.mock.calls[0][1] as () => Promise<number>;
    const diagnostic = jest.spyOn(console, 'info').mockImplementation(() => {});
    try {
      mockReconcile.mockResolvedValueOnce('paused');
      await expect(handler()).resolves.toBe(2);
      expect(diagnostic).toHaveBeenCalledTimes(1);
      expect(diagnostic).toHaveBeenCalledWith('[Travel Life diagnostic]', expect.objectContaining({
        operation: 'MAINTENANCE_RECONCILIATION', reasonCode: 'PAUSED', stage: null,
        retryable: true, durableOutcome: 'paused', correlationId: expect.any(String),
      }));
    } finally {
      diagnostic.mockRestore();
    }
  });

  it('redacts a failed background reconstruction into one fixed maintenance diagnostic', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/maintenance/task');
    const handler = mockDefineTask.mock.calls[0][1] as () => Promise<number>;
    const diagnostic = jest.spyOn(console, 'info').mockImplementation(() => {});
    try {
      const privateSentinel = 'private-background-rebuild-sentinel';
      mockReconcile.mockResolvedValueOnce('complete');
      mockReconcileQueued.mockRejectedValueOnce(new Error(`database is locked: ${privateSentinel}`));
      await expect(handler()).resolves.toBe(2);
      expect(diagnostic).toHaveBeenCalledTimes(1);
      expect(diagnostic).toHaveBeenCalledWith('[Travel Life diagnostic]', expect.objectContaining({
        operation: 'MAINTENANCE_RECONCILIATION', reasonCode: 'DATABASE_BUSY', stage: null,
        retryable: true, durableOutcome: 'failed', correlationId: expect.any(String),
      }));
      expect(JSON.stringify(diagnostic.mock.calls)).not.toContain(privateSentinel);
    } finally { diagnostic.mockRestore(); }
  });

  it('contains a reconciliation-runner native failure instead of letting TaskManager log it', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/maintenance/task');
    const handler = mockDefineTask.mock.calls[0][1] as () => Promise<number>;
    const diagnostic = jest.spyOn(console, 'info').mockImplementation(() => {});
    try {
      const privateSentinel = 'private-native-prepare-sentinel';
      mockReconcile.mockRejectedValueOnce(new Error(`NativeDatabase.prepareAsync rejected: ${privateSentinel}`));
      await expect(handler()).resolves.toBe(2);
      expect(diagnostic).toHaveBeenCalledTimes(1);
      expect(diagnostic).toHaveBeenCalledWith('[Travel Life diagnostic]', expect.objectContaining({
        operation: 'MAINTENANCE_RECONCILIATION', reasonCode: 'UNKNOWN', stage: null,
        retryable: true, durableOutcome: 'failed', correlationId: expect.any(String),
      }));
      expect(JSON.stringify(diagnostic.mock.calls)).not.toContain(privateSentinel);
    } finally { diagnostic.mockRestore(); }
  });

  it('preserves the closed native reason and reconciliation stage for background failures', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/maintenance/task');
    const handler = mockDefineTask.mock.calls[0][1] as () => Promise<number>;
    const diagnostic = jest.spyOn(console, 'info').mockImplementation(() => {});
    try {
      mockReconcile.mockResolvedValueOnce('complete');
      mockReconcileQueued.mockRejectedValueOnce(new ReconciliationStageError('LEASE_WRITE', new Error('database is locked: private sentinel')));
      await expect(handler()).resolves.toBe(2);
      expect(diagnostic).toHaveBeenCalledWith('[Travel Life diagnostic]', expect.objectContaining({
        operation: 'MAINTENANCE_RECONCILIATION', reasonCode: 'DATABASE_BUSY', stage: 'LEASE_WRITE', retryable: true, durableOutcome: 'failed',
      }));
      expect(JSON.stringify(diagnostic.mock.calls)).not.toContain('private sentinel');
    } finally { diagnostic.mockRestore(); }
  });
});
