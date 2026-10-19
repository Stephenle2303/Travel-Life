import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Image as NativeImage, PixelRatio, Pressable, Text, View, type GestureResponderEvent } from 'react-native';
import { Image as DetailImage } from 'expo-image';
import Svg, { G, Path } from 'react-native-svg';
import { boundViewport, fittedSize, MAX_WORLD_SCALE, WORLD_VIEW, zoomViewport, type Viewport } from '@/atlas/viewport';
import type { RevealJourney } from '@/reveal/types';
import { boundaryStroke, boundaryTransform, cartographicBand, clusterJourneys, layoutLabels, visibleCountryBoundaries, type PublicLabel } from '@/atlas/cartography';
import { ATLAS_COUNTRY_BOUNDARIES } from '@/atlas/country-boundaries';
import { visibleAtlasTiles } from '@/atlas/visible-tiles';
import { ATLAS_TILES } from '@/atlas/tile-assets';

// Public Natural Earth companion labels only. Vietnam Admin1 is intentionally
// absent until a current, redistributable 34-unit source passes verification.
const PUBLIC_LABELS: PublicLabel[] = [
  { id: 'country:canada', text: 'Canada', longitude: -105, latitude: 57, level: 'country', rank: 1 },
  { id: 'country:united-states', text: 'United States', longitude: -99, latitude: 39, level: 'country', rank: 2 },
  { id: 'country:brazil', text: 'Brazil', longitude: -52, latitude: -10, level: 'country', rank: 3 },
  { id: 'country:argentina', text: 'Argentina', longitude: -64, latitude: -37, level: 'country', rank: 4 },
  { id: 'country:united-kingdom', text: 'United Kingdom', longitude: -2, latitude: 54, level: 'country', rank: 5 },
  { id: 'country:france', text: 'France', longitude: 2, latitude: 46, level: 'country', rank: 6 },
  { id: 'country:india', text: 'India', longitude: 79, latitude: 22, level: 'country', rank: 7 },
  { id: 'country:vietnam', text: 'Việt Nam', longitude: 108, latitude: 16, level: 'country', rank: 8 },
  { id: 'country:indonesia', text: 'Indonesia', longitude: 117, latitude: -2, level: 'country', rank: 9 },
  { id: 'country:japan', text: 'Japan', longitude: 138, latitude: 37, level: 'country', rank: 10 },
  { id: 'country:australia', text: 'Australia', longitude: 134, latitude: -25, level: 'country', rank: 11 },
  { id: 'locality:new-york', text: 'New York', longitude: -74, latitude: 40.7, level: 'locality', rank: 1 },
  { id: 'locality:mexico-city', text: 'Mexico City', longitude: -99.1, latitude: 19.4, level: 'locality', rank: 2 },
  { id: 'locality:rio', text: 'Rio de Janeiro', longitude: -43.2, latitude: -22.9, level: 'locality', rank: 3 },
  { id: 'locality:buenos-aires', text: 'Buenos Aires', longitude: -58.4, latitude: -34.6, level: 'locality', rank: 4 },
  { id: 'locality:london', text: 'London', longitude: -.1, latitude: 51.5, level: 'locality', rank: 5 },
  { id: 'locality:paris', text: 'Paris', longitude: 2.35, latitude: 48.9, level: 'locality', rank: 6 },
  { id: 'locality:cairo', text: 'Cairo', longitude: 31.2, latitude: 30, level: 'locality', rank: 7 },
  { id: 'locality:lagos', text: 'Lagos', longitude: 3.4, latitude: 6.5, level: 'locality', rank: 8 },
  { id: 'locality:capetown', text: 'Cape Town', longitude: 18.4, latitude: -33.9, level: 'locality', rank: 9 },
  { id: 'locality:mumbai', text: 'Mumbai', longitude: 72.9, latitude: 19.1, level: 'locality', rank: 10 },
  { id: 'locality:delhi', text: 'Delhi', longitude: 77.2, latitude: 28.6, level: 'locality', rank: 11 },
  { id: 'locality:ho-chi-minh-city', text: 'TP. Hồ Chí Minh', longitude: 106.7, latitude: 10.8, level: 'locality', rank: 12 },
  { id: 'locality:hanoi', text: 'Hà Nội', longitude: 105.85, latitude: 21.03, level: 'locality', rank: 13 },
  { id: 'locality:bangkok', text: 'Bangkok', longitude: 100.5, latitude: 13.75, level: 'locality', rank: 14 },
  { id: 'locality:singapore', text: 'Singapore', longitude: 103.8, latitude: 1.35, level: 'locality', rank: 15 },
  { id: 'locality:tokyo', text: 'Tokyo', longitude: 139.7, latitude: 35.7, level: 'locality', rank: 16 },
  { id: 'locality:sydney', text: 'Sydney', longitude: 151.2, latitude: -33.9, level: 'locality', rank: 17 },
];

