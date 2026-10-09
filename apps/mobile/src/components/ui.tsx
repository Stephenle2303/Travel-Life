import { useEffect, useState, type PropsWithChildren } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const palette = {
  rainforest: '#102C26',
  fern: '#21483B',
  limestone: '#F3EEDD',
  sage: '#B4C6B5',
  citrus: '#D8EF69',
  clay: '#D98763',
} as const;

export function useReducedMotion(): boolean {
  // Treat an unknown operating-system preference as reduced motion until the
  // asynchronous accessibility query resolves. This avoids an initial burst of
  // motion for people who have opted out of it.
  const [reduced, setReduced] = useState(true);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduced(enabled);
      })
      .catch(() => {
        if (mounted) setReduced(true);
      });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}

export function Screen({ children }: PropsWithChildren) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function InsetPanel({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

export function Eyebrow({ children }: PropsWithChildren) {
  return <Text style={styles.eyebrow}>{children}</Text>;
}

export function Title({ children }: PropsWithChildren) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Body({ children, style }: PropsWithChildren<{ style?: StyleProp<TextStyle> }>) {
  return <Text style={[styles.body, style]}>{children}</Text>;
}

export function ActionButton({
  children,
  onPress,
  accessibilityLabel,
  variant = 'primary',
  disabled = false,
}: PropsWithChildren<{
  onPress: () => void;
  accessibilityLabel?: string;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}>) {
  const [focused, setFocused] = useState(false);
  const reducedMotion = useReducedMotion();

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' ? styles.primaryButton : styles.secondaryButton,
        focused && styles.focused,
        disabled && styles.disabled,
        pressed && styles.pressed,
        getPressedMotionStyle(pressed, reducedMotion),
      ]}>
      <Text style={[styles.buttonText, variant === 'secondary' && styles.secondaryButtonText]}>{children}</Text>
    </Pressable>
  );
}

/** Keeps pressed feedback deterministic and inspectable without animating for reduced-motion owners. */
export function getPressedMotionStyle(pressed: boolean, reducedMotion: boolean) {
  return pressed && !reducedMotion ? styles.pressedMotion : false;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.rainforest },
  screen: { flexGrow: 1, gap: 18, justifyContent: 'center', padding: 20, paddingBottom: 44, width: '100%', maxWidth: 640, alignSelf: 'center' },
  panel: { gap: 14, padding: 20, borderRadius: 20, backgroundColor: palette.fern, borderWidth: 1, borderColor: 'rgba(243,238,221,0.18)', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, elevation: 2 },
  eyebrow: { color: palette.citrus, fontSize: 11, fontWeight: '900', letterSpacing: 1.5, textTransform: 'uppercase' },
  title: { color: palette.limestone, fontSize: 38, lineHeight: 43, fontWeight: '900', letterSpacing: -1.2 },
  body: { color: palette.sage, fontSize: 16, lineHeight: 24 },
  button: { minHeight: 54, paddingHorizontal: 18, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  primaryButton: { backgroundColor: palette.citrus, borderColor: palette.citrus },
  secondaryButton: { backgroundColor: 'transparent', borderColor: 'rgba(243,238,221,0.42)' },
  buttonText: { color: palette.rainforest, fontSize: 16, fontWeight: '900' },
  secondaryButtonText: { color: palette.limestone },
  focused: { borderColor: palette.citrus, borderWidth: 3 },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.78 },
  pressedMotion: { transform: [{ scale: 0.985 }] },
});
