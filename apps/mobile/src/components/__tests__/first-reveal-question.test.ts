import { selectFirstRevealQuestion, simulateFirstRevealQuestion, type FirstRevealSimulation } from '@/reconstruction/first-reveal-question';

const trips = (...keys: string[]) => keys.map((key) => ({ support: [key] }));
const simulate = (key: string, ...supports: string[]): FirstRevealSimulation => ({
  key, recognizable: true, periodKnown: true, alreadyResolved: false,
  yes: { safe: true, reliable: trips(...supports), removedOrChanged: 8 },
  no: { safe: true, reliable: [], removedOrChanged: 0 },
});

it('offers only for three distinct newly reliable trips, even when total trips decrease', () => {
  expect(selectFirstRevealQuestion(trips('a', 'b', 'c', 'd'), [simulate('offer', 'new1', 'new2', 'new3')]))
    .toMatchObject({ key: 'offer', yesGain: 3 });
  expect(selectFirstRevealQuestion([], [simulate('offer', 'new1', 'new2')])).toBeNull();
});

it('does not count split support, duplicates or already reliable lineage', () => {
  const candidate = simulate('offer', 'fresh', 'fresh', 'split1', 'split2');
  candidate.yes.reliable = [...candidate.yes.reliable, { support: ['remapped'], reliablePredecessors: ['prior-trip'] }];
  expect(selectFirstRevealQuestion([{ support: ['split1', 'split2'] }], [candidate])).toBeNull();
});

it('rejects an unsafe counterfactual and ranks tied gains by disruption', () => {
  const unsafe = simulate('unsafe', '1', '2', '3', '4');
  unsafe.no.safe = false;
  const first = simulate('more-disruption', '1', '2', '3');
  const second = simulate('less-disruption', '1', '2', '3');
  second.yes.removedOrChanged = 1;
  expect(selectFirstRevealQuestion([], [unsafe, first, second])).toMatchObject({ key: 'less-disruption' });
});

it('bounds simulation work and discards results if the snapshot becomes stale', async () => {
  const candidates = ['a', 'b', 'c', 'd'].map((key) => simulate(key, '1', '2', '3'));
  const signal = new AbortController().signal;
  const project = jest.fn(async (candidate: { key: string }, answer: 'yes' | 'no') =>
    candidates.find(({ key }) => key === candidate.key)![answer]);
  await expect(simulateFirstRevealQuestion({ baseline: [], candidates, signal, current: () => true, project }))
    .resolves.toMatchObject({ key: 'a' });
  expect(project).toHaveBeenCalledTimes(6);
  let live = true;
  project.mockClear().mockImplementationOnce(async () => {
    live = false;
    return candidates[0].yes;
  });
  await expect(simulateFirstRevealQuestion({ baseline: [], candidates, signal, current: () => live, project })).resolves.toBeNull();
  expect(project).toHaveBeenCalledTimes(1);
});

it('withdraws a pending read-only branch when the reveal budget is cancelled', async () => {
  const controller = new AbortController();
  const project = jest.fn(() => new Promise<FirstRevealSimulation['yes']>(() => {}));
  const work = simulateFirstRevealQuestion({ baseline: [], candidates: [simulate('one', 'a', 'b', 'c')],
    signal: controller.signal, current: () => true, project });
  controller.abort();
  await expect(work).resolves.toBeNull();
  expect(project).toHaveBeenCalledTimes(1);
});
