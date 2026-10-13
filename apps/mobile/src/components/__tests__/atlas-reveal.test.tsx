import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { AtlasReveal, mapRegionFor } from '@/components/atlas-reveal';
import { assertRevealPayload, deriveAtlasExploration, projectReveal } from '@/reveal/projection';
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
    const model = projectReveal({ graph: null, durableRecord: { journeys: [{ displayId: 'journey-1', state: 'inferred', anchor: { latitude: 13.7, longitude: 100.5 }, years: [2024], periodLabel: '2024', ordering: 'chronological' }] }, reconstructionStatus: 'complete', reconciliationStatus: 'complete', pendingCount: 0, sourceScope: 'full', importedCount: 3 });
    expect(model).toMatchObject({ state: 'ready', replay: { eligible: true } });
    expect(model.journeys[0]).toEqual({ id: 'journey-1', label: 'Available journey 1', status: 'Inferred', years: [2024], periodLabel: '2024', ordering: 'Chronological', hasMapSupport: true, mapAnchor: { latitude: 13.7, longitude: 100.5 } });
    const view = await render(<AtlasReveal model={model} {...actions} />);
    expect(view.getByText(/Photo location does not verify/)).toBeOnTheScreen();
    expect(view.getByRole('button', { name: 'Check Replay availability' })).toBeOnTheScreen();
    await view.unmount();
    const unavailable = await render(<AtlasReveal model={model} {...actions} mapAvailable={false} />);
    expect(unavailable.getByText(/The map is unavailable. Your local history Timeline is still available/)).toBeOnTheScreen();
    await unavailable.rerender(<AtlasReveal model={model} {...actions} mapAvailable />);
    expect(unavailable.getByLabelText('Private Atlas map')).toBeOnTheScreen();
  });

  it('keeps the ready map, local list, coverage and Replay action available', async () => {
    const view = await render(<AtlasReveal model={modelFor({ durableRecord: { journeys: [{ displayId: 'journey-1', state: 'inferred', anchor: { latitude: 13.7, longitude: 100.5 }, years: [2024], periodLabel: '2024', ordering: 'chronological' }] } })} {...actions} />);
    expect(view.getByLabelText('Private Atlas map')).toBeOnTheScreen();
    expect(view.getByText(/3 device-visible records/)).toBeOnTheScreen();
    expect(view.getByText(/Available journey 1/)).toBeOnTheScreen();
    await fireEvent.press(view.getByRole('button', { name: 'Check Replay availability' }));
    expect(actions.onReplay).toHaveBeenCalled();
    await fireEvent.press(view.getByRole('button', { name: 'Use chronological Timeline fallback' }));
    expect(view.getByRole('button', { name: 'Show chronological Timeline' }).props.accessibilityState).toMatchObject({ selected: true });
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
    expect(() => assertRevealPayload({ statistics: { journeyCount: 2, placeCount: 3, supportedCountryCount: 1, countryStatus: 'supported' } })).not.toThrow();
    expect(() => assertRevealPayload({ statistics: { journeyCount: 2, countryCode: 'THA' } })).toThrow(/aggregate/);
  });

  it('renders only aggregate inferred statistics and explains unavailable country support', async () => {
    const model = modelFor({ durableRecord: { journeys: [{ displayId: 'journey-1', state: 'inferred', anchor: null, years: [], periodLabel: 'Date unknown', ordering: 'uncertain' }], statistics: { journeyCount: 1, placeCount: 2, supportedCountryCount: 0, countryStatus: 'supported' } } });
    const view = await render(<AtlasReveal model={model} {...actions} />);
    expect(view.getByText('Inferred local record')).toBeOnTheScreen();
    expect(view.getByText('1 inferred journey.')).toBeOnTheScreen();
    expect(view.getByText('2 inferred places.')).toBeOnTheScreen();
    expect(view.getByText(/No supported countries can be counted/)).toBeOnTheScreen();
    expect(JSON.stringify(model)).not.toMatch(/countryCode|THA|latitude|duration|route/);
  });

  it('withholds a committed statistics projection while access is restricted or local updates are pending', () => {
    const durableRecord = {
      journeys: [{ displayId: 'journey-1', state: 'inferred' as const, anchor: null, years: [], periodLabel: 'Date unknown', ordering: 'uncertain' as const }],
      statistics: { journeyCount: 1, placeCount: 1, supportedCountryCount: 1, countryStatus: 'supported' as const },
    };
    expect(modelFor({ durableRecord, reconstructionStatus: 'restricted', reconciliationStatus: 'restricted', sourceScope: 'revoked' }).statistics).toBeNull();
    expect(modelFor({ durableRecord, reconstructionStatus: 'running', reconciliationStatus: 'pending', pendingCount: 1 }).statistics).toBeNull();
  });

  it('coarsens and range-checks map points, then fits all displayed anchors', () => {
    const model = modelFor({ durableRecord: { journeys: [{ displayId: 'journey-1', state: 'inferred', anchor: { latitude: 13.75632, longitude: 100.501765 }, years: [], periodLabel: 'Date unknown', ordering: 'chronological' }, { displayId: 'journey-2', state: 'inferred', anchor: { latitude: 91, longitude: 100 }, years: [], periodLabel: 'Date unknown', ordering: 'uncertain' }] } });
    expect(model.journeys.map((journey) => journey.mapAnchor)).toEqual([{ latitude: 13.8, longitude: 100.5 }, null]);
    expect(mapRegionFor([{ latitude: 0, longitude: 0 }, { latitude: 10, longitude: 20 }])).toEqual({ latitude: 5, longitude: 10, latitudeDelta: 13, longitudeDelta: 26 });
  });

  it('keeps Map and Timeline on the same year-filtered journeys and clears an excluded selection', () => {
    const model = projectReveal({ graph: null, durableRecord: { journeys: [
      { displayId: 'journey-1', state: 'inferred', anchor: null, years: [2024, 2025], periodLabel: '2024', ordering: 'chronological' },
      { displayId: 'journey-2', state: 'possible-merge', anchor: null, years: [2023], periodLabel: '2023', ordering: 'uncertain' },
      { displayId: 'journey-3', state: 'inferred', anchor: null, years: [], periodLabel: 'Date unknown', ordering: 'uncertain' },
    ] }, reconstructionStatus: 'complete', reconciliationStatus: 'complete', pendingCount: 0, sourceScope: 'full', importedCount: 3 });
    expect(deriveAtlasExploration(model.journeys, { view: 'map', year: 2024, selectedJourneyId: 'journey-1' })).toMatchObject({ years: [2025, 2024, 2023], visibleJourneys: [expect.objectContaining({ id: 'journey-1' })], selectedJourneyId: 'journey-1' });
    expect(deriveAtlasExploration(model.journeys, { view: 'timeline', year: 2023, selectedJourneyId: 'journey-1' })).toMatchObject({ visibleJourneys: [expect.objectContaining({ id: 'journey-2' })], selectedJourneyId: null });
  });

  it('uses the same selected journey for a Timeline card and marker, and clears it when a filter excludes it', async () => {
    const model = projectReveal({ graph: null, durableRecord: { journeys: [
      { displayId: 'journey-1', state: 'inferred', anchor: { latitude: 13.7, longitude: 100.5 }, years: [2024], periodLabel: '2024', ordering: 'chronological' },
      { displayId: 'journey-2', state: 'inferred', anchor: { latitude: 35.7, longitude: 139.7 }, years: [2023], periodLabel: '2023', ordering: 'chronological' },
    ] }, reconstructionStatus: 'complete', reconciliationStatus: 'complete', pendingCount: 0, sourceScope: 'full', importedCount: 3 });
    const view = await render(<AtlasReveal model={model} {...actions} />);
    await fireEvent.press(view.getByRole('button', { name: /Available journey 1, 2024/ }));
    expect(view.getAllByLabelText('Available journey 1, 2024, selected')).toHaveLength(2);
    expect(view.getAllByLabelText('Available journey 1, 2024, selected').every((item) => item.props.accessibilityState?.selected)).toBe(true);
    await fireEvent.press(view.getByRole('button', { name: 'Show journeys from 2023' }));
    await fireEvent.press(view.getByRole('button', { name: 'Show all years' }));
    await waitFor(() => expect(view.queryByLabelText('Available journey 1, 2024, selected')).toBeNull());
  });

  it('opens the selected journey with only its opaque Atlas display ID', async () => {
    const open = jest.fn();
    const model = modelFor({ durableRecord: { journeys: [{ displayId: 'atlas-safe-display', state: 'inferred', anchor: null, years: [2024], periodLabel: '2024', ordering: 'chronological' }] } });
    const view = await render(<AtlasReveal model={model} {...actions} onOpenJourney={open} />);
    await fireEvent.press(view.getByRole('button', { name: /Available journey 1, 2024/ }));
    await fireEvent.press(view.getByRole('button', { name: 'Open selected private journey' }));
    expect(open).toHaveBeenCalledWith('atlas-safe-display');
  });
});
