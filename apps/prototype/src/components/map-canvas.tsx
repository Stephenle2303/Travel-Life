import { Component, type ReactNode, useMemo, useState } from 'react';
import { ImageBackground, PanResponder, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { palette, tactileFeedback } from '@/components/ui';
import type { AtlasCamera, SyntheticJourney } from '@/types/prototype';
import { projectAtlasAnchor } from '../../../../shared/atlas-cartography/projection';

export class MapErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export interface AtlasMarkerGroup { key: string; journeys: SyntheticJourney[]; x: number; y: number; }

/** Groups nearby public demo anchors so a dense demo can still be selected without pretending it is a route. */
export function groupAtlasJourneys(journeys: SyntheticJourney[]): AtlasMarkerGroup[] {
  const groups = new Map<string, AtlasMarkerGroup>();
  for (const journey of journeys) {
    if (!journey.atlasAnchor) continue;
    const point = projectAtlasAnchor(journey.atlasAnchor);
    if (!point) continue;
    const { x, y } = point;
    const key = `${Math.round(x / 9)}-${Math.round(y / 9)}`;
    const group = groups.get(key);
    if (group) group.journeys.push(journey);
    else groups.set(key, { key, journeys: [journey], x, y });
  }
  return [...groups.values()];
}

function Geography() {
  return <ImageBackground source={require('../../assets/atlas/world-map-reference.jpg')} style={styles.referenceBase} imageStyle={styles.referenceImage} />;
}

/** Bundled owner-supplied visual master. It deliberately never requests a tile or provider. */
export function MapCanvas({ journeys, selectedJourneyId, camera, onCameraChange, onFit, onSelect, onOpenTimeline }: {
  journeys: SyntheticJourney[]; selectedJourneyId: string; camera: AtlasCamera; onCameraChange: (camera: AtlasCamera) => void; onFit: () => void; onSelect: (journeyId: string) => void; onOpenTimeline: () => void;
}) {
  const { width } = useWindowDimensions();
  const [panStart, setPanStart] = useState(camera);
  const [openGroupKey, setOpenGroupKey] = useState<string | undefined>();
  const groups = useMemo(() => groupAtlasJourneys(journeys), [journeys]);
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 3 || Math.abs(gesture.dy) > 3,
    onPanResponderGrant: () => { setPanStart(camera); },
    onPanResponderMove: (_, gesture) => onCameraChange({ ...panStart, offsetX: panStart.offsetX + gesture.dx, offsetY: panStart.offsetY + gesture.dy }),
  }), [camera, onCameraChange, panStart]);
  const zoom = (delta: number) => { tactileFeedback.selection(); onCameraChange({ ...camera, zoom: camera.zoom + delta }); };
  return <View accessibilityLabel="Bundled reference-faithful world geography" style={styles.canvas}>
    <View accessibilityLabel="Offline reference Atlas map" style={[styles.field, width >= 900 && styles.fieldWide]} {...panResponder.panHandlers}>
      <View style={[styles.mapPlane, { transform: [{ translateX: camera.offsetX }, { translateY: camera.offsetY }, { scale: camera.zoom }] }]}><Geography />
        {groups.map((group) => {
          const selected = group.journeys.some((journey) => journey.id === selectedJourneyId);
          const overlap = group.journeys.length > 1;
          const label = overlap ? `${group.journeys.length} overlapping synthetic demo anchors` : `Select ${group.journeys[0].title}, synthetic demo anchor`;
          return <View key={group.key} style={[styles.marker, { left: `${group.x}%`, top: `${group.y}%` }, selected && styles.selectedMarker]}><Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected, expanded: overlap ? openGroupKey === group.key : undefined }} onPress={() => { tactileFeedback.selection(); if (overlap) setOpenGroupKey(openGroupKey === group.key ? undefined : group.key); else onSelect(group.journeys[0].id); }} style={({ pressed }) => [styles.markerTrigger, pressed && styles.pressed]}>
            <View style={[styles.markerDot, selected && styles.markerDotSelected]}><Text style={styles.markerNumber}>{overlap ? group.journeys.length : '•'}</Text></View><Text numberOfLines={1} style={[styles.markerText, selected && styles.markerTextSelected]}>{overlap ? `${group.journeys.length} demo anchors` : group.journeys[0].title}</Text>{selected ? <Text style={styles.status}>{overlap ? 'choose a demo chapter' : `${group.journeys[0].year} · ${group.journeys[0].status}`}</Text> : null}
          </Pressable>{overlap && openGroupKey === group.key ? <View style={styles.overlapChoices}>{group.journeys.map((journey) => <Pressable key={journey.id} accessibilityRole="button" accessibilityLabel={`Choose ${journey.title} from overlapping anchors`} onPress={() => { tactileFeedback.selection(); setOpenGroupKey(undefined); onSelect(journey.id); }} style={styles.overlapChoice}><Text numberOfLines={1} style={styles.overlapChoiceText}>{journey.title}</Text></Pressable>)}</View> : null}</View>;
        })}
      </View>
      {!journeys.length ? <View style={styles.emptyState}><Text style={styles.empty}>No usable fictional atlas coordinate matches this year. The synthetic journey stays available in Timeline rather than being placed or invented here.</Text><Pressable accessibilityRole="button" accessibilityLabel="Open Timeline for unplotted journeys" onPress={onOpenTimeline} style={styles.emptyAction}><Text style={styles.emptyActionText}>Open Timeline</Text></Pressable></View> : null}
    </View>
    <View style={styles.mapControls}><View style={styles.zoomControls}><Pressable accessibilityRole="button" accessibilityLabel="Zoom in atlas" onPress={() => zoom(0.2)} style={styles.mapButton}><Text style={styles.mapButtonText}>+</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Zoom out atlas" onPress={() => zoom(-0.2)} style={styles.mapButton}><Text style={styles.mapButtonText}>−</Text></Pressable></View><Pressable accessibilityRole="button" accessibilityLabel="Fit synthetic demo geography" onPress={onFit} style={styles.fitButton}><Text style={styles.fitText}>Fit demo atlas</Text></Pressable></View>
  </View>;
}

