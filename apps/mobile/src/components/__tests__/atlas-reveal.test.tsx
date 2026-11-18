import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { AtlasReveal, atlasMotionPolicy, mapCameraFor, mapLibreDevelopmentStyle } from '@/components/atlas-reveal';
import { parseAtlasBasemapStyle } from '@/atlas/basemap-config';
import { assertRevealPayload, deriveAtlasExploration, projectReveal } from '@/reveal/projection';
import { recordRevealEvent } from '@/reveal/telemetry';
import { consumeAtlasPreviewContext, saveAtlasPreviewContext } from '@/atlas/preview-context';

const mockCameraJumpTo = jest.fn();
let mockAtlasWidth = 390;
let mockAtlasFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  default: () => ({ width: mockAtlasWidth, height: 844, scale: 1, fontScale: mockAtlasFontScale }),
}));
const configuredStyle = 'https://api.maptiler.com/maps/streets-v2/style.json?key=published';
const originalStyle = process.env.EXPO_PUBLIC_ATLAS_MAP_STYLE_URL;

jest.mock('@maplibre/maplibre-react-native', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  const Camera = React.forwardRef((props: object, ref: unknown) => {
    React.useImperativeHandle(ref, () => ({ jumpTo: mockCameraJumpTo }));
    return <View {...props} />;
  });
  Camera.displayName = 'MockMapLibreCamera';
  return {
    Map: View, Camera, Layer: View,
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

jest.mock('@/replay/thumbnail-service', () => ({ replayThumbnails: { request: jest.fn(async () => ({ width: 1, height: 1, release: jest.fn() })), pin: jest.fn(), unpin: jest.fn(), subscribeInvalidation: jest.fn(() => jest.fn()) } }));

const actions = { onImport: jest.fn(), onRetry: jest.fn(), onCatchUp: jest.fn(), onManualEntry: jest.fn(), onReplay: jest.fn(), onSettings: jest.fn() };

function modelFor(overrides: Partial<Parameters<typeof projectReveal>[0]>) {
  return projectReveal({ graph: null, durableRecord: null, reconstructionStatus: 'complete', reconciliationStatus: 'complete', pendingCount: 0, sourceScope: 'full', importedCount: 3, ...overrides });
}

describe('private Atlas reveal', () => {
  it('connects adjacent suggested cards and preserves exact review when a filter hides one card', async () => {
    const pair = { leftId: 'older', rightId: 'newer', generation: 8, privacyRevision: 0 };
    const journeys = [
      { displayId: pair.rightId, label: 'Taiwan', periodLabel: 'March 2025' },
      { displayId: pair.leftId, label: 'Vietnam', periodLabel: 'February 2025' },
    ].map((journey) => ({ ...journey, state: 'inferred' as const, years: [2025], ordering: 'chronological' as const, anchor: null }));
    const load = jest.fn(async (id: string) => ({
      detail: { id, title: id, observedSpan: 'Observed', visits: [], memories: [], uncertainty: [] },
      previews: [], snapshotToken: pair.generation,
    }));
    const confirm = jest.fn().mockResolvedValueOnce('pending').mockResolvedValueOnce('applied');
    const view = await render(<AtlasReveal {...actions} model={modelFor({ durableRecord: { journeys, mergePairs: [pair] } })}
      initialExploration={{ view: 'timeline', year: null, selectedJourneyId: null }} loadJourneyPreview={load} confirmTimelineMerge={confirm} />);
    expect(view.getByTestId('timeline-merge-connector')).toBeOnTheScreen();
    const search = view.getByLabelText('Search visible Atlas journeys locally');
    await fireEvent.changeText(search, 'Taiwan');
    expect(view.queryByTestId('timeline-merge-connector')).toBeNull();
    await fireEvent.press(view.getByRole('button', { name: 'Review possible merge: Vietnam, February 2025 and Taiwan, March 2025' }));
    await waitFor(() => expect(view.getByRole('button', { name: 'Confirm merge' })).toBeEnabled());
    expect(confirm).not.toHaveBeenCalled();
    await fireEvent.press(view.getByRole('button', { name: 'Confirm merge' }));
    await fireEvent.press(await view.findByRole('button', { name: 'Check merge again' }));
    expect(confirm.mock.calls[0][0]).toEqual(pair);
    expect(confirm.mock.calls[0][1].id).toBe(pair.leftId);
    expect(confirm.mock.calls[1]).toEqual(confirm.mock.calls[0]);
  });

  it('withholds empty Timeline copy while its saved record is being checked', async () => {
    const view = await render(<AtlasReveal {...actions} model={modelFor({ privacyReady: false })}
      initialExploration={{ view: 'timeline', year: null, selectedJourneyId: null }} />);
    expect(view.getByText('Checking your saved journeys…')).toBeOnTheScreen();
    expect(view.queryByText('No supported journey is available to show.')).toBeNull();
    expect(view.queryByText('Journeys · 0')).toBeNull();
  });
  it('waits for durable privacy readback before reporting an empty Atlas', () => {
    expect(modelFor({ privacyReady: false })).toMatchObject({ state: 'processing', journeys: [] });
    expect(modelFor({ privacyReady: false, sourceScope: 'revoked' }).state).toBe('restricted');
    expect(modelFor({ privacyReady: false, reconstructionStatus: 'error' }).state).toBe('failed');
    expect(modelFor({ privacyReady: true, durableRecord: { journeys: [] } }).state).toBe('sparse');
  });
  it('keeps Timeline rows bounded and restores the page after its anchor disappears', async () => {
    const journeys = Array.from({ length: 50 }, (_, index) => ({
      displayId: 'journey-' + index,
      label: 'Journey ' + index,
      state: 'inferred' as const,
      anchor: null,
      years: [2024],
      periodLabel: '2024',
      ordering: 'chronological' as const,
    }));
    const model = modelFor({ durableRecord: { journeys } });
    const onHome = jest.fn();
    const view = await render(<AtlasReveal {...actions} model={model} onHome={onHome} initialExploration={{ view: 'timeline', year: null, selectedJourneyId: null }} />);
    expect(view.getByText('Journey 0')).toBeOnTheScreen();
    expect(view.queryByText('Journey 24')).toBeNull();
    await fireEvent.press(view.getByRole('button', { name: 'Next journeys' }));
    expect(view.queryByText('Journey 0')).toBeNull();
    expect(view.getByText('Journey 24')).toBeOnTheScreen();
    expect(view.queryByText('Journey 48')).toBeNull();
    await fireEvent.press(view.getByRole('button', { name: 'Home' }));
    const saved = onHome.mock.calls[0][0];
    expect(saved.timelineAnchor).toEqual({ id: 'journey-24', index: 24 });
    await view.unmount();

    const updated = modelFor({ durableRecord: { journeys: journeys.filter((journey) => journey.displayId !== saved.timelineAnchor.id) } });
    const reopened = await render(<AtlasReveal {...actions} model={updated} initialExploration={saved} />);
    expect(reopened.getByText('Journey 25')).toBeOnTheScreen();
    expect(reopened.queryByText('Journey 0')).toBeNull();
  });

  it('shows the Timeline alongside Map only when both panes have usable width', async () => {
    const model = modelFor({ durableRecord: { journeys: [{ displayId: 'wide-journey', state: 'inferred', anchor: { latitude: 13.7, longitude: 100.5 }, years: [2024], periodLabel: '2024', ordering: 'chronological' }] } });
    try {
      mockAtlasWidth = 900;
      const view = await render(<AtlasReveal {...actions} model={model} />);
      expect(view.getByTestId('maplibre-atlas-map')).toBeOnTheScreen();
      expect(view.getByLabelText('Chronological local journey Timeline')).toBeOnTheScreen();
      mockAtlasFontScale = 1.5;
      await view.rerender(<AtlasReveal {...actions} model={model} />);
      expect(view.getByTestId('maplibre-atlas-map')).toBeOnTheScreen();
      expect(view.queryByLabelText('Chronological local journey Timeline')).toBeNull();
    } finally {
      mockAtlasWidth = 390;
      mockAtlasFontScale = 1;
    }
  });

  it('passes current exploration to Home without changing its view', async () => {
    const onHome = jest.fn();
    const context = { view: 'timeline' as const, year: null, selectedJourneyId: null };
    const view = await render(<AtlasReveal {...actions} model={modelFor({})} initialExploration={context} onHome={onHome} />);
    await fireEvent.press(view.getByRole('button', { name: 'Home' }));
    expect(onHome).toHaveBeenCalledWith(expect.objectContaining({ view: 'timeline', year: null }));
  });
  beforeEach(() => {
    process.env.EXPO_PUBLIC_ATLAS_MAP_STYLE_URL = configuredStyle;
  });

  afterEach(() => {
    if (originalStyle === undefined) delete process.env.EXPO_PUBLIC_ATLAS_MAP_STYLE_URL;
    else process.env.EXPO_PUBLIC_ATLAS_MAP_STYLE_URL = originalStyle;
  });

  it('projects a completed graph into redacted inferred list items and a Replay handoff', async () => {
    const model = projectReveal({ graph: null, durableRecord: { journeys: [{ displayId: 'journey-1', state: 'inferred', anchor: { latitude: 13.7, longitude: 100.5 }, years: [2024], periodLabel: '2024', ordering: 'chronological' }] }, reconstructionStatus: 'complete', reconciliationStatus: 'complete', pendingCount: 0, sourceScope: 'full', importedCount: 3 });
    expect(model).toMatchObject({ state: 'ready', replay: { eligible: true } });
    expect(model.journeys[0]).toEqual({ id: 'journey-1', label: 'Private journey', status: 'Inferred', years: [2024], periodLabel: '2024', ordering: 'Chronological', hasMapSupport: true, mapAnchor: { latitude: 13.7, longitude: 100.5 } });
    const view = await render(<AtlasReveal model={model} {...actions} />);
    await fireEvent.press(view.getByRole('button', { name: 'Atlas details' }));
    expect(view.getByText(/Photo locations do not prove presence/)).toBeOnTheScreen();
    expect(view.getByRole('button', { name: 'Replay' })).toBeOnTheScreen();
    await view.unmount();
    const unavailable = await render(<AtlasReveal model={model} {...actions} mapAvailable={false} />);
    expect(unavailable.getByTestId('atlas-map-recovery')).toBeOnTheScreen();
    await unavailable.rerender(<AtlasReveal model={model} {...actions} mapAvailable />);
    expect(unavailable.getByTestId('maplibre-atlas-map')).toBeOnTheScreen();
  });

  it('keeps Replay ineligible when Atlas has only owner-entered journeys', () => {
    const model = modelFor({ durableRecord: { journeys: [{ displayId: 'manual:kyoto', state: 'owner-entered', anchor: { latitude: 35.7, longitude: 139.7 }, years: [2024], periodLabel: '2024-04-01', ordering: 'chronological', label: 'Kyoto · Japan', locationKind: 'owner-entered' }] } });
    expect(model.replay).toEqual({ eligible: false, reason: 'Replay needs observed destinations; owner-entered journeys are not evidence.' });
  });

  it('uses a first local media page when a Timeline detail has no cover preview', async () => {
    const load = jest.fn(async (id: string) => ({ detail: { id, title: 'Private journey', observedSpan: `Observed ${id}`, visits: [], memories: [{ id: `memory-${id}`, availability: 'unknown' as const, association: 'Associated locally.' }], uncertainty: [] }, previews: [], snapshotToken: 9 }));
    const loadPage = jest.fn(async (id: string, snapshotToken: number, page: number) => ({ page: { items: [{ id: `media-${id}`, availability: 'available' as const, association: 'Associated locally.', kind: id === 'journey-two' ? 'video' as const : 'photo' as const }], hasMore: false }, previews: [{ uri: `file:///${id}.jpg`, availability: 'available' as const, kind: id === 'journey-two' ? 'video' as const : 'photo' as const }] }));
    const model = modelFor({ durableRecord: { journeys: [
      { displayId: 'journey-one', state: 'inferred', anchor: null, years: [2024], periodLabel: 'January 2024', ordering: 'chronological' },
      { displayId: 'journey-two', state: 'inferred', anchor: null, years: [2024], periodLabel: 'February 2024', ordering: 'chronological' },
    ] } });
    const view = await render(<AtlasReveal model={model} {...actions} initialExploration={{ view: 'timeline', year: null, selectedJourneyId: null }} loadJourneyPreview={load} loadJourneyMediaPage={loadPage} />);
    await waitFor(() => expect(load).toHaveBeenCalledWith('journey-one'));
    await waitFor(() => expect(load).toHaveBeenCalledWith('journey-two'));
    await waitFor(() => expect(loadPage).toHaveBeenCalledWith('journey-one', 9, 0));
    await waitFor(() => expect(loadPage).toHaveBeenCalledWith('journey-two', 9, 0));
    expect(view.getByLabelText('photo thumbnail')).toBeOnTheScreen();
    expect(view.getByLabelText('video poster')).toBeOnTheScreen();
    expect(view.getAllByText('›')).toHaveLength(2);
  });

  it('keeps a resolved Timeline cover when the selected detail has no preview', async () => {
    const result = { detail: { id: 'journey-one', title: 'Private journey', observedSpan: 'Observed journey-one', visits: [], memories: [{ id: 'memory-one', availability: 'unknown' as const, association: 'Associated locally.' }], uncertainty: [] }, previews: [], snapshotToken: 9 };
    let resolveSelected: (value: typeof result) => void = () => undefined;
    const selectedRead = new Promise<typeof result>((resolve) => { resolveSelected = resolve; });
    let previewRequestCount = 0;
    const load = jest.fn(() => {
      previewRequestCount += 1;
      return previewRequestCount === 1 ? Promise.resolve(result) : selectedRead;
    });
    const loadPage = jest.fn(async () => ({ page: { items: [{ id: 'media-one', availability: 'available' as const, association: 'Associated locally.', kind: 'photo' as const }], hasMore: false }, previews: [{ uri: 'file:///journey-one.jpg', availability: 'available' as const, kind: 'photo' as const }] }));
    const model = modelFor({ durableRecord: { journeys: [{ displayId: 'journey-one', state: 'inferred', anchor: null, years: [2024], periodLabel: 'January 2024', ordering: 'chronological' }] } });
    const view = await render(<AtlasReveal model={model} {...actions} initialExploration={{ view: 'timeline', year: null, selectedJourneyId: null }} loadJourneyPreview={load} loadJourneyMediaPage={loadPage} />);
    await waitFor(() => expect(view.getByLabelText('photo thumbnail')).toBeOnTheScreen());
    await fireEvent.press(view.getByRole('button', { name: 'Private journey, January 2024' }));
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    resolveSelected(result);
    await fireEvent.press(await view.findByRole('button', { name: 'Evidence details' }));
    expect(view.getByText(/Observed journey-one/)).toBeOnTheScreen();
    expect(view.getByLabelText('photo thumbnail')).toBeOnTheScreen();
  });

  it('labels every durable journey related to a pending correction and keeps Edit reachable', async () => {
    const onEditJourney = jest.fn();
    const model = modelFor({ durableRecord: { journeys: [
      { displayId: 'related-one', state: 'inferred', anchor: null, years: [2024], periodLabel: '2024', ordering: 'chronological', needsReview: true },
      { displayId: 'related-two', state: 'inferred', anchor: null, years: [2024], periodLabel: '2024', ordering: 'chronological', needsReview: true },
    ] } });
    expect(model.journeys.map((journey) => journey.status)).toEqual(['Needs review', 'Needs review']);
    const load = jest.fn(async (id: string) => ({ detail: { id, title: 'Private journey', observedSpan: 'Observed 2024', visits: [], memories: [], uncertainty: [], correctionState: 'pending remap' as const }, previews: [], snapshotToken: 1 }));
    const view = await render(<AtlasReveal model={model} {...actions} initialExploration={{ view: 'timeline', year: null, selectedJourneyId: null }} loadJourneyPreview={load} onEditJourney={onEditJourney} />);
    expect(JSON.stringify(view.toJSON())).toContain('Needs review');
    await fireEvent.press(view.getAllByRole('button', { name: 'Private journey, 2024' })[0]);
    await waitFor(() => expect(view.getByText('Needs review')).toBeOnTheScreen());
    await fireEvent.press(view.getByRole('button', { name: 'Edit trip' }));
    expect(onEditJourney).toHaveBeenCalledWith('related-one', expect.objectContaining({ selectedJourneyId: 'related-one' }));
  });

  it('emits and restores the exact Atlas context for manual entry', async () => {
    const onManualEntry = jest.fn();
    const view = await render(<AtlasReveal model={modelFor({ durableRecord: { journeys: [{ displayId: 'journey-1', state: 'inferred', anchor: { latitude: 13.7, longitude: 100.5 }, years: [2024], periodLabel: '2024', ordering: 'chronological' }] } })} {...actions} onManualEntry={onManualEntry} initialExploration={{ view: 'timeline', year: 2024, selectedJourneyId: 'journey-1', camera: { center: [100.5, 13.7], zoom: 4 } }} />);
    await fireEvent.press(view.getByRole('button', { name: 'Add a journey manually' }));
    const context = onManualEntry.mock.calls[0][0];
    expect(context).toMatchObject({ view: 'timeline', year: 2024, selectedJourneyId: 'journey-1', camera: { center: [100.5, 13.7], zoom: 4 } });
    saveAtlasPreviewContext(context); expect(consumeAtlasPreviewContext()).toEqual(context); expect(consumeAtlasPreviewContext()).toBeNull();
  });

  it('does not hand a private search across provider sessions', () => {
    const original = {};
    const replacement = {};
    const context = { view: 'timeline' as const, year: 2024, selectedJourneyId: null, query: 'synthetic query', scrollY: 240 };
    saveAtlasPreviewContext(context, original);
    expect(consumeAtlasPreviewContext(replacement)).toBeNull();
    saveAtlasPreviewContext(context, original);
    expect(consumeAtlasPreviewContext(original)).toEqual(context);
  });

  it('keeps the ready map, local list, coverage and Replay action available', async () => {
    const view = await render(<AtlasReveal model={modelFor({ durableRecord: { journeys: [{ displayId: 'journey-1', state: 'inferred', anchor: { latitude: 13.7, longitude: 100.5 }, years: [2024], periodLabel: '2024', ordering: 'chronological' }] } })} {...actions} />);
    expect(view.getByTestId('maplibre-atlas-map')).toBeOnTheScreen();
    await fireEvent.press(view.getByRole('button', { name: 'Atlas details' }));
    expect(view.getByText(/3 device-visible records/)).toBeOnTheScreen();
    expect(view.queryByLabelText('Chronological local journey Timeline')).toBeNull();
    await fireEvent.press(view.getByRole('button', { name: 'Close Atlas details' }));
    await fireEvent.press(view.getByRole('button', { name: 'Replay' }));
    expect(actions.onReplay).toHaveBeenCalled();
    await fireEvent.press(view.getByRole('button', { name: 'Rebuild local journey history' }));
    expect(actions.onRetry).toHaveBeenCalled();
    await fireEvent.press(view.getByRole('button', { name: 'Show chronological Timeline' }));
    expect(view.getByRole('button', { name: 'Show chronological Timeline' }).props.accessibilityState).toMatchObject({ selected: true });
    await fireEvent.press(view.getByRole('button', { name: 'Open Settings' }));
    expect(actions.onSettings).toHaveBeenCalled();
  });

  it('uses the locally derived coarse trip label and month only in the Atlas list', () => {
    const model = modelFor({ durableRecord: { journeys: [{ displayId: 'taiwan-october', state: 'inferred', anchor: null, years: [2025], periodLabel: 'October 2025', ordering: 'chronological', label: 'Taiwan' }] } });
    expect(model.journeys[0]).toMatchObject({ label: 'Taiwan', periodLabel: 'October 2025' });
    expect(JSON.stringify(model)).not.toMatch(/countryCode|capturedDay|latitude/);
  });

  it('keeps the last durable map projection explorable while local reconciliation is running', async () => {
    const view = await render(<AtlasReveal model={modelFor({
      durableRecord: { journeys: [{ displayId: 'journey-1', state: 'inferred', anchor: { latitude: 13.7, longitude: 100.5 }, years: [2024], periodLabel: '2024', ordering: 'chronological' }] },
      reconstructionStatus: 'complete', reconciliationStatus: 'running', pendingCount: 1,
    })} {...actions} />);

    expect(view.getByText(/Checking local updates.*will refresh automatically when this finishes/)).toBeOnTheScreen();
    expect(view.getByTestId('maplibre-atlas-map')).toBeOnTheScreen();
    expect(view.getByRole('button', { name: 'Show chronological Timeline' })).toBeOnTheScreen();
    expect(view.getByRole('button', { name: 'Filter Atlas by year' })).toBeOnTheScreen();
    await fireEvent.press(view.getByRole('button', { name: 'Atlas details' }));
    expect(view.getByText('Replay will be available after local updates finish.')).toBeOnTheScreen();
  });

  it('renders fixed reconstruction wait guidance instead of replacing it with generic processing copy', async () => {
    const view = await render(<AtlasReveal model={modelFor({
      reconstructionStatus: 'running',
      reconstructionMessage: 'Waiting for an existing local update to finish. Your last completed Atlas remains available.',
      reconciliationStatus: 'pending',
      pendingCount: 1,
    })} {...actions} />);

    expect(view.getByText('Waiting for an existing local update to finish. Your last completed Atlas remains available.')).toBeOnTheScreen();
  });

  it('keeps Timeline recovery available without a configured native map', async () => {
    const view = await render(<AtlasReveal model={modelFor({ durableRecord: { journeys: [{ displayId: 'unavailable-native', state: 'inferred', anchor: { latitude: 13.7, longitude: 100.5 }, years: [2024], periodLabel: '2024', ordering: 'chronological' }] } })} {...actions} mapAvailable={false} />);
    expect(view.getByTestId('atlas-map-recovery')).toBeOnTheScreen();
    await fireEvent.press(view.getByRole('button', { name: 'Show chronological Timeline from map recovery' }));
    expect(view.getByLabelText('Chronological local journey Timeline')).toBeOnTheScreen();
  });
  it('offers import and manual entry for sparse evidence', async () => {
    const view = await render(<AtlasReveal model={modelFor({ sourceScope: 'limited', importedCount: 1 })} {...actions} />);
    expect(view.getByText(/No completed local reconstruction diagnostics/)).toBeOnTheScreen();
    expect(view.queryByTestId('maplibre-atlas-map')).toBeNull();
    await fireEvent.press(view.getByRole('button', { name: 'Import or reconnect photos' }));
    await fireEvent.press(view.getByRole('button', { name: 'Add a journey manually' }));
    expect(actions.onImport).toHaveBeenCalled();
    expect(actions.onManualEntry).toHaveBeenCalled();
  });

  it('shows durable aggregate sparse diagnostics after reopening without a graph', async () => {
    const diagnostics = { assessed: 2989, supported: 0, places: 0, visits: 0, missingDay: 1032, invalidDay: 0, unavailable: 0, duplicateConflict: 0, insufficientLocation: 1957, excluded: 0 };
    const model = modelFor({ graph: null, durableRecord: { journeys: [], diagnostics }, importedCount: 2989 });
    const view = await render(<AtlasReveal model={model} {...actions} />);
    await fireEvent.press(view.getByRole('button', { name: 'Atlas details' }));
    expect(view.getByText(/2989 records assessed; 0 supported/)).toBeOnTheScreen();
    expect(view.getByText(/1957 insufficient location support/)).toBeOnTheScreen();
    await fireEvent.press(view.getByRole('button', { name: 'Close Atlas details' }));
    await fireEvent.press(view.getByRole('button', { name: 'Recheck local journey history' }));
    expect(actions.onRetry).toHaveBeenCalled();
    expect(JSON.stringify(model)).not.toContain('evidenceId');
  });

  it('states active processing is not final and disables a duplicate catch-up', async () => {
    const onCatchUp = jest.fn();
    const view = await render(<AtlasReveal model={modelFor({ reconstructionStatus: 'running', reconciliationStatus: 'running', pendingCount: 1,
      durableRecord: { journeys: [{ displayId: 'previous-journey', state: 'inferred', anchor: { latitude: 13.7, longitude: 100.5 }, years: [2024], periodLabel: '2024', ordering: 'chronological' }] },
    })} {...actions} onCatchUp={onCatchUp} />);
    expect(view.getByLabelText('Local journey rebuild in progress').props.accessibilityState).toMatchObject({ busy: true });
    expect(view.getByText(/Rebuilding local journey history/)).toBeOnTheScreen();
    expect(view.getByText(/will refresh automatically when this finishes/)).toBeOnTheScreen();
    expect(view.getByRole('button', { name: 'Local journey history is updating' }).props.accessibilityState).toMatchObject({ disabled: true });
    expect(view.getByTestId('maplibre-atlas-map')).toBeOnTheScreen();
    expect(view.getByRole('button', { name: 'Show chronological Timeline' })).toBeOnTheScreen();
    expect(onCatchUp).not.toHaveBeenCalled();
  });

  it('offers catch-up for a sparse Atlas with only waiting changes', async () => {
    const onCatchUp = jest.fn();
    const model = modelFor({ reconstructionStatus: 'complete', reconciliationStatus: 'pending', pendingCount: 1 });
    expect(model.state).toBe('sparse');
    const view = await render(<AtlasReveal model={model} {...actions} onCatchUp={onCatchUp} />);
    expect(view.getByText(/Catch up to check whether any journeys can be revealed/)).toBeOnTheScreen();
    expect(view.queryByText(/Your last completed Atlas remains available/)).toBeNull();
    expect(view.queryByLabelText('Local journey rebuild in progress')).toBeNull();
    await fireEvent.press(view.getByRole('button', { name: 'Catch up waiting local journey changes' }));
    expect(onCatchUp).toHaveBeenCalledTimes(1);
    expect(view.queryByRole('button', { name: 'Recheck local journey history' })).toBeNull();
  });

  it('treats queued work as waiting and keeps the completed Atlas usable', async () => {
    const onCatchUp = jest.fn();
    const model = modelFor({
      reconstructionStatus: 'complete', reconciliationStatus: 'pending', pendingCount: 1,
      durableRecord: { journeys: [{ displayId: 'prior-journey', state: 'inferred', anchor: { latitude: 13.7, longitude: 100.5 }, years: [2024], periodLabel: '2024', ordering: 'chronological' }] },
    });
    expect(model.state).toBe('ready');
    expect(model.pendingUpdates).toBe(true);
    const view = await render(<AtlasReveal model={model} {...actions} onCatchUp={onCatchUp} />);
    expect(view.queryByText('Updating your Atlas')).toBeNull();
    expect(view.getByTestId('maplibre-atlas-map')).toBeOnTheScreen();
    await fireEvent.press(view.getByRole('button', { name: 'Catch up waiting local journey changes' }));
    expect(onCatchUp).toHaveBeenCalledTimes(1);
    expect(view.queryByRole('button', { name: 'Rebuild local journey history' })).toBeNull();
    expect(view.getByRole('button', { name: 'Add a journey manually' })).toBeOnTheScreen();
  });

  it('keeps remap-only review distinct from queued catch-up', async () => {
    const model = modelFor({ reconciliationStatus: 'pending', pendingCount: 2, queuedChangeCount: 0, unresolvedRemapCount: 2 });
    expect(model.pendingUpdates).toBe(false);
    expect(model.reviewRequired).toBe(true);
    const view = await render(<AtlasReveal model={model} {...actions} />);
    expect(view.getByText(/Some journeys need review/)).toBeOnTheScreen();
    expect(view.queryByRole('button', { name: 'Catch up waiting local journey changes' })).toBeNull();
  });

  it('withholds catch-up when queued changes also need correction remap review', async () => {
    const model = modelFor({ reconciliationStatus: 'pending', pendingCount: 3, queuedChangeCount: 1, unresolvedRemapCount: 2 });
    expect(model.pendingUpdates).toBe(false);
    const view = await render(<AtlasReveal model={model} {...actions} />);
    expect(view.getByText(/Some journeys need review/)).toBeOnTheScreen();
    expect(view.queryByRole('button', { name: 'Catch up waiting local journey changes' })).toBeNull();
  });

  it('routes failed queued reconciliation through catch-up rather than rebuild', async () => {
    const onCatchUp = jest.fn();
    const onRetry = jest.fn();
    const model = modelFor({ reconciliationStatus: 'error', pendingCount: 1, queuedChangeCount: 1, unresolvedRemapCount: 0 });
    const view = await render(<AtlasReveal model={model} {...actions} onCatchUp={onCatchUp} onRetry={onRetry} />);
    expect(view.queryByRole('button', { name: 'Recheck local journey history' })).toBeNull();
    await fireEvent.press(view.getByRole('button', { name: 'Catch up waiting local journey changes' }));
    expect(onCatchUp).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('offers reconnect/import for restricted access and retry/manual entry after a failure', async () => {
    const restricted = await render(<AtlasReveal model={modelFor({ reconstructionStatus: 'restricted', reconciliationStatus: 'restricted', sourceScope: 'revoked' })} {...actions} />);
    expect(restricted.getByText(/Access is limited/)).toBeOnTheScreen();
    await fireEvent.press(restricted.getByRole('button', { name: 'Import or reconnect photos' }));
    expect(actions.onImport).toHaveBeenCalled();
    await fireEvent.press(restricted.getByRole('button', { name: 'Add a journey manually' }));
    expect(actions.onManualEntry).toHaveBeenLastCalledWith(expect.objectContaining({ view: 'map', year: null, selectedJourneyId: null, camera: undefined, localViewport: undefined }));
    await restricted.unmount();
    const failed = await render(<AtlasReveal model={modelFor({ reconstructionStatus: 'error', reconciliationStatus: 'error', durableRecord: { journeys: [{ displayId: 'recovery-gallery', state: 'inferred', anchor: null, years: [2025], periodLabel: 'September 2025', ordering: 'uncertain' }] } })} {...actions} loadJourneyPreview={async (id) => ({ detail: { id, title: 'Private journey', observedSpan: 'Observed September 2025', visits: [], memories: [{ id: 'memory-1', availability: 'available', association: 'Associated locally.' }], uncertainty: [] }, previews: [{ uri: 'file:///photo.jpg', availability: 'available', kind: 'photo' }], snapshotToken: 3 })} />);
    expect(failed.getByText(/could not finish/)).toBeOnTheScreen();
    expect(failed.getByText(/still browse the last committed journeys and their associated photos/)).toBeOnTheScreen();
    await fireEvent.press(failed.getByRole('button', { name: 'Show chronological Timeline' }));
    await fireEvent.press(failed.getByRole('button', { name: /Private journey, September 2025/ }));
    await waitFor(() => expect(failed.getByRole('button', { name: 'See photos and videos' })).toBeOnTheScreen());
    await fireEvent.press(failed.getByRole('button', { name: 'See photos and videos' }));
    expect(failed.getByTestId('journey-media-album')).toBeOnTheScreen();
    await fireEvent.press(failed.getByRole('button', { name: 'Recheck local journey history' }));
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
    expect(view.queryByText('Inferred local record')).toBeNull();
    await fireEvent.press(view.getByRole('button', { name: 'Atlas details' }));
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

  it('does not select a remote demo style in any build', () => {
    expect(mapLibreDevelopmentStyle(true)).toBeNull();
    expect(mapLibreDevelopmentStyle(false)).toBeNull();
  });

  it('enables only an HTTPS MapTiler vector style and never supplies a default', () => {
    expect(parseAtlasBasemapStyle(undefined)).toEqual({ enabled: false, reason: 'missing' });
    expect(parseAtlasBasemapStyle('http://api.maptiler.com/maps/streets/style.json?key=published')).toEqual({ enabled: false, reason: 'invalid' });
    expect(parseAtlasBasemapStyle('https://demotiles.maplibre.org/style.json')).toEqual({ enabled: false, reason: 'invalid' });
    expect(parseAtlasBasemapStyle('https://api.maptiler.com/maps/streets-v2/style.json?key=published')).toEqual({ enabled: true, styleUrl: 'https://api.maptiler.com/maps/streets-v2/style.json?key=published' });
  });

  it('keeps Timeline recovery when no provider style is configured', async () => {
    delete process.env.EXPO_PUBLIC_ATLAS_MAP_STYLE_URL;
    const view = await render(<AtlasReveal model={modelFor({ durableRecord: { journeys: [{ displayId: 'configured-later', state: 'inferred', anchor: { latitude: 13.7, longitude: 100.5 }, years: [2024], periodLabel: '2024', ordering: 'chronological' }] } })} {...actions} />);
    expect(view.queryByTestId('maplibre-atlas-map')).toBeNull();
    expect(view.getByTestId('atlas-map-recovery')).toBeOnTheScreen();
  });

  it('uses configured vector labels with coarse local marker data and returns to recovery on a style failure', async () => {
    const view = await render(<AtlasReveal model={modelFor({ durableRecord: { journeys: [{ displayId: 'provider-safe', state: 'inferred', anchor: { latitude: 13.7, longitude: 100.5 }, years: [2024], periodLabel: '2024', ordering: 'chronological' }] } })} {...actions} />);
    expect(view.getByTestId('maplibre-atlas-map').props.mapStyle).toContain('api.maptiler.com');
    expect(view.queryByTestId('local-atlas-canvas')).toBeNull();
    const source = view.getByTestId('private-atlas-journeys');
    expect(JSON.stringify(source.props.data)).toContain('13.7');
    expect(JSON.stringify(source.props.data)).not.toContain('Private journey');
    await fireEvent(source, 'press', { nativeEvent: { features: [{ properties: { journeyId: 'provider-safe' } }] } });
    await waitFor(() => expect(view.getByTestId('journey-preview-sheet')).toBeOnTheScreen());
    const mapDiagnostic = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    try {
      await fireEvent(view.getByTestId('maplibre-atlas-map'), 'didFailLoadingMap', { message: 'private-style-sentinel' });
      expect(mapDiagnostic).toHaveBeenCalledWith('[Travel Life diagnostic]', {
        operation: 'ATLAS_MAP', stage: 'MAP_STYLE', reasonCode: 'MAP_STYLE_UNAVAILABLE',
        retryable: true, durableOutcome: 'unchanged', correlationId: expect.any(String),
      });
      expect(JSON.stringify(mapDiagnostic.mock.calls)).not.toContain('private-style-sentinel');
    } finally {
      mapDiagnostic.mockRestore();
    }
    expect(view.getByTestId('atlas-map-recovery')).toBeOnTheScreen();
    await fireEvent.press(view.getByRole('button', { name: 'Retry configured Atlas map' }));
    expect(view.getByTestId('maplibre-atlas-map')).toBeOnTheScreen();
    await fireEvent.press(view.getByRole('button', { name: 'Show chronological Timeline' }));
    expect(view.getByLabelText('Chronological local journey Timeline')).toBeOnTheScreen();
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

  it('filters only the current redacted projection, clears an excluded selection, and exposes local map controls', async () => {
    const model = modelFor({ durableRecord: { journeys: [
      { displayId: 'journey-one', state: 'inferred', anchor: { latitude: 13.7, longitude: 100.5 }, years: [2024], periodLabel: 'April 2024', ordering: 'chronological', label: 'North coast' },
      { displayId: 'journey-two', state: 'possible-merge', anchor: { latitude: 35.7, longitude: 139.7 }, years: [2023], periodLabel: 'May 2023', ordering: 'uncertain', label: 'Harbor' },
    ] } });
    const view = await render(<AtlasReveal model={model} {...actions} />);
    await fireEvent.press(view.getByRole('button', { name: 'Show chronological Timeline' }));
    await fireEvent.press(view.getAllByRole('button', { name: /North coast, April 2024/ }).slice(-1)[0]);
    expect(view.getByTestId('journey-preview-sheet')).toBeOnTheScreen();
    await fireEvent.changeText(view.getByLabelText('Search visible Atlas journeys locally'), 'harbor');
    expect(view.queryByTestId('journey-preview-sheet')).toBeNull();
    expect(view.getAllByRole('button', { name: 'Harbor, May 2023' }).length).toBeGreaterThan(0);
    expect(view.queryByRole('button', { name: 'North coast, April 2024' })).toBeNull();
    await fireEvent.press(view.getByRole('button', { name: 'Show Atlas map' }));
    expect(view.getByTestId('maplibre-atlas-map')).toBeOnTheScreen();
  });

  it('uses no decorative map motion and removes the preview fade when reduced motion is enabled', () => {
    expect(atlasMotionPolicy(false)).toEqual({ cardAnimation: 'fade', hasDecorativeMotion: false });
    expect(atlasMotionPolicy(true)).toEqual({ cardAnimation: 'none', hasDecorativeMotion: false });
  });

  it('keeps Timeline selection coherent and clears it when a filter excludes it', async () => {
    const model = projectReveal({ graph: null, durableRecord: { journeys: [
      { displayId: 'journey-1', state: 'inferred', anchor: { latitude: 13.7, longitude: 100.5 }, years: [2024], periodLabel: '2024', ordering: 'chronological' },
      { displayId: 'journey-2', state: 'inferred', anchor: { latitude: 35.7, longitude: 139.7 }, years: [2023], periodLabel: '2023', ordering: 'chronological' },
    ] }, reconstructionStatus: 'complete', reconciliationStatus: 'complete', pendingCount: 0, sourceScope: 'full', importedCount: 3 });
    const view = await render(<AtlasReveal model={model} {...actions} />);
    await fireEvent.press(view.getByRole('button', { name: 'Show chronological Timeline' }));
    await fireEvent.press(view.getAllByRole('button', { name: /Private journey, 2024/ }).slice(-1)[0]);
    expect(view.getAllByLabelText('Private journey, 2024, selected').length).toBeGreaterThan(0);
    expect(view.getAllByLabelText('Private journey, 2024, selected').every((item) => item.props.accessibilityState?.selected)).toBe(true);
    await fireEvent.press(view.getByRole('button', { name: 'Filter Atlas by year' }));
    await fireEvent.press(view.getByRole('button', { name: 'Show journeys from 2023' }));
    await fireEvent.press(view.getByRole('button', { name: 'Filter Atlas by year' }));
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
    await fireEvent(view.getByTestId('private-atlas-journeys'), 'press', { nativeEvent: { features: [{ properties: { journeyId: 'map-one' } }, { properties: { journeyId: 'map-two' } }] } });
    expect(view.getByText('Choose a journey')).toBeOnTheScreen();
    await fireEvent.press(view.getAllByRole('button', { name: 'Choose Private journey' })[0]);
    await waitFor(() => expect(load).toHaveBeenCalledWith('map-one'));
  });

  it('hands the enclosing scroll surface to a native map gesture, then releases it', async () => {
    const onMapGestureChange = jest.fn();
    const view = await render(<AtlasReveal model={modelFor({ durableRecord: { journeys: [{ displayId: 'journey-1', state: 'inferred', anchor: { latitude: 13.7, longitude: 100.5 }, years: [2024], periodLabel: '2024', ordering: 'chronological' }] } })} {...actions} onMapGestureChange={onMapGestureChange} />);
    const map = view.getByTestId('maplibre-atlas-map');
    expect(map.props.dragPan).toBe(true);
    expect(map.props.touchZoom).toBe(true);
    expect(map.props.doubleTapZoom).toBe(true);
    await fireEvent(map, 'regionWillChange', { nativeEvent: {} });
    await fireEvent(map, 'regionDidChange', { nativeEvent: { center: [100.5, 13.7], zoom: 5 } });
    expect(onMapGestureChange).toHaveBeenNthCalledWith(1, true);
    expect(onMapGestureChange).toHaveBeenLastCalledWith(false);
    await fireEvent.press(view.getByRole('button', { name: 'Show chronological Timeline' }));
    await fireEvent.press(view.getByRole('button', { name: 'Show Atlas map' }));
    expect(view.getByTestId('private-atlas-camera').props.initialViewState).toEqual({ center: [100.5, 13.7], zoom: 5 });
  });

  it('appends gallery pages and retains prior media through a retry', async () => {
    const preview = jest.fn(async (id: string) => ({ detail: { id, title: 'Private journey', observedSpan: 'Observed 2024', visits: [], memories: [{ id: 'memory-1', availability: 'available' as const, association: 'Associated locally.' }], uncertainty: [] }, previews: [{ uri: 'file:///photo.jpg', availability: 'available' as const, kind: 'photo' as const }], snapshotToken: 8 }));
    const page = jest.fn().mockResolvedValueOnce({ page: { items: [{ id: 'media-1', availability: 'available' as const, association: 'Associated locally.', kind: 'photo' as const }], hasMore: true }, previews: [{ uri: 'file:///photo.jpg', availability: 'available' as const, kind: 'photo' as const }] }).mockRejectedValueOnce(new Error('temporary')).mockResolvedValueOnce({ page: { items: [{ id: 'media-2', availability: 'available' as const, association: 'Associated locally.', kind: 'video' as const }], hasMore: false }, previews: [{ uri: 'file:///video.mp4', availability: 'available' as const, kind: 'video' as const }] });
    const model = modelFor({ durableRecord: { journeys: [{ displayId: 'gallery-safe', state: 'inferred', anchor: null, years: [2024], periodLabel: '2024', ordering: 'chronological' }] } });
    const view = await render(<AtlasReveal model={model} {...actions} initialExploration={{ view: 'timeline', year: null, selectedJourneyId: null }} loadJourneyPreview={preview} loadJourneyMediaPage={page} />);
    await fireEvent.press(view.getByRole('button', { name: /Private journey, 2024/ }));
    await waitFor(() => expect(view.getByRole('button', { name: 'See photos and videos' })).toBeOnTheScreen());
    await fireEvent.press(view.getByRole('button', { name: 'See photos and videos' }));
    await waitFor(() => expect(page).toHaveBeenCalledWith('gallery-safe', 8, 0));
    expect(view.getByTestId('journey-media-album')).toBeOnTheScreen();
    expect(view.getByRole('button', { name: 'Close photos and videos' })).toBeOnTheScreen();
    expect(view.getByLabelText('Associated photo thumbnail')).toBeOnTheScreen();
    await fireEvent.press(view.getByRole('button', { name: 'Load more media' }));
    await waitFor(() => expect(view.getByRole('button', { name: 'Retry media page' })).toBeOnTheScreen());
    expect(view.getByTestId('journey-media-tile-media-1')).toBeOnTheScreen();
    await fireEvent.press(view.getByRole('button', { name: 'Retry media page' }));
    await waitFor(() => expect(page).toHaveBeenCalledWith('gallery-safe', 8, 1));
    await waitFor(() => expect(view.getByTestId('journey-media-tile-media-2')).toBeOnTheScreen());
    expect(view.getByTestId('journey-media-tile-media-1')).toBeOnTheScreen();
    expect(page).toHaveBeenCalledTimes(3);
    await fireEvent.press(view.getByTestId('journey-media-tile-media-2'));
    expect(view.getByRole('button', { name: 'Back to gallery' })).toBeOnTheScreen();
    await fireEvent.press(view.getByRole('button', { name: 'Back to gallery' }));
    expect(view.getByTestId('journey-media-grid')).toBeOnTheScreen();
    expect(view.getByTestId('journey-media-tile-media-1')).toBeOnTheScreen();
  });

  it('reports a classified preview read failure without leaking native error content', async () => {
    const log = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    try {
      const model = modelFor({ durableRecord: { journeys: [{ displayId: 'synthetic-journey', state: 'inferred', anchor: null, years: [2024], periodLabel: '2024', ordering: 'chronological' }] } });
      const load = jest.fn(async () => { throw new Error('database is locked: secret-sentinel'); });
      const view = await render(<AtlasReveal {...actions} model={model} loadJourneyPreview={load} initialExploration={{ view: 'map', year: null, selectedJourneyId: 'synthetic-journey' }} />);
      expect(await view.findByText('Could not open this journey. Close and try again.')).toBeOnTheScreen();
      expect(log).toHaveBeenCalledWith('[Travel Life diagnostic]', { operation: 'ATLAS_PREVIEW', stage: 'PREVIEW_READ', reasonCode: 'DATABASE_BUSY', retryable: true, durableOutcome: 'unchanged', correlationId: expect.any(String) });
      const start = log.mock.calls.find(([, event]) => event?.reasonCode === 'START')?.[1];
      const failure = log.mock.calls.find(([, event]) => event?.reasonCode === 'DATABASE_BUSY')?.[1];
      expect(start?.correlationId).toEqual(failure?.correlationId);
      expect(JSON.stringify(log.mock.calls)).not.toContain('secret-sentinel');
      expect(view.queryByText(/secret-sentinel/)).toBeNull();
    } finally {
      log.mockRestore();
    }
  });

  it('keeps an in-place preview bound to the selected opaque journey and can close it', async () => {
    const load = jest.fn(async (id: string) => ({ detail: { id, title: 'Private journey', observedSpan: 'Observed 2024-01-01', visits: [], memories: [], uncertainty: [], correctionState: 'inferred' as const }, previews: [{ uri: 'file:///private-photo.jpg', availability: 'available' as const, kind: 'photo' as const }] }));
    const edit = jest.fn();
    const model = modelFor({ durableRecord: { journeys: [{ displayId: 'atlas-safe-display', state: 'inferred', anchor: null, years: [2024], periodLabel: '2024', ordering: 'chronological' }] } });
    const view = await render(<AtlasReveal model={model} {...actions} initialExploration={{ view: 'timeline', year: null, selectedJourneyId: null }} loadJourneyPreview={load} onEditJourney={edit} />);
    await fireEvent.press(view.getByRole('button', { name: /Private journey, 2024/ }));
    expect(view.getByTestId('journey-preview-sheet')).toBeOnTheScreen();
    expect(view.getByRole('button', { name: 'Edit trip' })).toBeOnTheScreen();
    await fireEvent.press(view.getByRole('button', { name: 'Edit trip' }));
    expect(edit).toHaveBeenCalledWith('atlas-safe-display', expect.objectContaining({ selectedJourneyId: 'atlas-safe-display', view: 'timeline' }));
    await fireEvent.press(await view.findByRole('button', { name: 'Evidence details' }));
    expect(view.getByText(/Observed 2024-01-01/)).toBeOnTheScreen();
    expect(view.getByLabelText('Associated photo preview')).toBeOnTheScreen();
    expect(load).toHaveBeenCalledWith('atlas-safe-display');
    await fireEvent.press(view.getByRole('button', { name: 'Close journey preview' }));
    expect(view.queryByLabelText('Close journey preview')).toBeNull();
  });
});
