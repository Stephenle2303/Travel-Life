import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TravelHero } from '@/components/travel-hero';
import { ActionButton, Body, palette } from '@/components/ui';
import { appRoutes, openRoute } from '@/navigation/app-contract';
import { savePresentation } from '@/onboarding/presentation';

export function WelcomeScreen({ returnToAtlas = false }: { returnToAtlas?: boolean }) {
  const router = useRouter();
  const [heroInView, setHeroInView] = useState(true);
  const [heroHeight, setHeroHeight] = useState(616);

  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const begin = async () => {
    if (returnToAtlas) { openRoute(router, appRoutes.atlas, 'dismissTo'); return; }
    if (pending) return;
    setPending(true);
    try { await savePresentation('started'); openRoute(router, appRoutes.import); }
    catch { setMessage("Couldn't save your progress. Try again."); }
    finally { setPending(false); }
  };
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        onScroll={(event) => setHeroInView(event.nativeEvent.contentOffset.y < heroHeight)}
        scrollEventThrottle={64}
        showsVerticalScrollIndicator={false}>
        <View onLayout={(event) => setHeroHeight(event.nativeEvent.layout.height)}>
          <TravelHero screenActive={heroInView} onStart={() => void begin()} startLabel={returnToAtlas ? 'View my Atlas' : 'Explore my travel life'} />
        </View>
        {pending && <Body>Opening photo choices…</Body>}
        {message && <Body>{message}</Body>}
        {process.env.EXPO_PUBLIC_TRAVEL_LIFE_ACCOUNT_ENABLED === 'true' && <ActionButton accessibilityLabel="Already have an account? Sign in" onPress={() => openRoute(router, appRoutes.account)} variant="secondary">Already have an account? Sign in</ActionButton>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.rainforest },
  content: { width: '100%', maxWidth: 1120, alignSelf: 'center', padding: 12, paddingBottom: 44, gap: 28 },
  details: { flexDirection: 'row', flexWrap: 'wrap', gap: 24, paddingHorizontal: 8 },
  intro: { flexGrow: 1, flexBasis: 300, gap: 14 },
});
