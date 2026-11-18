import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import geography from '@/reconstruction/data/natural-earth-110m-admin-0-countries-5.1.1.json';
import { ActionButton, Body } from '@/components/ui';

const land = geography.countries.map(({ rings }) => rings.map((ring) => ring
  .map(([x, y], index) => `${index ? 'L' : 'M'}${x},${-y}`).join('') + 'Z').join('')).join('');

export function OfflineHomeMap({ point, select, radiusMeters }: {
  point: { latitude: number; longitude: number } | null;
  radiusMeters: number;
  select(latitude: number, longitude: number): void;
}) {
  const [width, setWidth] = useState(0);
  const [span, setSpan] = useState(360);
  const [center, setCenter] = useState({ latitude: 0, longitude: 0 });
  const height = width / 2;
  const radiusDegrees = radiusMeters * 180 / (Math.PI * 6_371_000);
  const west = Math.min(180 - span, Math.max(-180, center.longitude - span / 2));
  const top = Math.min(90 - span / 2, Math.max(-90, -center.latitude - span / 4));
  const zoomIn = () => {
    if (!point) return;
    setCenter(point);
    setSpan((previous) => Math.max(0.75, previous / 4));
  };
  return <View style={{ gap: 8 }}>
    <Body>Tap the map to place a pin. Zoom in to adjust the area.</Body>
    <Pressable accessible={false} onLayout={({ nativeEvent }) => setWidth(nativeEvent.layout.width)}
      style={{ width: '100%', aspectRatio: 2, overflow: 'hidden', borderRadius: 10 }}
      onPress={({ nativeEvent }) => {
        if (!width) return;
        select(Number((-(top + nativeEvent.locationY / height * span / 2)).toFixed(5)),
          Number((west + nativeEvent.locationX / width * span).toFixed(5)));
      }}>
      <View pointerEvents="none" style={{ flex: 1 }}>
        <Svg width="100%" height="100%" viewBox={`${west} ${top} ${span} ${span / 2}`}>
          <Rect x={-180} y={-90} width={360} height={180} fill="#173845" />
          <Path d={land} fill="#547962" fillRule="evenodd" />
          {point && <>
            <Ellipse cx={point.longitude} cy={-point.latitude} ry={radiusDegrees} rx={radiusDegrees / Math.max(0.02, Math.cos(point.latitude * Math.PI / 180))} fill="#D8EF69" fillOpacity={0.4} />
            <Circle cx={point.longitude} cy={-point.latitude} r={span / 135} fill="#D8EF69" />
          </>}
        </Svg>
      </View>
    </Pressable>
    <ActionButton variant="secondary" onPress={zoomIn} disabled={!point || span <= 0.75}>Zoom in on pin</ActionButton>
    {span < 360 && <ActionButton variant="secondary" onPress={() => setSpan(360)}>World view</ActionButton>}
  </View>;
}
