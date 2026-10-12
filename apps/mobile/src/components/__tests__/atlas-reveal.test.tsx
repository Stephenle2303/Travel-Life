import { fireEvent, render } from '@testing-library/react-native';

import { AtlasReveal, mapRegionFor } from '@/components/atlas-reveal';
import { assertRevealPayload, projectReveal } from '@/reveal/projection';
import { recordRevealEvent } from '@/reveal/telemetry';

jest.mock('react-native-maps', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  return { __esModule: true, default: View, Marker: View };
});

const actions = { onImport: jest.fn(), onRetry: jest.fn(), onCatchUp: jest.fn(), onManualEntry: jest.fn(), onReplay: jest.fn() };

function modelFor(overrides: Partial<Parameters<typeof projectReveal>[0]>) {
  return projectReveal({ graph: null, durableRecord: null, reconstructionStatus: 'complete', reconciliationStatus: 'complete', pendingCount: 0, sourceScope: 'full', importedCount: 3, ...overrides });
}

describe('private Atlas reveal', () => {
  it('projects a completed graph into redacted inferred list items and a Replay handoff', async () => {
    const model = projectReveal({ graph: null, durableRecord: { journeys: [{ state: 'inferred', anchor: { latitude: 13.7, longitude: 100.5 } }] }, reconstructionStatus: 'complete', reconciliationStatus: 'complete', pendingCount: 0, sourceScope: 'full', importedCount: 3 });
    expect(model).toMatchObject({ state: 'ready', replay: { eligible: true } });
    expect(model.journeys[0]).toEqual({ id: 'journey-1', label: 'Available journey 1', status: 'Inferred', hasMapSupport: true, mapAnchor: { latitude: 13.7, longitude: 100.5 } });
    const view = await render(<AtlasReveal model={model} {...actions} />);
    expect(view.getByText(/Photo location does not verify/)).toBeOnTheScreen();
    expect(view.getByRole('button', { name: 'Check Replay availability' })).toBeOnTheScreen();
    await view.unmount();
    const unavailable = await render(<AtlasReveal model={model} {...actions} mapAvailable={false} />);
    expect(unavailable.getByText(/The map is unavailable. Your local history list is still available/)).toBeOnTheScreen();
    await unavailable.rerender(<AtlasReveal model={model} {...actions} mapAvailable />);
    expect(unavailable.getByLabelText('Private Atlas map')).toBeOnTheScreen();
  });

  it('keeps the ready map, local list, coverage and Replay action available', async () => {
    const view = await render(<AtlasReveal model={modelFor({ durableRecord: { journeys: [{ state: 'inferred', anchor: { latitude: 13.7, longitude: 100.5 } }] } })} {...actions} />);
    expect(view.getByLabelText('Private Atlas map')).toBeOnTheScreen();
    expect(view.getByText(/3 device-visible records/)).toBeOnTheScreen();
    expect(view.getByText(/Available journey 1/)).toBeOnTheScreen();
    await fireEvent.press(view.getByRole('button', { name: 'Check Replay availability' }));
    expect(actions.onReplay).toHaveBeenCalled();
    await fireEvent.press(view.getByRole('button', { name: 'Use history list fallback' }));
    expect(view.getByText(/Your local history list is available below/)).toBeOnTheScreen();
  });

  it('offers import and manual entry for sparse evidence', async () => {
    const view = await render(<AtlasReveal model={modelFor({ sourceScope: 'limited', importedCount: 1 })} {...actions} />);
    expect(view.getByText(/not enough supported local evidence/)).toBeOnTheScreen();
    await fireEvent.press(view.getByRole('button', { name: 'Import or reconnect photos' }));
    await fireEvent.press(view.getByRole('button', { name: 'Add a journey manually' }));
    expect(actions.onImport).toHaveBeenCalled();
    expect(actions.onManualEntry).toHaveBeenCalled();
  });

  it('states processing is not final and offers a local catch-up', async () => {
    const view = await render(<AtlasReveal model={modelFor({ reconstructionStatus: 'running', reconciliationStatus: 'running', pendingCount: 1 })} {...actions} />);
    expect(view.getByText(/not final yet/)).toBeOnTheScreen();
    await fireEvent.press(view.getByRole('button', { name: 'Catch up local journey history' }));
    expect(actions.onCatchUp).toHaveBeenCalled();
  });

  it('offers reconnect/import for restricted access and retry/manual entry after a failure', async () => {
    const restricted = await render(<AtlasReveal model={modelFor({ reconstructionStatus: 'restricted', reconciliationStatus: 'restricted', sourceScope: 'revoked' })} {...actions} />);
    expect(restricted.getByText(/Access is limited/)).toBeOnTheScreen();
    await fireEvent.press(restricted.getByRole('button', { name: 'Import or reconnect photos' }));
    expect(actions.onImport).toHaveBeenCalled();
    await restricted.unmount();
    const failed = await render(<AtlasReveal model={modelFor({ reconstructionStatus: 'error', reconciliationStatus: 'error' })} {...actions} />);
    expect(failed.getByText(/could not finish/)).toBeOnTheScreen();
    await fireEvent.press(failed.getByRole('button', { name: 'Retry local reveal' }));
    await fireEvent.press(failed.getByRole('button', { name: 'Add a journey manually' }));
    expect(actions.onRetry).toHaveBeenCalled();
    expect(actions.onManualEntry).toHaveBeenCalled();
  });

  it('rejects private fields and makes absent consent or sink failure inert', async () => {
    expect(() => assertRevealPayload({ nested: { latitude: 1 } })).toThrow(/not allowed/);
    const sink = { record: jest.fn().mockRejectedValue(new Error('offline')) };
    await expect(recordRevealEvent(false, sink, { name: 'reveal-opened', state: 'ready', journeyCount: 1 })).resolves.toBeUndefined();
    expect(sink.record).not.toHaveBeenCalled();
    await expect(recordRevealEvent(true, sink, { name: 'reveal-opened', state: 'ready', journeyCount: 1 })).resolves.toBeUndefined();
    await expect(recordRevealEvent(true, sink, { name: 'reveal-opened', state: 'ready', journeyCount: 1, nested: { sourceId: 'private' } })).resolves.toBeUndefined();
    expect(sink.record).toHaveBeenCalledTimes(1);
  });

  it('coarsens and range-checks map points, then fits all displayed anchors', () => {
    const model = modelFor({ durableRecord: { journeys: [{ state: 'inferred', anchor: { latitude: 13.75632, longitude: 100.501765 } }, { state: 'inferred', anchor: { latitude: 91, longitude: 100 } }] } });
    expect(model.journeys.map((journey) => journey.mapAnchor)).toEqual([{ latitude: 13.8, longitude: 100.5 }, null]);
    expect(mapRegionFor([{ latitude: 0, longitude: 0 }, { latitude: 10, longitude: 20 }])).toEqual({ latitude: 5, longitude: 10, latitudeDelta: 13, longitudeDelta: 26 });
  });
});
