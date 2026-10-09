import { useEffect, useState, type PropsWithChildren, type ReactNode } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent, type StyleProp, type TextStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const palette = {
  rainforest: '#102C26', fern: '#21483B', limestone: '#F3EEDD', sage: '#B4C6B5', citrus: '#D8EF69', clay: '#D98763',
  ink: '#102C26', night: '#102C26', paper: '#F3EEDD', moss: '#21483B', coral: '#D98763', yellow: '#D8EF69', mist: '#B4C6B5', muted: '#B4C6B5', inferred: '#D98763', confirmed: '#D8EF69',
} as const;

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => { if (mounted && enabled) setReduced(true); })
      .catch(() => { if (mounted) setReduced(true); });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { mounted = false; subscription.remove(); };
  }, []);
  return reduced;
}

/** Adapter seam for optional native haptics. This local prototype intentionally uses a silent implementation. */
export const tactileFeedback = { selection: () => undefined } as const;
export function atlasLayoutForWidth(width: number): 'stacked' | 'wide' { return width >= 900 ? 'wide' : 'stacked'; }

export function Screen({ children, wide = false, onScroll }: PropsWithChildren<{ wide?: boolean; onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void }>) {
  return <SafeAreaView style={styles.safe} edges={['top', 'bottom']}><ScrollView contentContainerStyle={[styles.screen, wide && styles.wideScreen]} showsVerticalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={100}>{children}</ScrollView></SafeAreaView>;
}

export function AtlasShell({ primary, secondary }: { primary: ReactNode; secondary: ReactNode }) {
  const { width } = useWindowDimensions();
  const layout = atlasLayoutForWidth(width);
  return <View testID={`atlas-layout-${layout}`} style={[styles.atlasShell, layout === 'wide' && styles.atlasShellWide]}><View style={styles.atlasPrimary}>{primary}</View><View style={[styles.atlasSecondary, layout === 'wide' && styles.atlasSecondaryWide]}>{secondary}</View></View>;
}

export function InsetPanel({ children, tone = 'fern', style }: PropsWithChildren<{ tone?: 'fern' | 'limestone' | 'transparent'; style?: object }>) {
  return <View style={[styles.inset, tone === 'limestone' && styles.insetLight, tone === 'transparent' && styles.insetTransparent, style]}>{children}</View>;
}

export function Eyebrow({ children }: PropsWithChildren) { return <Text style={styles.eyebrow}>{children}</Text>; }
export function Title({ children }: PropsWithChildren) { return <Text style={styles.title}>{children}</Text>; }
export function Body({ children, style }: PropsWithChildren<{ style?: StyleProp<TextStyle> }>) { return <Text style={[styles.body, style]}>{children}</Text>; }
export function Callout({ children, tone = 'mist' }: PropsWithChildren<{ tone?: 'mist' | 'coral' | 'moss' }>) { return <View style={[styles.callout, tone === 'coral' && styles.coralCallout, tone === 'moss' && styles.mossCallout]}>{children}</View>; }

export function ActionButton({ children, onPress, variant = 'primary', accessibilityLabel }: PropsWithChildren<{ onPress: () => void; variant?: 'primary' | 'secondary' | 'quiet'; accessibilityLabel?: string }>) {
  const [focused, setFocused] = useState(false);
  const reducedMotion = useReducedMotion();
  const handlePress = () => { tactileFeedback.selection(); onPress(); };
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={handlePress} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={({ pressed }) => [styles.button, styles[variant], focused && styles.focused, pressed && styles.pressed, pressed && !reducedMotion && styles.pressedMotion]}><Text style={[styles.buttonText, variant !== 'primary' && styles.quietText]}>{children}</Text></Pressable>;
}

export function Pill({ children, status }: PropsWithChildren<{ status?: 'inferred' | 'confirmed' }>) { return <Text style={[styles.pill, status === 'inferred' ? styles.inferredPill : styles.confirmedPill]}>{children}</Text>; }
export function Section({ title, children }: { title: string; children: ReactNode }) { return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.rainforest },
  screen: { gap: 18, padding: 20, paddingBottom: 44, width: '100%', maxWidth: 820, alignSelf: 'center' },
  wideScreen: { maxWidth: 1480 },
  atlasShell: { width: '100%', gap: 16 },
  atlasShellWide: { flexDirection: 'row', alignItems: 'flex-start' },
  atlasPrimary: { flex: 1, minWidth: 0 },
  atlasSecondary: { width: '100%', gap: 14 },
  atlasSecondaryWide: { width: 370, flexShrink: 0 },
  inset: { gap: 12, padding: 16, borderRadius: 18, backgroundColor: palette.fern, borderWidth: 1, borderColor: 'rgba(243,238,221,0.16)' },
  insetLight: { backgroundColor: palette.limestone, borderColor: 'rgba(16,44,38,0.18)' },
  insetTransparent: { backgroundColor: 'transparent' },
  eyebrow: { color: palette.citrus, fontSize: 11, fontWeight: '900', letterSpacing: 1.5, textTransform: 'uppercase' },
  title: { color: palette.limestone, fontSize: 36, lineHeight: 40, fontWeight: '900', letterSpacing: -1.2 },
  body: { color: palette.sage, fontSize: 15, lineHeight: 23 },
  callout: { backgroundColor: 'rgba(180,198,181,0.12)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(180,198,181,0.25)', padding: 14, gap: 7 },
  coralCallout: { borderColor: palette.clay, backgroundColor: 'rgba(217,135,99,0.12)' },
  mossCallout: { borderColor: palette.sage, backgroundColor: 'rgba(180,198,181,0.08)' },
  button: { minHeight: 52, borderRadius: 14, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  primary: { backgroundColor: palette.citrus, borderColor: palette.citrus },
  secondary: { backgroundColor: palette.fern, borderColor: 'rgba(243,238,221,0.22)' },
  quiet: { backgroundColor: 'transparent', borderColor: 'rgba(180,198,181,0.48)' },
  buttonText: { color: palette.rainforest, fontSize: 15, fontWeight: '900' },
  quietText: { color: palette.limestone },
  focused: { borderColor: palette.citrus, borderWidth: 2 },
  pressed: { opacity: 0.76 },
  pressedMotion: { transform: [{ scale: 0.985 }] },
  pill: { alignSelf: 'flex-start', borderRadius: 99, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 5, color: palette.rainforest, fontSize: 10, fontWeight: '900', letterSpacing: 0.7, textTransform: 'uppercase' },
  inferredPill: { backgroundColor: palette.clay },
  confirmedPill: { backgroundColor: palette.citrus },
  section: { gap: 10, marginTop: 2 },
  sectionTitle: { color: palette.limestone, fontSize: 18, fontWeight: '900' },
});
