import { ReconstructionController, RECONSTRUCTION_RULE_VERSION, type ReconstructionGraph } from '@/reconstruction';
import { ReconciliationStageError } from '@/reconstruction/repository';

const graph: ReconstructionGraph = { ruleVersion: RECONSTRUCTION_RULE_VERSION, places: [], visits: [], journeys: [], possibleMerges: [], dispositions: [], memberships: [] };

describe('local reconstruction controller', () => {
  it('acknowledges a queued maintenance wait without beginning reconstruction', () => {
    const repository = { rebuild: jest.fn(async () => graph) };
    const notify = jest.fn();
    const controller = new ReconstructionController(repository, notify);

    expect(controller.acknowledgeQueuedMaintenanceWait()).toBe(true);
    expect(repository.rebuild).not.toHaveBeenCalled();
    expect(controller.view).toMatchObject({ status: 'running', message: expect.stringContaining('Waiting for an existing local update') });
    expect(notify).toHaveBeenCalledWith(controller.view);
  });

  it('publishes a completed local draft after an atomic repository rebuild', async () => {
    const notify = jest.fn();
    const controller = new ReconstructionController({ rebuild: async () => graph }, notify);
    await controller.rebuild();
    expect(controller.view).toMatchObject({ status: 'complete', graph });
  });

  it('keeps its prior completed graph when a later rebuild is blocked or fails', async () => {
    const notify = jest.fn();
    const repository = { rebuild: jest.fn<Promise<ReconstructionGraph>, []>().mockResolvedValueOnce(graph).mockRejectedValueOnce(new Error('Private record is not connected.')) };
    const controller = new ReconstructionController(repository, notify);
    await controller.rebuild();
    await controller.rebuild();
    expect(controller.view).toMatchObject({ status: 'restricted', graph, message: expect.stringContaining('Reconnect') });
  });

  it('redacts a native rebuild failure into one fixed event and safe owner copy', async () => {
    const privateSentinel = 'private-native-rebuild-sentinel';
    const diagnostic = jest.spyOn(console, 'info').mockImplementation(() => {});
    try {
      const controller = new ReconstructionController({ rebuild: async () => { throw new Error(`database is locked: ${privateSentinel}`); } }, jest.fn());
      await controller.rebuild();
      expect(diagnostic).toHaveBeenCalledTimes(1);
      expect(diagnostic).toHaveBeenCalledWith('[Travel Life diagnostic]', expect.objectContaining({
        operation: 'ATLAS_REBUILD', reasonCode: 'DATABASE_BUSY', stage: null,
        retryable: true, durableOutcome: 'failed', correlationId: expect.any(String),
      }));
      expect(JSON.stringify(diagnostic.mock.calls)).not.toContain(privateSentinel);
      expect(controller.view.message).not.toContain(privateSentinel);
    } finally {
      diagnostic.mockRestore();
    }
  });

  it('uses the durable reconciliation boundary and keeps the prior graph on a failed catch-up', async () => {
    const updated = { ...graph, journeys: [{ id: 'journey:updated', visitIds: [], state: 'inferred' as const }] };
    const repository = {
      rebuild: jest.fn(async () => graph),
      reconcileQueued: jest.fn<Promise<{ graph: ReconstructionGraph; newJourneyCount: number; updatedJourneyCount: number }>, []>()
        .mockResolvedValueOnce({ graph: updated, newJourneyCount: 1, updatedJourneyCount: 0 })
        .mockRejectedValueOnce(new Error('transaction failed')),
    };
    const controller = new ReconstructionController(repository, jest.fn());

    await controller.rebuild();
    await controller.reconcile();
    expect(controller.view).toMatchObject({ status: 'complete', graph: updated, message: expect.stringContaining('private and unpublished') });

    await controller.reconcile();
    expect(controller.view).toMatchObject({ status: 'error', graph: updated, message: expect.stringContaining('last completed result') });
    expect(repository.reconcileQueued).toHaveBeenCalledTimes(2);
  });

  it('logs only a fixed diagnostic category for a failed catch-up', async () => {
    const log = jest.spyOn(console, 'info').mockImplementation(() => {});
    try {
      const privateDetail = 'private-place-name';
      const repository = {
        rebuild: async () => graph,
        reconcileQueued: async () => { throw new Error(`no such column: ${privateDetail}`); },
      };
      const controller = new ReconstructionController(repository, jest.fn());

      await controller.reconcile();

      expect(log).toHaveBeenCalledWith('[Travel Life diagnostic]', expect.objectContaining({ operation: 'ATLAS_CATCH_UP', reasonCode: 'SCHEMA', stage: null, retryable: true, durableOutcome: 'failed' }));
      expect(JSON.stringify(log.mock.calls)).not.toContain(privateDetail);
      expect(controller.view.status).toBe('error');
    } finally {
      log.mockRestore();
    }
  });

  it('logs a fixed SQLite stage without exposing the native failure detail', async () => {
    const log = jest.spyOn(console, 'info').mockImplementation(() => {});
    try {
      const privateDetail = 'private-place-name';
      const repository = {
        rebuild: async () => graph,
        reconcileQueued: async () => { throw new ReconciliationStageError('LEASE_WRITE', new Error(`database is locked: ${privateDetail}`)); },
      };

      await new ReconstructionController(repository, jest.fn()).reconcile();

      expect(log).toHaveBeenCalledWith('[Travel Life diagnostic]', expect.objectContaining({ operation: 'ATLAS_CATCH_UP', reasonCode: 'DATABASE_BUSY', stage: 'LEASE_WRITE', retryable: true, durableOutcome: 'failed' }));
      expect(JSON.stringify(log.mock.calls)).not.toContain(privateDetail);
    } finally {
      log.mockRestore();
    }
  });

  it('shows fixed owner guidance for a busy reconciliation without native details', async () => {
    const privateDetail = 'private-place-name';
    const repository = {
      rebuild: async () => graph,
      reconcileQueued: async () => { throw new ReconciliationStageError('LEASE_WRITE', new Error(`database is locked: ${privateDetail}`)); },
    };
    const controller = new ReconstructionController(repository, jest.fn());

    await controller.reconcile();

    expect(controller.view.message).toContain('Local storage is busy while Atlas updates');
    expect(controller.view.message).not.toContain(privateDetail);
  });

  it.each([
    ['History corrections need owner review before local reconciliation.', 'HISTORY_REVIEW'],
    ['Journey correction needs owner remap.', 'JOURNEY_REMAP'],
  ])('separates protected owner-review failures without logging their details', async (message, code) => {
    const log = jest.spyOn(console, 'info').mockImplementation(() => {});
    try {
      const repository = { rebuild: async () => graph, reconcileQueued: async () => { throw new Error(message); } };
      await new ReconstructionController(repository, jest.fn()).reconcile();
      expect(log).toHaveBeenCalledWith('[Travel Life diagnostic]', expect.objectContaining({ operation: 'ATLAS_CATCH_UP', reasonCode: code }));
    } finally {
      log.mockRestore();
    }
  });

  it('does not republish a late completed graph after lifecycle clear', async () => {
    let finish!: (result: ReconstructionGraph) => void;
    const notify = jest.fn();
    const controller = new ReconstructionController({ rebuild: () => new Promise<ReconstructionGraph>((resolve) => { finish = resolve; }) }, notify);

    const pending = controller.rebuild();
    controller.clear();
    finish(graph);
    await pending;

    expect(controller.view).toEqual({ status: 'idle', graph: null, message: null });
    expect(notify).toHaveBeenCalledTimes(2);
    expect(notify).toHaveBeenLastCalledWith({ status: 'idle', graph: null, message: null });
  });

  it('serializes repository rebuilds and waits for lifecycle resume', async () => {
    const resolvers: ((result: ReconstructionGraph) => void)[] = [];
    const secondGraph = { ...graph, journeys: [{ id: 'journey:second', visitIds: [], state: 'inferred' as const }] };
    const controller = new ReconstructionController({ rebuild: () => new Promise<ReconstructionGraph>((resolve) => { resolvers.push(resolve); }) }, jest.fn());

    const first = controller.rebuild();
    controller.clear();
    controller.resume();
    await controller.rebuild();
    expect(resolvers).toHaveLength(1);

    resolvers[0](graph);
    await first;

    const second = controller.rebuild();
    expect(resolvers).toHaveLength(2);
    resolvers[1](secondGraph);
    await second;

    expect(controller.view).toMatchObject({ status: 'complete', graph: secondGraph });
  });

  it('blocks rebuilds after lifecycle clear until the record reconnects', async () => {
    const rebuild = jest.fn(async () => graph);
    const controller = new ReconstructionController({ rebuild }, jest.fn());

    controller.clear();
    await controller.rebuild();
    expect(rebuild).not.toHaveBeenCalled();

    controller.resume();
    await controller.rebuild();
    expect(rebuild).toHaveBeenCalledTimes(1);
  });

  it('does not publish a late failure from an invalidated rebuild', async () => {
    let fail!: (error: Error) => void;
    const notify = jest.fn();
    const controller = new ReconstructionController({ rebuild: () => new Promise<ReconstructionGraph>((_resolve, reject) => { fail = reject; }) }, notify);

    const pending = controller.rebuild();
    controller.clear();
    fail(new Error('database unavailable'));
    await pending;

    expect(controller.view).toEqual({ status: 'idle', graph: null, message: null });
    expect(notify).toHaveBeenCalledTimes(2);
    expect(notify).toHaveBeenLastCalledWith({ status: 'idle', graph: null, message: null });
  });
});
