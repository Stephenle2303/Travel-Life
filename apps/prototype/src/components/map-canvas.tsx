import { Component, type ReactNode, useMemo, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { palette, tactileFeedback } from '@/components/ui';
import type { AtlasCamera, SyntheticJourney } from '@/types/prototype';

const obsidian = {
  void: '#0B132B', midnight: '#1C2541', glass: 'rgba(19,27,49,0.82)', luminous: '#1F3159', cyan: '#4EA8DE', cyanBright: '#00B4D8', amber: '#F3722C', gold: '#E9C46A', secondary: '#8D99AE',
} as const;

export class MapErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export interface AtlasMarkerGroup { key: string; journeys: SyntheticJourney[]; x: number; y: number; }

/** Groups nearby fictional anchors so a dense demo can still be selected without pretending it is a route. */
export function groupAtlasJourneys(journeys: SyntheticJourney[]): AtlasMarkerGroup[] {
  const groups = new Map<string, AtlasMarkerGroup>();
  for (const journey of journeys) {
    if (!journey.atlasAnchor) continue;
    const x = 50 + journey.atlasAnchor.longitude / 2;
    const y = 50 - journey.atlasAnchor.latitude / 1.35;
    const key = `${Math.round(x / 9)}-${Math.round(y / 9)}`;
    const group = groups.get(key);
    if (group) group.journeys.push(journey);
    else groups.set(key, { key, journeys: [journey], x, y });
  }
  return [...groups.values()];
}

function Geography() {
  return <>
    <View pointerEvents="none" style={[styles.graticule, styles.latitudeOne]} /><View pointerEvents="none" style={[styles.graticule, styles.latitudeTwo]} />
    <View pointerEvents="none" style={[styles.meridian, styles.meridianOne]} /><View pointerEvents="none" style={[styles.meridian, styles.meridianTwo]} />
    <View pointerEvents="none" style={[styles.land, styles.westernLand]} /><View pointerEvents="none" style={[styles.land, styles.centralLand]} /><View pointerEvents="none" style={[styles.land, styles.easternLand]} />
    <View pointerEvents="none" style={[styles.isle, styles.isleOne]} /><View pointerEvents="none" style={[styles.isle, styles.isleTwo]} />
    <Text pointerEvents="none" style={[styles.geoLabel, styles.westernLabel]}>VERDANT REACH</Text><Text pointerEvents="none" style={[styles.geoLabel, styles.centralLabel]}>LANTERN SEA</Text><Text pointerEvents="none" style={[styles.geoLabel, styles.easternLabel]}>CEDAR COAST</Text>
  </>;
}

/** Dependency-free, bundled fictional geography. It deliberately never requests a map tile or provider. */
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
  return <View accessibilityLabel="Bundled synthetic demo geography" style={styles.canvas}>
    <View style={styles.heading}><View><Text style={styles.kicker}>PRIVATE ATLAS · SYNTHETIC DEMO</Text><Text style={styles.label}>EXPLORE{`\n`}THE WORLD</Text></View><Text style={styles.count}>{journeys.length.toString().padStart(2, '0')}</Text></View>
    <Text style={styles.caption}>Fictional demo geography and anchors only—not a device location, real visit, route, or map service.</Text>
    <View accessibilityLabel="Offline fictional atlas map" style={[styles.field, width >= 900 && styles.fieldWide]} {...panResponder.panHandlers}>
      <View style={[styles.mapPlane, { transform: [{ translateX: camera.offsetX }, { translateY: camera.offsetY }, { scale: camera.zoom }] }]}><Geography />
        {groups.map((group) => {
          const selected = group.journeys.some((journey) => journey.id === selectedJourneyId);
          const overlap = group.journeys.length > 1;
          const label = overlap ? `${group.journeys.length} overlapping synthetic demo anchors` : `Select ${group.journeys[0].title}, fictional demo anchor`;
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
  canvas: { backgroundColor: obsidian.void, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(78,168,222,0.42)', padding: 16, gap: 8, overflow: 'hidden' },
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }, kicker: { color: obsidian.cyan, fontSize: 10, fontWeight: '900', letterSpacing: 1.5 }, label: { color: palette.limestone, fontSize: 25, lineHeight: 27, fontWeight: '900', letterSpacing: 1.4, marginTop: 3 }, count: { color: obsidian.secondary, fontSize: 34, lineHeight: 36, fontWeight: '300' }, caption: { color: obsidian.secondary, fontSize: 12, lineHeight: 18, maxWidth: 650 },
  field: { height: 370, marginTop: 6, borderRadius: 16, backgroundColor: obsidian.midnight, borderWidth: 1, borderColor: 'rgba(233,196,106,0.38)', position: 'relative', overflow: 'hidden' }, fieldWide: { height: 540 }, mapPlane: { width: '100%', height: '100%' },
  graticule: { position: 'absolute', width: '120%', height: 1, left: '-10%', backgroundColor: 'rgba(78,168,222,0.18)' }, latitudeOne: { top: '33%' }, latitudeTwo: { top: '66%' }, meridian: { position: 'absolute', height: '120%', width: 1, top: '-10%', backgroundColor: 'rgba(78,168,222,0.18)' }, meridianOne: { left: '34%', transform: [{ rotate: '12deg' }] }, meridianTwo: { left: '70%', transform: [{ rotate: '-9deg' }] },
  land: { position: 'absolute', backgroundColor: '#1F3159', borderWidth: 1, borderColor: 'rgba(233,196,106,0.42)' }, westernLand: { width: '38%', height: '55%', left: '-8%', top: '34%', borderRadius: 96, transform: [{ rotate: '-18deg' }] }, centralLand: { width: '34%', height: '40%', left: '35%', top: '18%', borderRadius: 80, transform: [{ rotate: '28deg' }] }, easternLand: { width: '30%', height: '62%', right: '-7%', top: '31%', borderRadius: 88, transform: [{ rotate: '14deg' }] }, isle: { position: 'absolute', backgroundColor: '#1F3159', borderColor: 'rgba(233,196,106,0.42)', borderWidth: 1, borderRadius: 999 }, isleOne: { width: 26, height: 16, left: '63%', top: '62%' }, isleTwo: { width: 18, height: 12, left: '56%', top: '71%' },
  geoLabel: { position: 'absolute', color: 'rgba(233,196,106,0.72)', fontSize: 9, fontWeight: '900', letterSpacing: 1.3 }, westernLabel: { left: '8%', top: '81%' }, centralLabel: { left: '41%', top: '13%' }, easternLabel: { right: '4%', top: '82%' },
  marker: { position: 'absolute', width: 140, minHeight: 48, alignItems: 'center', justifyContent: 'center', transform: [{ translateX: -70 }, { translateY: -24 }] }, markerTrigger: { alignItems: 'center', justifyContent: 'center', width: '100%' }, selectedMarker: { zIndex: 2 }, markerDot: { minWidth: 21, height: 21, paddingHorizontal: 4, borderRadius: 12, borderWidth: 1, borderColor: obsidian.gold, alignItems: 'center', justifyContent: 'center', backgroundColor: obsidian.amber }, markerDotSelected: { minWidth: 29, height: 29, borderRadius: 15, borderColor: obsidian.gold, borderWidth: 3, backgroundColor: obsidian.cyanBright }, markerNumber: { color: obsidian.void, fontWeight: '900', fontSize: 13 }, markerText: { color: palette.limestone, backgroundColor: obsidian.glass, borderRadius: 7, paddingHorizontal: 6, paddingVertical: 3, fontSize: 11, fontWeight: '800', marginTop: 4 }, markerTextSelected: { color: obsidian.void, backgroundColor: obsidian.cyanBright }, status: { color: obsidian.secondary, fontSize: 9, fontWeight: '900', marginTop: 3, textTransform: 'uppercase', textAlign: 'center' }, overlapChoices: { width: 140, gap: 4, marginTop: 5, padding: 5, borderRadius: 8, backgroundColor: obsidian.glass, borderWidth: 1, borderColor: obsidian.cyan }, overlapChoice: { minHeight: 32, paddingHorizontal: 7, justifyContent: 'center', borderRadius: 5, backgroundColor: obsidian.luminous }, overlapChoiceText: { color: palette.limestone, fontSize: 10, fontWeight: '800', textAlign: 'center' }, pressed: { opacity: 0.72 }, emptyState: { position: 'absolute', top: 14, left: 14, right: 14, gap: 10, padding: 14, borderRadius: 12, backgroundColor: obsidian.glass, borderColor: 'rgba(78,168,222,0.42)', borderWidth: 1 }, empty: { color: obsidian.secondary, fontSize: 13, lineHeight: 19, maxWidth: 340 }, emptyAction: { minHeight: 42, paddingHorizontal: 12, alignSelf: 'flex-start', justifyContent: 'center', borderRadius: 10, backgroundColor: obsidian.cyanBright }, emptyActionText: { color: obsidian.void, fontWeight: '900', fontSize: 12 },
  mapControls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }, zoomControls: { flexDirection: 'row', gap: 8 }, mapButton: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: obsidian.glass, borderColor: 'rgba(78,168,222,0.55)', borderWidth: 1 }, mapButtonText: { color: obsidian.cyan, fontSize: 25, fontWeight: '700' }, fitButton: { minHeight: 44, paddingHorizontal: 13, justifyContent: 'center', borderRadius: 10, backgroundColor: obsidian.cyanBright }, fitText: { color: obsidian.void, fontSize: 12, fontWeight: '900' },
});
