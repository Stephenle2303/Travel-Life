import { ReconciliationStageError } from '@/reconstruction/repository';

const mockDefineTask = jest.fn();
const mockReconcile = jest.fn();
const mockReconcileQueued = jest.fn();
const mockRunCluePass = jest.fn(async (..._args: unknown[]) => ({ status: 'complete', produced: 0, activated: 0, reviewCards: 0, rebuildTriggered: false }));
const mockAccountSync = jest.fn(async()=>true);

jest.mock('expo-task-manager', () => ({ defineTask: mockDefineTask }));
jest.mock('expo-background-task', () => ({ BackgroundTaskResult: { Success: 1, Failed: 2 } }));
jest.mock('@/import-record', () => ({ createNativeImportRepository: jest.fn(() => ({})) }));
jest.mock('@/photo-access/native-adapter', () => ({ nativePhotoAccess: {} }));
jest.mock('@/maintenance/reconcile-runner', () => ({ reconcilePermittedLibrary: (...args: unknown[]) => mockReconcile(...args) }));
jest.mock('@/reconstruction', () => ({ createNativeReconstructionRepository: jest.fn(() => ({ reconcileQueued: (...args: unknown[]) => mockReconcileQueued(...args), runCluePass: (...args: unknown[]) => mockRunCluePass(...args) })) }));
jest.mock('@/account/history-sync-native',()=>({runBackgroundAccountSync:()=>mockAccountSync()}));

describe('maintenance task entry point', () => {
  beforeEach(()=>{ mockReconcileQueued.mockClear(); mockRunCluePass.mockClear(); });

  it('runs the clue pass once reconciliation completes, and its failure never blocks account sync or fails the task', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/maintenance/task');
    const handler = mockDefineTask.mock.calls[0][1] as () => Promise<number>;
    mockReconcile.mockResolvedValueOnce('complete');
    mockReconcileQueued.mockResolvedValueOnce({});
    mockRunCluePass.mockRejectedValueOnce(new Error('database is locked: private-clue-sentinel'));
    mockAccountSync.mockResolvedValueOnce(true);
    const diagnostic = jest.spyOn(console, 'info').mockImplementation(() => {});
    try {
      await expect(handler()).resolves.toBe(1);
      expect(mockRunCluePass).toHaveBeenCalledTimes(1);
      // runCluePass's own (real) implementation always self-reports an
      // accurate AI_CLUE_PASS diagnostic before rethrowing; this mock
      // bypasses that, so the task's own catch staying silent (rather than
      // re-logging a second, wrongly-staged event under an unrelated
      // correlation id) means no diagnostic fires here at all.
      expect(diagnostic).not.toHaveBeenCalledWith('[Travel Life diagnostic]', expect.objectContaining({ operation: 'AI_CLUE_PASS' }));
      expect(JSON.stringify(diagnostic.mock.calls)).not.toContain('private-clue-sentinel');
    } finally { diagnostic.mockRestore(); }
  });

  it('does not run the clue pass when reconciliation itself did not complete', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/maintenance/task');
    const handler = mockDefineTask.mock.calls[0][1] as () => Promise<number>;
    mockReconcile.mockResolvedValueOnce('paused');
    await expect(handler()).resolves.toBe(2);
    expect(mockRunCluePass).not.toHaveBeenCalled();
  });
  it('does not report OS success after failed account merge or pull',async()=>{
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/maintenance/task');
    const handler=mockDefineTask.mock.calls[0][1] as ()=>Promise<number>;
    mockReconcile.mockResolvedValueOnce('complete');mockReconcileQueued.mockResolvedValueOnce({});mockAccountSync.mockResolvedValueOnce(false);
    await expect(handler()).resolves.toBe(2);
    mockReconcileQueued.mockClear();
  });
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
