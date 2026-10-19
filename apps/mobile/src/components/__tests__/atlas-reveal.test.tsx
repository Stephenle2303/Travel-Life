import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { AtlasReveal, mapCameraFor, mapLibreDevelopmentStyle } from '@/components/atlas-reveal';
import { assertRevealPayload, deriveAtlasExploration, projectReveal } from '@/reveal/projection';
import { recordRevealEvent } from '@/reveal/telemetry';

jest.mock('@maplibre/maplibre-react-native', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  return {
    Map: View, Camera: View, Layer: View,
    GeoJSONSource: ({ children, ...props }: { children?: unknown }) => <View {...props}>{children}</View>,
  };
});

jest.mock('expo-video', () => ({
  useVideoPlayer: (_source: unknown, setup: (player: { muted: boolean; volume: number; loop: boolean; play(): void; pause(): void }) => void) => {
    const player = { muted: true, volume: 0, loop: false, play: jest.fn(), pause: jest.fn() };
    setup(player);
    return player;
  },
  VideoView: () => null,
}));

const actions = { onImport: jest.fn(), onRetry: jest.fn(), onCatchUp: jest.fn(), onManualEntry: jest.fn(), onReplay: jest.fn() };

function modelFor(overrides: Partial<Parameters<typeof projectReveal>[0]>) {
  return projectReveal({ graph: null, durableRecord: null, reconstructionStatus: 'complete', reconciliationStatus: 'complete', pendingCount: 0, sourceScope: 'full', importedCount: 3, ...overrides });
}

