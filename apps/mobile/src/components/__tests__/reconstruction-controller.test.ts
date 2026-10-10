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
});
