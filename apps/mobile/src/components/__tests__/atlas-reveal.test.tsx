import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { AtlasReveal, mapCameraFor, mapRegionFor } from '@/components/atlas-reveal';
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

afterEach(() => jest.restoreAllMocks());

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

  it('uses a restrained camera pitch only for an explicit perspective request and keeps Reduce Motion flat', () => {
    const region = mapRegionFor([{ latitude: 0, longitude: 0 }, { latitude: 10, longitude: 20 }]);
    expect(mapCameraFor(region, 'flat', false)).toMatchObject({ center: { latitude: 5, longitude: 10 }, pitch: 0, heading: 0 });
    expect(mapCameraFor(region, 'perspective', false)).toMatchObject({ pitch: 28, heading: 0 });
    expect(mapCameraFor(region, 'perspective', true)).toMatchObject({ pitch: 0, heading: 0 });
  });

  it('lets an owner explicitly switch to the perspective treatment while ordinary motion is allowed', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    const model = modelFor({ durableRecord: { journeys: [{ displayId: 'journey-1', state: 'inferred', anchor: { latitude: 13.7, longitude: 100.5 }, years: [2024], periodLabel: '2024', ordering: 'chronological' }] } });
    const view = await render(<AtlasReveal model={model} {...actions} />);
    const perspective = view.getByRole('button', { name: 'Show Atlas map in 3D' });
    await waitFor(() => expect(perspective.props.accessibilityState).toMatchObject({ disabled: false }));
    await fireEvent.press(perspective);
    expect(view.getByLabelText('Private Atlas map').props.initialCamera).toMatchObject({ pitch: 28, heading: 0 });
  });

  it('keeps the 3D control unavailable and the camera flat for Reduce Motion', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const model = modelFor({ durableRecord: { journeys: [{ displayId: 'journey-1', state: 'inferred', anchor: { latitude: 13.7, longitude: 100.5 }, years: [2024], periodLabel: '2024', ordering: 'chronological' }] } });
    const view = await render(<AtlasReveal model={model} {...actions} />);
    const perspective = view.getByRole('button', { name: 'Map perspective is unavailable while Reduce Motion is on' });
    await waitFor(() => expect(perspective.props.accessibilityState).toMatchObject({ disabled: true }));
    expect(view.getByLabelText('Private Atlas map').props.initialCamera).toMatchObject({ pitch: 0, heading: 0 });
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
    expect(view.getAllByLabelText('Available journey 1, 2024, Atlas item 1, selected')).toHaveLength(2);
    expect(view.getAllByLabelText('Available journey 1, 2024, Atlas item 1, selected').every((item) => item.props.accessibilityState?.selected)).toBe(true);
    await fireEvent.press(view.getByRole('button', { name: 'Show journeys from 2023' }));
    await fireEvent.press(view.getByRole('button', { name: 'Show all years' }));
    await waitFor(() => expect(view.queryByLabelText('Available journey 1, 2024, Atlas item 1, selected')).toBeNull());
  });

  it('keeps rows flat while stating only their safe period and necessary uncertainty', async () => {
    const model = modelFor({ durableRecord: { journeys: [
      { displayId: 'ordinary', state: 'inferred', anchor: null, years: [2024], periodLabel: '2024', ordering: 'chronological' },
      { displayId: 'unknown', state: 'possible-merge', anchor: null, years: [], periodLabel: 'Date unknown', ordering: 'uncertain' },
    ] } });
    const view = await render(<AtlasReveal model={model} {...actions} />);
    expect(view.getByText('2024 · Inferred · Location unknown')).toBeOnTheScreen();
    expect(view.getByText('Date unknown · Needs review · Order uncertain · Location unknown')).toBeOnTheScreen();
    await fireEvent.press(view.getByRole('button', { name: 'Available journey 2, Date unknown, Atlas item 2' }));
    expect(view.getByLabelText('Available journey 2, Date unknown, Atlas item 2, selected').props.accessibilityState).toMatchObject({ selected: true });
  });

  it('keeps a long uncertain period readable without a truncation limit', async () => {
    const longPeriod = 'Observed 2024-01-01 to 2024-12-31 with an intentionally long owner-readable period label';
    const model = modelFor({ durableRecord: { journeys: [{ displayId: 'long-period', state: 'possible-merge', anchor: null, years: [], periodLabel: longPeriod, ordering: 'uncertain' }] } });
    const view = await render(<AtlasReveal model={model} {...actions} />);
    const period = view.getByText(`${longPeriod} · Needs review · Order uncertain · Location unknown`);
    expect(period.props.numberOfLines).toBeUndefined();
  });

  it('keeps unknown-coordinate journeys Timeline-only and hides map-only controls', async () => {
    const model = modelFor({ durableRecord: { journeys: [{ displayId: 'unknown', state: 'inferred', anchor: null, years: [2024], periodLabel: '2024', ordering: 'chronological' }] } });
    const view = await render(<AtlasReveal model={model} {...actions} />);
    expect(view.queryByLabelText('Private Atlas map')).toBeNull();
    expect(view.getByText(/No visible journey has a map-supported location/)).toBeOnTheScreen();
    expect(view.queryByRole('button', { name: 'Show Atlas map in 3D' })).toBeNull();
    await fireEvent.press(view.getByRole('button', { name: 'Show chronological Timeline' }));
    expect(view.queryByRole('button', { name: 'Show Atlas map in 3D' })).toBeNull();
  });

  it('clears a selected journey that disappears from a refreshed projection', async () => {
    const selected = modelFor({ durableRecord: { journeys: [{ displayId: 'temporary', state: 'inferred', anchor: { latitude: 13.7, longitude: 100.5 }, years: [2024], periodLabel: '2024', ordering: 'chronological' }] } });
    const removed = modelFor({ durableRecord: { journeys: [] } });
    const view = await render(<AtlasReveal model={selected} {...actions} />);
    await fireEvent.press(view.getByRole('button', { name: /Available journey 1, 2024/ }));
    await view.rerender(<AtlasReveal model={removed} {...actions} />);
    await waitFor(() => expect(view.queryByRole('button', { name: 'Open selected private journey' })).toBeNull());
  });

  it('preserves a coarse explored viewport when depth changes', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    const model = modelFor({ durableRecord: { journeys: [{ displayId: 'journey-1', state: 'inferred', anchor: { latitude: 13.7, longitude: 100.5 }, years: [2024], periodLabel: '2024', ordering: 'chronological' }] } });
    const view = await render(<AtlasReveal model={model} {...actions} />);
    await fireEvent(view.getByLabelText('Private Atlas map'), 'regionChangeComplete', { latitude: 20.04, longitude: 105.06, latitudeDelta: 4.04, longitudeDelta: 5.06 });
    await fireEvent.press(view.getByRole('button', { name: 'Show Atlas map in 3D' }));
    expect(view.getByLabelText('Private Atlas map').props.initialCamera).toMatchObject({ center: { latitude: 20, longitude: 105.1 }, pitch: 28 });
  });

  it('disambiguates duplicate safe journey wording without exposing IDs', async () => {
    const model = modelFor({ durableRecord: { journeys: [
      { displayId: 'one', state: 'inferred', anchor: null, years: [2024], periodLabel: '2024', ordering: 'chronological' },
      { displayId: 'two', state: 'inferred', anchor: null, years: [2024], periodLabel: '2024', ordering: 'chronological' },
    ] } });
    const duplicated = { ...model, journeys: model.journeys.map((journey) => ({ ...journey, label: 'Available journey', periodLabel: '2024' })) } as typeof model;
    const view = await render(<AtlasReveal model={duplicated} {...actions} />);
    expect(view.getByRole('button', { name: 'Available journey, 2024, Atlas item 1' })).toBeOnTheScreen();
    expect(view.getByRole('button', { name: 'Available journey, 2024, Atlas item 2' })).toBeOnTheScreen();
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