/** All touches and buttons update the same measured, aspect-preserving viewport. */
export function LocalAtlasMap({ journeys, selectedJourneyId, onChoose, onGestureChange, initialViewport, onViewportChange }: { journeys: RevealJourney[]; selectedJourneyId: string | null; onChoose(ids: string[]): void; onGestureChange(active: boolean): void; initialViewport?: Viewport; onViewportChange?(view: Viewport): void }) {
  const [size, setSize] = useState({ width: 0, height: 430 });
  const [view, setView] = useState<Viewport>(initialViewport ?? WORLD_VIEW);
  const [assetLevel, setAssetLevel] = useState<'high' | 'low' | 'failed'>('high');
  const [failedTiles, setFailedTiles] = useState<Set<string>>(() => new Set());
  const live = useRef(view);
  const baseline = useRef<{ view: Viewport; x: number; y: number; distance: number; count: number } | null>(null);
  const moved = useRef(false);
  const surface = useRef<View>(null);
  const release = useRef(onGestureChange);
  const [band, setBand] = useState<'world' | 'regional' | 'country' | 'local'>('world');
  const [labelBounds, setLabelBounds] = useState<Record<string, { width: number; height: number }>>({});
  const finish = useCallback(() => { baseline.current = null; release.current(false); }, []);
  useEffect(() => { release.current = onGestureChange; }, [onGestureChange]);
  useEffect(() => () => { release.current(false); }, []);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => { if (next !== 'active') finish(); });
    return () => subscription?.remove?.();
  }, [finish]);
  const update = (next: Viewport) => {
    live.current = next;
    setView(next);
    setBand((current) => cartographicBand(fittedSize(size).width * next.scale, current));
    onViewportChange?.(next);
  };
  const sample = (event: GestureResponderEvent) => {
    const touches = event.nativeEvent.touches;
    if (!touches.length) return null;
    const a = touches[0]; const b = touches[1] ?? a;
    const localAX = a.locationX ?? a.pageX;
    const localAY = a.locationY ?? a.pageY;
    const localBX = b.locationX ?? b.pageX;
    const localBY = b.locationY ?? b.pageY;
    return { count: touches.length, x: (a.pageX + b.pageX) / 2, y: (a.pageY + b.pageY) / 2, distance: Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY), localX: (localAX + localBX) / 2 - size.width / 2, localY: (localAY + localBY) / 2 - size.height / 2 };
  };
  const start = (event: GestureResponderEvent) => {
    const point = sample(event);
    if (point) baseline.current = { ...point, view: live.current };
    onGestureChange(true);
  };
  const tiles = visibleAtlasTiles(size, view, PixelRatio.get());
  const clusters = clusterJourneys(journeys, size, view, selectedJourneyId);
  const labels = layoutLabels(PUBLIC_LABELS, size, view, band, (text, level) => labelBounds[`${level}:${text}`] ?? (() => { const font = level === 'country' ? 14 : 12; const scale = PixelRatio.getFontScale(); return { width: Math.ceil((text.length * font * scale * .72) + 8), height: Math.ceil(font * scale + 8) }; })(), clusters.map((cluster) => ({ x: cluster.point.x - 24, y: cluster.point.y - 24, width: 48, height: 48 })));
  const boundaries = visibleCountryBoundaries(ATLAS_COUNTRY_BOUNDARIES, size, view);
  const image = boundaryTransform(size, view);
  const imageWidth = image.width;
  const imageHeight = image.height;
  const imageLeft = image.left;
  const imageTop = image.top;
  const boundaryScale = image.scale;
  const stroke = boundaryStroke(band);
  return <View style={{ gap: 8 }}>
    <View ref={surface} testID="local-atlas-canvas" accessibilityLabel="Private Atlas local world canvas" onLayout={(event) => { const nextSize = { width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height }; const nextView = boundViewport(live.current, nextSize); live.current = nextView; setSize(nextSize); setView(nextView); setBand((current) => cartographicBand(fittedSize(nextSize).width * nextView.scale, current)); onViewportChange?.(nextView); }}
      onTouchStart={(event) => { if (!baseline.current) moved.current = false; start(event); }} onTouchEnd={(event) => { if (event.nativeEvent.touches.length) start(event); else finish(); }} onTouchCancel={finish}
      onMoveShouldSetResponderCapture={(event) => { const point = sample(event); const base = baseline.current; return !!point && !!base && (point.count > 1 || Math.hypot(point.x - base.x, point.y - base.y) > 5); }}
      onResponderGrant={() => { moved.current = true; }} onResponderTerminationRequest={() => true} onResponderRelease={finish} onResponderTerminate={finish}
      onResponderMove={(event) => {
        const point = sample(event); const base = baseline.current;
        if (!point || !base) return;
        if (point.count !== base.count) { start(event); return; }
        moved.current = true;
        const scale = point.count > 1 && base.distance > 0 ? base.view.scale * point.distance / base.distance : base.view.scale;
        const scaled = zoomViewport(base.view, scale, { x: point.localX - (point.x - base.x), y: point.localY - (point.y - base.y) }, size);
        update(boundViewport({ ...scaled, x: scaled.x + point.x - base.x, y: scaled.y + point.y - base.y }, size));
      }} style={{ height: 430, overflow: 'hidden', borderRadius: 22, backgroundColor: '#0B132B' }}>
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}>{assetLevel === 'failed' ? <Text style={{ color: 'white', padding: 24 }}>Map artwork unavailable. Your journeys remain available in Timeline.</Text> : <NativeImage source={assetLevel === 'high' ? require('../../assets/atlas/world-base.png') : require('../../assets/atlas/world-base-low.png')} onError={() => setAssetLevel(assetLevel === 'high' ? 'low' : 'failed')} resizeMode="contain" testID="atlas-image-plane" style={{ position: 'absolute', width: imageWidth, height: imageHeight, left: imageLeft, top: imageTop }} />}</View>
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}>{assetLevel !== 'failed' && tiles.filter((tile) => !failedTiles.has(tile.key)).map((tile) => <DetailImage key={tile.key} testID={`atlas-tile-${tile.key}`} source={ATLAS_TILES[tile.level][`${tile.col}:${tile.row}`]} contentFit="fill" cachePolicy="none" recyclingKey={tile.key} transition={0} onError={() => setFailedTiles((previous) => new Set(previous).add(tile.key))} style={{ position: 'absolute', left: tile.left, top: tile.top, width: tile.size, height: tile.size }} />)}</View>
      {assetLevel !== 'failed' && boundaryScale > 0 && <Svg testID="atlas-country-boundary-overlay" pointerEvents="none" width={size.width} height={size.height} style={{ position: 'absolute', top: 0, left: 0 }}>
        <G testID="atlas-country-boundary-transform" transform={image.transform}>
          {boundaries.map((boundary) => <G key={boundary.id}><Path d={boundary.d} fill="none" stroke={stroke.casingColor} strokeWidth={stroke.casingWidth / boundaryScale} strokeLinejoin="round" strokeLinecap="round" /><Path d={boundary.d} fill="none" stroke={stroke.color} strokeWidth={stroke.width / boundaryScale} strokeLinejoin="round" strokeLinecap="round" /></G>)}
        </G>
      </Svg>}
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}>
        {labels.map((label) => <Text key={label.id} onTextLayout={(event) => { const line = event.nativeEvent.lines[0]; if (line) setLabelBounds((current) => current[`${label.level}:${label.text}`]?.width === line.width && current[`${label.level}:${label.text}`]?.height === line.height ? current : { ...current, [`${label.level}:${label.text}`]: { width: line.width, height: line.height } }); }} style={{ position: 'absolute', left: label.point.x - label.width / 2 - 4, top: label.point.y - label.height / 2 - 2, color: label.level === 'country' ? '#E9DDB2' : '#B8C9D4', fontSize: label.level === 'country' ? 14 : 12, fontWeight: label.level === 'country' ? '700' : '400', textShadowColor: '#081527', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 }, backgroundColor: 'rgba(8,21,39,0.72)', paddingHorizontal: 4, borderRadius: 3 }}>{label.text}</Text>)}
      </View>
      {clusters.map((cluster) => {
        if (cluster.point.x < 0 || cluster.point.x > size.width || cluster.point.y < 0 || cluster.point.y > size.height) return null;
        const isCluster = cluster.journeyIds.length > 1;
        const single = isCluster ? null : journeys.find((journey) => journey.id === cluster.journeyIds[0]);
        const selected = cluster.selected;
        const label = isCluster ? `${cluster.journeyIds.length} journeys in this map area` : `${single?.label}, ${single?.periodLabel}${selected ? ', selected' : ''}`;
        return <Pressable key={cluster.id} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={label} onPress={() => { if (!moved.current) onChoose(cluster.journeyIds); }} style={{ position: 'absolute', left: cluster.point.x - 24, top: cluster.point.y - 24, width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}><View testID={isCluster ? `atlas-cluster-${cluster.id}` : `atlas-dot-${single!.id}`} style={{ width: isCluster ? undefined : selected ? 12 : 8, minWidth: isCluster ? 26 : undefined, height: isCluster ? 26 : selected ? 12 : 8, paddingHorizontal: isCluster ? 5 : 0, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? '#00B4D8' : '#F8961E', borderColor: '#0B132B', borderWidth: 1 }}>{isCluster && <Text style={{ color: '#081527', fontWeight: '800' }}>{cluster.journeyIds.length}</Text>}</View></Pressable>;
      })}
    </View>
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {[{ label: 'Zoom in on local Atlas map', title: '+', factor: 1.6, disabled: view.scale >= MAX_WORLD_SCALE }, { label: 'Zoom out on local Atlas map', title: '−', factor: 1 / 1.6, disabled: view.scale <= 1 }].map((button) => <Pressable key={button.label} accessibilityRole="button" accessibilityLabel={button.label} disabled={button.disabled} accessibilityState={{ disabled: button.disabled }} onPress={() => update(zoomViewport(live.current, live.current.scale * button.factor, { x: 0, y: 0 }, size))} style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1C2541', opacity: button.disabled ? 0.4 : 1, borderRadius: 12 }}><Text style={{ color: 'white', fontSize: 24 }}>{button.title}</Text></Pressable>)}
      <Pressable accessibilityRole="button" accessibilityLabel="Fit whole world map" onPress={() => update(WORLD_VIEW)} style={{ minHeight: 48, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 12, backgroundColor: '#1C2541' }}><Text style={{ color: 'white' }}>Fit world</Text></Pressable>
    </View>
    <Text accessibilityLabel="Offline cartography coverage" style={{ color: '#B8C9D4', fontSize: 12 }}>Offline country borders and locality names. Vietnam provincial boundaries are being verified.</Text>
  </View>;
}
