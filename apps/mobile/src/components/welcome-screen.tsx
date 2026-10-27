import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TravelHero } from '@/components/travel-hero';
import { Body, Eyebrow, Title, palette } from '@/components/ui';
import { appRoutes, openRoute } from '@/navigation/app-contract';

export function WelcomeScreen() {
  const router = useRouter();
  const [heroInView, setHeroInView] = useState(true);
  const [heroHeight, setHeroHeight] = useState(616);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        onScroll={(event) => setHeroInView(event.nativeEvent.contentOffset.y < heroHeight)}
        scrollEventThrottle={64}
        showsVerticalScrollIndicator={false}>
        <View onLayout={(event) => setHeroHeight(event.nativeEvent.layout.height)}>
          <TravelHero screenActive={heroInView} onStart={() => openRoute(router, appRoutes.trust)} />
        </View>
        <View style={styles.details}>
          <View style={styles.intro}>
            <Eyebrow>Private by design</Eyebrow>
            <Title>A lifetime of little “remember when?”</Title>
            <Body>Start with a private Atlas, revisit the chapters your available evidence supports, and choose what you want to share when you are ready.</Body>
          </View>
        </View>
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
