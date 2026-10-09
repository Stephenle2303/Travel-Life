import { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo, AppState, Image, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { heroPlaybackPolicy, type MotionPreference, type PlaybackIntent } from '@/data/hero-playback';
import { HeroVideo } from '@/components/hero-video';
import { palette } from '@/components/ui';

const poster = require('../../assets/synthetic/hero/poster.jpg');
const portrait = require('../../assets/video/travel-hero-portrait.mp4');
const wide = require('../../assets/video/travel-hero-wide.mp4');

function useHeroEnvironment() {
  const [motionPreference, setMotionPreference] = useState<MotionPreference>('unknown');
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const [pageVisible, setPageVisible] = useState(Platform.OS !== 'web');

  useEffect(() => {
    const lifecycle = AppState.addEventListener('change', (state) => setAppActive(state === 'active'));
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const media = window.matchMedia('(prefers-reduced-motion: reduce)');
      const updateMotion = () => setMotionPreference(media.matches ? 'reduced' : 'full');
      const updateVisibility = () => setPageVisible(document.visibilityState === 'visible');
      updateMotion();
      updateVisibility();
      media.addEventListener('change', updateMotion);
      document.addEventListener('visibilitychange', updateVisibility);
      return () => { lifecycle.remove(); media.removeEventListener('change', updateMotion); document.removeEventListener('visibilitychange', updateVisibility); };
    }
    let mounted = true;
    let preferenceChanged = false;
    const updateMotion = (reduced: boolean) => setMotionPreference(reduced ? 'reduced' : 'full');
    // Unknown or failed accessibility lookup stays static until preference resolves.
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => { if (mounted && !preferenceChanged) updateMotion(reduced); }).catch(() => { if (mounted && !preferenceChanged) setMotionPreference('reduced'); });
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', (reduced) => { preferenceChanged = true; updateMotion(reduced); });
    return () => { mounted = false; motion.remove(); lifecycle.remove(); };
  }, []);

  return { motionPreference, appActive, pageVisible };
}

