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
});