describe('private Atlas reveal', () => {
  it('projects a completed graph into redacted inferred list items and a Replay handoff', async () => {
    const model = projectReveal({ graph: null, durableRecord: { journeys: [{ displayId: 'journey-1', state: 'inferred', anchor: { latitude: 13.7, longitude: 100.5 }, years: [2024], periodLabel: '2024', ordering: 'chronological' }] }, reconstructionStatus: 'complete', reconciliationStatus: 'complete', pendingCount: 0, sourceScope: 'full', importedCount: 3 });
    expect(model).toMatchObject({ state: 'ready', replay: { eligible: true } });
    expect(model.journeys[0]).toEqual({ id: 'journey-1', label: 'Private journey', status: 'Inferred', years: [2024], periodLabel: '2024', ordering: 'Chronological', hasMapSupport: true, mapAnchor: { latitude: 13.7, longitude: 100.5 } });
    const view = await render(<AtlasReveal model={model} {...actions} />);
    await fireEvent.press(view.getByRole('button', { name: 'About your Atlas' }));
    expect(view.getByText(/Photo location does not verify/)).toBeOnTheScreen();
    expect(view.getByRole('button', { name: 'Check Replay availability' })).toBeOnTheScreen();
    await view.unmount();
    const unavailable = await render(<AtlasReveal model={model} {...actions} mapAvailable={false} />);
    expect(unavailable.getByTestId('private-atlas-map')).toBeOnTheScreen();
    await unavailable.rerender(<AtlasReveal model={model} {...actions} mapAvailable />);
    expect(unavailable.getByTestId('private-atlas-map')).toBeOnTheScreen();
  });

  it('keeps the ready map, local list, coverage and Replay action available', async () => {
    const view = await render(<AtlasReveal model={modelFor({ durableRecord: { journeys: [{ displayId: 'journey-1', state: 'inferred', anchor: { latitude: 13.7, longitude: 100.5 }, years: [2024], periodLabel: '2024', ordering: 'chronological' }] } })} {...actions} />);
    expect(view.getByTestId('private-atlas-map')).toBeOnTheScreen();
    await fireEvent.press(view.getByRole('button', { name: 'About your Atlas' }));
    expect(view.getByText(/3 device-visible records/)).toBeOnTheScreen();
    expect(view.getByText('Private journey')).toBeOnTheScreen();
    await fireEvent.press(view.getByRole('button', { name: 'Check Replay availability' }));
    expect(actions.onReplay).toHaveBeenCalled();
    await fireEvent.press(view.getByRole('button', { name: 'Show chronological Timeline' }));
    expect(view.getByRole('button', { name: 'Show chronological Timeline' }).props.accessibilityState).toMatchObject({ selected: true });
  });

  it('keeps the last durable map projection explorable while local reconciliation is running', async () => {
    const view = await render(<AtlasReveal model={modelFor({
      durableRecord: { journeys: [{ displayId: 'journey-1', state: 'inferred', anchor: { latitude: 13.7, longitude: 100.5 }, years: [2024], periodLabel: '2024', ordering: 'chronological' }] },
      reconstructionStatus: 'complete', reconciliationStatus: 'running', pendingCount: 1,
    })} {...actions} />);

    expect(view.getByText('Local updates are still being reconciled. This record is not final yet.')).toBeOnTheScreen();
    expect(view.getByTestId('private-atlas-map')).toBeOnTheScreen();
    expect(view.getByRole('button', { name: 'Show chronological Timeline' })).toBeOnTheScreen();
    expect(view.getByRole('button', { name: 'Show journeys from 2024' })).toBeOnTheScreen();
    expect(view.getByText('Replay will be available after local updates finish.')).toBeOnTheScreen();
  });

  it('uses a bundled offline map without a native tile renderer', async () => {
    const view = await render(<AtlasReveal model={modelFor({ durableRecord: { journeys: [{ displayId: 'journey-1', state: 'inferred', anchor: { latitude: 13.7, longitude: 100.5 }, years: [2024], periodLabel: '2024', ordering: 'chronological' }] } })} {...actions} />);
    const map = view.getByTestId('private-atlas-map');
    expect(map.props.source).toBeDefined();
    expect(view.getByTestId('private-atlas-anchors')).toBeOnTheScreen();
  });

  it('offers import and manual entry for sparse evidence', async () => {
    const view = await render(<AtlasReveal model={modelFor({ sourceScope: 'limited', importedCount: 1 })} {...actions} />);
    expect(view.getByText('No journey revealed yet.')).toBeOnTheScreen();
    expect(view.getByText(/No completed local reconstruction diagnostics/)).toBeOnTheScreen();
    await fireEvent.press(view.getByRole('button', { name: 'Import or reconnect photos' }));
    await fireEvent.press(view.getByRole('button', { name: 'Add a journey manually' }));
    expect(actions.onImport).toHaveBeenCalled();
    expect(actions.onManualEntry).toHaveBeenCalled();
  });

  it('shows durable aggregate sparse diagnostics after reopening without a graph', async () => {
    const diagnostics = { assessed: 2989, supported: 0, places: 0, visits: 0, missingDay: 1032, invalidDay: 0, unavailable: 0, duplicateConflict: 0, insufficientLocation: 1957, excluded: 0 };
    const model = modelFor({ graph: null, durableRecord: { journeys: [], diagnostics }, importedCount: 2989 });
    const view = await render(<AtlasReveal model={model} {...actions} />);
    expect(view.getByText(/2989 records assessed; 0 supported/)).toBeOnTheScreen();
    expect(view.getByText(/1957 insufficient location support/)).toBeOnTheScreen();
    await fireEvent.press(view.getByRole('button', { name: 'Recheck local journey history' }));
    expect(actions.onRetry).toHaveBeenCalled();
    expect(JSON.stringify(model)).not.toContain('evidenceId');
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

  it('coarsens and range-checks map points, then frames all displayed anchors', () => {
    const model = modelFor({ durableRecord: { journeys: [{ displayId: 'journey-1', state: 'inferred', anchor: { latitude: 13.75632, longitude: 100.501765 }, years: [], periodLabel: 'Date unknown', ordering: 'chronological' }, { displayId: 'journey-2', state: 'inferred', anchor: { latitude: 91, longitude: 100 }, years: [], periodLabel: 'Date unknown', ordering: 'uncertain' }] } });
    expect(model.journeys.map((journey) => journey.mapAnchor)).toEqual([{ latitude: 13.8, longitude: 100.5 }, null]);
    expect(mapCameraFor([{ latitude: 0, longitude: 0 }, { latitude: 10, longitude: 20 }])).toEqual({ center: [10, 5], zoom: 4 });
  });

  it('never selects a MapLibre demo style', () => {
    expect(mapLibreDevelopmentStyle(true)).toBeNull();
    expect(mapLibreDevelopmentStyle(false)).toBeNull();
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

  it('keeps Timeline selection coherent and clears it when a filter excludes it', async () => {
    const model = projectReveal({ graph: null, durableRecord: { journeys: [
      { displayId: 'journey-1', state: 'inferred', anchor: { latitude: 13.7, longitude: 100.5 }, years: [2024], periodLabel: '2024', ordering: 'chronological' },
      { displayId: 'journey-2', state: 'inferred', anchor: { latitude: 35.7, longitude: 139.7 }, years: [2023], periodLabel: '2023', ordering: 'chronological' },
    ] }, reconstructionStatus: 'complete', reconciliationStatus: 'complete', pendingCount: 0, sourceScope: 'full', importedCount: 3 });
    const view = await render(<AtlasReveal model={model} {...actions} />);
    await fireEvent.press(view.getByRole('button', { name: /Private journey, 2024/ }));
    expect(view.getAllByLabelText('Private journey, 2024, selected')).toHaveLength(1);
    expect(view.getAllByLabelText('Private journey, 2024, selected').every((item) => item.props.accessibilityState?.selected)).toBe(true);
    await fireEvent.press(view.getByRole('button', { name: 'Show journeys from 2023' }));
    await fireEvent.press(view.getByRole('button', { name: 'Show all years' }));
    await waitFor(() => expect(view.queryByLabelText('Private journey, 2024, selected')).toBeNull());
  });

  it('opens a map feature and requires an explicit choice for overlapping features', async () => {
    const load = jest.fn(async (id: string) => ({ detail: { id, title: 'Private journey', observedSpan: `Observed ${id}`, visits: [], memories: [], uncertainty: [] }, previews: [] }));
    const model = modelFor({ durableRecord: { journeys: [
      { displayId: 'map-one', state: 'inferred', anchor: { latitude: 13.7, longitude: 100.5 }, years: [2024], periodLabel: '2024', ordering: 'chronological' },
      { displayId: 'map-two', state: 'inferred', anchor: { latitude: 13.7, longitude: 100.5 }, years: [2024], periodLabel: '2024', ordering: 'chronological' },
    ] } });
    const view = await render(<AtlasReveal model={model} {...actions} loadJourneyPreview={load} />);
    await fireEvent.press(view.getByTestId('private-atlas-anchors'));
    expect(view.getByText('Choose a journey')).toBeOnTheScreen();
    await fireEvent.press(view.getAllByRole('button', { name: 'Choose Private journey' })[0]);
    await waitFor(() => expect(load).toHaveBeenCalledWith('map-one'));
  });

  it('hands the enclosing scroll surface to a native map gesture, then releases it', async () => {
    const onMapGestureChange = jest.fn();
    const view = await render(<AtlasReveal model={modelFor({ durableRecord: { journeys: [{ displayId: 'journey-1', state: 'inferred', anchor: { latitude: 13.7, longitude: 100.5 }, years: [2024], periodLabel: '2024', ordering: 'chronological' }] } })} {...actions} onMapGestureChange={onMapGestureChange} />);
    const map = view.getByTestId('private-atlas-map');
    await fireEvent(map, 'pressIn');
    await fireEvent(map, 'pressOut');
    expect(onMapGestureChange).toHaveBeenNthCalledWith(1, true);
    expect(onMapGestureChange).toHaveBeenLastCalledWith(false);
  });

  it('loads a bounded gallery page and allows retry after a stale page error', async () => {
    const preview = jest.fn(async (id: string) => ({ detail: { id, title: 'Private journey', observedSpan: 'Observed 2024', visits: [], memories: [{ id: 'memory-1', availability: 'available' as const, association: 'Associated locally.' }], uncertainty: [] }, previews: [{ uri: 'file:///photo.jpg', availability: 'available' as const, kind: 'photo' as const }], snapshotToken: 8 }));
    const page = jest.fn().mockResolvedValueOnce({ page: { items: [{ id: 'media-1', availability: 'available' as const, association: 'Associated locally.', kind: 'photo' as const }], hasMore: true }, previews: [{ uri: 'file:///photo.jpg', availability: 'available' as const, kind: 'photo' as const }] }).mockRejectedValueOnce(new Error('stale')).mockResolvedValueOnce({ page: { items: [], hasMore: false }, previews: [] });
    const model = modelFor({ durableRecord: { journeys: [{ displayId: 'gallery-safe', state: 'inferred', anchor: null, years: [2024], periodLabel: '2024', ordering: 'chronological' }] } });
    const view = await render(<AtlasReveal model={model} {...actions} loadJourneyPreview={preview} loadJourneyMediaPage={page} />);
    await fireEvent.press(view.getByRole('button', { name: /Private journey, 2024/ }));
    await waitFor(() => expect(view.getByRole('button', { name: 'See photos and videos' })).toBeOnTheScreen());
    await fireEvent.press(view.getByRole('button', { name: 'See photos and videos' }));
    await waitFor(() => expect(page).toHaveBeenCalledWith('gallery-safe', 8, 0));
    expect(view.getByLabelText('Associated photo thumbnail')).toBeOnTheScreen();
    await fireEvent.press(view.getByRole('button', { name: 'Next media page' }));
    await waitFor(() => expect(view.getByRole('button', { name: 'Retry media page' })).toBeOnTheScreen());
    await fireEvent.press(view.getByRole('button', { name: 'Retry media page' }));
    await waitFor(() => expect(page).toHaveBeenCalledWith('gallery-safe', 8, 1));
  });

  it('keeps an in-place preview bound to the selected opaque journey and can close it', async () => {
    const load = jest.fn(async (id: string) => ({ detail: { id, title: 'Private journey', observedSpan: 'Observed 2024-01-01', visits: [], memories: [], uncertainty: [], correctionState: 'inferred' as const }, previews: [{ uri: 'file:///private-photo.jpg', availability: 'available' as const, kind: 'photo' as const }] }));
    const model = modelFor({ durableRecord: { journeys: [{ displayId: 'atlas-safe-display', state: 'inferred', anchor: null, years: [2024], periodLabel: '2024', ordering: 'chronological' }] } });
    const view = await render(<AtlasReveal model={model} {...actions} loadJourneyPreview={load} />);
    await fireEvent.press(view.getByRole('button', { name: /Private journey, 2024/ }));
    await waitFor(() => expect(view.getByText('Observed 2024-01-01')).toBeOnTheScreen());
    expect(view.getByLabelText('Associated photo preview')).toBeOnTheScreen();
    expect(load).toHaveBeenCalledWith('atlas-safe-display');
    await fireEvent.press(view.getByRole('button', { name: 'Close journey preview' }));
    expect(view.queryByLabelText('Close journey preview')).toBeNull();
  });
});
