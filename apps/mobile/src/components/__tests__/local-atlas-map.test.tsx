import { fireEvent, render } from '@testing-library/react-native';
import { LocalAtlasMap } from '@/components/local-atlas-map';
import { boundViewport, fittedSize, MAX_WORLD_SCALE, WORLD_VIEW, zoomViewport } from '@/atlas/viewport';
import { projectWorldPoint } from '@/atlas/world-projection';
import { nearbyJourneyIds } from '@/atlas/map-markers';
import { boundaryTransform, cartographicBand, clusterJourneys, layoutLabels } from '@/atlas/cartography';

describe('local map viewport', () => {
  it('allows country-level zoom and separates nearby Vietnam fixture points by screen distance', () => {
    const size = { width: 350, height: 430 };
    expect(zoomViewport(WORLD_VIEW, 32, { x: 0, y: 0 }, size).scale).toBe(32);
    expect(zoomViewport(WORLD_VIEW, 1000, { x: 0, y: 0 }, size).scale).toBe(MAX_WORLD_SCALE);
    const base = { label: 'Synthetic fixture', periodLabel: 'Test only', status: 'Inferred' as const, years: [2024], ordering: 'Chronological' as const, hasMapSupport: true };
    const journeys = [
      { ...base, id: 'hcm', mapAnchor: { latitude: 10.8, longitude: 106.7 } },
      { ...base, id: 'vung-tau', mapAnchor: { latitude: 10.35, longitude: 107.1 } },
    ];
    expect(nearbyJourneyIds(journeys, 'hcm', size, 1)).toEqual(['hcm', 'vung-tau']);
    expect(nearbyJourneyIds(journeys, 'hcm', size, 64)).toEqual(['hcm']);
  });
  it('uses the world projection for real trip overlays and keeps their visual size after zoom', async () => {
    const choose = jest.fn();
    const journey = { id: 'public-control', label: 'Synthetic London', periodLabel: 'Test fixture', status: 'Inferred' as const, years: [2024], ordering: 'Chronological' as const, hasMapSupport: true, mapAnchor: { latitude: 51.5072, longitude: -.1276 } };
    const screen = await render(<LocalAtlasMap journeys={[journey]} selectedJourneyId={null} onChoose={choose} onGestureChange={jest.fn()} />);
    await fireEvent(screen.getByTestId('local-atlas-canvas'), 'layout', { nativeEvent: { layout: { width: 350, height: 430 } } });
    const dot = screen.getByLabelText('Synthetic London, Test fixture');
    expect(dot.props.style.width).toBe(48);
    expect(screen.getByTestId('atlas-dot-public-control').props.style.width).toBe(8);
    await fireEvent.press(dot);
    expect(choose).toHaveBeenCalledWith(['public-control']);
    await fireEvent.press(screen.getByLabelText('Zoom in on local Atlas map'));
    expect(screen.getByTestId('atlas-dot-public-control').props.style.width).toBe(8);
    expect(projectWorldPoint(0, 0)).toEqual({ x: .5, y: .5 });
    expect(projectWorldPoint(181, 0)).toBeNull();
    expect(projectWorldPoint(-74, 40.7)!.x).toBeLessThan(.5);
    expect(projectWorldPoint(139.7, 35.7)!.x).toBeGreaterThan(.5);
    const transform = boundaryTransform({ width: 350, height: 430 }, { scale: 1.6, x: 0, y: 0 });
    expect(transform.transform).toBe(`translate(${transform.left} ${transform.top}) scale(${transform.width / 2048})`);
  });
  it('falls back to a smaller geographic asset and keeps recovery explicit on total failure', async () => {
    const screen = await render(<LocalAtlasMap journeys={[]} selectedJourneyId={null} onChoose={jest.fn()} onGestureChange={jest.fn()} />);
    const high = screen.getByTestId('atlas-image-plane').props.source;
    await fireEvent(screen.getByTestId('atlas-image-plane'), 'error');
    expect(screen.getByTestId('atlas-image-plane').props.source).not.toEqual(high);
    await fireEvent(screen.getByTestId('atlas-image-plane'), 'error');
    expect(screen.getByText(/Map artwork unavailable/)).toBeOnTheScreen();
  });
  it('fits the complete world inside a portrait viewport and resets translations at minimum', () => {
    const size = { width: 350, height: 430 };
    const fitted = fittedSize(size);
    expect(fitted.width).toBeLessThan(size.width);
    expect(fitted.height).toBeLessThan(size.height);
    expect(fitted.width / fitted.height).toBeCloseTo(2048 / 1280);
    expect(boundViewport({ scale: 0.5, x: 100, y: -100 }, size)).toEqual(WORLD_VIEW);
  });
  it('keeps a point under the zoom focus when away from bounds', () => {
    const before = { scale: 2, x: 0, y: 0 };
    const next = zoomViewport(before, 3, { x: 30, y: 0 }, { width: 350, height: 430 });
    expect((30 - before.x) / before.scale).toBeCloseTo((30 - next.x) / next.scale);
  });
  it('changes the rendered image through pinch, buttons and Fit world', async () => {
    const onGestureChange = jest.fn();
    const screen = await render(<LocalAtlasMap journeys={[]} selectedJourneyId={null} onChoose={jest.fn()} onGestureChange={onGestureChange} />);
    const canvas = screen.getByTestId('local-atlas-canvas');
    await fireEvent(canvas, 'layout', { nativeEvent: { layout: { width: 350, height: 430 } } });
    const width = () => screen.getByTestId('atlas-image-plane').props.style.width;
    const fitted = width();
    const touch = (x: number, y: number) => ({ pageX: x, pageY: y, locationX: x, locationY: y });
    await fireEvent(canvas, 'touchStart', { nativeEvent: { touches: [touch(150, 215), touch(200, 215)] } });
    await fireEvent(canvas, 'responderGrant', {});
    await fireEvent(canvas, 'responderMove', { nativeEvent: { touches: [touch(125, 215), touch(225, 215)] } });
    expect(width()).toBeCloseTo(fitted * 2);
    await fireEvent(canvas, 'responderRelease', {});
    expect(onGestureChange).toHaveBeenLastCalledWith(false);
    await fireEvent.press(screen.getByLabelText('Zoom out on local Atlas map'));
    expect(width()).toBeLessThan(fitted * 2);
    await fireEvent.press(screen.getByLabelText('Fit whole world map'));
    expect(width()).toBeCloseTo(fitted);
    expect(screen.getByLabelText('Zoom out on local Atlas map').props.accessibilityState.disabled).toBe(true);
  });
  it('pans a zoomed image and releases the page lock on cancellation and unmount', async () => {
    const change = jest.fn();
    const screen = await render(<LocalAtlasMap journeys={[]} selectedJourneyId={null} onChoose={jest.fn()} onGestureChange={change} />);
    const canvas = screen.getByTestId('local-atlas-canvas');
    await fireEvent(canvas, 'layout', { nativeEvent: { layout: { width: 350, height: 430 } } });
    await fireEvent.press(screen.getByLabelText('Zoom in on local Atlas map'));
    const before = screen.getByTestId('atlas-image-plane').props.style.left;
    await fireEvent(canvas, 'touchStart', { nativeEvent: { touches: [{ pageX: 100, pageY: 100 }] } });
    await fireEvent(canvas, 'responderMove', { nativeEvent: { touches: [{ pageX: 120, pageY: 100 }] } });
    expect(screen.getByTestId('atlas-image-plane').props.style.left).toBeGreaterThan(before);
    await fireEvent(canvas, 'touchCancel', {});
    expect(change).toHaveBeenLastCalledWith(false);
    await screen.unmount();
    expect(change).toHaveBeenLastCalledWith(false);
  });
  it('rebases a pinch-to-one-finger transition without jumping', async () => {
    const screen = await render(<LocalAtlasMap journeys={[]} selectedJourneyId={null} onChoose={jest.fn()} onGestureChange={jest.fn()} />);
    const canvas = screen.getByTestId('local-atlas-canvas');
    await fireEvent(canvas, 'layout', { nativeEvent: { layout: { width: 350, height: 430 } } });
    const touches = [{ pageX: 100, pageY: 200 }, { pageX: 200, pageY: 200 }];
    await fireEvent(canvas, 'touchStart', { nativeEvent: { touches } });
    await fireEvent(canvas, 'responderMove', { nativeEvent: { touches: [{ pageX: 50, pageY: 200 }, { pageX: 250, pageY: 200 }] } });
    const before = { ...screen.getByTestId('atlas-image-plane').props.style };
    await fireEvent(canvas, 'touchEnd', { nativeEvent: { touches: [{ pageX: 250, pageY: 200 }] } });
    await fireEvent(canvas, 'responderMove', { nativeEvent: { touches: [{ pageX: 250, pageY: 200 }] } });
    expect(screen.getByTestId('atlas-image-plane').props.style).toEqual(before);
  });
  it('keeps cartographic labels bounded and clusters co-located journeys before exposing their chooser', async () => {
    const base = { label: 'Synthetic fixture', periodLabel: 'Test only', status: 'Inferred' as const, years: [2024], ordering: 'Chronological' as const, hasMapSupport: true, mapAnchor: { latitude: 10.8, longitude: 106.7 } };
    const journeys = [{ ...base, id: 'first' }, { ...base, id: 'second', label: 'Synthetic second' }];
    const screen = await render(<LocalAtlasMap journeys={journeys} selectedJourneyId={null} onChoose={jest.fn()} onGestureChange={jest.fn()} />);
    await fireEvent(screen.getByTestId('local-atlas-canvas'), 'layout', { nativeEvent: { layout: { width: 350, height: 430 } } });
    expect(screen.getByTestId('atlas-country-boundary-overlay')).toBeOnTheScreen();
    expect(screen.getByLabelText('2 journeys in this map area')).toBeOnTheScreen();
    expect(screen.queryByTestId('atlas-dot-first')).toBeNull();
    expect(cartographicBand(950, 'world')).toBe('world');
    expect(cartographicBand(1_200, 'world')).toBe('regional');
    const labels = layoutLabels([
      { id: 'first', text: 'First', longitude: 0, latitude: 0, level: 'country', rank: 1 },
      { id: 'second', text: 'Second', longitude: 0, latitude: 0, level: 'country', rank: 2 },
    ], { width: 350, height: 430 }, WORLD_VIEW, 'world', () => ({ width: 40, height: 14 }));
    expect(labels.map(({ id }) => id)).toEqual(['first']);
    expect(clusterJourneys(journeys, { width: 350, height: 430 }, WORLD_VIEW, null)).toHaveLength(1);
  });
  it('uses conservative label bounds before native text measurement and honors measured bounds afterwards', () => {
    const labels = [
      { id: 'first', text: 'Long country name', longitude: 0, latitude: 0, level: 'country' as const, rank: 1 },
      { id: 'second', text: 'Second name', longitude: 50, latitude: 0, level: 'country' as const, rank: 2 },
    ];
    const firstPass = layoutLabels(labels, { width: 350, height: 430 }, WORLD_VIEW, 'world', () => ({ width: 180, height: 30 }));
    const measured = layoutLabels(labels, { width: 350, height: 430 }, WORLD_VIEW, 'world', () => ({ width: 30, height: 14 }));
    expect(firstPass.map((label) => label.id)).toEqual(['first']);
    expect(measured.map((label) => label.id)).toEqual(['first', 'second']);
  });
});
