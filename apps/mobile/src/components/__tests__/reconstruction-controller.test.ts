import { ReconstructionController, RECONSTRUCTION_RULE_VERSION, type ReconstructionGraph } from '@/reconstruction';

const graph: ReconstructionGraph = { ruleVersion: RECONSTRUCTION_RULE_VERSION, places: [], visits: [], journeys: [], possibleMerges: [], dispositions: [], memberships: [] };

describe('local reconstruction controller', () => {
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