export function TravelHero({ onStart, screenActive = true }: { onStart: () => void; screenActive?: boolean }) {
  const { width } = useWindowDimensions();
  const desktop = width >= 900;
  const environment = useHeroEnvironment();
  const [intent, setIntent] = useState<PlaybackIntent>('auto');
  const [mediaFailed, setMediaFailed] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [focused, setFocused] = useState(false);
  const shouldPlay = screenActive && heroPlaybackPolicy({ ...environment, intent, mediaFailed, autoplayBlocked });
  const handleBlocked = useCallback(() => { setAutoplayBlocked(true); setIntent('pause'); setPlaying(false); }, []);
  const handleFailed = useCallback(() => { setMediaFailed(true); setPlaying(false); }, []);
  const handlePlaying = useCallback((value: boolean) => { setPlaying(value); if (value) setAutoplayBlocked(false); }, []);
  const togglePlayback = () => setIntent(shouldPlay ? 'pause' : 'play');

  return <View testID="travel-memory-hero" style={[styles.hero, desktop && styles.heroWide]}>
    <Image source={poster} accessibilityLabel="Fictional sunlit beach, part of the synthetic travel montage" style={StyleSheet.absoluteFill} resizeMode="cover" />
    {!mediaFailed && <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: shouldPlay && playing ? 1 : 0 }]}><HeroVideo source={desktop ? wide : portrait} shouldPlay={shouldPlay} onPlaying={handlePlaying} onBlocked={handleBlocked} onFailed={handleFailed} /></View>}
    <View style={styles.topline}>
      <View style={styles.stamp}><Text style={styles.stampStar}>✳</Text><View><Text style={styles.brand}>TRAVEL LIFE</Text><Text style={styles.stampText}>A WORLD OF MOMENTS</Text></View></View>
      <Pressable accessibilityRole="button" accessibilityLabel={shouldPlay ? 'Pause travel montage' : 'Play travel montage'} accessibilityState={{ disabled: mediaFailed || environment.motionPreference === 'unknown' }} disabled={mediaFailed || environment.motionPreference === 'unknown'} onPress={togglePlayback} style={({ pressed }) => [styles.motionButton, pressed && styles.pressed, pressed && environment.motionPreference === 'full' && styles.pressedMotion]}><Text style={styles.motionIcon}>{shouldPlay ? 'Ⅱ' : '▷'}</Text><Text style={styles.motionText}>{mediaFailed ? 'Still view' : shouldPlay ? 'Pause' : 'Play'}</Text></Pressable>
    </View>
    <LinearGradient pointerEvents="none" colors={['rgba(9,32,28,0)', 'rgba(9,32,28,0.54)', 'rgba(9,32,28,0.94)']} locations={[0, 0.37, 1]} style={[styles.scrim, desktop && styles.scrimWide]} />
    <View style={[styles.content, desktop && styles.contentWide]}>
      <Text style={styles.kicker}>YOUR LIFE, A LITTLE MORE WANDERFUL</Text>
      <Text accessibilityRole="header" style={[styles.title, desktop && styles.titleWide]}>Your travels.{ '\n' }<Text style={styles.alive}>Alive again.</Text></Text>
      <Text style={[styles.body, desktop && styles.bodyWide]}>Rediscover the places, people, and moments tucked inside your photos.</Text>
      <View style={[styles.footer, desktop && styles.footerWide]}>
        <View style={styles.startGroup}><Pressable accessibilityRole="button" onPress={onStart} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={({ pressed }) => [styles.startButton, focused && styles.focused, pressed && styles.pressed, pressed && environment.motionPreference === 'full' && styles.pressedMotion]}><Text style={styles.startText}>Set up private reveal</Text><Text style={styles.startArrow}>↗</Text></Pressable><Text style={styles.privateNote}>Yours to explore. Yours to share.</Text></View>
        <Text style={[styles.demoNote, desktop && styles.demoNoteWide]}>Synthetic demo imagery{mediaFailed ? '\nVideo unavailable · still view' : autoplayBlocked ? '\nMotion paused · play to retry' : '\nA little glimpse of what’s possible'}</Text>
      </View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  hero: { minHeight: 616, borderRadius: 24, overflow: 'hidden', justifyContent: 'flex-end', backgroundColor: '#2EA7A5' },
  heroWide: { minHeight: 650, borderRadius: 28 },
  topline: { position: 'absolute', top: 20, left: 20, right: 20, zIndex: 2, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  stamp: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(10,38,33,0.76)', borderRadius: 99, paddingVertical: 8, paddingHorizontal: 11, flexShrink: 1 },
  stampStar: { color: palette.clay, fontSize: 19, lineHeight: 22 },
  brand: { color: palette.limestone, fontSize: 11, fontWeight: '900', letterSpacing: 1.3, marginBottom: 2 },
  stampText: { color: palette.limestone, fontSize: 8, fontWeight: '800', letterSpacing: 1.2, flexShrink: 1 },
  motionButton: { minWidth: 76, minHeight: 44, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: 'rgba(10,38,33,0.76)', borderRadius: 99, borderWidth: 1, borderColor: 'rgba(243,238,221,0.5)' },
  motionIcon: { color: palette.limestone, fontSize: 18, fontWeight: '800' },
  motionText: { color: palette.limestone, fontSize: 11, fontWeight: '800' },
  scrim: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 420 },
  scrimWide: { height: 490 },
  content: { padding: 24, paddingTop: 94, gap: 12 },
  contentWide: { padding: 44, paddingTop: 92, gap: 16 },
  kicker: { fontSize: 9, letterSpacing: 1.6, fontWeight: '900', color: '#F1AD8B' },
  title: { fontSize: 46, lineHeight: 47, letterSpacing: -1.8, fontWeight: '900', color: palette.limestone },
  titleWide: { fontSize: 78, lineHeight: 79, letterSpacing: -3.2 },
  alive: { color: palette.limestone },
  body: { maxWidth: 305, color: '#FFF9EB', fontSize: 16, lineHeight: 24 },
  bodyWide: { maxWidth: 430, fontSize: 18, lineHeight: 27 },
  footer: { gap: 18, marginTop: 10 },
  footerWide: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24, marginTop: 14 },
  startGroup: { gap: 9, maxWidth: 330, width: '100%' },
  startButton: { minHeight: 56, paddingHorizontal: 20, backgroundColor: palette.citrus, borderRadius: 15, borderWidth: 2, borderColor: palette.citrus, flexDirection: 'row', gap: 18, justifyContent: 'space-between', alignItems: 'center' },
  startText: { color: palette.rainforest, fontSize: 15, fontWeight: '900', flexShrink: 1 },
  startArrow: { color: palette.rainforest, fontSize: 25, lineHeight: 28 },
  privateNote: { color: '#F3EEDD', fontSize: 11, textAlign: 'center' },
  demoNote: { color: '#F3EEDD', fontSize: 10, lineHeight: 16, opacity: 0.9 },
  demoNoteWide: { textAlign: 'right' },
  focused: { borderColor: palette.limestone },
  pressed: { opacity: 0.75 },
  pressedMotion: { transform: [{ scale: 0.985 }] },
});
