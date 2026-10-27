import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type PressableProps } from 'react-native';

import { palette } from '@/components/ui';

type TripListCardProps = Omit<PressableProps, 'children' | 'style'> & {
  title: string;
  detail: string;
  secondaryDetail?: string;
  cover: ReactNode;
  selected?: boolean;
  muted?: boolean;
  trailing?: ReactNode;
  status?: ReactNode;
};

/**
 * One recognizable, accessible trip row for private Atlas, Replay editing,
 * and selected sharing. Callers own their data policy and may pass only a
 * locally-authorized preview (or the explicit fallback) as `cover`.
 */
export function TripListCard({ title, detail, secondaryDetail, cover, selected = false, muted = false, trailing, status, ...pressable }: TripListCardProps) {
  return <Pressable {...pressable} style={({ pressed }) => [styles.card, selected && styles.selected, muted && styles.muted, pressed && !pressable.disabled && styles.pressed]}>
    <View style={styles.cover}>{cover}</View>
    <View style={styles.copy}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.detail}>{detail}</Text>
      {secondaryDetail && <Text style={styles.detail}>{secondaryDetail}</Text>}
      {status}
    </View>
    {trailing}
  </Pressable>;
}

export function TripCoverFallback({ label = 'TRIP' }: { label?: string }) {
  return <View style={styles.fallback}><Text style={styles.fallbackText}>{label}</Text></View>;
}

export const tripListCardStyles = StyleSheet.create({
  coverImage: { width: '100%', height: '100%' },
  check: { color: palette.citrus, fontSize: 26, fontWeight: '900', padding: 8 },
  arrow: { color: palette.sage, fontSize: 26, paddingHorizontal: 8 },
  edited: { color: palette.citrus, fontSize: 12, marginTop: 6 },
});

const styles = StyleSheet.create({
  card: { minHeight: 92, marginTop: 8, padding: 8, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: palette.fern, borderRadius: 12, backgroundColor: palette.rainforest },
  selected: { borderColor: palette.citrus, backgroundColor: palette.fern },
  muted: { opacity: 0.52 },
  pressed: { opacity: 0.82 },
  cover: { width: 76, height: 76, overflow: 'hidden', borderRadius: 10, backgroundColor: palette.fern },
  copy: { flex: 1, gap: 4 },
  title: { color: palette.limestone, fontSize: 17, fontWeight: '800' },
  detail: { color: palette.sage, fontSize: 13 },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fallbackText: { color: palette.sage, fontSize: 11, fontWeight: '900' },
});