const styles = StyleSheet.create({
  canvas: { backgroundColor: '#071726', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(78,168,222,0.42)', padding: 10, gap: 8, overflow: 'hidden' },
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }, kicker: { color: palette.citrus, fontSize: 10, fontWeight: '900', letterSpacing: 1.25 }, label: { color: palette.limestone, fontSize: 21, fontWeight: '900', marginTop: 3 }, count: { color: palette.sage, fontSize: 34, lineHeight: 36, fontWeight: '300' }, caption: { color: palette.sage, fontSize: 12, lineHeight: 18, maxWidth: 650 },
  field: { height: 370, marginTop: 6, borderRadius: 14, backgroundColor: '#071726', borderWidth: 1, borderColor: 'rgba(78,168,222,0.42)', position: 'relative', overflow: 'hidden' }, fieldWide: { height: 540 }, mapPlane: { width: '100%', height: '100%' }, referenceBase: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }, referenceImage: { resizeMode: 'cover', opacity: 0.98 },
  graticule: { position: 'absolute', width: '120%', height: 1, left: '-10%', backgroundColor: 'rgba(180,198,181,0.13)' }, latitudeOne: { top: '33%' }, latitudeTwo: { top: '66%' }, meridian: { position: 'absolute', height: '120%', width: 1, top: '-10%', backgroundColor: 'rgba(180,198,181,0.12)' }, meridianOne: { left: '34%', transform: [{ rotate: '12deg' }] }, meridianTwo: { left: '70%', transform: [{ rotate: '-9deg' }] },
  land: { position: 'absolute', backgroundColor: '#315B4A', borderWidth: 1, borderColor: 'rgba(243,238,221,0.18)' }, westernLand: { width: '38%', height: '55%', left: '-8%', top: '34%', borderRadius: 96, transform: [{ rotate: '-18deg' }] }, centralLand: { width: '34%', height: '40%', left: '35%', top: '18%', borderRadius: 80, transform: [{ rotate: '28deg' }] }, easternLand: { width: '30%', height: '62%', right: '-7%', top: '31%', borderRadius: 88, transform: [{ rotate: '14deg' }] }, isle: { position: 'absolute', backgroundColor: '#315B4A', borderColor: 'rgba(243,238,221,0.18)', borderWidth: 1, borderRadius: 999 }, isleOne: { width: 26, height: 16, left: '63%', top: '62%' }, isleTwo: { width: 18, height: 12, left: '56%', top: '71%' },
  geoLabel: { position: 'absolute', color: 'rgba(243,238,221,0.48)', fontSize: 9, fontWeight: '900', letterSpacing: 1.3 }, westernLabel: { left: '8%', top: '81%' }, centralLabel: { left: '41%', top: '13%' }, easternLabel: { right: '4%', top: '82%' },
  marker: { position: 'absolute', width: 140, minHeight: 48, alignItems: 'center', justifyContent: 'center', transform: [{ translateX: -70 }, { translateY: -24 }] }, markerTrigger: { alignItems: 'center', justifyContent: 'center', width: '100%' }, selectedMarker: { zIndex: 2 }, markerDot: { minWidth: 21, height: 21, paddingHorizontal: 4, borderRadius: 12, borderWidth: 1, borderColor: palette.clay, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.rainforest }, markerDotSelected: { minWidth: 29, height: 29, borderRadius: 15, borderColor: palette.citrus, borderWidth: 2 }, markerNumber: { color: palette.limestone, fontWeight: '900', fontSize: 13 }, markerText: { color: palette.limestone, backgroundColor: 'rgba(16,44,38,0.9)', borderRadius: 7, paddingHorizontal: 6, paddingVertical: 3, fontSize: 11, fontWeight: '800', marginTop: 4 }, markerTextSelected: { color: palette.rainforest, backgroundColor: palette.citrus }, status: { color: palette.sage, fontSize: 9, fontWeight: '900', marginTop: 3, textTransform: 'uppercase', textAlign: 'center' }, overlapChoices: { width: 140, gap: 4, marginTop: 5, padding: 5, borderRadius: 8, backgroundColor: palette.rainforest, borderWidth: 1, borderColor: palette.citrus }, overlapChoice: { minHeight: 32, paddingHorizontal: 7, justifyContent: 'center', borderRadius: 5, backgroundColor: palette.fern }, overlapChoiceText: { color: palette.limestone, fontSize: 10, fontWeight: '800', textAlign: 'center' }, pressed: { opacity: 0.72 }, emptyState: { position: 'absolute', top: 14, left: 14, right: 14, gap: 10, padding: 14, borderRadius: 12, backgroundColor: 'rgba(16,44,38,0.9)', borderColor: 'rgba(180,198,181,0.35)', borderWidth: 1 }, empty: { color: palette.sage, fontSize: 13, lineHeight: 19, maxWidth: 340 }, emptyAction: { minHeight: 42, paddingHorizontal: 12, alignSelf: 'flex-start', justifyContent: 'center', borderRadius: 10, backgroundColor: palette.citrus }, emptyActionText: { color: palette.rainforest, fontWeight: '900', fontSize: 12 },
  mapControls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }, zoomControls: { flexDirection: 'row', gap: 8 }, mapButton: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.rainforest, borderColor: 'rgba(180,198,181,0.4)', borderWidth: 1 }, mapButtonText: { color: palette.limestone, fontSize: 25, fontWeight: '700' }, fitButton: { minHeight: 44, paddingHorizontal: 13, justifyContent: 'center', borderRadius: 10, backgroundColor: palette.citrus }, fitText: { color: palette.rainforest, fontSize: 12, fontWeight: '900' },
});
